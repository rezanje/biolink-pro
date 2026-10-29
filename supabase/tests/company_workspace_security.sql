-- Run in an isolated database with the fixture's two companies, profiles and leads.
-- No production identities or records are used.
BEGIN;
SET LOCAL ROLE anon;
DO $$ DECLARE n integer; BEGIN
  UPDATE public.companies SET name = 'forged'; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Anonymous company update succeeded'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
DO $$ DECLARE n integer; BEGIN
  UPDATE public.companies SET name = 'forged'; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Ordinary user company update succeeded'; END IF;
  IF public.company_update_lead_status('00000000-0000-0000-0000-000000000401', 'contacted') THEN
    RAISE EXCEPTION 'Ordinary user updated a company lead'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
DO $$ DECLARE n integer; BEGIN
  UPDATE public.companies SET website = 'https://example.test' WHERE id = '00000000-0000-0000-0000-000000000101';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Company admin cannot update own company'; END IF;
  UPDATE public.companies SET website = 'https://forged.test' WHERE id = '00000000-0000-0000-0000-000000000102';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-company update succeeded'; END IF;
  IF NOT public.company_update_lead_status('00000000-0000-0000-0000-000000000401', 'contacted') THEN
    RAISE EXCEPTION 'Company admin cannot update own lead'; END IF;
  IF public.company_update_lead_status('00000000-0000-0000-0000-000000000402', 'contacted') THEN
    RAISE EXCEPTION 'Cross-company lead update succeeded'; END IF;
  BEGIN
    UPDATE public.companies SET admin_id = '00000000-0000-0000-0000-000000000301' WHERE id = '00000000-0000-0000-0000-000000000101';
    RAISE EXCEPTION 'Company admin changed admin_id';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
DO $$ DECLARE n integer; BEGIN
  UPDATE public.companies SET website = 'https://global.test' WHERE id = '00000000-0000-0000-0000-000000000102';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Super admin company update denied'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
