-- AI Concierge is currently a Premium and B2B benefit.

DROP POLICY IF EXISTS "Owners manage concierge settings" ON public.ai_concierge_settings;
CREATE POLICY "Premium owners manage concierge settings" ON public.ai_concierge_settings
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_id
          AND p.user_id = auth.uid()
          AND p.tier IN ('PREMIUM', 'B2B')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_id
          AND p.user_id = auth.uid()
          AND p.tier IN ('PREMIUM', 'B2B')
    ));

DROP POLICY IF EXISTS "Public reads enabled concierge settings" ON public.ai_concierge_settings;
CREATE POLICY "Public reads premium concierge settings" ON public.ai_concierge_settings
    FOR SELECT TO anon, authenticated
    USING (enabled AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_id
          AND p.is_public IS DISTINCT FROM false
          AND p.tier IN ('PREMIUM', 'B2B')
    ));

DROP POLICY IF EXISTS "Public writes concierge messages" ON public.ai_concierge_messages;
CREATE POLICY "Public writes premium concierge messages" ON public.ai_concierge_messages
    FOR INSERT TO anon, authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_id
          AND p.is_public IS DISTINCT FROM false
          AND p.tier IN ('PREMIUM', 'B2B')
    ));

NOTIFY pgrst, 'reload schema';
