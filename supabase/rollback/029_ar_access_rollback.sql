-- Rollback 029: kembalikan penjaga profil versi 025. Kolom ar_access
-- dibiarkan (kode lama tidak membacanya); hapus manual kalau perlu.

BEGIN;

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
$function$;

COMMIT;
