-- Rollback 028: buka lagi baca publik tabel profiles (kondisi sebelum 028).
-- Catatan: ini membuka lagi celah lama (semua kolom semua profil terbaca
-- publik). Pakai hanya kalau kartu publik rusak dan tidak bisa diperbaiki maju.
-- Fungsi nfc_public_profile* dibiarkan (dipakai kode baru, tidak berbahaya).

BEGIN;

DROP POLICY IF EXISTS nfc_profiles_admin_read ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DO $$
BEGIN
    IF to_regclass('public.ai_concierge_settings') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Public reads enabled concierge settings" ON public.ai_concierge_settings;
        CREATE POLICY "Public reads enabled concierge settings" ON public.ai_concierge_settings
            FOR SELECT USING (enabled AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = ai_concierge_settings.profile_id AND p.is_public IS DISTINCT FROM false));
    END IF;
    IF to_regclass('public.ai_concierge_messages') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Public writes concierge messages" ON public.ai_concierge_messages;
        CREATE POLICY "Public writes concierge messages" ON public.ai_concierge_messages
            FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = ai_concierge_messages.profile_id AND p.is_public IS DISTINCT FROM false));
    END IF;
    IF to_regclass('public.saved_profiles') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Members save public profiles" ON public.saved_profiles;
        CREATE POLICY "Members save public profiles" ON public.saved_profiles
            FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = saved_profiles.profile_id AND p.is_public IS DISTINCT FROM false));
    END IF;
END $$;

COMMIT;
