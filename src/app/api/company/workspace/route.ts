import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'
import { companyAccess, isCompanyLeadStatus, summarizeCompany } from '@/lib/company-workspace.mjs'

// Dashboard perusahaan. Perusahaan selalu ditentukan server dari sesi
// (admin perusahaan) atau dari ?company= untuk super admin; semua query
// dibatasi company_id itu.

const PRIVATE = { 'Cache-Control': 'private, no-store' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LEADS = 2000

async function access(request: Request) {
    const session = await adminSession()
    const requested = new URL(request.url).searchParams.get('company')
    const result = companyAccess(session?.actor ?? null, requested)
    return { session, ...result }
}

function denied(status: number) {
    const error = status === 401 ? 'Unauthorized' : status === 400 ? 'Pilih perusahaan' : 'Forbidden'
    return NextResponse.json({ error }, { status, headers: PRIVATE })
}

export async function GET(request: Request) {
    try {
        const { session, status, companyId } = await access(request)
        if (status !== 200 || !session || !companyId) return denied(status)
        const admin = session.admin

        const { data: company } = await admin.from('companies')
            .select('id, name, logo_url, website, card_template').eq('id', companyId).maybeSingle()
        if (!company) return NextResponse.json({ error: 'Perusahaan tidak ditemukan' }, { status: 404, headers: PRIVATE })

        const { data: people, error: peopleError } = await admin.from('profiles')
            .select('id, user_id, display_name, email, job_title, slug, avatar_url, role, updated_at')
            .eq('company_id', companyId).order('display_name')
        if (peopleError) throw peopleError
        const userIds = (people || []).map(p => p.user_id).filter(Boolean)
        const profileIds = (people || []).map(p => p.id)

        const since = new Date(Date.now() - 30 * 86400000).toISOString()
        const [serials, analytics, leads] = await Promise.all([
            userIds.length
                ? admin.from('serial_numbers').select('owner_id, is_claimed, nfc_tap_count, last_tapped_at').in('owner_id', userIds)
                : Promise.resolve({ data: [], error: null }),
            profileIds.length
                ? admin.from('analytics').select('profile_id, event_type, created_at').in('profile_id', profileIds).gte('created_at', since).limit(20000)
                : Promise.resolve({ data: [], error: null }),
            profileIds.length
                ? admin.from('leads').select('id, profile_id, created_at, name, email, whatsapp, company, job_title, status')
                    .in('profile_id', profileIds).order('created_at', { ascending: false }).limit(MAX_LEADS)
                : Promise.resolve({ data: [], error: null }),
        ])
        if (serials.error || analytics.error || leads.error) throw new Error('Data perusahaan tidak bisa dimuat')

        // Kartu/jam yang dibuat untuk perusahaan ini. UUID lengkap tidak dikirim (itu kunci klaim);
        // cukup kode pendek untuk mencocokkan dengan kartu fisik.
        const [companySerials, deviceTypes] = await Promise.all([
            admin.from('serial_numbers').select('id, serial_uuid, device_type_id, is_claimed, owner_id, claimed_at, nfc_tap_count, last_tapped_at, created_at')
                .eq('company_id', companyId).order('created_at', { ascending: false }).limit(2000),
            admin.from('device_types').select('id, name'),
        ])
        if (companySerials.error) throw companySerials.error
        const deviceName = new Map((deviceTypes.data || []).map(d => [d.id, d.name]))
        const personByUser = new Map((people || []).map(p => [p.user_id, p.id]))
        const cards = (companySerials.data || []).map(c => ({
                id: c.id,
                code: String(c.serial_uuid).slice(0, 8).toUpperCase(),
                device: (c.device_type_id && deviceName.get(c.device_type_id)) || 'Perangkat',
                active: Boolean(c.is_claimed),
                person_id: c.owner_id ? personByUser.get(c.owner_id) || null : null,
                claimed_at: c.claimed_at,
                taps: c.nfc_tap_count || 0,
                last_tapped_at: c.last_tapped_at,
                created_at: c.created_at,
            }))
        const unclaimed = cards.filter(c => !c.active).length

        const summary = summarizeCompany({ people: people || [], serials: serials.data || [], analytics: analytics.data || [], leads: leads.data || [] })
        return NextResponse.json({
            company,
            viewerRole: session.actor.role,
            people: (people || []).map(({ user_id: _userId, ...p }) => p),
            summary: { ...summary, counts: { ...summary.counts, unclaimed: unclaimed || 0 } },
            leads: leads.data || [],
            cards,
            leadsTruncated: (leads.data || []).length >= MAX_LEADS,
        }, { headers: PRIVATE })
    } catch (error) {
        console.error('Company workspace error:', error)
        return NextResponse.json({ error: 'Dashboard perusahaan tidak bisa dimuat' }, { status: 500, headers: PRIVATE })
    }
}

// Ubah status lead (hanya lead milik karyawan perusahaan ini).
export async function PATCH(request: Request) {
    try {
        const { session, status, companyId } = await access(request)
        if (status !== 200 || !session || !companyId) return denied(status)
        const body = await request.json()
        if (typeof body.leadId !== 'string' || !UUID.test(body.leadId) || !isCompanyLeadStatus(body.status)) {
            return NextResponse.json({ error: 'Data tidak valid' }, { status: 400, headers: PRIVATE })
        }
        const admin = session.admin
        const { data: lead } = await admin.from('leads').select('id, profile_id').eq('id', body.leadId).maybeSingle()
        if (!lead) return NextResponse.json({ error: 'Lead tidak ditemukan' }, { status: 404, headers: PRIVATE })
        const { data: owner } = await admin.from('profiles').select('company_id').eq('id', lead.profile_id).maybeSingle()
        if (!owner || owner.company_id !== companyId) return denied(403)

        const { error } = await admin.from('leads').update({ status: body.status }).eq('id', lead.id)
        if (error) throw error
        return NextResponse.json({ ok: true, status: body.status }, { headers: PRIVATE })
    } catch (error) {
        console.error('Company lead update error:', error)
        return NextResponse.json({ error: 'Status lead tidak bisa diubah' }, { status: 500, headers: PRIVATE })
    }
}
