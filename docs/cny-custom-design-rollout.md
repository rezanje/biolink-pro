# CNY Custom Design rollout checkpoint

PR #34 adds a private per-profile CNY entitlement. No profile receives it by default, and this change does not grant access to any real user.

## Current architecture

- The appearance screen saves `profiles.theme` through Supabase. The existing owner RLS policy allows direct row updates, so client-side hiding or an API-only check cannot secure a custom template.
- The existing global admin role is `super_admin`; `company_admin` is scoped to a company. Only `super_admin` may use the new CNY grant/revoke API.
- Migration `023_cny_custom_design_access.sql` adds a default-false profile flag and a database trigger. The trigger blocks an ungranted CNY theme even via direct Supabase writes, and prevents non-service roles from changing the CNY flag or admin identity fields. Revocation atomically changes an active CNY theme to Classic while preserving other theme keys.

## Required approval before merge or production release

Review and approve the production database/security migration. Apply it before deploying this PR. It changes the `profiles` schema and its write behavior. Review existing `super_admin` and `company_admin` rows before release because the older owner-update policy did not protect the `role` field; this migration prevents future direct role edits but does not adjudicate past assignments.

The migration contains no grant statements for users. After application, verify that `cny_design_enabled` is false for all profiles and that the trigger is present. The SQL test at `supabase/tests/cny_custom_design_access.sql` uses a temporary fixture and can be run in an isolated test database before production application. Reza can grant access later from the global admin panel, one selected user at a time.

Until the migration is approved and applied, keep PR #34 unmerged. The app code and SQL test alone do not secure the live database.
