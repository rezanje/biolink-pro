import 'server-only'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { decryptTokens } from './crypto.mjs'
import { refreshAccessToken } from './google-calendar.mjs'
import { DEFAULT_PREFERENCES, normalizePreferences } from './policy.mjs'

export class MeetingError extends Error { constructor(message: string, public status = 400) { super(message) } }
export const premium = (tier: string) => tier === 'PREMIUM' || tier === 'B2B'
export function calendarConfig() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!clientId || !clientSecret || !secret || !siteUrl) return null
    try { const origin = new URL(siteUrl).origin; return { clientId, clientSecret, secret, redirectUri: `${origin}/api/calendar/callback`, origin } } catch { return null }
}
export function adminClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new MeetingError('Calendar booking setup is not ready.', 503)
    return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}
export async function owner() {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new MeetingError('Please sign in first.', 401)
    const { data: profile } = await client.from('profiles').select('id,user_id,tier,display_name').eq('user_id', user.id).maybeSingle()
    if (!profile || !premium(profile.tier)) throw new MeetingError('Available on Premium and B2B plans.', 403)
    return { user, profile }
}
export function sameOrigin(request: Request) {
    const origin = request.headers.get('origin')
    if (!origin || origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) throw new MeetingError('Invalid request origin.', 403)
}
export async function body(request: Request) {
    if (Number(request.headers.get('content-length') || 0) > 12000) throw new MeetingError('Request is too large.', 413)
    try { return await request.json() } catch { throw new MeetingError('Invalid request.', 400) }
}
export async function respond(run: () => Promise<unknown>) {
    try { return NextResponse.json(await run(), { headers: { 'Cache-Control': 'no-store' } }) }
    catch (error) { return NextResponse.json({ error: error instanceof MeetingError ? error.message : 'Calendar request failed. Reconnect Google or try again.' }, { status: error instanceof MeetingError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } }) }
}
export async function calendarAccess(userId: string) {
    const config = calendarConfig()
    if (!config) throw new MeetingError('Calendar booking setup is not ready.', 503)
    const { data, error } = await adminClient().from('calendar_connections').select('encrypted_tokens,google_account_id,email').eq('user_id', userId).maybeSingle()
    if (error) throw new MeetingError('Calendar booking setup is not ready.', 503)
    if (!data) throw new MeetingError('Connect Google Calendar first.', 409)
    const tokens = decryptTokens(data.encrypted_tokens, config.secret)
    const refreshed = await refreshAccessToken(tokens.refresh_token, config.clientId, config.clientSecret)
    if (!refreshed.access_token) throw new MeetingError('Reconnect Google Calendar.', 409)
    return { token: refreshed.access_token as string, accountId: data.google_account_id as string, email: data.email as string }
}
export async function accessToken(userId: string) { return (await calendarAccess(userId)).token }
export async function publicBooking(slug: string) {
    if (!calendarConfig()) return null
    const admin = adminClient()
    const { data: profile } = await admin.from('profiles').select('id,user_id,tier,display_name,is_public').eq('slug', slug).eq('is_public', true).maybeSingle()
    if (!profile || !premium(profile.tier)) return null
    const [{ data: preferences }, { data: concierge }, { data: connection }] = await Promise.all([
        admin.from('meeting_settings').select('*').eq('profile_id', profile.id).eq('enabled', true).maybeSingle(),
        admin.from('ai_concierge_settings').select('enabled').eq('profile_id', profile.id).eq('enabled', true).maybeSingle(),
        admin.from('calendar_connections').select('user_id').eq('user_id', profile.user_id).maybeSingle(),
    ])
    if (!preferences || !concierge || !connection) return null
    return { profile, preferences: normalizePreferences(preferences) as typeof DEFAULT_PREFERENCES }
}
const attempts = new Map<string, { count: number; expires: number }>()
export function throttle(request: Request) {
    const key = `${request.method}:${(request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()}`
    const now = Date.now()
    for (const [ip, value] of attempts) if (value.expires <= now) attempts.delete(ip)
    const value = attempts.get(key) || { count: 0, expires: now + 60000 }
    if (value.count >= (request.method === 'GET' ? 60 : 8) || attempts.size >= 5000) throw new MeetingError('Please wait a moment before trying again.', 429)
    attempts.set(key, { ...value, count: value.count + 1 })
}
