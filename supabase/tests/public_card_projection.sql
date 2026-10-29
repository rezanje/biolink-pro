-- Additive phase 024, tested before phase 025. Uses only the isolated fixture.
BEGIN;
SET LOCAL ROLE anon;
DO $$ DECLARE n integer; BEGIN
    SELECT count(*) INTO n FROM public.public_card_profiles;
    IF n <> 3 THEN RAISE EXCEPTION 'Projection did not preserve three public fixture cards'; END IF;
    SELECT count(*) INTO n FROM public.public_card_profiles
      WHERE id IN ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202')
        AND slug IS NOT NULL AND display_name IS NOT NULL;
    IF n <> 2 THEN RAISE EXCEPTION 'Saved-card preview fields are unavailable'; END IF;
    SELECT count(*) INTO n FROM public.public_card_profiles v
    WHERE to_jsonb(v) ?| ARRAY['role','company_id','user_id','admin_id','subscription_valid_until']
       OR v.theme ?| ARRAY['view_count','private_future_key']
       OR v.company_brand->'theme' ? 'secret';
    IF n <> 0 THEN RAISE EXCEPTION 'Projection leaked a private field'; END IF;
    SELECT count(*) INTO n FROM public.public_card_by_owner('00000000-0000-0000-0000-000000000302');
    IF n <> 1 THEN RAISE EXCEPTION 'Public tap owner lookup failed'; END IF;
    SELECT count(*) INTO n FROM public.public_card_by_owner('00000000-0000-0000-0000-000000000303');
    IF n <> 0 THEN RAISE EXCEPTION 'Private card owner lookup succeeded'; END IF;
    -- Phase 024 is additive: the old app still reads base profiles until 025.
    SELECT count(*) INTO n FROM public.profiles;
    IF n <> 4 THEN RAISE EXCEPTION 'Additive phase broke old public profile reads'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
