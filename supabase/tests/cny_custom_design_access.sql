-- Run after migration 023 in an isolated test database. Uses only a temporary
-- table, so no real profile or entitlement is created or changed.
BEGIN;

CREATE TEMP TABLE cny_access_probe (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    role text NOT NULL,
    company_id uuid,
    cny_design_enabled boolean NOT NULL DEFAULT false,
    theme jsonb NOT NULL DEFAULT '{}'::jsonb
) ON COMMIT DROP;

INSERT INTO cny_access_probe (id, user_id, role, theme)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'user', '{"template_id":"classic"}');

CREATE TRIGGER enforce_cny_custom_design_access
BEFORE INSERT OR UPDATE ON cny_access_probe
FOR EACH ROW EXECUTE FUNCTION public.enforce_cny_custom_design_access();

GRANT SELECT, INSERT, UPDATE ON cny_access_probe TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

DO $$
BEGIN
    BEGIN
        UPDATE cny_access_probe SET theme = '{"template_id":"cny"}'::jsonb;
        RAISE EXCEPTION 'Ungrant user saved CNY';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE cny_access_probe SET cny_design_enabled = true;
        RAISE EXCEPTION 'User granted their own CNY access';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE cny_access_probe SET role = 'super_admin';
        RAISE EXCEPTION 'User promoted their own admin role';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO cny_access_probe (id, user_id, role)
        VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'super_admin');
        RAISE EXCEPTION 'User inserted their own admin role';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO cny_access_probe (id, user_id, role, cny_design_enabled)
        VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'user', true);
        RAISE EXCEPTION 'User inserted their own CNY grant';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO cny_access_probe (id, user_id, role)
        VALUES ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008', 'user');
        RAISE EXCEPTION 'User inserted a profile for another identity';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO cny_access_probe (id, user_id, role, company_id)
        VALUES ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', 'user', '00000000-0000-0000-0000-000000000010');
        RAISE EXCEPTION 'User inserted a forged company membership';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END $$;

-- The ordinary authenticated claim/onboarding insert is still permitted.
INSERT INTO cny_access_probe (id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'user');

RESET ROLE;
UPDATE cny_access_probe SET cny_design_enabled = true;
SET LOCAL ROLE authenticated;
UPDATE cny_access_probe SET theme = '{"template_id":"cny","view_count":7}'::jsonb;
RESET ROLE;
UPDATE cny_access_probe SET cny_design_enabled = false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cny_access_probe
        WHERE cny_design_enabled = false
          AND theme->>'template_id' = 'classic'
          AND theme->>'view_count' = '7'
    ) THEN
        RAISE EXCEPTION 'CNY revoke did not preserve theme data and restore Classic';
    END IF;
END $$;

ROLLBACK;
