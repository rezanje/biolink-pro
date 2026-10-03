import { accessToken, adminClient, body, calendarConfig, MeetingError, owner, respond, sameOrigin } from '@/lib/meetings/server'
import { DEFAULT_PREFERENCES, normalizePreferences } from '@/lib/meetings/policy.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
    return respond(async () => {
        const { user, profile } = await owner()
        if (!calendarConfig()) return { configured: false, connected: false, preferences: DEFAULT_PREFERENCES }
        const admin = adminClient()
        const [connection, settings] = await Promise.all([
            admin.from('calendar_connections').select('email').eq('user_id', user.id).maybeSingle(),
            admin.from('meeting_settings').select('*').eq('profile_id', profile.id).maybeSingle(),
        ])
        if (connection.error || settings.error) return { configured: false, connected: false, preferences: DEFAULT_PREFERENCES }
        return { configured: true, connected: Boolean(connection.data), email: connection.data?.email, preferences: settings.data ? normalizePreferences(settings.data) : DEFAULT_PREFERENCES }
    })
}
export async function PUT(request: Request) {
    return respond(async () => {
        sameOrigin(request)
        const { profile, user } = await owner()
        let preferences
        try { preferences = normalizePreferences(await body(request)) } catch { throw new MeetingError('Check your timezone, days, duration, and working hours.') }
        if (!calendarConfig()) throw new MeetingError('Calendar booking setup is not ready.', 503)
        if (preferences.enabled) await accessToken(user.id)
        const { error } = await adminClient().from('meeting_settings').upsert({ ...preferences, profile_id: profile.id, updated_at: new Date().toISOString() })
        if (error) throw new MeetingError('Could not save meeting settings. Please try again.', 503)
        return { saved: true, preferences }
    })
}
export async function DELETE(request: Request) {
    return respond(async () => {
        sameOrigin(request)
        const { user, profile } = await owner()
        const admin = adminClient()
        const disabled = await admin.from('meeting_settings').update({ enabled: false, updated_at: new Date().toISOString() }).eq('profile_id', profile.id)
        if (disabled.error) throw new MeetingError('Could not disconnect Google Calendar. Please try again.', 503)
        const { error } = await admin.from('calendar_connections').delete().eq('user_id', user.id)
        if (error) throw new MeetingError('Could not disconnect Google Calendar. Please try again.', 503)
        return { disconnected: true }
    })
}
