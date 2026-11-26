import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { arCardFromProfile, isArPilot, normalizeSlug, parsePilotUserIds } from '@/lib/ar-pilot.mjs'

// Hologram AR (pilot). Ketersediaan ditentukan server dari PEMILIK kartu
// (profiles.user_id ada di AR_PILOT_USER_IDS). Pengunjung tidak perlu login:
// yang memindai kartu adalah orang lain. Tidak ada parameter dari browser yang
// bisa menyalakan fitur ini.
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
    const slug = normalizeSlug(new URL(request.url).searchParams.get('slug'))
    const pilots = parsePilotUserIds(process.env.AR_PILOT_USER_IDS)
    if (!slug || pilots.size === 0) return NextResponse.json({ enabled: false }, { status: 404, headers: NO_STORE })

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return NextResponse.json({ enabled: false }, { status: 503, headers: NO_STORE })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: profile } = await admin.from('profiles')
        .select('user_id, slug, display_name, job_title, company, avatar_url, is_public')
        .eq('slug', slug).maybeSingle()
    if (!profile || profile.is_public === false || !isArPilot(pilots, profile.user_id)) {
        return NextResponse.json({ enabled: false }, { status: 404, headers: NO_STORE })
    }
    return NextResponse.json({ enabled: true, card: arCardFromProfile(profile), target: '/ar/targets/sample-card.mind' }, { headers: NO_STORE })
}
