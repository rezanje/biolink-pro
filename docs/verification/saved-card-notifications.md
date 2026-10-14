# Saved-card owner awareness

Base: `origin/main` at `405c68ba74f4fd66bafa5ccf60fef9e3aedefad1` (fetched 2026-10-14).
Branch: `codex/saved-card-owner-notifications`.

Saving a public card still writes immediately to `saved_profiles`. An insert trigger
adds one in-app owner notification per saver and saved card. No approval state,
automatic reciprocal save, email, push, historical backfill, or client-controlled
actor/recipient fields are introduced. Folder assignments are preserved.

The dashboard notification link displays unread count and opens the inbox. Owners
can view the saver's public card, explicitly **Simpan balik**, or mark the notice
read. The inbox resolves the current public master card, falling back to the oldest
public card (UUID breaks ties). It returns only public display name, slug, and card
ID. When no public card exists, awareness remains with an anonymous member label;
private profiles and auth contact metadata are never used as a fallback. Self-saves
retain existing behavior and produce no self-notification. Trusted imports without
a user JWT also produce no notification. Delete/re-save does not generate repeat
notices. The inbox displays the latest 100 notices; its unread badge counts all.

Notification storage errors are caught inside the trigger's subtransaction so the
saved card survives. Failures log only SQLSTATE, without personal information.
Delivery is best effort: there is no automatic retry or historical backfill.

## Review and rollout

Migration `supabase/migrations/022_saved_card_notifications.sql` is prepared only.
Review it against the actual Supabase schema and grants, particularly migrations
019 and 021. `profiles.is_master` is optional: missing means non-master. Apply first in a disposable
or staging environment; then test two real authenticated accounts there before
approving production rollout. Migration and app deployment remain separate review
steps. No production database, merge, deployment, PR, or live outreach was performed.

There was no existing in-app notification table or component on the fetched main
or inspected cloud branch. This change adds a narrowly scoped owner inbox while
reusing the existing Supabase authentication, Saved Cards, folder policies,
dashboard shell, design tokens, and three-language UI provider.

## Reproduce verification

- `bash scripts/test-saved-card-notifications.sh` launches and destroys an isolated
  PostgreSQL 16 Docker container. It uses a minimal Supabase schema contract and
  applies 019, 021, and 022 only there. It runs notification and existing card-folder
  SQL tests. It never reads project credentials or publishes a database port.
- `node --test src/lib/*.test.mjs src/lib/pet/*.test.mjs`
- `npx tsc --noEmit`
- `npx eslint src/components/dashboard/CardSaveNotifications.tsx src/components/dashboard/DashboardShell.tsx src/app/dashboard/notifications/page.tsx src/lib/ui-language.mjs`
- `npm run lint` (current main has existing failures; compare with base).
- `npm run build` (requires access to Google Fonts and build-time Supabase public
  environment values). `npm run build -- --webpack` is the supported alternative
  when Turbopack's external font fetch fails in the cloud environment.

The SQL checks cover immediate saving, optional reciprocal saving, private card
rejection, forged actor rejection, owner-only reads and read updates, client
notification insertion and identity-update rejection, duplicate and delete/re-save
idempotency, self-save suppression, public master selection and public fallback,
private identity suppression, missing saver cards, trusted imports, anonymous
access rejection, injected delivery failure, no historical backfill, and existing
folder isolation and preservation.

## Browser verification

The optional browser harness uses Chromium and Playwright with intercepted
Supabase responses, synthetic user sessions, and a localhost-only target. It
checks mobile/desktop rendering, unread badge, public profile link, no automatic
reciprocal save, authenticated save payload, disabled repeat action, recoverable
save/read/load failures, unavailable public profiles, empty state, Indonesian
copy, and runtime errors. Screenshots are written under `/tmp`.

```sh
npm install --cache /tmp/biolink-npm-cache --prefix /tmp/biolink-browser --no-audit --no-fund playwright
NEXT_PUBLIC_SUPABASE_URL=https://notifications-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-key npm run dev -- --webpack --port 3005
# In another terminal:
PLAYWRIGHT_MODULE=/tmp/biolink-browser/node_modules/playwright/index.mjs node scripts/check-card-notifications-browser.mjs
```

