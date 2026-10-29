-- Company workspace: close legacy public company writes and scope CRM updates.
-- Requires a reviewed production migration before this dashboard is released.
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.companies;
DROP POLICY IF EXISTS "Enable update for everyone" ON public.companies;
DROP POLICY IF EXISTS "Enable delete for everyone" ON public.companies;

CREATE POLICY "Super admins insert companies" ON public.companies FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Admins update their companies" ON public.companies FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()
    AND (role = 'super_admin' OR (role = 'company_admin' AND company_id = companies.id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()
    AND (role = 'super_admin' OR (role = 'company_admin' AND company_id = companies.id))));
CREATE POLICY "Super admins delete companies" ON public.companies FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE OR REPLACE FUNCTION public.protect_company_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF current_user NOT IN ('postgres', 'service_role') AND
       (NEW.id IS DISTINCT FROM OLD.id OR NEW.admin_id IS DISTINCT FROM OLD.admin_id) THEN
        RAISE EXCEPTION 'Company identity is admin-managed' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_company_identity ON public.companies;
CREATE TRIGGER protect_company_identity BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.protect_company_identity();

-- The caller's company is read from its authenticated profile; no client company ID is trusted.
CREATE OR REPLACE FUNCTION public.company_update_lead_status(p_lead_id uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
    IF p_status IS NULL OR p_status NOT IN ('new', 'contacted', 'converted', 'failed') THEN
        RAISE EXCEPTION 'Invalid lead status' USING ERRCODE = '22023';
    END IF;
    UPDATE public.leads AS l SET status = p_status
    FROM public.profiles AS cardholder, public.profiles AS actor
    WHERE l.id = p_lead_id
      AND l.profile_id = cardholder.id
      AND cardholder.company_id = actor.company_id
      AND actor.user_id = auth.uid()
      AND actor.role = 'company_admin'
      AND actor.company_id IS NOT NULL;
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.company_update_lead_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_update_lead_status(uuid, text) TO authenticated;

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
           'name', c.name, 'logo_url', c.logo_url, 'theme', c.theme,
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

CREATE OR REPLACE FUNCTION public.company_profile_read_allowed(p_user_id uuid, p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT auth.uid() = p_user_id OR EXISTS (
        SELECT 1 FROM public.profiles actor WHERE actor.user_id = auth.uid()
          AND (actor.role = 'super_admin' OR
               (actor.role = 'company_admin' AND actor.company_id IS NOT NULL AND actor.company_id = p_company_id))
    );
$$;
REVOKE ALL ON FUNCTION public.company_profile_read_allowed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_profile_read_allowed(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Owners and scoped admins read profiles" ON public.profiles FOR SELECT TO authenticated
USING (public.company_profile_read_allowed(user_id, company_id));

-- The public card view above returns the allowed brand fields. The base
-- companies table also contains admin_id and is not a public directory.
DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
CREATE POLICY "Scoped admins read companies" ON public.companies FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles actor WHERE actor.user_id = auth.uid()
    AND (actor.role = 'super_admin' OR
         (actor.role = 'company_admin' AND actor.company_id = companies.id))));

-- Keep lead details private to the card owner at the direct table boundary.
-- Company admins use the tenant-scoped workspace API and RPC above.
DROP POLICY IF EXISTS "Owner view leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Card owners read leads" ON public.leads FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

-- A production-only legacy policy outside the tracked set must be reviewed;
-- leaving an extra permissive SELECT policy would defeat the privacy fix.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'profiles' AND cmd IN ('SELECT', 'ALL')
        AND policyname <> 'Owners and scoped admins read profiles')
      OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'companies' AND cmd IN ('SELECT', 'ALL')
        AND policyname <> 'Scoped admins read companies')
      OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'leads' AND cmd IN ('SELECT', 'ALL')
        AND policyname <> 'Card owners read leads') THEN
        RAISE EXCEPTION 'Review additional profile/company/lead read policies before applying company workspace migration';
    END IF;
END $$;
NOTIFY pgrst, 'reload schema';
