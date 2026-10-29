-- CNY Custom Design: deny everyone until a super admin grants an individual profile.
-- Apply in a reviewed production migration before deploying code that exposes the grant UI.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cny_design_enabled boolean;
ALTER TABLE public.profiles ALTER COLUMN cny_design_enabled SET DEFAULT false;
UPDATE public.profiles SET cny_design_enabled = false WHERE cny_design_enabled IS NULL;
ALTER TABLE public.profiles ALTER COLUMN cny_design_enabled SET NOT NULL;

-- Safe fallback for any pre-existing, unentitled CNY selection. This preserves all
-- other theme keys and does not grant anyone access.
UPDATE public.profiles
SET theme = jsonb_set(COALESCE(theme, '{}'::jsonb), '{template_id}', '"classic"'::jsonb)
WHERE cny_design_enabled = false AND theme->>'template_id' = 'cny';

CREATE OR REPLACE FUNCTION public.enforce_cny_custom_design_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    -- PostgREST owner updates are still allowed for normal profile fields.
    -- Entitlements and the role fields used by the admin API require service role.
    IF TG_OP = 'INSERT' THEN
        IF current_user NOT IN ('service_role', 'postgres')
            AND (NEW.cny_design_enabled = true OR NEW.role IS DISTINCT FROM 'user') THEN
            RAISE EXCEPTION 'Admin-managed profile fields cannot be inserted by this role' USING ERRCODE = '42501';
        END IF;
    ELSIF current_user NOT IN ('service_role', 'postgres') THEN
        IF NEW.cny_design_enabled IS DISTINCT FROM OLD.cny_design_enabled
            OR NEW.role IS DISTINCT FROM OLD.role
            OR NEW.company_id IS DISTINCT FROM OLD.company_id
            OR NEW.user_id IS DISTINCT FROM OLD.user_id
            OR NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Admin-managed profile fields cannot be changed by this role' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.theme->>'template_id' = 'cny' AND NEW.cny_design_enabled = false THEN
        IF TG_OP = 'UPDATE' AND current_user IN ('service_role', 'postgres')
            AND OLD.cny_design_enabled = true AND NEW.cny_design_enabled = false THEN
            -- Revocation atomically returns a selected CNY card to Classic.
            NEW.theme = jsonb_set(NEW.theme, '{template_id}', '"classic"'::jsonb);
        ELSE
            RAISE EXCEPTION 'CNY Custom Design access is required' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cny_custom_design_access ON public.profiles;
CREATE TRIGGER enforce_cny_custom_design_access
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_cny_custom_design_access();

COMMENT ON COLUMN public.profiles.cny_design_enabled IS
    'Super admin grant for the CNY Custom Design template; false by default.';
