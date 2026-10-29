# Company workspace review (dashboard PR, stacked on PR #34)

The existing `companies` table and `profiles.company_id` supply tenancy. `profiles.role = company_admin` is the company administrator; global `super_admin` remains separate and manages special design grants in PR #34. The existing `leads` table already captures name/contact, originating profile, and status (`new`, `contacted`, `converted`, `failed`), so this dashboard reuses those records. No new company, user assignment, CNY entitlement, or lead is created by this PR.

## Review scope

- `/company/dashboard` displays real counts and recent leads; prior fabricated asset/scans/green-impact numbers are removed.
- `/company/users` lists only cardholders linked to the caller's company and can toggle lead capture for those profiles.
- `/company/leads` lists only leads originating from those profiles, with search, status filter, pagination, and status updates.
- `/company/settings` edits the caller's company identity/theme and displays the CNY visual style when its company name is Candra Naya Lestari. Generic companies use their own theme. Logo URL editing replaces the prior unaudited client-side logo upload.
- Legacy `/company/assets` and `/company/analytics` paths redirect to the supported roster/overview to avoid invented metrics.

The company ID is derived by the server from the authenticated profile, not accepted from the browser. The workspace API defaults to 401/403 for missing/non-company-admin sessions; data reads are scoped to `company_id`, lead status writes use a database function that checks company membership in the update itself, and cardholder lead-capture writes include the caller's company ID in the update predicate. Company admins cannot grant the CNY design. A CNY brand fallback provides the original logo and forest/vermilion palette if a CNY company row has no custom brand; no CNY company row is created automatically.

## Staged production approval and compatibility

**No production step is approved yet.** PR #34 migration `023_cny_custom_design_access.sql` and its role audit/backup checkpoint comes first. This dashboard release then has two separately reviewable schema phases:

1. **024, additive:** `024_public_card_projection.sql` adds `public_card_profiles` and `public_card_by_owner` without changing the old base-table read policies. It can be applied while the old public-card app is live. The view projects only public-card fields and allowlisted theme keys. `company_brand.theme` contains only `primary` and `accent`, not arbitrary company JSON. Test the view, NFC owner lookup, and saved-card preview fields after applying it. This phase alone does **not** close the old broad read policy.
2. **Projection-compatible app:** deploy the separate compatibility build from draft PR #36, based on PR #34. It changes the public card, NFC tap, and saved-card reads to the new projection while retaining the existing company portal. Verify real public cards, taps, and saved cards before tightening RLS. Do not deploy that build before 024; it requires the view. Keep a known-good deployment artifact for rollback.
3. **025, tightening:** after a separate database/security approval, backup, and read-policy audit, apply `025_company_portal_security.sql`. It removes legacy broad profile/company reads and public company writes; allows base-profile reads only to owners, own-company admins, or global super admins; keeps direct lead reads owner-only; and installs company-scoped lead-status writes. It aborts if an unreviewed extra SELECT/ALL policy would leave profiles, companies, or leads exposed. Verify anonymous, ordinary-user, company A, company B, and super-admin behavior against the production policy set.
4. **Dashboard release:** after Reza reviews the dashboard, deploy PR #35 with `COMPANY_WORKSPACE_ENABLED=true`. The flag defaults off, so a projection-compatible deployment cannot accidentally expose the new workspace before 025. Verify company roster and lead API permissions using safe authorized test accounts. No company, role, grant, or CRM record should be created merely by release.

**Rollback:** After 025, a dashboard defect is handled by disabling `COMPANY_WORKSPACE_ENABLED` or redeploying the known-good **PR #36 projection-compatible build**. Do not revert to the old app binary: it reads base profiles and would fail under tightened RLS. Keep 025's protections in place. If a projection defect is discovered, deploy a corrected projection-compatible build or a separately reviewed database change; dropping 025 or restoring public `USING (true)` policies would reopen exposure. Before 025, the old app can continue alongside additive 024; 024 itself is not a destructive policy change.

The tracked legacy `profiles` policy exposed entire rows to anonymous callers. The new projection excludes private cards (`is_public = false`), account/company/admin IDs, role, billing expiry, and unapproved theme keys. Public email and phone remain visible when set because the current card already displays them; the model has no distinct private roster email or explicit contact opt-in field. A company needing private HR email must use a separate field and consent decision rather than entering it as card contact data. The public company brand omits `companies.admin_id` and non-brand theme keys. The saved-card collection uses the projection instead of an embedded base-profile join.

Read-only production preflight (run in the protected admin environment):

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

Back up company rows, admin assignments, profile identity/contact/theme fields, and lead statuses before 025. Compare deployed policies to this branch before approval. The isolated fixture `supabase/tests/fixtures/company-workspace-bootstrap.sql` runs `supabase/tests/public_card_projection.sql` after 024 and `supabase/tests/company_workspace_security.sql` after 025. The latter switches to `anon`, an ordinary authenticated user, company A admin, company B admin, and super admin to check projected/public reads, private cards, tenant reads/writes, lead RPC authorization, and `admin_id` protection. Local mocked card/tap rendering passed; saved-card preview columns were checked in SQL. The workspace API returned 401 for unauthenticated GET/PATCH with the flag enabled, and role 403/200 predicates have unit coverage. Authenticated deployed API smoke checks remain necessary.

## Known limits

The dashboard does not add user invitation, bulk import, lead notes, deal values, or historical pipeline analytics because the existing data model does not support them. Company membership and privileged role assignment remain controlled by existing global-admin APIs. Public card contact fields stay visible by existing product behavior; no private roster email model exists. Storage bucket policies for the old logo uploader were not verified; the dashboard no longer uploads logos. Actual production RLS differs until checked against the read-only preflight queries. The isolated SQL fixture and pure authorization tests are not substitutes for deployed API/RLS smoke checks.
