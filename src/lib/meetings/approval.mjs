import { availableSlots } from './policy.mjs'
export async function approveBooking(store, calendar) {
    const booking = await store.claim()
    if (!booking) throw new Error('This request is already being handled. Refresh the list.')
    let safeToRelease = !booking.approval_recovery
    try {
        if (booking.approval_calendar_account_id && booking.approval_calendar_account_id !== calendar.accountId) {
            safeToRelease = false
            throw new Error('Reconnect the original Google account to retry this approval.')
        }
        let event = await calendar.existing(booking)
        if (event) safeToRelease = false
        if (!event) {
            safeToRelease = true
            if (Date.parse(booking.start_at) <= Date.now()) throw new Error('This meeting time has passed. Ask the visitor to request another time.')
            const busy = await calendar.busy(booking)
            if (!availableSlots([{ start: booking.start_at, end: booking.end_at }], busy).length) throw new Error('This time is busy. Choose another request or try again after freeing the calendar.')
            safeToRelease = false
            event = await calendar.insert(booking)
        }
        await store.finish(booking, event)
        return event
    } catch (error) { if (safeToRelease) await store.release(booking); throw error }
}
