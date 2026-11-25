-- 028: Batasi siapa yang bisa membaca tabel profiles.
-- Butuh 023–026 sudah jalan. Kode aplikasi cabang fix/profile-read-scope
-- harus live LEBIH DULU (membaca kartu publik lewat fungsi di bawah); fungsi
-- di bagian 1–2 aman dipasang sebelum kode itu dirilis.
--
-- Sebelumnya: kebijakan "Public profiles are viewable by everyone" membuat
-- siapa pun (tanpa login) bisa mengambil SEMUA kolom SEMUA profil sekaligus,
-- termasuk role admin, tag internal, tier, dan hak fitur.
--
-- Setelah migrasi ini:
--   * tabel profiles hanya bisa dibaca pemiliknya, admin perusahaannya, dan
--     super admin;
--   * kartu publik dibaca lewat nfc_public_profile* (satu profil per panggilan,
--     tanpa role / user_tag / feature_grants; profil privat hanya untuk
--     pemiliknya);
--   * kartu tersimpan, cek link tersedia, dan kebijakan concierge / simpan
--     kartu memakai fungsi khusus, bukan baca tabel langsung.
--
-- Satu transaksi. Rollback: supabase/rollback/028_profile_read_scope_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Fungsi baca kartu publik
-- ---------------------------------------------------------------------------

-- Boleh dilihat publik: profil publik, atau pemiliknya sendiri, atau super admin.
CREATE OR REPLACE FUNCTION public.nfc_profile_visible(p_is_public boolean, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p_is_public IS DISTINCT FROM false
        OR (auth.uid() IS NOT NULL AND p_user_id = auth.uid())
        OR public.nfc_is_super_admin();
$$;

CREATE OR REPLACE FUNCTION public.nfc_public_profile(p_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT to_jsonb(p) - 'role' - 'user_tag' - 'feature_grants'
    FROM public.profiles p
    WHERE p.slug = lower(btrim(coalesce(p_slug, '')))
      AND public.nfc_profile_visible(p.is_public, p.user_id)
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.nfc_public_profile_by_owner(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT to_jsonb(p) - 'role' - 'user_tag' - 'feature_grants'
    FROM public.profiles p
    WHERE p.user_id = p_user_id
      AND public.nfc_profile_visible(p.is_public, p.user_id)
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.nfc_public_profile_by_id(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT to_jsonb(p) - 'role' - 'user_tag' - 'feature_grants'
    FROM public.profiles p
    WHERE p.id = p_id
      AND public.nfc_profile_visible(p.is_public, p.user_id)
    LIMIT 1;
$$;

-- Untuk kebijakan tabel lain (concierge, simpan kartu).
CREATE OR REPLACE FUNCTION public.nfc_profile_is_public(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_id AND p.is_public IS DISTINCT FROM false);
$$;

-- Kartu yang disimpan pengguna yang sedang login, dengan ringkasan profilnya.
CREATE OR REPLACE FUNCTION public.nfc_saved_profile_cards()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'profile_id', s.profile_id,
        'folder_id', s.folder_id,
        'created_at', s.created_at,
        'profile', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
            'slug', p.slug, 'display_name', p.display_name, 'company', p.company,
            'job_title', p.job_title, 'avatar_url', p.avatar_url) END
    ) ORDER BY s.created_at DESC), '[]'::jsonb)
    FROM public.saved_profiles s
    LEFT JOIN public.profiles p ON p.id = s.profile_id AND p.is_public IS DISTINCT FROM false
    WHERE auth.uid() IS NOT NULL AND s.user_id = auth.uid();
$$;

-- Link profil belum dipakai orang lain.
CREATE OR REPLACE FUNCTION public.nfc_slug_available(p_slug text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.slug = lower(btrim(coalesce(p_slug, '')))
          AND p.user_id IS DISTINCT FROM auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.nfc_profile_visible(boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_public_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_public_profile_by_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_public_profile_by_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_profile_is_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_saved_profile_cards() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nfc_slug_available(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.nfc_profile_visible(boolean, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_public_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_public_profile_by_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_public_profile_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_profile_is_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_saved_profile_cards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_slug_available(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kebijakan tabel lain yang tadinya membaca profiles langsung
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF to_regclass('public.ai_concierge_settings') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Public reads enabled concierge settings" ON public.ai_concierge_settings;
        CREATE POLICY "Public reads enabled concierge settings" ON public.ai_concierge_settings
            FOR SELECT USING (enabled AND public.nfc_profile_is_public(profile_id));
    END IF;
    IF to_regclass('public.ai_concierge_messages') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Public writes concierge messages" ON public.ai_concierge_messages;
        CREATE POLICY "Public writes concierge messages" ON public.ai_concierge_messages
            FOR INSERT WITH CHECK (public.nfc_profile_is_public(profile_id));
    END IF;
    IF to_regclass('public.saved_profiles') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Members save public profiles" ON public.saved_profiles;
        CREATE POLICY "Members save public profiles" ON public.saved_profiles
            FOR INSERT WITH CHECK (user_id = auth.uid() AND public.nfc_profile_is_public(profile_id));
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. profiles: tutup baca publik
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS nfc_profiles_admin_read ON public.profiles;
CREATE POLICY nfc_profiles_admin_read ON public.profiles
    FOR SELECT TO authenticated
    USING (public.nfc_is_super_admin() OR (company_id IS NOT NULL AND public.nfc_is_company_admin_of(company_id)));

COMMIT;
