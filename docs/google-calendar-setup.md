# Google Calendar booking setup

Meeting requests stay **pending** until the card owner accepts them in **Dashboard → AI & Translate → Meeting requests**. Sending a request or declining it does not create an event or send a calendar invitation. Acceptance checks availability again, creates an event in the connected account's primary calendar, and emails the visitor a Google Calendar invitation.

## One-time app operator setup

1. Open [Google Cloud Console](https://console.cloud.google.com/), select/create the app's project, and enable **Google Calendar API**.
2. Configure **Google Auth Platform → Branding / Audience / Data Access**. Add the app name, support email, homepage, privacy policy and terms URLs. For external users, add your test owners while testing. Publish and complete Google's verification requirements before offering the connection to all owners. External OAuth apps in Testing can issue refresh tokens that expire after seven days.
3. Create an **OAuth client → Web application**. Add this exact authorized redirect URI for production:

   ```text
   https://my.gentanala.com/api/calendar/callback
   ```

   The URI must match `NEXT_PUBLIC_SITE_URL` in the deployment. For localhost tests add `http://localhost:3000/api/calendar/callback` separately. The existing Supabase login callback is a separate connection.
4. Add these **server-only** environment variables in Vercel for Production, and for Preview only if that environment has its own approved callback:

   ```text
   GOOGLE_CALENDAR_CLIENT_ID=<web client ID>
   GOOGLE_CALENDAR_CLIENT_SECRET=<web client secret>
   SUPABASE_SERVICE_ROLE_KEY=<existing server service role key>
   NEXT_PUBLIC_SITE_URL=https://my.gentanala.com
   ```

   Never prefix Calendar secrets with `NEXT_PUBLIC_`. The service-role key is also used to derive the AES-GCM encryption key for stored refresh tokens. Rotating it requires owners to reconnect, unless existing tokens are re-encrypted before rotation.
5. In the project's **Supabase SQL Editor**, run [migration 020](../supabase/migrations/020_meeting_bookings.sql) once. It creates private encrypted credentials, owner-readable settings/requests, and a service-only atomic approval function. Apply existing migrations 017–019 first if not already present. The normal Supabase public/service REST keys cannot apply SQL schema migrations; use SQL Editor or your authorized database migration connection.
6. Redeploy after saving environment variables. Sign in as a Premium/B2B owner and verify that **Connect Google Calendar** appears. If it does not, check the environment and migration.

Requested OAuth scopes:

- `openid`, `email`: identify the account selected by the owner.
- `https://www.googleapis.com/auth/calendar.freebusy`: check available times without showing event details to visitors.
- `https://www.googleapis.com/auth/calendar.events.owned`: add approved meetings to the primary calendar owned by that account.

## Steps for each owner

1. Open **AI & Translate → Meeting requests** and choose **Connect Google Calendar**.
2. Select the Google account whose primary calendar should receive meetings. Allow the requested permissions and return to the app.
3. Set timezone (for example `Asia/Jakarta`), duration, working hours and days. Enable the meeting switch and **Save meeting settings**. Enable the AI concierge to display its booking entry point on the public card.
4. Visitors select **Book a meeting**, choose an available time, and submit their name and email. They see **awaiting approval**, with no invitation yet.
5. Check **Booking requests** and click **Accept** or **Decline**. Only Accept adds the event and sends an invitation. If the calendar is busy or Google is temporarily unavailable, the request remains retryable. If a Google write or its confirmation was interrupted, it stays Processing; use Retry approval after five minutes to safely confirm/reuse the same event. Decline is disabled while the outcome is uncertain. Retrying that approval requires the same Google account used on the first attempt, even if another account was connected meanwhile. Refresh the list to see recent requests.
6. **Disconnect** turns off new requests and removes stored app credentials; existing Google events stay in the calendar. To revoke the underlying Google permission as well, remove the app in the Google account's third-party connections settings.

The optional existing **Booking link** remains available when built-in requests are off/unavailable. It follows the external provider's behavior, including whether that provider requires approval.

## Production acceptance check

Use a real owner and a visitor test email you control:

1. Connect and enable booking. Ensure a busy Google event's time is absent from the visitor slots.
2. Submit a request; confirm it is pending and **no Google event/invitation exists**.
3. Decline one request; confirm no event/invitation is created.
4. Submit another and accept it; confirm the event is on the owner's selected primary calendar and the visitor receives the invitation.
5. Retry/refresh approval; confirm there is only one event. Request two overlapping times and confirm only one can be accepted.
6. Disconnect; confirm new requests are unavailable.

Local tests use fake Google responses and do not write to a real calendar. A successful build or simulated acceptance is not proof that production OAuth is configured.

## Current limits

- Premium/B2B owners, one connected primary Google calendar per owner.
- 15/30/60 minute duration, 14 days ahead, two hours minimum notice.
- Requests do not reserve a calendar slot; availability is checked again at acceptance. Pending requests appear when owners open/refresh the settings page; separate owner notification emails are not implemented.
- Google invitations are sent on acceptance. A decline is recorded in the app; there is no separate decline email.
- Per-instance IP throttling and per-email request limits cover normal abuse at current traffic. Use shared rate limiting if traffic expands.
- Cancellation/rescheduling, calendar selection and Google Meet links are outside this initial workflow.
