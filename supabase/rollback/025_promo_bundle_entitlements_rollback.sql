-- Rollback 025_promo_bundle_entitlements.sql.
--
-- Mengembalikan klaim ke perilaku 023 dan melepas penjagaan hak profil.
-- Tabel dan kolom baru (promo_packages, promo_grants, profile_slug_history,
-- bundle_id, promo_package_id, unlocked_templates, feature_grants) sengaja
-- TIDAK dihapus supaya datanya aman; kode lama tidak membacanya.
-- Setelah ini, kembalikan kode aplikasi ke commit sebelum cabang
-- feat/nfc-promo-bundle.
--
-- Catatan: aturan lama tier_configs (semua pengguna login bisa mengubah) TIDAK
-- dipulihkan karena itu celah keamanan.

BEGIN;

DROP TRIGGER IF EXISTS nfc_guard_profile_entitlements ON public.profiles;
DROP FUNCTION IF EXISTS public.nfc_guard_profile_entitlements();
DROP TRIGGER IF EXISTS nfc_record_slug_history ON public.profiles;
DROP FUNCTION IF EXISTS public.nfc_record_slug_history();
DROP FUNCTION IF EXISTS public.nfc_resolve_old_slug(text);
DROP FUNCTION IF EXISTS public.nfc_admin_set_bundle(uuid[], boolean);
DROP FUNCTION IF EXISTS public.nfc_after_claim(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.nfc_apply_promo(uuid, uuid);
DROP FUNCTION IF EXISTS public.nfc_promo_for_serial(uuid);
DROP FUNCTION IF EXISTS public.nfc_ensure_profile(uuid);
DROP FUNCTION IF EXISTS public.nfc_log_claim(uuid, uuid);
DROP FUNCTION IF EXISTS public.nfc_json_array(jsonb);

-- Klaim versi 023
CREATE OR REPLACE FUNCTION public.nfc_claim_serial(p_serial_uuid text, p_new_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_id uuid;
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

        UPDATE public.serial_numbers
        SET is_claimed = true,
            owner_id = p_new_user_id,
            claimed_at = now()
        WHERE serial_uuid::text = lower(btrim(p_serial_uuid))
          AND is_claimed IS NOT TRUE
          AND owner_id IS NULL
        RETURNING id INTO v_id;

        IF v_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Serial not found or already claimed');
        END IF;
        RETURN jsonb_build_object('success', true, 'serial_id', v_id);
    END IF;

    UPDATE public.serial_numbers
    SET is_claimed = true,
        owner_id = v_uid,
        claimed_at = coalesce(claimed_at, now())
    WHERE serial_uuid::text = lower(btrim(p_serial_uuid))
      AND (is_claimed IS NOT TRUE OR owner_id = v_uid)
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Serial not found or already claimed');
    END IF;
    RETURN jsonb_build_object('success', true, 'serial_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.nfc_claim_serial(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nfc_claim_serial(text, uuid) TO anon, authenticated;

-- claim_serial_number tidak ada di produksi sebelum 025 (dibuat 025 sebagai
-- jalur kompatibilitas), jadi dihapus lagi.
DROP FUNCTION IF EXISTS public.claim_serial_number(uuid, uuid);

-- Kado versi 023
CREATE OR REPLACE FUNCTION public.nfc_mark_gift_opened(p_serial_uuid text)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
    UPDATE public.serial_numbers
    SET gift_opened_at = now()
    WHERE serial_uuid::text = lower(btrim(p_serial_uuid))
      AND gift_opened_at IS NULL
      AND gift_enabled IS TRUE
      AND coalesce(btrim(gift_url), '') <> '';
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

    UPDATE public.serial_numbers
    SET gift_enabled = true,
        gift_url = btrim(coalesce(p_url, '')),
        gift_message = nullif(btrim(coalesce(p_message, '')), ''),
        gift_from = nullif(btrim(coalesce(p_from, '')), '')
    WHERE gift_token = p_token
      AND gift_opened_at IS NULL
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gift link is invalid or already opened');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
