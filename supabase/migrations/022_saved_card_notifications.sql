-- Awareness only: saves remain immediate. No historical backfill or outreach.
BEGIN;
CREATE TABLE public.card_save_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saved_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz,
    CHECK (recipient_id <> actor_id),
    UNIQUE (recipient_id, actor_id, saved_profile_id)
);
CREATE INDEX card_save_notifications_inbox ON public.card_save_notifications (recipient_id, created_at DESC, id);
ALTER TABLE public.card_save_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read card save notifications" ON public.card_save_notifications
    FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Owners mark card save notifications read" ON public.card_save_notifications
    FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
REVOKE ALL ON public.card_save_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.card_save_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.card_save_notifications TO authenticated;

CREATE FUNCTION public.notify_card_saved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid;
BEGIN
    -- Only a verified authenticated saver may generate awareness. Service imports
    -- and self-saves preserve Saved Cards behavior without sending notifications.
    IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
    SELECT p.user_id INTO owner_id FROM public.profiles p
        WHERE p.id = NEW.profile_id AND p.is_public IS DISTINCT FROM false;
    IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
    BEGIN
        INSERT INTO public.card_save_notifications (recipient_id, actor_id, saved_profile_id)
        VALUES (owner_id, NEW.user_id, NEW.profile_id)
        ON CONFLICT (recipient_id, actor_id, saved_profile_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Never lose the successfully saved card if notification storage fails.
        RAISE WARNING 'Card-save notification delivery failed (SQLSTATE %)', SQLSTATE;
    END;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_card_saved() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_card_saved AFTER INSERT ON public.saved_profiles
    FOR EACH ROW EXECUTE FUNCTION public.notify_card_saved();

-- Resolve current public identity rather than storing names/slugs that could
-- become private. Prefer a public master, then oldest public card, then UUID.
-- Never return auth metadata, email, phone, or private profile information.
CREATE FUNCTION public.list_card_save_notifications()
RETURNS TABLE (
    id uuid, created_at timestamptz, read_at timestamptz,
    actor_profile_id uuid, actor_slug text, actor_name text, is_saved boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT n.id, n.created_at, n.read_at, p.id, p.slug, p.display_name,
        EXISTS (SELECT 1 FROM public.saved_profiles s WHERE s.user_id = auth.uid() AND s.profile_id = p.id)
    FROM public.card_save_notifications n
    LEFT JOIN LATERAL (
        SELECT p.id, p.slug, p.display_name FROM public.profiles p
        WHERE p.user_id = n.actor_id AND p.is_public IS DISTINCT FROM false
        -- Older setup scripts lack is_master; absence means non-master.
        ORDER BY COALESCE((to_jsonb(p)->>'is_master')::boolean, false) DESC,
            p.created_at ASC NULLS LAST, p.id ASC
        LIMIT 1
    ) p ON true
    WHERE n.recipient_id = auth.uid()
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.list_card_save_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_card_save_notifications() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
