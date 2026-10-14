BEGIN;
INSERT INTO auth.users (id, email) VALUES
 ('80000000-0000-0000-0000-000000000001', 'actor@example.test'),
 ('80000000-0000-0000-0000-000000000002', 'owner@example.test');
INSERT INTO public.profiles (id, user_id, slug, display_name, is_public) VALUES
 ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'full-actor', 'Full actor', true),
 ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'full-owner', 'Full owner', true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '81000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '81000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000002', true);
DO $$ DECLARE n record; BEGIN
 SELECT * INTO n FROM public.list_card_save_notifications();
 IF n.actor_name IS DISTINCT FROM 'Full actor' OR n.actor_slug IS DISTINCT FROM 'full-actor' THEN RAISE EXCEPTION 'Full schema identity failed'; END IF;
 IF (SELECT count(*) FROM public.card_save_notifications) <> 1 THEN RAISE EXCEPTION 'Full schema duplicates'; END IF;
 IF EXISTS (SELECT 1 FROM public.saved_profiles) THEN RAISE EXCEPTION 'Full schema automatically saved back'; END IF;
END $$;
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '81000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF NOT (SELECT is_saved FROM public.list_card_save_notifications()) THEN RAISE EXCEPTION 'Full schema save back missing'; END IF;
END $$;
UPDATE public.card_save_notifications SET read_at = now();
RESET ROLE;
UPDATE public.profiles SET is_public = false WHERE slug = 'full-actor';
SET LOCAL ROLE authenticated;
DO $$ DECLARE n record; BEGIN
 SELECT * INTO n FROM public.list_card_save_notifications();
 IF n.actor_name IS NOT NULL OR n.actor_slug IS NOT NULL THEN RAISE EXCEPTION 'Legacy permissive profile RLS leaked through inbox'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM * FROM public.card_save_notifications;
  RAISE EXCEPTION 'Supabase default grants leaked inbox to anon';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Record the repository's pre-existing privacy problem without masking it.
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = 'full-actor' AND is_public = false) THEN RAISE EXCEPTION 'Expected legacy public RLS risk not reproduced'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