Set `CHROMIUM_PATH` if Chromium is elsewhere. This harness verifies client behavior;
real authorization and trigger behavior are verified separately by the SQL suite.

## Results on 2026-10-14

- Disposable PostgreSQL notification and existing card-folder tests: passed.
  The delivery failure test deliberately emits a SQLSTATE-only warning.
- Existing Node tests: 17 passed, 0 failed.
- TypeScript `--noEmit`: passed.
- ESLint for changed components, route, translations, and browser harness: passed.
- Full project lint: 90 errors, 104 warnings; identical totals on clean base
  `405c68b`. Examples include legacy `any` types, hook warnings, and CommonJS
  imports in existing scripts. No unrelated lint repairs were made.
- Browser harness: passed with no page runtime errors; mobile width 390px and
  desktop width 1440px. Reviewed both screenshots.
- `npm run build -- --webpack`: passed, including the new static notifications
  route. Existing middleware deprecation and webpack cache warnings remain.
- Default Turbopack build: blocked by external Google Fonts fetch failures for
  existing fonts. An initial linked dependency layout was also incompatible with
  Turbopack; dependencies were copied into the isolated worktree before retrying.
- `git diff --check`: passed.

Remaining validation: live schema/grant comparison and two-account staging
smoke test after migration review. Production migration/deployment and a draft PR
require separate authorization.

## Full repository schema integration follow-up

`bash scripts/test-saved-card-notifications-full-schema.sh` now passes against
unchanged repository `complete-setup.sql`, PLG initialization, tier configuration,
B2B RBAC, profile RLS migration 003, and migrations 019, 021, and 022 in disposable
PostgreSQL 16. The auth schema and Supabase default grants are a local contract;
all product tables and legacy policies come from the repository scripts.

The first replay correctly failed because `complete-setup.sql` omits
`profiles.is_master`. Migration 022 was repaired to treat an absent optional field
as false using a JSON projection. The full replay now passes without altering
existing profile columns, while the original multi-card tests still verify public
master preference and deterministic fallback when the field exists.

Additional verified behavior includes the real signup trigger creating
`public.users`, the repository's unique profile-per-user constraint, enum-based
tiers, legacy permissive profile RLS, Supabase default anonymous grants, immediate
and duplicate saves, explicit save back, marking read, and private actor projection
suppression. Inbox grants explicitly revoke anonymous access even when defaults
are permissive.

**Existing correctness/privacy risks:** both `complete-setup.sql` and profile RLS
migration 003 use `FOR SELECT USING (TRUE)`; B2B RBAC adds another similarly open
policy. The local full-schema test confirms an anonymous query can read an
`is_public = false` profile. Migration 022's explicit public filter prevents this
leak through the notification inbox, but it does not repair existing profile or
Saved Cards reads. A card becoming private after an inbox view may remain readable
through the existing public page if the deployed database retains these policies.
Audit actual deployed policies before rollout; a global RLS repair should be a
separate reviewed change because existing admin and owner flows rely on them.

Other repository bootstrap scripts are not a canonical clean-install sequence:
`schema.sql` references `companies` before creating it, and the extension block in
`gentanala-schema.sql` contains procedural IF statements without an opening DO
block. These pre-existing script issues were not changed. The complete-setup route
above is executable and was tested; a deployed schema may differ from all snapshots.

**Unavailable staging access:** no staging URL, staging project credentials, or
two authenticated staging accounts were supplied. Consequently, PostgREST API
integration with real JWTs, cookie/login behavior across two accounts, actual
schema/grants comparison, and notification visibility in the deployed app remain
unexecuted. No attempt was made against production. These are pending validation,
not denied operations. Local PostgreSQL role/JWT-claim tests and intercepted browser
tests are complete and repeatable.

**Rollout requirements:** review 022 and deployed prerequisites/grants; resolve or
explicitly scope the pre-existing profile privacy policies; apply 022 to an
approved staging project; verify A saves B immediately, B sees A's public card and
can optionally save back, repeats stay idempotent, private/missing actors stay
hidden, and delivery failure preserves saving. Then seek separate production
migration/deployment approval. No branch push or PR was performed.
