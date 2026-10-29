-- Run in an isolated database with the fixture's two companies, profiles and leads.
-- No production identities or records are used.
BEGIN;
SET LOCAL ROLE anon;
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 0 THEN RAISE EXCEPTION 'Anonymous base profile read succeeded'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 0 THEN RAISE EXCEPTION 'Anonymous base company read succeeded'; END IF;
  SELECT count(*) INTO n FROM public.leads;
  IF n <> 0 THEN RAISE EXCEPTION 'Anonymous lead read succeeded'; END IF;
  SELECT count(*) INTO n FROM public.public_card_profiles;
  IF n <> 3 THEN RAISE EXCEPTION 'Public card view omitted a public card or exposed a private card'; END IF;
  SELECT count(*) INTO n FROM public.public_card_profiles v
    WHERE to_jsonb(v) ?| ARRAY['role','company_id','user_id','admin_id','subscription_valid_until']
       OR v.theme ?| ARRAY['view_count','private_future_key']
       OR v.company_brand->'theme' ? 'secret';
  IF n <> 0 THEN RAISE EXCEPTION 'Public card view exposed private fields'; END IF;
  SELECT count(*) INTO n FROM public.public_card_by_owner('00000000-0000-0000-0000-000000000303');
  IF n <> 0 THEN RAISE EXCEPTION 'Private card available through public owner lookup'; END IF;
  SELECT count(*) INTO n FROM public.public_card_by_owner('00000000-0000-0000-0000-000000000302');
  IF n <> 1 THEN RAISE EXCEPTION 'Public tap owner lookup lost its card'; END IF;
  UPDATE public.companies SET name = 'forged'; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Anonymous company update succeeded'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'Ordinary user read another profile'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 0 THEN RAISE EXCEPTION 'Ordinary user read company admin row'; END IF;
  SELECT count(*) INTO n FROM public.leads;
  IF n <> 1 THEN RAISE EXCEPTION 'Ordinary user read another lead or lost own lead'; END IF;
  UPDATE public.profiles SET display_name = 'forged' WHERE id = '00000000-0000-0000-0000-000000000203';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Ordinary user changed another company profile'; END IF;
  UPDATE public.companies SET name = 'forged'; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Ordinary user company update succeeded'; END IF;
  IF public.company_update_lead_status('00000000-0000-0000-0000-000000000401', 'contacted') THEN
    RAISE EXCEPTION 'Ordinary user updated a company lead'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 2 THEN RAISE EXCEPTION 'Company A admin read outside company A'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 1 THEN RAISE EXCEPTION 'Company A admin read another company'; END IF;
  SELECT count(*) INTO n FROM public.leads;
  IF n <> 0 THEN RAISE EXCEPTION 'Company admin bypassed owner lead RLS'; END IF;
  UPDATE public.profiles SET display_name = 'forged' WHERE id = '00000000-0000-0000-0000-000000000203';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Company A admin changed company B profile'; END IF;
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

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'Company B admin read outside company B'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 1 THEN RAISE EXCEPTION 'Company B admin read another company'; END IF;
  SELECT count(*) INTO n FROM public.leads;
  IF n <> 1 THEN RAISE EXCEPTION 'Company B admin read company A lead'; END IF;
  UPDATE public.profiles SET display_name = 'forged' WHERE id = '00000000-0000-0000-0000-000000000202';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Company B admin changed company A profile'; END IF;
  IF NOT public.company_update_lead_status('00000000-0000-0000-0000-000000000402', 'converted') THEN
    RAISE EXCEPTION 'Company B admin cannot update own company lead'; END IF;
  IF public.company_update_lead_status('00000000-0000-0000-0000-000000000401', 'converted') THEN
    RAISE EXCEPTION 'Company B admin updated company A lead'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 4 THEN RAISE EXCEPTION 'Super admin cannot read profiles'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 2 THEN RAISE EXCEPTION 'Super admin cannot read companies'; END IF;
  UPDATE public.companies SET website = 'https://global.test' WHERE id = '00000000-0000-0000-0000-000000000102';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Super admin company update denied'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
