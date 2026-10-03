import { createHash } from 'node:crypto'
export const CALENDAR_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events.owned', 'https://www.googleapis.com/auth/calendar.freebusy']
export function authorizationUrl({ clientId, redirectUri, state, verifier }) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: CALENDAR_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString()
    return url.toString()
}
async function jsonRequest(url, options = {}, fetcher = fetch) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!response.ok) { const error = new Error('Google Calendar is unavailable. Reconnect your account or try again.'); error.status = response.status; throw error }
    return response.json()
}
export async function exchangeCode({ code, verifier, clientId, clientSecret, redirectUri }, fetcher = fetch) {
    const tokens = await jsonRequest('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, code_verifier: verifier, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString() }, fetcher)
    if (!tokens.refresh_token || !CALENDAR_SCOPES.slice(2).every(scope => tokens.scope?.split(' ').includes(scope))) throw new Error('Calendar permissions were not granted')
    return tokens
}
export async function refreshAccessToken(refreshToken, clientId, clientSecret, fetcher = fetch) {
    return jsonRequest('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }).toString() }, fetcher)
}
export async function calendarIdentity(token, fetcher = fetch) {
    return jsonRequest('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } }, fetcher)
}
export async function calendarBusy(token, start, end, fetcher = fetch) {
    const data = await jsonRequest('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeMin: start, timeMax: end, items: [{ id: 'primary' }] }) }, fetcher)
    const calendar = data.calendars?.primary
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error('Could not check calendar availability')
    return calendar.busy
}
export const bookingEventId = id => createHash('sha256').update(`gentanala-booking:${id}`).digest('hex')
export async function existingCalendarEvent(token, booking, fetcher = fetch) {
    const id = bookingEventId(booking.id)
    try {
        const event = await jsonRequest(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, { headers: { Authorization: `Bearer ${token}` } }, fetcher)
        if (event.status === 'cancelled' || event.extendedProperties?.private?.booking_id !== booking.id) throw new Error('Existing calendar event does not match this request')
        return event
    } catch (error) { if (error.status === 404) return null; throw error }
}
export async function ensureCalendarEvent(token, booking, fetcher = fetch) {
    const existing = await existingCalendarEvent(token, booking, fetcher)
    if (existing) return existing
    const event = { id: bookingEventId(booking.id), summary: `Meeting with ${booking.visitor_name}`, description: booking.note || '', start: { dateTime: booking.start_at, timeZone: booking.timezone }, end: { dateTime: booking.end_at, timeZone: booking.timezone }, attendees: [{ email: booking.visitor_email }], extendedProperties: { private: { booking_id: booking.id } } }
    try {
        return await jsonRequest('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) }, fetcher)
    } catch (error) {
        if (error.status === 409) { const found = await existingCalendarEvent(token, booking, fetcher); if (found) return found }
        throw error
    }
}
