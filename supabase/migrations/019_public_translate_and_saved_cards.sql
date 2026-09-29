-- Public Live Translate quota and each member's private saved-card collection.

CREATE TABLE IF NOT EXISTS public.saved_profiles (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, profile_id)
);

ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read saved profiles" ON public.saved_profiles;
CREATE POLICY "Members read saved profiles" ON public.saved_profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members save public profiles" ON public.saved_profiles;
CREATE POLICY "Members save public profiles" ON public.saved_profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.is_public IS DISTINCT FROM false
        )
    );

DROP POLICY IF EXISTS "Members remove saved profiles" ON public.saved_profiles;
CREATE POLICY "Members remove saved profiles" ON public.saved_profiles
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.public_interpreter_usage (
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    visitor_id uuid NOT NULL,
    hour_started_at timestamptz NOT NULL,
    request_count smallint NOT NULL DEFAULT 0 CHECK (request_count BETWEEN 0 AND 5),
    PRIMARY KEY (profile_id, visitor_id, hour_started_at)
);

ALTER TABLE public.public_interpreter_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_interpreter_quota(
    p_profile_id uuid,
    p_visitor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_hour timestamptz := date_trunc('hour', now());
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_profile_id
          AND p.is_public IS DISTINCT FROM false
          AND p.tier IN ('PREMIUM', 'B2B')
    ) THEN
        RETURN false;
    END IF;

    INSERT INTO public.public_interpreter_usage (profile_id, visitor_id, hour_started_at, request_count)
    VALUES (p_profile_id, p_visitor_id, current_hour, 1)
    ON CONFLICT (profile_id, visitor_id, hour_started_at)
    DO UPDATE SET request_count = public.public_interpreter_usage.request_count + 1
        WHERE public.public_interpreter_usage.request_count < 5;

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_interpreter_quota(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_public_interpreter_quota(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
