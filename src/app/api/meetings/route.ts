import { randomUUID } from 'node:crypto'
import { accessToken, adminClient, body, MeetingError, publicBooking, respond, sameOrigin, throttle } from '@/lib/meetings/server'
import { availableSlots, localDate, normalizeRequest, slotsForDay } from '@/lib/meetings/policy.mjs'
import { calendarBusy } from '@/lib/meetings/google-calendar.mjs'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function slots(slug: string, date: string) {
    const booking = await publicBooking(slug)
    if (!booking) throw new MeetingError('Meeting requests are currently unavailable.', 404)
    const candidates = slotsForDay(date, booking.preferences)
    if (!candidates.length) return { ...booking, slots: [] }
    const token = await accessToken(booking.profile.user_id)
    const busy = await calendarBusy(token, candidates[0].start, candidates[candidates.length - 1].end)
    return { ...booking, slots: availableSlots(candidates, busy) }
}
export async function GET(request: Request) {
    return respond(async () => {
        throttle(request)
        const params = new URL(request.url).searchParams; const slug = (params.get('slug') || '').slice(0, 80)
        if (!params.has('date')) {
            const booking = await publicBooking(slug)
            return booking ? { enabled: true, timezone: booking.preferences.timezone, duration: booking.preferences.duration, today: localDate(new Date(), booking.preferences.timezone) } : { enabled: false }
        }
        let result
        try { result = await slots(slug, params.get('date') || '') } catch (error) {
            if (error instanceof Error && error.message === 'Invalid date') throw new MeetingError('Invalid date.')
            throw error
        }
        return { enabled: true, timezone: result.preferences.timezone, duration: result.preferences.duration, slots: result.slots }
    })
}
export async function POST(request: Request) {
    return respond(async () => {
        sameOrigin(request); throttle(request)
        const input = await body(request)
        let contact
        try { contact = normalizeRequest(input) } catch { throw new MeetingError('Check your name, email, and meeting time.') }
        const slug = typeof input.slug === 'string' ? input.slug.slice(0, 80) : ''
        const booking = await publicBooking(slug)
        if (!booking) throw new MeetingError('Meeting requests are currently unavailable.', 404)
        const admin = adminClient()
        const id = typeof input.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId) ? input.requestId : randomUUID()
        const { data: existing } = await admin.from('meeting_requests').select('id,visitor_email,start_at,profile_id').eq('id', id).maybeSingle()
        if (existing) {
            if (existing.profile_id !== booking.profile.id || existing.visitor_email !== contact.email || Date.parse(existing.start_at) !== Date.parse(contact.start)) throw new MeetingError('Please start a new meeting request.', 409)
            return { submitted: true, status: 'pending' }
        }
        const { count, error: countError } = await admin.from('meeting_requests').select('id', { count: 'exact', head: true }).eq('profile_id', booking.profile.id).eq('visitor_email', contact.email).gte('created_at', new Date(Date.now() - 3600000).toISOString())
        if (countError) throw new MeetingError('Meeting requests are currently unavailable.', 503)
        if ((count || 0) >= 3) throw new MeetingError('Please wait before sending another meeting request.', 429)
        const result = await slots(slug, localDate(new Date(contact.start), booking.preferences.timezone))
        const selected = result.slots.find((slot: { start: string; end: string }) => slot.start === contact.start)
        if (!selected) throw new MeetingError('This time is no longer available. Choose another time.', 409)
        const { error } = await admin.from('meeting_requests').insert({ id, profile_id: booking.profile.id, visitor_name: contact.name, visitor_email: contact.email, note: contact.note, start_at: selected.start, end_at: selected.end, timezone: booking.preferences.timezone, status: 'pending' })
        if (error) throw new MeetingError('Could not send your request. Please try again.', 503)
        return { submitted: true, status: 'pending' }
    })
}
