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
019 and 021 and the existing `profiles.is_master` field. Apply first in a disposable
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

Remaining validation: full Supabase schema integration and two-account staging
smoke test after migration review. Production migration/deployment and a draft PR
require separate authorization.
