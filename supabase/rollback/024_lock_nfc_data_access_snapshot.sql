-- Jalankan SEBELUM 024_lock_nfc_data_access.sql dan simpan hasilnya.
-- Hasilnya adalah SQL yang mengembalikan aturan akses serial_numbers dan
-- companies persis seperti sebelum migrasi (dipakai oleh rollback).
-- Hanya membaca katalog; tidak membaca data pelanggan.

SELECT string_agg(stmt, E'\n' ORDER BY ord) AS restore_sql
FROM (
    SELECT 1 AS ord, format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, tablename) AS stmt
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('serial_numbers', 'companies')
    UNION ALL
    SELECT 2, format(
        'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;',
        policyname, tablename, permissive, cmd,
        array_to_string(roles, ', '),
        CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END,
        CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END)
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('serial_numbers', 'companies')
    UNION ALL
    SELECT 3, format('GRANT %s ON public.%I TO %I;', privilege_type, table_name, grantee)
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name IN ('serial_numbers', 'companies')
      AND grantee IN ('anon', 'authenticated')
    UNION ALL
    SELECT 4, format('GRANT EXECUTE ON FUNCTION %s TO %s;', p.oid::regprocedure, r.rolname)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    CROSS JOIN (VALUES ('anon'), ('authenticated')) r(rolname)
    WHERE p.proname = 'claim_serial_number'
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    UNION ALL
    SELECT 5, format('ALTER FUNCTION %s %s;', p.oid::regprocedure,
                     CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.proname = 'increment_tap_count'
) s;
