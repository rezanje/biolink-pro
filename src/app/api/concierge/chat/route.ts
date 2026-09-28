import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Message = { role: 'visitor' | 'assistant'; text: string }
const attempts = new Map<string, number[]>()
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const safeUrl = (value: unknown) => {
    const url = clean(value, 500)
    return /^https:\/\//i.test(url) ? url : ''
}

function allowed(req: Request) {
    const origin = req.headers.get('origin')
    if (!origin) return true
    try { return new URL(origin).host === new URL(req.url).host } catch { return false }
}

function withinLimit(key: string) {
    const now = Date.now()
    const recent = (attempts.get(key) || []).filter(time => now - time < 60_000)
    if (recent.length >= 8) return false
    recent.push(now)
    attempts.set(key, recent)
    // ponytail: per-instance throttle; move to shared rate limiting if traffic grows.
    return true
}

export async function POST(req: Request) {
    if (!allowed(req)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    try {
        const body = await req.json()
        const slug = clean(body.slug, 80).toLowerCase()
        const question = clean(body.question, 1000)
        const visitorId = clean(body.visitorId, 100)
        const visitorName = clean(body.visitorName, 100)
        const intent = clean(body.intent, 120)
        const history = Array.isArray(body.history) ? body.history.slice(-6).map((item: unknown) => {
            const value = item as Record<string, unknown>
            return { role: value.role === 'assistant' ? 'assistant' : 'visitor', text: clean(value.text, 1000) }
        }).filter((item: Message) => item.text) : []
        if (!slug || !question || !visitorId) return NextResponse.json({ error: 'Question is incomplete.' }, { status: 400 })
        if (!withinLimit(`${slug}:${visitorId}`)) return NextResponse.json({ error: 'Please wait a moment before asking again.' }, { status: 429 })

        const supabase = await createClient()
        const { data: profile } = await supabase.from('profiles')
            .select('id,display_name,bio,company,job_title,social_links,is_public')
            .eq('slug', slug).eq('is_public', true).maybeSingle()
        if (!profile) return NextResponse.json({ error: 'This card is unavailable.' }, { status: 404 })
        const { data: settings } = await supabase.from('ai_concierge_settings')
            .select('persona,instructions,knowledge,booking_url,enabled')
            .eq('profile_id', profile.id).eq('enabled', true).maybeSingle()
        if (!settings) return NextResponse.json({ error: 'The concierge is unavailable.' }, { status: 404 })

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY
        if (!apiKey) return NextResponse.json({ error: 'The concierge is not ready yet.' }, { status: 503 })
        const knowledge = typeof settings.knowledge === 'object' && settings.knowledge ? settings.knowledge : {}
        const facts = { name: profile.display_name, bio: profile.bio, company: profile.company, jobTitle: profile.job_title, links: profile.social_links, knowledge }
        const instruction = [
            `You are ${settings.persona || 'a professional concierge'} for ${profile.display_name || 'this profile'}.`,
            'Answer only from APPROVED FACTS below. Never invent prices, promises, timelines, or private details.',
            'If unknown, say so briefly and offer the official contact option. Match visitor language. Be concise: maximum 120 words. Do not use markdown links.',
            `ADDITIONAL OWNER GUIDANCE: ${settings.instructions || 'None.'}`,
            `APPROVED FACTS: ${JSON.stringify(facts)}`,
        ].join('\n')
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents: [...history, { role: 'visitor', text: question }].map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.text }] })), generationConfig: { temperature: 0.35, maxOutputTokens: 300 } })
        })
        const data = await response.json().catch(() => ({}))
        const reply = clean(data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join(''), 2000)
        if (!response.ok || !reply) return NextResponse.json({ error: 'The concierge could not answer right now.' }, { status: 502 })

        await supabase.from('ai_concierge_messages').insert([
            { profile_id: profile.id, visitor_id: visitorId, visitor_name: visitorName || null, intent: intent || null, role: 'visitor', content: question },
            { profile_id: profile.id, visitor_id: visitorId, visitor_name: visitorName || null, intent: intent || null, role: 'assistant', content: reply },
        ])
        return NextResponse.json({ reply, bookingUrl: safeUrl(settings.booking_url) })
    } catch {
        return NextResponse.json({ error: 'The concierge could not answer right now.' }, { status: 500 })
    }
}
