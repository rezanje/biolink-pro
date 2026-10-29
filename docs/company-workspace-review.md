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
```

Back up company rows, admin assignments, and lead statuses in controlled storage before applying 024. Postcheck that legacy public company-write policies are absent, new policies/function exist, ordinary users and company admins cannot write another company's row or lead, and super-admin company administration still works. The isolated SQL fixture test covers these positive and negative cases, including company `admin_id` protection.

Rollback the dashboard application first; leave migration 024's tightened company policies in place. Dropping them without a secure replacement would reopen unrestricted public company writes. If application company management unexpectedly fails, repair the privileged admin path under review rather than restoring `WITH CHECK (true)` policies.

## Known limits

The dashboard does not add user invitation, bulk import, lead notes, deal values, or historical pipeline analytics because the existing data model does not support them. Company membership and privileged role assignment remain controlled by existing global-admin APIs. The tracked schema has a broadly readable `profiles` SELECT policy for public cards, so this PR scopes **company workspace** reads and writes but does not claim to make all public profile fields private across Supabase clients. Storage bucket policies for the old logo uploader were not verified; the dashboard no longer uploads logos. Actual production RLS differs until checked against the read-only preflight queries. The isolated SQL fixture and pure authorization tests are not substitutes for deployed API/RLS smoke checks.
