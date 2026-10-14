-- Disposable DB only. Apply 019, 021 and 022 first; fixtures roll back.
BEGIN;
INSERT INTO auth.users (id) VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003');
INSERT INTO public.profiles (id, user_id, slug, display_name, is_public, is_master) VALUES
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'saver-private', 'Secret name', false, true),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner', 'Owner', true, true),
 ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'saver-other', 'Other', true, false),
 ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'saver-public', 'Saver', true, true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000002');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.saved_profiles) <> 1 THEN RAISE EXCEPTION 'Save did not succeed immediately'; END IF;
 IF (SELECT count(*) FROM public.card_save_notifications) <> 0 THEN RAISE EXCEPTION 'Actor can read owner inbox'; END IF;
 BEGIN
  INSERT INTO public.saved_profiles VALUES ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', now(), null);
  RAISE EXCEPTION 'Forged actor accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'Private card accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Duplicate and delete/re-save must not spam or auto-save back.
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
DELETE FROM public.saved_profiles;
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000002');
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000004');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
DO $$ DECLARE n record; BEGIN
 IF (SELECT count(*) FROM public.card_save_notifications) <> 1 THEN RAISE EXCEPTION 'Expected one owner notification'; END IF;
 IF EXISTS (SELECT 1 FROM public.saved_profiles) THEN RAISE EXCEPTION 'Automatically saved back'; END IF;
 SELECT * INTO n FROM public.list_card_save_notifications();
 IF n.actor_name <> 'Saver' OR n.actor_slug <> 'saver-public' OR n.actor_profile_id <> '20000000-0000-0000-0000-000000000004' THEN RAISE EXCEPTION 'Public master not selected'; END IF;
 IF n.is_saved THEN RAISE EXCEPTION 'Incorrect reciprocal status'; END IF;
 BEGIN
  INSERT INTO public.card_save_notifications (recipient_id, actor_id, saved_profile_id) VALUES (auth.uid(), auth.uid(), '20000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'Client forged notification';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.card_save_notifications SET read_at = now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner cannot mark read'; END IF;
 BEGIN
  UPDATE public.card_save_notifications SET actor_id = auth.uid();
  RAISE EXCEPTION 'Notification identity mutable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Explicit Simpan balik uses the same Saved Cards insert.
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000004') ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF NOT (SELECT is_saved FROM public.list_card_save_notifications()) THEN RAISE EXCEPTION 'Reciprocal save missing'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.list_card_save_notifications()) THEN RAISE EXCEPTION 'Third party inbox exposed'; END IF;
 UPDATE public.card_save_notifications SET read_at = now();
 IF FOUND THEN RAISE EXCEPTION 'Third party changed inbox'; END IF;
END $$;
RESET ROLE;
-- Private master falls back deterministically to the available public card.
UPDATE public.profiles SET is_public = false WHERE slug = 'saver-public';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
 IF (SELECT actor_slug FROM public.list_card_save_notifications()) <> 'saver-other' THEN RAISE EXCEPTION 'Public fallback missing'; END IF;
END $$;
RESET ROLE;
-- Current public state is resolved live; no retained private names or slugs.
UPDATE public.profiles SET is_public = false WHERE user_id = '10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
DO $$ DECLARE n record; BEGIN
 SELECT * INTO n FROM public.list_card_save_notifications();
 IF n.actor_name IS NOT NULL OR n.actor_slug IS NOT NULL OR n.actor_profile_id IS NOT NULL THEN RAISE EXCEPTION 'Private identity leaked'; END IF;
END $$;
RESET ROLE;
-- Notification failure must not roll back the original save.
CREATE FUNCTION public.test_notification_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected delivery failure'; END $$;
CREATE TRIGGER test_notification_failure BEFORE INSERT ON public.card_save_notifications FOR EACH ROW EXECUTE FUNCTION public.test_notification_failure();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000002');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.saved_profiles) THEN RAISE EXCEPTION 'Delivery failure lost save'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER test_notification_failure ON public.card_save_notifications;
-- Saver without any profile still generates awareness, without private auth data.
SET LOCAL ROLE authenticated;
DELETE FROM public.saved_profiles;
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES (auth.uid(), '20000000-0000-0000-0000-000000000002');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.list_card_save_notifications()) <> 2 THEN RAISE EXCEPTION 'Missing-profile saver lost'; END IF;
END $$;
RESET ROLE;
-- Trusted imports lacking a user JWT do not generate notices.
SELECT set_config('request.jwt.claim.sub', '', true);
INSERT INTO public.saved_profiles (user_id, profile_id)
VALUES ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.card_save_notifications WHERE saved_profile_id = '20000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'Import generated notice'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM * FROM public.card_save_notifications;
  RAISE EXCEPTION 'Anonymous inbox access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM * FROM public.list_card_save_notifications();
  RAISE EXCEPTION 'Anonymous RPC access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
