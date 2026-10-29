# Company workspace review (dashboard PR, stacked on PR #34)

The existing `companies` table and `profiles.company_id` supply tenancy. `profiles.role = company_admin` is the company administrator; global `super_admin` remains separate and manages special design grants in PR #34. The existing `leads` table already captures name/contact, originating profile, and status (`new`, `contacted`, `converted`, `failed`), so this dashboard reuses those records. No new company, user assignment, CNY entitlement, or lead is created by this PR.

## Review scope

- `/company/dashboard` displays real counts and recent leads; prior fabricated asset/scans/green-impact numbers are removed.
- `/company/users` lists only cardholders linked to the caller's company and can toggle lead capture for those profiles.
- `/company/leads` lists only leads originating from those profiles, with search, status filter, pagination, and status updates.
- `/company/settings` edits the caller's company identity/theme and displays the CNY visual style when its company name is Candra Naya Lestari. Generic companies use their own theme. Logo URL editing replaces the prior unaudited client-side logo upload.
- Legacy `/company/assets` and `/company/analytics` paths redirect to the supported roster/overview to avoid invented metrics.

The company ID is derived by the server from the authenticated profile, not accepted from the browser. The workspace API defaults to 401/403 for missing/non-company-admin sessions; data reads are scoped to `company_id`, lead status writes use a database function that checks company membership in the update itself, and cardholder lead-capture writes include the caller's company ID in the update predicate. Company admins cannot grant the CNY design. A CNY brand fallback provides the original logo and forest/vermilion palette if a CNY company row has no custom brand; no CNY company row is created automatically.

## Database/security approval required before any dashboard release

`024_company_portal_security.sql` removes old public `companies` INSERT/UPDATE/DELETE policies, allows global super admins to manage companies, lets company admins update only their own company, protects company identity/admin assignment from client writes, and installs the company-scoped lead-status function. Review its RLS interaction with the actual production schema, apply it only after migration 023, and run protected preflight/backups and postchecks. This migration is separate from entitlement release and requires explicit production database/security approval. Do not deploy the dashboard before that approval; this is a **draft review**, not a release request.

The tracked legacy `profiles` policy also exposed entire rows to anonymous callers. Migration 024 now replaces it with owner/scoped-admin SELECT access. It replaces public card reads with `public_card_profiles`, a security-barrier projection that exposes only card display data and an allowlist of theme keys; private cards (`is_public = false`) are excluded. The tap lookup returns that projection without the account UUID. The public company brand in the projection omits `companies.admin_id`; direct company reads now require a matching company admin or global super admin. Direct lead SELECT is re-established as owner-only; company admins use the scoped workspace API. The migration fails if another profile, company, or lead SELECT/ALL policy remains, so an unreviewed permissive policy cannot silently override these restrictions. The saved-card collection uses the public projection instead of an embedded base-profile join. Public cards continue to show `profiles.email` and `profiles.phone` when filled, matching their existing rendering; the schema has no separate private roster email or explicit contact opt-in flag. A company wanting private HR email must use a separate field/consent decision before entering it as a card contact.

Read-only preflight:

```sql
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('companies','profiles','leads')
ORDER BY tablename, policyname;
SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;
SELECT company_id, count(*) FROM public.profiles
WHERE role='company_admin' GROUP BY company_id ORDER BY company_id;
SELECT count(*) AS leads_without_profile FROM public.leads l
LEFT JOIN public.profiles p ON p.id=l.profile_id WHERE p.id IS NULL;
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('profiles','companies','leads')
  AND grantee IN ('anon','authenticated') ORDER BY table_name, grantee, privilege_type;
```

Back up company rows, admin assignments, profile identity/contact/theme fields, and lead statuses in controlled storage before applying 024. Postcheck that legacy public company-write and profile-read policies are absent, the public-card projection contains only approved fields, private cards are omitted, ordinary users and company admins cannot read/write another company's base rows or leads, and super-admin company administration still works. Review any additional deployed profile/company SELECT policies before migration: an extra permissive policy would defeat the narrowing. The isolated SQL fixture at `supabase/tests/fixtures/company-workspace-bootstrap.sql` and `supabase/tests/company_workspace_security.sql` runs as `anon`, an ordinary authenticated user, company A admin, company B admin, and super admin. It checks anonymous projection/private-card behavior, base-profile/company/lead read counts, tenant writes, lead RPC authorization, and `admin_id` protection. A local unauthenticated workspace API GET and PATCH returned 401; role 403/200 predicates are unit-tested, while authenticated deployed API tests remain a production postcheck.

Rollback the dashboard application first; leave migration 024's tightened company policies in place. Dropping them without a secure replacement would reopen unrestricted public company writes. If application company management unexpectedly fails, repair the privileged admin path under review rather than restoring `WITH CHECK (true)` policies.

## Known limits

The dashboard does not add user invitation, bulk import, lead notes, deal values, or historical pipeline analytics because the existing data model does not support them. Company membership and privileged role assignment remain controlled by existing global-admin APIs. Public card contact fields stay visible by existing product behavior; no private roster email model exists. Storage bucket policies for the old logo uploader were not verified; the dashboard no longer uploads logos. Actual production RLS differs until checked against the read-only preflight queries. The isolated SQL fixture and pure authorization tests are not substitutes for deployed API/RLS smoke checks.
