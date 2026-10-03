import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { adminClient, calendarConfig, owner } from '@/lib/meetings/server'
import { createOAuthState, readOAuthState } from '@/lib/meetings/crypto.mjs'
import { authorizationUrl } from '@/lib/meetings/google-calendar.mjs'
export const runtime = 'nodejs'
export async function GET(request: Request) {
    const config = calendarConfig()
    const fallback = new URL('/dashboard/ai-assistant?calendar=unavailable', config?.origin || new URL(request.url).origin)
    try {
        if (!config) return NextResponse.redirect(fallback)
        const { user } = await owner()
        const { error } = await adminClient().from('calendar_connections').select('user_id').eq('user_id', user.id).maybeSingle()
        if (error) return NextResponse.redirect(fallback)
        const state = createOAuthState(user.id, config.secret)
        const value = readOAuthState(state, config.secret, user.id)
        const cookieStore = await cookies()
        cookieStore.set('gentanala-calendar-state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/calendar', maxAge: 600 })
        return NextResponse.redirect(authorizationUrl({ ...config, state: value.nonce, verifier: value.verifier }))
    } catch { return NextResponse.redirect(fallback) }
}
