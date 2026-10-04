-- Each member can organize their saved cards into private folders.
BEGIN;

CREATE TABLE IF NOT EXISTS public.card_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS card_folders_member_name
    ON public.card_folders (user_id, lower(btrim(name)));

ALTER TABLE public.card_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own card folders" ON public.card_folders
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members create own card folders" ON public.card_folders
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members rename own card folders" ON public.card_folders
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members delete own card folders" ON public.card_folders
    FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_folders TO authenticated;

ALTER TABLE public.saved_profiles
    ADD COLUMN folder_id uuid,
    ADD CONSTRAINT saved_profiles_member_folder_fkey
        FOREIGN KEY (user_id, folder_id) REFERENCES public.card_folders (user_id, id)
        ON DELETE SET NULL (folder_id);

CREATE INDEX saved_profiles_member_folder ON public.saved_profiles (user_id, folder_id);

CREATE POLICY "Members organize saved profiles" ON public.saved_profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Organization may only change folder_id, never the saved profile identity.
-- Public eligibility is checked on initial INSERT by migration 019.
REVOKE UPDATE ON public.saved_profiles FROM authenticated;
GRANT UPDATE (folder_id) ON public.saved_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
