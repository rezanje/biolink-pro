-- Run against a disposable database after migrations 019 and 021.
-- All fixtures and changes are rolled back.
BEGIN;
INSERT INTO auth.users (id) VALUES
    ('10000000-0000-0000-0000-000000000001'),
    ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles (id, user_id, slug, is_public) VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'folder-test-one', true),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'folder-test-two', true);
INSERT INTO public.card_folders (id, user_id, name) VALUES
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Clients'),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Private');
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES
    ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
    IF (SELECT count(*) FROM public.card_folders) <> 1 THEN
        RAISE EXCEPTION 'Another member folder was exposed';
    END IF;
    BEGIN
        INSERT INTO public.card_folders (user_id, name)
        VALUES ('10000000-0000-0000-0000-000000000002', 'Not mine');
        RAISE EXCEPTION 'Creating a folder for another member was allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.saved_profiles SET folder_id = '30000000-0000-0000-0000-000000000002';
        RAISE EXCEPTION 'Moving a card into another member folder was allowed';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    UPDATE public.card_folders SET name = 'Changed' WHERE id = '30000000-0000-0000-0000-000000000002';
    IF FOUND THEN RAISE EXCEPTION 'Renaming another member folder was allowed'; END IF;
    DELETE FROM public.card_folders WHERE id = '30000000-0000-0000-0000-000000000002';
    IF FOUND THEN RAISE EXCEPTION 'Deleting another member folder was allowed'; END IF;
    BEGIN
        INSERT INTO public.card_folders (user_id, name)
        VALUES (auth.uid(), ' clients ');
        RAISE EXCEPTION 'Duplicate folder name was allowed';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.card_folders (user_id, name) VALUES (auth.uid(), '   ');
        RAISE EXCEPTION 'Empty folder name was allowed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.saved_profiles SET folder_id = '30000000-0000-0000-0000-000000000001';
    IF NOT FOUND THEN RAISE EXCEPTION 'Own saved card could not be moved'; END IF;
    UPDATE public.card_folders SET name = 'Partners' WHERE id = '30000000-0000-0000-0000-000000000001';
    IF NOT FOUND THEN RAISE EXCEPTION 'Own folder could not be renamed'; END IF;
    DELETE FROM public.card_folders WHERE id = '30000000-0000-0000-0000-000000000001';
    IF NOT EXISTS (SELECT 1 FROM public.saved_profiles WHERE folder_id IS NULL) THEN
        RAISE EXCEPTION 'Deleting a folder must preserve its saved cards as unfiled';
    END IF;
END $$;
RESET ROLE;

-- Organizing a previously saved card must still work if it becomes private.
UPDATE public.profiles SET is_public = false WHERE id = '20000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
INSERT INTO public.card_folders (id, user_id, name)
VALUES ('30000000-0000-0000-0000-000000000003', auth.uid(), 'Saved earlier');
UPDATE public.saved_profiles SET folder_id = '30000000-0000-0000-0000-000000000003';
UPDATE public.saved_profiles SET folder_id = NULL;
RESET ROLE;
UPDATE public.profiles SET is_public = true WHERE id = '20000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
-- Saving uses ON CONFLICT DO NOTHING, without UPDATE permissions on identity.
INSERT INTO public.saved_profiles (user_id, profile_id)
VALUES (auth.uid(), '20000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, profile_id) DO NOTHING;
UPDATE public.saved_profiles SET folder_id = '30000000-0000-0000-0000-000000000003'
WHERE profile_id = '20000000-0000-0000-0000-000000000002';
INSERT INTO public.saved_profiles (user_id, profile_id)
VALUES (auth.uid(), '20000000-0000-0000-0000-000000000002')
ON CONFLICT (user_id, profile_id) DO NOTHING;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.saved_profiles
        WHERE profile_id = '20000000-0000-0000-0000-000000000002'
        AND folder_id = '30000000-0000-0000-0000-000000000003') THEN
        RAISE EXCEPTION 'Saving again must preserve the existing folder assignment';
    END IF;
    BEGIN
        UPDATE public.saved_profiles SET profile_id = '20000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'Folder permissions must not allow rewriting the saved profile';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END $$;
RESET ROLE;
ROLLBACK;
