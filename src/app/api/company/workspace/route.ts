import { NextResponse } from 'next/server'
import { adminSession } from '@/lib/admin-session'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { companyWorkspaceEnabled, companyWorkspaceStatus, companyPage, isCompanyLeadStatus } from '@/lib/company-workspace.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGE_SIZE = 25
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' }

async function workspaceSession() {
    if (!companyWorkspaceEnabled(process.env.COMPANY_WORKSPACE_ENABLED)) return { status: 503 as const }
    const session = await adminSession()
    const status = companyWorkspaceStatus(session)
    if (status !== 200 || !session) return { status: status as 401 | 403 }
    return { status: 200 as const, session, companyId: session.actor.companyId as string }
}

function errorResponse(status: number) {
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Company workspace unavailable' }, { status, headers: PRIVATE_HEADERS })
}

export async function GET(request: Request) {
    try {
        const access = await workspaceSession()
        if (access.status !== 200) return errorResponse(access.status)
        const { admin } = access.session
        const companyId = access.companyId
        const params = new URL(request.url).searchParams
        const view = params.get('view') || 'summary'

        if (view === 'context') {
            const { data, error } = await admin.from('companies')
                .select('id, name, logo_url, website, theme').eq('id', companyId).single()
            if (error || !data) return NextResponse.json({ error: 'Company unavailable' }, { status: 404 })
            return NextResponse.json({ company: data }, { headers: PRIVATE_HEADERS })
        }

        if (view === 'people') {
            const page = companyPage(params.get('page'))
            const search = (params.get('q') || '').trim().slice(0, 80).replace(/[,%()]/g, ' ')
            let query = admin.from('profiles')
                .select('id, display_name, email, job_title, slug, avatar_url, lead_capture_enabled', { count: 'exact' })
                .eq('company_id', companyId)
            if (search) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`)
            const { data, count, error } = await query.order('display_name').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
            if (error) throw error
            return NextResponse.json({ people: data || [], total: count || 0, page, pageSize: PAGE_SIZE }, { headers: PRIVATE_HEADERS })
        }

        if (view === 'leads') {
            const page = companyPage(params.get('page'))
            const status = params.get('status') || 'all'
            if (status !== 'all' && !isCompanyLeadStatus(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
            const search = (params.get('q') || '').trim().slice(0, 80).replace(/[,%()]/g, ' ')
            let query = admin.from('leads')
                .select('id, profile_id, created_at, name, email, whatsapp, company, status, profiles!inner(display_name, company_id)', { count: 'exact' })
                .eq('profiles.company_id', companyId)
            if (status !== 'all') query = query.eq('status', status)
            if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
            const { data, count, error } = await query.order('created_at', { ascending: false })
                .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
            if (error) throw error
            return NextResponse.json({ leads: data || [], total: count || 0, page, pageSize: PAGE_SIZE }, { headers: PRIVATE_HEADERS })
        }

        if (view !== 'summary') return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
        const leadCount = (status?: string) => {
            let query = admin.from('leads')
                .select('id, profiles!inner(company_id)', { count: 'exact', head: true })
                .eq('profiles.company_id', companyId)
            if (status) query = query.eq('status', status)
            return query
        }
        const [people, allLeads, newLeads, contacted, converted, recent] = await Promise.all([
            admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
            leadCount(), leadCount('new'), leadCount('contacted'), leadCount('converted'),
            admin.from('leads').select('id, created_at, name, status, profiles!inner(display_name, company_id)')
                .eq('profiles.company_id', companyId).order('created_at', { ascending: false }).limit(5),
        ])
        if ([people, allLeads, newLeads, contacted, converted, recent].some(result => result.error)) {
            throw new Error('Company summary unavailable')
        }
        return NextResponse.json({
            counts: { people: people.count || 0, leads: allLeads.count || 0, new: newLeads.count || 0,
                contacted: contacted.count || 0, converted: converted.count || 0 },
            recentLeads: recent.data || [],
        }, { headers: PRIVATE_HEADERS })
    } catch {
        return NextResponse.json({ error: 'Company workspace unavailable' }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const access = await workspaceSession()
        if (access.status !== 200) return errorResponse(access.status)
        const body = await request.json()

        if (body.kind === 'lead_status') {
            if (typeof body.leadId !== 'string' || !UUID.test(body.leadId) || !isCompanyLeadStatus(body.status)) {
                return NextResponse.json({ error: 'Invalid lead update' }, { status: 400 })
            }
            const client = await createSessionClient()
            const { data, error } = await client.rpc('company_update_lead_status', { p_lead_id: body.leadId, p_status: body.status })
            if (error) return NextResponse.json({ error: 'Lead update was denied' }, { status: 403 })
            if (data !== true) return NextResponse.json({ error: 'Lead unavailable' }, { status: 404 })
            return NextResponse.json({ status: body.status })
        }

        if (body.kind === 'lead_capture') {
            if (typeof body.profileId !== 'string' || !UUID.test(body.profileId) || typeof body.enabled !== 'boolean') {
                return NextResponse.json({ error: 'Invalid cardholder update' }, { status: 400 })
            }
            const { data, error } = await access.session.admin.from('profiles')
                .update({ lead_capture_enabled: body.enabled })
                .eq('id', body.profileId).eq('company_id', access.companyId)
                .select('id, lead_capture_enabled').single()
            if (error || !data) return NextResponse.json({ error: 'Cardholder unavailable' }, { status: 404 })
            return NextResponse.json({ profile: data })
        }

        return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
    } catch {
        return NextResponse.json({ error: 'Company update unavailable' }, { status: 500 })
    }
}
