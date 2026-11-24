-- 025: Paket promo, aktivasi bundel sekali, dan kunci hak Premium.
-- Butuh 023 dan 024 sudah jalan, dan kode aplikasi cabang
-- feat/nfc-promo-bundle ikut dirilis bersamaan.
--
-- Sebelumnya:
--   * pemilik profil bisa mengubah tier, masa berlaku Premium, dan edisi
--     spesialnya sendiri langsung lewat kunci publik situs;
--   * semua pengguna yang login bisa mengubah tabel fitur per tier
--     (tier_configs);
--   * Premium 30 hari ditulis oleh browser saat klaim, dan alur klaim lewat
--     email/password menimpa profil lama (slug, nama, bio) saat klaim
--     perangkat kedua;
--   * jam dan kartu dalam satu paket harus diklaim satu per satu;
--   * kado wajib punya link; ucapan saja tidak tampil.
--
-- Setelah migrasi ini:
--   * tier, subscription_valid_until, special_edition(s), unlocked_templates,
--     dan feature_grants hanya bisa diubah super admin atau server. Perubahan
--     dari pengguna biasa diabaikan diam-diam (supaya klien lama tidak rusak).
--   * tier_configs hanya bisa diubah super admin.
--   * Ganti slug oleh pengguna biasa butuh Premium aktif (atau B2B) dan tidak
--     boleh memakai nama yang dicadangkan. Slug lama dicatat supaya
--     my.gentanala.com/<slug-lama> tetap diarahkan ke profil yang sama.
--   * nfc_claim_serial membuat profil kalau belum ada (tanpa menimpa profil
--     lama), ikut mengklaim semua nomor seri di bundel yang sama, menggabung
--     edisi spesial, dan memberi hak paket promo yang berlaku.
--   * Paket promo (promo_packages) diatur super admin: on/off, periode,
--     Premium N hari / tanpa batas, template eksklusif, dan fitur tambahan.
--     Mematikan paket hanya menghentikan pemberian baru; hak yang sudah
--     diberikan tetap.
--
-- Satu transaksi. Rollback: supabase/rollback/025_promo_bundle_entitlements_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Kolom baru
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlocked_templates text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS feature_grants text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.promo_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    description text,
    is_active boolean NOT NULL DEFAULT false,
    applies_to_all boolean NOT NULL DEFAULT false,
    starts_at timestamptz,
    ends_at timestamptz,
    premium_mode text NOT NULL DEFAULT 'none' CHECK (premium_mode IN ('none', 'days', 'unlimited')),
    premium_days integer CHECK (premium_days IS NULL OR premium_days BETWEEN 1 AND 3650),
    templates text[] NOT NULL DEFAULT '{}',
    features text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (premium_mode <> 'days' OR premium_days IS NOT NULL),
    CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

ALTER TABLE public.serial_numbers ADD COLUMN IF NOT EXISTS bundle_id uuid;
ALTER TABLE public.serial_numbers ADD COLUMN IF NOT EXISTS promo_package_id uuid
    REFERENCES public.promo_packages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_serial_numbers_bundle_id ON public.serial_numbers(bundle_id) WHERE bundle_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.promo_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id uuid REFERENCES public.promo_packages(id) ON DELETE SET NULL,
    package_name text NOT NULL,
    user_id uuid NOT NULL,
    serial_id uuid UNIQUE,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_grants_user ON public.promo_grants(user_id);

