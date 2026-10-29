-- Phase 1: additive public-card projection. Safe while the old app still reads base profiles.
-- Apply after migration 023, before a projection-compatible app deployment.
-- Public cards need a narrow projection; the old profiles SELECT exposed role,
-- company membership, billing expiry, entitlement state, and every theme key.
-- Keep email/phone here because the existing public card explicitly displays
-- those contact fields when present. A future private roster email needs a
-- separate field and product-level consent decision.
CREATE OR REPLACE VIEW public.public_card_profiles WITH (security_barrier = true) AS
SELECT p.id, p.slug, p.display_name, p.bio, p.avatar_url, p.phone, p.email,
       p.company, p.job_title, p.social_links, p.special_edition, p.special_editions,
       p.selected_special_greeting_anim, p.enable_special_greeting_anim,
       p.pet_enabled, p.pet_character_id, p.pet_name, p.lead_capture_delay,
       p.cny_design_enabled,
       (p.tier = 'B2B' OR (p.tier = 'PREMIUM' AND
           (p.subscription_valid_until IS NULL OR p.subscription_valid_until >= now()))) AS premium_design_enabled,
       (p.lead_capture_enabled = true AND p.tier <> 'FREE') AS lead_capture_available,
       COALESCE((SELECT jsonb_object_agg(key, value) FROM jsonb_each(COALESCE(p.theme, '{}'::jsonb))
           WHERE key = ANY (ARRAY[
               'primary','background','style','template_id','font_pair','image_filter','theme_mode',
               'whatsapp','wechat_id','gallery','files','links','welcome_word','welcome_duration',
               'active_mode','redirect_url','redirect_type','redirect_message','redirect_until',
               'public_translate_enabled'
           ])), '{}'::jsonb) AS theme,
       CASE WHEN c.id IS NOT NULL THEN jsonb_build_object(
           'name', c.name, 'logo_url', c.logo_url,
           'theme', jsonb_build_object('primary', c.theme->'primary', 'accent', c.theme->'accent'),
           'bio', to_jsonb(c)->'bio', 'avatar_url', to_jsonb(c)->'avatar_url',
           'social_links', to_jsonb(c)->'social_links') END AS company_brand
FROM public.profiles p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.is_public IS DISTINCT FROM false;
REVOKE ALL ON public.public_card_profiles FROM PUBLIC;
GRANT SELECT ON public.public_card_profiles TO anon, authenticated;

-- Tap routes know the serial's owner UUID, but public card results never include it.
CREATE OR REPLACE FUNCTION public.public_card_by_owner(p_owner_id uuid)
RETURNS SETOF public.public_card_profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT v.* FROM public.public_card_profiles v
    JOIN public.profiles p ON p.id = v.id
    WHERE p.user_id = p_owner_id
    ORDER BY COALESCE((to_jsonb(p)->>'is_master')::boolean, false) DESC, p.id
    LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_card_by_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_card_by_owner(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
