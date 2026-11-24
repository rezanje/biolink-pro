-- 023: Fungsi publik NFC (bagian A dari perbaikan akses data NFC, audit
-- teknologi 23 Nov 2026, P0).
--
-- Hanya MENAMBAH fungsi; tidak mengubah aturan akses apa pun. Aman dijalankan
-- sebelum kode baru dirilis. Kode baru (tap, kado, isian kado, klaim) memakai
-- fungsi ini. Penguncian ada di 024_lock_nfc_data_access.sql, dijalankan
-- SETELAH kode baru live.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Fungsi bantu peran (dipakai di aturan akses)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nfc_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role::text = 'super_admin'
    );
$$;

-- Penonton satu perusahaan dengan pemilik nomor seri (anggota atau admin).
CREATE OR REPLACE FUNCTION public.nfc_shares_company_with(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p_owner IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.profiles me
        JOIN public.profiles owner_profile ON owner_profile.company_id = me.company_id
        WHERE me.user_id = auth.uid()
          AND me.company_id IS NOT NULL
          AND owner_profile.user_id = p_owner
    );
$$;

CREATE OR REPLACE FUNCTION public.nfc_is_company_admin_for(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p_owner IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.profiles me
        JOIN public.profiles owner_profile ON owner_profile.company_id = me.company_id
        WHERE me.user_id = auth.uid()
          AND me.role::text = 'company_admin'
          AND me.company_id IS NOT NULL
          AND owner_profile.user_id = p_owner
    );
$$;

CREATE OR REPLACE FUNCTION public.nfc_is_company_admin_of(p_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p_company IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
          AND role::text = 'company_admin'
          AND company_id = p_company
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Fungsi untuk halaman publik dan klaim
-- ---------------------------------------------------------------------------

-- Data satu nomor seri untuk halaman tap/kado. Tanpa gift_token.
CREATE OR REPLACE FUNCTION public.nfc_get_serial(p_serial_uuid text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT (to_jsonb(s) - 'gift_token')
           || jsonb_build_object('products', to_jsonb(p))
    FROM public.serial_numbers s
    LEFT JOIN public.products p ON p.id = s.product_id
    WHERE s.serial_uuid::text = lower(btrim(p_serial_uuid))
    LIMIT 1;
$$;

-- Tandai kado sudah dibuka. Hanya sekali, dan hanya kalau kadonya ada.
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

-- Klaim nomor seri. Tidak bisa merebut nomor seri yang sudah dimiliki orang
-- lain.
--
-- Pemanggil yang login: diklaim untuk dirinya sendiri (p_new_user_id
-- diabaikan).
-- Pendaftar email baru: konfirmasi email aktif, jadi sesinya belum ada saat
-- mengklaim dari halaman tap. Supaya alur itu tetap jalan, p_new_user_id
-- diterima hanya untuk akun yang dibuat <= 15 menit lalu dan emailnya belum
-- dikonfirmasi, dan hanya untuk nomor seri yang belum diklaim.
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

-- Halaman isian kado milik pembeli (akses dengan token rahasia).
CREATE OR REPLACE FUNCTION public.nfc_get_gift_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'id', s.id,
        'serial_uuid', s.serial_uuid,
        'gift_url', s.gift_url,
        'gift_message', s.gift_message,
        'gift_from', s.gift_from,
        'gift_opened_at', s.gift_opened_at,
        'is_claimed', s.is_claimed
    )
    FROM public.serial_numbers s
    WHERE coalesce(p_token, '') <> '' AND s.gift_token = p_token
    LIMIT 1;
$$;

-- Simpan isian kado. Ditolak kalau kado sudah dibuka penerimanya.
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

REVOKE ALL ON FUNCTION public.nfc_get_serial(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_mark_gift_opened(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_claim_serial(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_get_gift_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfc_save_gift(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nfc_get_serial(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_mark_gift_opened(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_claim_serial(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_get_gift_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_save_gift(text, text, text, text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.nfc_is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_shares_company_with(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_is_company_admin_for(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfc_is_company_admin_of(uuid) TO anon, authenticated;

COMMIT;
