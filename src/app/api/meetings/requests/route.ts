import { randomUUID } from 'node:crypto'
import { calendarAccess, adminClient, body, MeetingError, owner, respond, sameOrigin } from '@/lib/meetings/server'
import { approveBooking } from '@/lib/meetings/approval.mjs'
import { calendarBusy, ensureCalendarEvent, existingCalendarEvent } from '@/lib/meetings/google-calendar.mjs'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
    return respond(async () => {
        const { profile } = await owner()
        const offset = Number(new URL(request.url).searchParams.get('offset') || 0)
        if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new MeetingError('Invalid page.')
        const { data, error } = await adminClient().from('meeting_requests').select('id,visitor_name,visitor_email,note,start_at,end_at,timezone,status,calendar_event_url,approval_calendar_email,created_at').eq('profile_id', profile.id).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 49)
        if (error) throw new MeetingError('Calendar booking setup is not ready.', 503)
        return { requests: data || [], hasMore: (data || []).length === 50 }
    })
}
type Booking = { id: string; start_at: string; end_at: string; visitor_name: string; visitor_email: string; timezone: string; note: string }
type Event = { id: string; htmlLink?: string }
export async function PATCH(request: Request) {
    return respond(async () => {
        sameOrigin(request)
        const { user, profile } = await owner(); const input = await body(request)
        if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id) || !['approve', 'reject'].includes(input.action)) throw new MeetingError('Invalid request.')
        const admin = adminClient()
        const { data: current } = await admin.from('meeting_requests').select('id,status,approval_calendar_account_id').eq('id', input.id).eq('profile_id', profile.id).maybeSingle()
        if (!current) throw new MeetingError('Meeting request not found.', 404)
        if (input.action === 'reject') {
            const { data, error } = await admin.from('meeting_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', input.id).eq('profile_id', profile.id).eq('status', 'pending').select('id').maybeSingle()
            if (error || !data) throw new MeetingError('This request is already being handled. Refresh the list.', 409)
            return { status: 'rejected' }
        }
        if (current.status === 'approved') return { status: 'approved' }
        const account = await calendarAccess(user.id); const token = account.token; const attempt = randomUUID()
        if (current.status === 'approving' && current.approval_calendar_account_id !== account.accountId) throw new MeetingError('Reconnect the original Google account to retry this approval.', 409)
        try {
            await approveBooking({
                claim: async () => {
                    const { data, error } = await admin.rpc('claim_meeting_request', { p_request_id: input.id, p_owner_id: user.id, p_attempt: attempt, p_calendar_account_id: account.accountId, p_calendar_email: account.email })
                    if (error) throw new MeetingError('Could not accept this request. Please try again.', 503)
                    return data?.[0] || null
                },
                finish: async (booking: Booking, event: Event) => {
                    const { data, error } = await admin.from('meeting_requests').update({ status: 'approved', calendar_event_id: event.id, calendar_event_url: event.htmlLink || null, approval_attempt: null, updated_at: new Date().toISOString() }).eq('id', booking.id).eq('profile_id', profile.id).eq('status', 'approving').eq('approval_attempt', attempt).select('id').maybeSingle()
                    if (error || !data) throw new MeetingError('Calendar saved. Refresh and retry to confirm the request.', 503)
                },
                release: async (booking: Booking) => {
                    await admin.from('meeting_requests').update({ status: 'pending', approval_attempt: null, approval_recovery: false, approval_calendar_account_id: null, approval_calendar_email: null, updated_at: new Date().toISOString() }).eq('id', booking.id).eq('profile_id', profile.id).eq('status', 'approving').eq('approval_attempt', attempt)
                },
            }, {
                accountId: account.accountId,
                existing: (booking: Booking) => existingCalendarEvent(token, booking),
                busy: (booking: Booking) => calendarBusy(token, booking.start_at, booking.end_at),
                insert: (booking: Booking) => ensureCalendarEvent(token, booking),
            })
        } catch (error) {
            if (error instanceof MeetingError) throw error
            if (error instanceof Error && /^(This request|This time is busy|This meeting time|Reconnect the original Google account)/.test(error.message)) throw new MeetingError(error.message, 409)
            throw error
        }
        return { status: 'approved' }
    })
}
