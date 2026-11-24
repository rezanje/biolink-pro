-- 024: Tutup akses data NFC yang terlalu terbuka (bagian B, audit teknologi
-- 23 Nov 2026, P0). Butuh 023_nfc_public_functions.sql dan kode aplikasi baru
-- sudah live.
--
-- Sebelumnya kunci publik situs bisa membaca semua nomor seri (termasuk token
-- kado), mengubah dan menghapus nomor seri, mengubah/menghapus perusahaan, dan
-- pemilik profil bisa mengganti perannya sendiri jadi super admin.
--
-- Setelah migrasi ini:
--   * serial_numbers hanya bisa dibaca pemiliknya, anggota perusahaan
--     pemiliknya, dan super admin; ubah/hapus hanya super admin dan admin
--     perusahaan (untuk nomor seri anggota perusahaannya). Halaman publik
--     memakai fungsi dari 023, yang tidak pernah mengembalikan gift_token.
--   * role dan company_id di profil hanya bisa diubah super admin / server.
--   * companies tetap terbaca publik (branding kartu), tapi hanya super admin
--     yang bisa tambah/hapus; admin perusahaan bisa ubah perusahaannya sendiri.
--
-- Satu transaksi: kalau satu langkah gagal, tidak ada yang berubah.
-- Rollback: supabase/rollback/024_lock_nfc_data_access_rollback.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- 2. serial_numbers: hapus semua aturan lama, pasang yang tertutup
-- ---------------------------------------------------------------------------

DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'serial_numbers'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.serial_numbers', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfc_serial_read ON public.serial_numbers
    FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid()
        OR public.nfc_is_super_admin()
        OR public.nfc_shares_company_with(owner_id)
    );

CREATE POLICY nfc_serial_super_admin ON public.serial_numbers
    FOR ALL TO authenticated
    USING (public.nfc_is_super_admin())
    WITH CHECK (public.nfc_is_super_admin());

CREATE POLICY nfc_serial_company_admin ON public.serial_numbers
    FOR ALL TO authenticated
    USING (public.nfc_is_company_admin_for(owner_id))
    WITH CHECK (public.nfc_is_company_admin_for(owner_id));

REVOKE ALL ON public.serial_numbers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.serial_numbers TO authenticated;

-- Fungsi lama yang tetap dipakai aplikasi.
DO $$
BEGIN
    -- Penghitung tap harus tetap jalan setelah tabel ditutup.
    IF to_regprocedure('public.increment_tap_count(uuid)') IS NOT NULL THEN
        ALTER FUNCTION public.increment_tap_count(uuid) SECURITY DEFINER;
        ALTER FUNCTION public.increment_tap_count(uuid) SET search_path = public;
    END IF;
    -- Klaim lama menerima user id dari pemanggil: jangan bisa dipanggil tanpa login.
    IF to_regprocedure('public.claim_serial_number(uuid, uuid)') IS NOT NULL THEN
        REVOKE ALL ON FUNCTION public.claim_serial_number(uuid, uuid) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.claim_serial_number(uuid, uuid) TO authenticated;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. profiles: role dan company_id hanya bisa diubah super admin / server
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER sengaja: current_user harus peran pemanggil (anon /
-- authenticated dari API publik; service_role / postgres dari server).
CREATE OR REPLACE FUNCTION public.nfc_guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
    v_new jsonb := to_jsonb(NEW);
    v_old jsonb;
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') OR public.nfc_is_super_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF coalesce(v_new->>'role', 'user') <> 'user' OR (v_new->>'company_id') IS NOT NULL THEN
            RAISE EXCEPTION 'Not allowed to set role or company' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    v_old := to_jsonb(OLD);
    IF (v_new->'role') IS DISTINCT FROM (v_old->'role')
       OR (v_new->'company_id') IS DISTINCT FROM (v_old->'company_id') THEN
        RAISE EXCEPTION 'Not allowed to change role or company' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nfc_guard_profile_privileges ON public.profiles;
CREATE TRIGGER nfc_guard_profile_privileges
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.nfc_guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- 5. companies: tetap bisa dilihat publik (logo/branding di kartu), tapi
--    hanya super admin yang bisa tambah/hapus, admin perusahaan ubah miliknya
-- ---------------------------------------------------------------------------

DO $$
DECLARE pol record;
BEGIN
    IF to_regclass('public.companies') IS NULL THEN RETURN; END IF;

    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'companies' AND cmd <> 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.companies', pol.policyname);
    END LOOP;

    -- Logo dan branding perusahaan tampil di kartu publik: pastikan tetap terbaca.
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'companies' AND cmd = 'SELECT') THEN
        EXECUTE 'CREATE POLICY nfc_company_public_read ON public.companies FOR SELECT USING (true)';
    END IF;

    EXECUTE 'CREATE POLICY nfc_company_super_admin ON public.companies FOR ALL TO authenticated '
         || 'USING (public.nfc_is_super_admin()) WITH CHECK (public.nfc_is_super_admin())';
    EXECUTE 'CREATE POLICY nfc_company_admin_update ON public.companies FOR UPDATE TO authenticated '
         || 'USING (public.nfc_is_company_admin_of(id)) WITH CHECK (public.nfc_is_company_admin_of(id))';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.companies FROM anon';
END $$;

COMMIT;
