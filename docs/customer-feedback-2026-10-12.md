# Customer feedback implementation — 12 October 2026

## Status

Prepared in an isolated worktree based on origin/main db52079. No production deployment, billing payment, account change, permission change, or customer lead insertion/deletion was performed. Existing changes in the original checkout were preserved.

## Delivered

- Visitor lead form uses the existing translation formatter with English fixed explicitly. The card's selected language still applies to the rest of the public card. The form declares lang=en. Contact-payload debug logging was removed.
- Owner tracker refreshes on window focus or when the document becomes visible, retaining current filters. A refresh button provides an explicit retry. Authentication/profile/read errors show a visible alert rather than an empty-contact message. A request counter prevents an older response from replacing the latest results.
- Interpreter handles a provider HTTP 402 as a temporary service outage (HTTP 503), with a visitor-safe localized message. Provider failures log only HTTP status; no billing details, credentials, or spoken text are logged. Successful translation behavior is preserved.

## Confirmed production blocker

The deployed /api/generate-bio route returned HTTP 402 with the provider explanation that prepayment credits are depleted. Both this route and the deployed interpreter use GOOGLE_GEMINI_API_KEY. The deployed interpreter returned its generic HTTP 502 for the same service outage.

Listing provider models succeeded, so model discovery alone was not proof that generation credits were available. No model, provider, API key, or payment setup was replaced.

Translation will remain unavailable until the owner restores Gemini service balance at https://ai.studio/projects. No payment was made. After balance restoration, recheck the production interpreter response, actual microphone capture, and spoken playback before calling translation operational.

The current Vercel CLI session cannot access the repository-linked project organization. It cannot supply production logs or deploy to this project's production environment. Native Chrome access also failed during this session. A Vercel plugin exists but is not installed. The installed CLI reports 58.1.0 and recommends updating to 63.1.2 before further release work.

## Verification

- Baseline Node suite: 32 tests passed before changes.
- Final Node suite: 39 tests passed, including seven feedback tests.
- Regression tests were observed failing before the language, refresh, visible-error, and provider-402 changes, then passing afterward.
- A fixture visitor submits through the real form handler and is displayed by the matching owner's real tracker logic. This uses an isolated in-memory test client; it is not a production write or an owner-RLS test.
- Form SSR is verified using actual React rendering with Indonesian and Chinese card language contexts. Local browser inspection also confirmed an English form on the Indonesian public card. At a 390 x 844 viewport, the form fits the screen and its Submit button remains reachable by scrolling. This is a browser viewport check, not a physical-phone microphone test.
- Focus/visibility refresh, listener cleanup, failure display, and stale-response protection are verified through the component's real callbacks with test event targets.
- Provider success and depleted-credit handling are tested with network fixtures. No successful live translation is claimed.
- TypeScript check passed. Production build passed after loading the existing ignored development configuration.
- Targeted lint reports no errors and two existing warnings in the tracker (unused savingDelay and the existing fetchAnalytics effect dependency). These were not expanded into unrelated work.

## Remaining acceptance

- Release approval and access to the production hosting project.
- Restore provider balance, then verify speech-to-text, translation, and voice playback on real devices.
- Authenticated owner dashboard check against an explicitly authorized production test lead. The original customer could not be identified, so no claim is made that their specific missing-lead complaint was reproduced.

No database migration is required for this change.
