# CNY Custom Design production approval packet

PR #34 adds a per-profile CNY entitlement. `023_cny_custom_design_access.sql` is the required production database and security change. Reza requested **no initial grants**. The migration adds `profiles.cny_design_enabled boolean NOT NULL DEFAULT false`; existing values become false. It resets any pre-existing ungranted `theme.template_id = 'cny'` to `classic` while preserving other theme keys. It creates a trigger denying client writes to the entitlement, role, company membership, profile identity, or ungranted CNY theme. Service-role grant/revoke remains confined to the super-admin route. Revocation atomically changes an active CNY selection to Classic.

## Approval and sequence

1. A database owner reviews/approves this migration and obtains a production backup of `profiles` (at least `id`, `user_id`, `role`, `company_id`, `cny_design_enabled` if present, and `theme`) in controlled storage. Do not paste personal rows into CI or the PR. Record the backup reference and affected-row counts privately.
2. Run the **read-only** preflight queries below. Compare all `super_admin` and `company_admin` identities with the approved admin roster; an existing role may have been self-assigned under the old owner-update policy. Resolve mismatches before enabling this admin API. Check the active production policy definitions, since tracked SQL may differ from the deployed database.
3. Apply migration 023 in a reviewed transaction using the team's normal production migration mechanism. No user grants are part of it. Confirm postchecks before deploying PR #34.
4. Deploy the reviewed PR after required CI and branch-protection checks pass. Confirm an ordinary owner cannot direct-save CNY, a company admin cannot grant it, and the global admin control is visible to verified super admins. Do not change the live `/rezanje` profile or grant any user during smoke testing.
5. The separate company rollout stages are additive `024_public_card_projection.sql` in compatibility PR #36, then access-tightening `025_company_portal_security.sql` in dashboard PR #35. Each requires its own review. Neither is part of the CNY entitlement release.

### Read-only preflight SQL

```sql
SELECT role, count(*) AS profiles FROM public.profiles GROUP BY role ORDER BY role;
SELECT id, user_id, email, role, company_id FROM public.profiles
WHERE role IN ('super_admin', 'company_admin') ORDER BY role, user_id;
SELECT count(*) AS currently_cny FROM public.profiles WHERE theme->>'template_id' = 'cny';
SELECT id, user_id, theme FROM public.profiles WHERE theme->>'template_id' = 'cny';
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles' ORDER BY policyname;
```

The second and fourth queries contain personal data: run and retain them only in the protected admin environment. Before migration 023 the entitlement column may not exist, so do not query it until after migration. The approved admin identities must come from Reza or an established independent admin roster; database role values alone do not establish legitimacy.

### Postchecks (read-only)

```sql
SELECT count(*) AS granted FROM public.profiles WHERE cny_design_enabled = true;
SELECT count(*) AS ungranted_cny FROM public.profiles
WHERE cny_design_enabled = false AND theme->>'template_id' = 'cny';
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'enforce_cny_custom_design_access';
SELECT column_default, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cny_design_enabled';
```

Expected counts: zero grants and zero ungranted CNY selections; enabled trigger (`O`), false default, non-null column. Confirm the count of Classic replacements matches the preflight CNY count.

## Existing flows and limitations

Claim and OAuth callback create ordinary profiles using the authenticated session with their own `user_id`; they do not set a company ID or privileged role. Those inserts remain allowed. Existing profile edits still work except for direct changes to `role`, `company_id`, `user_id`, `id`, and the entitlement. Company association and admin assignment must use the existing privileged admin routes; validate any other undocumented join flow during production review. The new INSERT guard also rejects a forged company ID and a foreign user ID even if the existing insert policy was inadvertently broadened. It does not change existing tier, serial claim, or billing rules.

The SQL test uses a temporary table with the real trigger function, including allowed onboarding insert, denied identity/company spoofing, denied self-grant/role promotion, direct-save denial, allowed grant, and revoke fallback. It does **not** prove the production RLS configuration or deployed API authorization. JS unit tests cover the role predicate and template-selection predicate. A local browser fixture covered granted and ungranted appearance/public rendering. Production preflight and smoke checks are required before claiming production security.

## Rollback

If application behavior fails after database migration, revert the app deployment while **leaving migration 023 and its trigger in place**. The old app tolerates the additive default-false column, and keeping the trigger preserves the new protection against direct role/company/entitlement writes. Do not drop the trigger or restore the old owner-write behavior as a quick rollback: that would silently reopen the known privilege escalation. If a database rollback is unavoidable, require a separately reviewed replacement policy/trigger that maintains the same protected fields and an approved restoration plan for pre-migration themes. Restoring theme snapshots or grants must never be done automatically.

Release remains blocked until production DB/security approval, actual migration/postchecks, verified admin roster, green required CI, and any formal review/branch protection.
