import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const visitorIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function allowed(req: Request) {
    const origin = req.headers.get('origin')
    if (!origin) return true
    try { return new URL(origin).host === new URL(req.url).host } catch { return false }
}

function extractAnswer(value: unknown) {
    const raw = clean(value, 5000)
    try {
        const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '') as { sourceText?: unknown; translatedText?: unknown }
        return { sourceText: clean(parsed.sourceText, 2000), translatedText: clean(parsed.translatedText, 2000) }
    } catch { return { sourceText: '', translatedText: '' } }
}

export async function POST(req: Request) {
    if (!allowed(req)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    try {
        const body = await req.json()
        const audio = typeof body.audio === 'string' ? body.audio : ''
        const mimeType = clean(body.mimeType, 60)
        const sourceLanguage = clean(body.sourceLanguage, 60)
        const targetLanguage = clean(body.targetLanguage, 60)
        const slug = clean(body.slug, 100)
        const visitorId = clean(body.visitorId, 36)
        if (!audio || audio.length > 3_500_000 || !sourceLanguage || !targetLanguage) return NextResponse.json({ error: 'Recording is incomplete.' }, { status: 400 })
        if (!['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].includes(mimeType)) return NextResponse.json({ error: 'Unsupported recording format.' }, { status: 400 })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { data: ownerProfile } = user
            ? await supabase.from('profiles').select('tier').eq('user_id', user.id).maybeSingle()
            : { data: null }
        const ownerCanTranslate = ownerProfile?.tier === 'PREMIUM' || ownerProfile?.tier === 'B2B'

        if (slug) {
            if (!slug || !visitorIdPattern.test(visitorId)) return NextResponse.json({ error: 'Open a public Premium or B2B card to use Live Translate.' }, { status: 401 })
            const { data: profile } = await supabase.from('profiles').select('id,tier,is_public').eq('slug', slug).maybeSingle()
            if (!profile || profile.is_public === false || (profile.tier !== 'PREMIUM' && profile.tier !== 'B2B')) return NextResponse.json({ error: 'Live Translate is not available on this card.' }, { status: 403 })
            const { data: allowedByQuota } = await supabase.rpc('consume_public_interpreter_quota', { p_profile_id: profile.id, p_visitor_id: visitorId })
            if (!allowedByQuota) return NextResponse.json({ error: 'Live Translate limit reached. Please try again in the next hour.' }, { status: 429 })
        } else if (!ownerCanTranslate) {
            return NextResponse.json({ error: 'Live Interpreter is available on Premium and B2B plans.' }, { status: 403 })
        }

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY
        if (!apiKey) return NextResponse.json({ error: 'Live Interpreter is not ready yet.' }, { status: 503 })
        const prompt = `Listen to this short spoken message. Transcribe it faithfully in ${sourceLanguage}, then translate it into ${targetLanguage}. Return only valid JSON: {"sourceText":"...","translatedText":"..."}. Do not add commentary.`
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: audio } }] }],
                generationConfig: { temperature: 0, maxOutputTokens: 700 },
            }),
        })
        const data = await response.json().catch(() => ({}))
        const answer = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('')
        const result = extractAnswer(answer)
        if (!response.ok || !result.sourceText || !result.translatedText) return NextResponse.json({ error: 'Could not translate that recording. Please try again.' }, { status: 502 })
        return NextResponse.json(result)
    } catch {
        return NextResponse.json({ error: 'Could not translate that recording. Please try again.' }, { status: 500 })
    }
}
