-- 029: Uji coba hologram AR per akun, diatur dari dashboard admin.
-- Butuh 025. Kode aplikasi (feat/ar-hologram) ikut dirilis bersamaan.
--
--   profiles.ar_access:
--     'off'     hologram mati (bawaan)
--     'preview' hanya pemilik kartu yang sedang login (uji pribadi)
--     'pilot'   semua yang memindai kartu itu bisa melihat hologram
--   Hanya super admin / server yang bisa mengubahnya (penjaga 025 diperluas).
--
-- Rollback: supabase/rollback/029_ar_access_rollback.sql

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ar_access text NOT NULL DEFAULT 'off';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ar_access_check') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_ar_access_check CHECK (ar_access IN ('off', 'preview', 'pilot'));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.nfc_guard_profile_entitlements()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') OR public.nfc_is_super_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.tier := 'FREE';
        NEW.subscription_valid_until := NULL;
        NEW.special_edition := NULL;
        NEW.special_editions := '[]'::jsonb;
        NEW.unlocked_templates := '{}';
        NEW.feature_grants := '{}';
        NEW.ar_access := 'off';
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
    NEW.ar_access := OLD.ar_access;

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
$function$;

COMMIT;
