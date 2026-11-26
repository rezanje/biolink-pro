import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { arCardFromProfile, arModeFor, normalizeSlug, parsePilotUserIds } from '@/lib/ar-pilot.mjs'
import { createClient as createSessionClient } from '@/lib/supabase/server'

// Hologram AR. Ketersediaan ditentukan server dari PEMILIK kartu:
//   pilot   -> semua pemindai (tanpa login) bisa melihat, seperti NFC;
//   preview -> hanya pemilik kartu yang sedang login (preview privat).
// Tidak ada parameter dari browser yang bisa menyalakan fitur ini.
const NO_STORE = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const TARGET = '/ar/targets/kartu-uji-01.mind'

export async function GET(request: Request) {
    const slug = normalizeSlug(new URL(request.url).searchParams.get('slug'))
    const pilotIds = parsePilotUserIds(process.env.AR_PILOT_USER_IDS)
    const previewIds = parsePilotUserIds(process.env.AR_PREVIEW_USER_IDS)
    if (!slug || (pilotIds.size === 0 && previewIds.size === 0)) return NextResponse.json({ enabled: false }, { status: 404, headers: NO_STORE })

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return NextResponse.json({ enabled: false }, { status: 503, headers: NO_STORE })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: profile } = await admin.from('profiles')
        .select('user_id, slug, display_name, job_title, company, avatar_url, is_public')
        .eq('slug', slug).maybeSingle()
    if (!profile || profile.is_public === false) return NextResponse.json({ enabled: false }, { status: 404, headers: NO_STORE })

    // Sesi hanya dibaca kalau kartu ini ada di daftar preview.
    let viewerUserId: string | null = null
    if (previewIds.has(String(profile.user_id).toLowerCase())) {
        const session = await createSessionClient()
        viewerUserId = (await session.auth.getUser()).data.user?.id ?? null
    }
    const mode = arModeFor({ pilotIds, previewIds, ownerUserId: profile.user_id, viewerUserId })
    if (!mode) return NextResponse.json({ enabled: false }, { status: 404, headers: NO_STORE })
    return NextResponse.json({ enabled: true, mode, card: arCardFromProfile(profile), target: TARGET }, { headers: NO_STORE })
}
