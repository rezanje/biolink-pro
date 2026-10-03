import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { adminClient, calendarConfig, owner } from '@/lib/meetings/server'
import { encryptTokens, readOAuthState } from '@/lib/meetings/crypto.mjs'
import { calendarIdentity, exchangeCode } from '@/lib/meetings/google-calendar.mjs'
export const runtime = 'nodejs'
export async function GET(request: Request) {
    const config = calendarConfig()
    const destination = new URL('/dashboard/ai-assistant', config?.origin || new URL(request.url).origin)
    const cookieStore = await cookies()
    const stored = cookieStore.get('gentanala-calendar-state')?.value
    cookieStore.delete({ name: 'gentanala-calendar-state', path: '/api/calendar' })
    try {
        if (!config) throw new Error('Missing setup')
        const params = new URL(request.url).searchParams
        const { user } = await owner()
        const state = params.get('state')
        if (!stored || params.get('error')) throw new Error('OAuth not completed')
        const value = readOAuthState(stored, config.secret, user.id)
        if (state !== value.nonce) throw new Error('OAuth state does not match')
        const code = params.get('code')
        if (!code) throw new Error('Missing code')
        const tokens = await exchangeCode({ ...config, code, verifier: value.verifier })
        const identity = await calendarIdentity(tokens.access_token)
        if (!identity.email || !identity.email_verified || typeof identity.sub !== 'string' || !identity.sub || identity.sub.length > 255) throw new Error('Unverified account')
        const { error } = await adminClient().from('calendar_connections').upsert({ user_id: user.id, email: identity.email, google_account_id: identity.sub, encrypted_tokens: encryptTokens({ refresh_token: tokens.refresh_token }, config.secret), updated_at: new Date().toISOString() })
        if (error) throw new Error('Connection not saved')
        destination.searchParams.set('calendar', 'connected')
    } catch { destination.searchParams.set('calendar', 'failed') }
    return NextResponse.redirect(destination)
}
