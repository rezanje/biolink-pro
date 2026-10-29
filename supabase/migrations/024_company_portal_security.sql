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
