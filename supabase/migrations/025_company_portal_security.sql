-- Phase 2, AFTER the projection-compatible app is live: tighten company, profile, and lead access.
-- Requires separate reviewed production database/security approval.
-- Do not roll back to a pre-projection app once this phase is applied.
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
