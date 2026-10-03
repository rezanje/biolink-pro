# Conversation history and approved Google Calendar meetings

Owners must be able to open a visitor conversation, read messages in chronological order, and load messages older than the dashboard preview. History reads remain scoped to the authenticated owner's profile and the selected visitor. A native modal provides focus management, Escape dismissal, and a mobile layout.

Visitors may request a meeting from the public card. Each request starts pending; it does not create a Calendar event or send an invitation. Owners connect their own Google account, choose business hours, weekdays, duration (15/30/60 minutes), and IANA timezone. Booking uses the primary calendar, a 14-day horizon, and at least two hours' notice. Busy events are excluded from offered slots. Owners approve or decline requests; approval rechecks availability and creates an event with the guest invited. Duplicate approvals must reuse the same event. A failed approval remains retryable.

Google authorization uses a dedicated web OAuth client, offline access, PKCE, and a short-lived state cookie bound to the signed-in owner. Refresh/access tokens are encrypted with AES-GCM on the server and stored in a service-role-only table. Public responses expose slots and display settings, never tokens or private calendar events. Booking tables use RLS, and updates use conditional status transitions.

One-time operator setup requires Google Calendar API, GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and migration 020. Each owner then uses Connect Google Calendar and consent. Missing setup must be shown honestly; calendar synchronization is not ready until setup and a real owner connection succeed. Existing booking links continue to work.

Implement without new runtime dependencies. Keep the existing Premium/B2B feature eligibility and public-card visibility rules. Ship the independently usable conversation fix even if operator credentials are still missing. Tests use local fixtures, never live Calendar event creation.