CREATE TABLE IF NOT EXISTS public.profile_slug_history (
    old_slug text PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    changed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Akses tabel baru
-- ---------------------------------------------------------------------------

ALTER TABLE public.promo_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_slug_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promo_packages, public.promo_grants, public.profile_slug_history FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_packages TO authenticated;
GRANT SELECT ON public.promo_grants TO authenticated;
REVOKE ALL ON public.profile_slug_history FROM authenticated;

DROP POLICY IF EXISTS nfc_promo_packages_admin ON public.promo_packages;
CREATE POLICY nfc_promo_packages_admin ON public.promo_packages
    FOR ALL TO authenticated
    USING (public.nfc_is_super_admin())
    WITH CHECK (public.nfc_is_super_admin());

DROP POLICY IF EXISTS nfc_promo_grants_read ON public.promo_grants;
CREATE POLICY nfc_promo_grants_read ON public.promo_grants
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.nfc_is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. tier_configs: hanya super admin yang boleh mengubah
-- ---------------------------------------------------------------------------

DO $$
DECLARE pol record;
BEGIN
    IF to_regclass('public.tier_configs') IS NULL THEN RETURN; END IF;

    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'tier_configs' AND cmd <> 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.tier_configs', pol.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public.tier_configs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tier_configs FROM anon';
    EXECUTE 'CREATE POLICY nfc_tier_configs_admin_write ON public.tier_configs
                 FOR UPDATE TO authenticated
                 USING (public.nfc_is_super_admin())
                 WITH CHECK (public.nfc_is_super_admin())';
END $$;

-- ---------------------------------------------------------------------------
-- 4. Aturan slug
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nfc_is_reserved_slug(p_slug text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
    SELECT lower(btrim(coalesce(p_slug, ''))) = ANY (ARRAY[
        'admin', 'administrator', 'api', 'app', 'auth', 'activate', 'login', 'logout',
        'register', 'signup', 'signin', 'dashboard', 'company', 'tap', 'gift', 'kado',
        'switch', 'get-started', 'customize', 'privacy', 'terms', 'legal', 'help',
        'support', 'about', 'contact', 'settings', 'account', 'billing', 'checkout',
        'shop', 'store', 'gentanala', 'gentanala-official', 'official', 'www', 'mail',
        'static', 'assets', 'public', 'images', 'favicon', 'robots', 'sitemap',
        'manifest', 'sw', 'offline', 'null', 'undefined', 'root', 'system'
    ]) OR lower(btrim(coalesce(p_slug, ''))) LIKE 'gentanala-%';
$$;

-- Premium aktif: B2B selalu, PREMIUM selama belum lewat masa berlakunya.
CREATE OR REPLACE FUNCTION public.nfc_tier_is_active(p_tier text, p_valid_until timestamptz)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
    SELECT coalesce(p_tier, 'FREE') = 'B2B'
        OR (coalesce(p_tier, 'FREE') = 'PREMIUM' AND (p_valid_until IS NULL OR p_valid_until >= now()));
$$;

-- ---------------------------------------------------------------------------
-- 5. Jaga kolom hak akses profil
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER sengaja: current_user harus peran pemanggil. Fungsi
-- SECURITY DEFINER (klaim, admin) dan service role melewati penjagaan ini.
CREATE OR REPLACE FUNCTION public.nfc_guard_profile_entitlements()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') OR public.nfc_is_super_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.tier := 'FREE';
        NEW.subscription_valid_until := NULL;
        NEW.special_edition := NULL;
        NEW.special_editions := '{}';
        NEW.unlocked_templates := '{}';
        NEW.feature_grants := '{}';
        IF NEW.slug IS NOT NULL AND public.nfc_is_reserved_slug(NEW.slug) THEN
            RAISE EXCEPTION 'This profile URL is reserved' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    NEW.tier := OLD.tier;
    NEW.subscription_valid_until := OLD.subscription_valid_until;
    NEW.special_edition := OLD.special_edition;
    NEW.special_editions := OLD.special_editions;
    NEW.unlocked_templates := OLD.unlocked_templates;
    NEW.feature_grants := OLD.feature_grants;

    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        IF NOT public.nfc_tier_is_active(OLD.tier::text, OLD.subscription_valid_until) THEN
            RAISE EXCEPTION 'Changing the profile URL needs Premium' USING ERRCODE = '42501';
        END IF;
        IF NEW.slug IS NULL OR NEW.slug !~ '^[a-z0-9-]{3,40}$' THEN
            RAISE EXCEPTION 'Invalid profile URL' USING ERRCODE = '22023';
        END IF;
        IF public.nfc_is_reserved_slug(NEW.slug) THEN
            RAISE EXCEPTION 'This profile URL is reserved' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nfc_guard_profile_entitlements ON public.profiles;
CREATE TRIGGER nfc_guard_profile_entitlements
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.nfc_guard_profile_entitlements();

-- Catat slug lama untuk pengalihan. Berlaku untuk semua jalur (termasuk
-- server), jadi ditulis sebagai SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.nfc_record_slug_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF NEW.slug IS NOT NULL THEN
        DELETE FROM public.profile_slug_history WHERE old_slug = NEW.slug;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
        INSERT INTO public.profile_slug_history (old_slug, profile_id, changed_at)
        VALUES (OLD.slug, NEW.id, now())
        ON CONFLICT (old_slug) DO UPDATE SET profile_id = EXCLUDED.profile_id, changed_at = now();
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS nfc_record_slug_history ON public.profiles;
CREATE TRIGGER nfc_record_slug_history
    AFTER INSERT OR UPDATE OF slug ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.nfc_record_slug_history();

-- Halaman publik: slug lama -> slug sekarang (null kalau tidak ada).
CREATE OR REPLACE FUNCTION public.nfc_resolve_old_slug(p_slug text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p.slug
    FROM public.profile_slug_history h
    JOIN public.profiles p ON p.id = h.profile_id
    WHERE h.old_slug = lower(btrim(coalesce(p_slug, '')))
      AND p.slug IS DISTINCT FROM h.old_slug
      AND coalesce(p.is_public, true)
    LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 6. Profil dan hak saat klaim
-- ---------------------------------------------------------------------------

-- Buat profil kalau belum ada. Profil yang sudah ada tidak disentuh.
CREATE OR REPLACE FUNCTION public.nfc_ensure_profile(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_id uuid;
    v_email text;
    v_name text;
    v_base text;
    v_slug text;
    v_try int := 0;
BEGIN
    SELECT id INTO v_id FROM public.profiles WHERE user_id = p_user_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    SELECT u.email, nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
    INTO v_email, v_name
    FROM auth.users u WHERE u.id = p_user_id;

    v_base := left(regexp_replace(lower(split_part(coalesce(v_email, 'owner'), '@', 1)), '[^a-z0-9]', '', 'g'), 24);
    IF length(v_base) < 3 OR public.nfc_is_reserved_slug(v_base) THEN v_base := 'owner'; END IF;

    LOOP
        v_try := v_try + 1;
        v_slug := v_base || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = v_slug)
             AND NOT EXISTS (SELECT 1 FROM public.profile_slug_history WHERE old_slug = v_slug);
        IF v_try > 20 THEN
            v_slug := v_base || '-' || replace(gen_random_uuid()::text, '-', '');
            EXIT;
        END IF;
    END LOOP;

    INSERT INTO public.profiles (user_id, slug, display_name, bio, email, is_public, tier)
    VALUES (p_user_id, v_slug, coalesce(v_name, split_part(coalesce(v_email, 'Gentanala Owner'), '@', 1)),
            'Gentanala Owner', v_email, true, 'FREE')
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.profiles WHERE user_id = p_user_id;
    END IF;
    RETURN v_id;
END;
$$;

-- Paket yang berlaku untuk satu nomor seri: paket khusus seri itu kalau
-- aktif, kalau tidak paket "semua seri" aktif yang paling baru.
CREATE OR REPLACE FUNCTION public.nfc_promo_for_serial(p_serial_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p.id
    FROM public.promo_packages p
    LEFT JOIN public.serial_numbers s ON s.id = p_serial_id
    WHERE p.is_active
      AND (p.starts_at IS NULL OR p.starts_at <= now())
      AND (p.ends_at IS NULL OR p.ends_at > now())
      AND (p.id = s.promo_package_id OR p.applies_to_all)
    ORDER BY (p.id = s.promo_package_id) DESC NULLS LAST, p.created_at DESC
    LIMIT 1;
$$;

-- Beri hak paket ke pengguna, sekali per nomor seri. Tidak pernah menurunkan
-- hak yang sudah ada (B2B tetap B2B, tanpa batas tetap tanpa batas).
CREATE OR REPLACE FUNCTION public.nfc_apply_promo(p_user_id uuid, p_serial_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_pkg public.promo_packages%ROWTYPE;
    v_pkg_id uuid;
    v_prof record;
    v_until timestamptz;
    v_tier text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.promo_grants WHERE serial_id = p_serial_id) THEN
        RETURN NULL;
    END IF;

    v_pkg_id := public.nfc_promo_for_serial(p_serial_id);
    IF v_pkg_id IS NULL THEN RETURN NULL; END IF;
    SELECT * INTO v_pkg FROM public.promo_packages WHERE id = v_pkg_id;

    SELECT tier::text AS tier, subscription_valid_until INTO v_prof
    FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;

    v_tier := coalesce(v_prof.tier, 'FREE');
    v_until := v_prof.subscription_valid_until;

    IF v_tier <> 'B2B' AND v_pkg.premium_mode <> 'none' THEN
        IF v_pkg.premium_mode = 'unlimited' THEN
            v_until := NULL;
        ELSIF v_tier = 'PREMIUM' AND v_until IS NULL THEN
            v_until := NULL; -- sudah tanpa batas
        ELSE
            v_until := greatest(
                CASE WHEN v_tier = 'PREMIUM' THEN coalesce(v_until, now()) ELSE now() END,
                now()
            ) + make_interval(days => v_pkg.premium_days);
        END IF;
        v_tier := 'PREMIUM';
    END IF;

    IF v_tier = 'PREMIUM' THEN
        UPDATE public.profiles
        SET tier = 'PREMIUM', subscription_valid_until = v_until
        WHERE user_id = p_user_id;
    END IF;

    UPDATE public.profiles
    SET unlocked_templates = ARRAY(SELECT DISTINCT x FROM unnest(coalesce(unlocked_templates, '{}') || v_pkg.templates) x ORDER BY x),
        feature_grants = ARRAY(SELECT DISTINCT x FROM unnest(coalesce(feature_grants, '{}') || v_pkg.features) x ORDER BY x)
    WHERE user_id = p_user_id;

    INSERT INTO public.promo_grants (package_id, package_name, user_id, serial_id, details)
    VALUES (v_pkg.id, v_pkg.name, p_user_id, p_serial_id, jsonb_build_object(
        'premium_mode', v_pkg.premium_mode, 'premium_days', v_pkg.premium_days,
        'templates', v_pkg.templates, 'features', v_pkg.features, 'valid_until', v_until))
    ON CONFLICT (serial_id) DO NOTHING;

    RETURN jsonb_build_object('package', v_pkg.name, 'valid_until', v_until);
END;
$$;

-- Setelah nomor seri berpindah ke pemilik: klaim sisa bundel, pastikan
-- profil ada, gabung edisi spesial, beri hak paket promo.
CREATE OR REPLACE FUNCTION public.nfc_after_claim(p_user_id uuid, p_serial_id uuid, p_new_claim boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_bundle uuid;
    v_bundle_count int := 0;
    v_editions text[];
    v_promo jsonb;
    v_slug text;
BEGIN
    SELECT bundle_id INTO v_bundle FROM public.serial_numbers WHERE id = p_serial_id;

    IF v_bundle IS NOT NULL THEN
        WITH c AS (
            UPDATE public.serial_numbers
            SET is_claimed = true, owner_id = p_user_id, claimed_at = now()
            WHERE bundle_id = v_bundle AND id <> p_serial_id
              AND is_claimed IS NOT TRUE AND owner_id IS NULL
            RETURNING id
        ), l AS (
            INSERT INTO public.ownership_logs (serial_id, to_user_id, transfer_type)
            SELECT id, p_user_id, 'claim' FROM c
            RETURNING 1
        )
        SELECT count(*) INTO v_bundle_count FROM l;
    END IF;

    PERFORM public.nfc_ensure_profile(p_user_id);

    SELECT ARRAY(
        SELECT DISTINCT e FROM (
            SELECT unnest(coalesce(p.special_editions, '{}')) e FROM public.profiles p WHERE p.user_id = p_user_id
            UNION SELECT p.special_edition FROM public.profiles p WHERE p.user_id = p_user_id
            UNION SELECT unnest(coalesce(s.special_editions, '{}')) FROM public.serial_numbers s
                  WHERE s.id = p_serial_id OR (v_bundle IS NOT NULL AND s.bundle_id = v_bundle AND s.owner_id = p_user_id)
            UNION SELECT s.special_edition FROM public.serial_numbers s
                  WHERE s.id = p_serial_id OR (v_bundle IS NOT NULL AND s.bundle_id = v_bundle AND s.owner_id = p_user_id)
        ) t WHERE e IS NOT NULL AND e <> '' ORDER BY e
    ) INTO v_editions;

    IF cardinality(v_editions) > 0 THEN
        UPDATE public.profiles
        SET special_editions = v_editions,
            special_edition = coalesce(special_edition, v_editions[1])
        WHERE user_id = p_user_id;
    END IF;

    IF p_new_claim THEN
        v_promo := public.nfc_apply_promo(p_user_id, p_serial_id);
    END IF;
    SELECT slug INTO v_slug FROM public.profiles WHERE user_id = p_user_id;

    RETURN jsonb_build_object('bundle_claimed', v_bundle_count, 'promo', v_promo, 'slug', v_slug);
END;
$$;

-- Klaim nomor seri. Aturan siapa yang boleh mengklaim sama dengan 023.
CREATE OR REPLACE FUNCTION public.nfc_claim_serial(p_serial_uuid text, p_new_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_id uuid;
    v_new boolean := false;
    v_after jsonb;
BEGIN
    IF v_uid IS NULL THEN
        IF p_new_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM auth.users u
            WHERE u.id = p_new_user_id
              AND u.email_confirmed_at IS NULL
              AND u.created_at > now() - interval '15 minutes'
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
        END IF;
        v_uid := p_new_user_id;

        UPDATE public.serial_numbers
        SET is_claimed = true, owner_id = v_uid, claimed_at = now()
        WHERE serial_uuid::text = lower(btrim(p_serial_uuid))
          AND is_claimed IS NOT TRUE AND owner_id IS NULL
        RETURNING id INTO v_id;
        v_new := v_id IS NOT NULL;
    ELSE
        SELECT id INTO v_id FROM public.serial_numbers
        WHERE serial_uuid::text = lower(btrim(p_serial_uuid)) AND owner_id = v_uid AND is_claimed;

        IF v_id IS NULL THEN
            UPDATE public.serial_numbers
            SET is_claimed = true, owner_id = v_uid, claimed_at = now()
            WHERE serial_uuid::text = lower(btrim(p_serial_uuid))
              AND is_claimed IS NOT TRUE AND owner_id IS NULL
            RETURNING id INTO v_id;
            v_new := v_id IS NOT NULL;
        END IF;
    END IF;

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Serial not found or already claimed');
    END IF;

    IF v_new THEN
        INSERT INTO public.ownership_logs (serial_id, to_user_id, transfer_type)
        VALUES (v_id, v_uid, 'claim');
    END IF;

    v_after := public.nfc_after_claim(v_uid, v_id, v_new);
    RETURN jsonb_build_object('success', true, 'serial_id', v_id, 'new_claim', v_new) || v_after;
END;
$$;

-- Fungsi lama tetap ada untuk kompatibilitas, tapi lewat jalur yang sama.
CREATE OR REPLACE FUNCTION public.claim_serial_number(p_serial_uuid uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    RETURN public.nfc_claim_serial(p_serial_uuid::text, NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Admin: pasangkan / lepas bundel
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nfc_admin_set_bundle(p_serial_ids uuid[], p_pair boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_bundle uuid;
    v_owners int;
    v_n int;
BEGIN
    IF NOT public.nfc_is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
    IF p_serial_ids IS NULL OR cardinality(p_serial_ids) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pilih nomor seri');
    END IF;

    IF NOT p_pair THEN
        UPDATE public.serial_numbers SET bundle_id = NULL WHERE id = ANY (p_serial_ids);
        GET DIAGNOSTICS v_n = ROW_COUNT;
        RETURN jsonb_build_object('success', true, 'count', v_n);
    END IF;

    IF cardinality(p_serial_ids) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pilih minimal 2 nomor seri');
    END IF;

    SELECT count(DISTINCT owner_id) INTO v_owners
    FROM public.serial_numbers WHERE id = ANY (p_serial_ids) AND owner_id IS NOT NULL;
    IF v_owners > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nomor seri sudah dimiliki orang yang berbeda');
    END IF;

    v_bundle := gen_random_uuid();
    UPDATE public.serial_numbers SET bundle_id = v_bundle WHERE id = ANY (p_serial_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'count', v_n, 'bundle_id', v_bundle);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7b. Mode kado: ucapan saja (tanpa link) juga sah
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nfc_mark_gift_opened(p_serial_uuid text)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
    UPDATE public.serial_numbers
    SET gift_opened_at = now()
    WHERE serial_uuid::text = lower(btrim(p_serial_uuid))
      AND gift_opened_at IS NULL
      AND gift_enabled IS TRUE
      AND (coalesce(btrim(gift_url), '') <> '' OR coalesce(btrim(gift_message), '') <> '');
$$;

CREATE OR REPLACE FUNCTION public.nfc_save_gift(p_token text, p_url text, p_message text, p_from text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
    IF coalesce(p_token, '') = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid link');
    END IF;
    IF coalesce(btrim(p_url), '') = '' AND coalesce(btrim(p_message), '') = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gift needs a link or a message');
    END IF;

    UPDATE public.serial_numbers
    SET gift_enabled = true,
        gift_url = btrim(coalesce(p_url, '')),
        gift_message = nullif(left(btrim(coalesce(p_message, '')), 300), ''),
        gift_from = nullif(left(btrim(coalesce(p_from, '')), 80), '')
    WHERE gift_token = p_token
      AND gift_opened_at IS NULL
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gift link is invalid or already opened');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Hak eksekusi
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.nfc_ensure_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_promo_for_serial(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_apply_promo(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_after_claim(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_record_slug_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfc_claim_serial(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_serial_number(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nfc_admin_set_bundle(uuid[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nfc_resolve_old_slug(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.nfc_claim_serial(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_serial_number(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_admin_set_bundle(uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_resolve_old_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_is_reserved_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_tier_is_active(text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_mark_gift_opened(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_save_gift(text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Paket bawaan: sama dengan perilaku sekarang (Premium 30 hari tiap klaim)
-- ---------------------------------------------------------------------------

INSERT INTO public.promo_packages (name, description, is_active, applies_to_all, premium_mode, premium_days)
SELECT 'Trial standar', 'Premium 30 hari untuk setiap klaim yang tidak punya paket khusus.', true, true, 'days', 30
WHERE NOT EXISTS (SELECT 1 FROM public.promo_packages);

COMMIT;
