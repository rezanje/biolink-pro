-- AI concierge: owner-approved knowledge, public visitor conversations, and booking handoff.

CREATE TABLE IF NOT EXISTS public.ai_concierge_settings (
    profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false,
    persona text NOT NULL DEFAULT 'Professional concierge' CHECK (char_length(persona) <= 80),
    instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 1500),
    greeting text NOT NULL DEFAULT '' CHECK (char_length(greeting) <= 400),
    knowledge jsonb NOT NULL DEFAULT '{"about":"","services":"","portfolio":"","faq":""}'::jsonb,
    suggested_actions jsonb NOT NULL DEFAULT '["Explore services","View portfolio","Ask about pricing","Book a meeting"]'::jsonb,
    booking_url text NOT NULL DEFAULT '' CHECK (char_length(booking_url) <= 500),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_concierge_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    visitor_id text NOT NULL CHECK (char_length(visitor_id) BETWEEN 8 AND 100),
    visitor_name text NULL CHECK (char_length(visitor_name) <= 100),
    intent text NULL CHECK (char_length(intent) <= 120),
    role text NOT NULL CHECK (role IN ('visitor', 'assistant')),
    content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_concierge_messages_profile_created_idx
    ON public.ai_concierge_messages(profile_id, created_at DESC);

ALTER TABLE public.ai_concierge_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_concierge_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage concierge settings" ON public.ai_concierge_settings;
CREATE POLICY "Owners manage concierge settings" ON public.ai_concierge_settings
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Public reads enabled concierge settings" ON public.ai_concierge_settings;
CREATE POLICY "Public reads enabled concierge settings" ON public.ai_concierge_settings
    FOR SELECT TO anon, authenticated
    USING (enabled AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_public IS DISTINCT FROM false));

DROP POLICY IF EXISTS "Public writes concierge messages" ON public.ai_concierge_messages;
CREATE POLICY "Public writes concierge messages" ON public.ai_concierge_messages
    FOR INSERT TO anon, authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_public IS DISTINCT FROM false));

DROP POLICY IF EXISTS "Owners read concierge messages" ON public.ai_concierge_messages;
CREATE POLICY "Owners read concierge messages" ON public.ai_concierge_messages
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_ai_concierge_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_ai_concierge_settings ON public.ai_concierge_settings;
CREATE TRIGGER touch_ai_concierge_settings
    BEFORE UPDATE ON public.ai_concierge_settings
    FOR EACH ROW EXECUTE FUNCTION public.touch_ai_concierge_settings();

NOTIFY pgrst, 'reload schema';
