-- Rollback 024_lock_nfc_data_access.sql (bagian B). Fungsi dari 023 dibiarkan.
--
-- Langkah:
--   1. Jalankan file ini (menghapus aturan, trigger, dan fungsi baru).
--   2. Langsung jalankan restore_sql hasil supabase/rollback/024_lock_nfc_data_access_snapshot.sql yang disimpan
--      sebelum migrasi (mengembalikan aturan lama persis).
--   3. Kembalikan kode aplikasi ke commit sebelum perbaikan (revert di GitHub).
--
-- Catatan: langkah 2 mengembalikan juga celah lama. Pakai hanya kalau alur
-- pelanggan rusak dan tidak bisa diperbaiki maju.

BEGIN;

DROP TRIGGER IF EXISTS nfc_guard_profile_privileges ON public.profiles;
DROP FUNCTION IF EXISTS public.nfc_guard_profile_privileges();

DROP POLICY IF EXISTS nfc_serial_read ON public.serial_numbers;
DROP POLICY IF EXISTS nfc_serial_super_admin ON public.serial_numbers;
DROP POLICY IF EXISTS nfc_serial_company_admin ON public.serial_numbers;

DO $$
BEGIN
    IF to_regclass('public.companies') IS NOT NULL THEN
        DROP POLICY IF EXISTS nfc_company_super_admin ON public.companies;
        DROP POLICY IF EXISTS nfc_company_admin_update ON public.companies;
        DROP POLICY IF EXISTS nfc_company_public_read ON public.companies;
    END IF;
END $$;

-- Fungsi halaman publik dibiarkan ada (tidak berbahaya dan dipakai kode baru);
-- hapus hanya setelah kode aplikasi di-revert:
-- DROP FUNCTION IF EXISTS public.nfc_get_serial(text);
-- DROP FUNCTION IF EXISTS public.nfc_mark_gift_opened(text);
-- DROP FUNCTION IF EXISTS public.nfc_claim_serial(text, uuid);
-- DROP FUNCTION IF EXISTS public.nfc_get_gift_by_token(text);
-- DROP FUNCTION IF EXISTS public.nfc_save_gift(text, text, text, text);

COMMIT;

-- Lanjutkan dengan restore_sql dari snapshot.
