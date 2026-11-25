// Dashboard perusahaan (B2B): aturan akses dan perhitungan ringkasan dari data
// mentah. Data diambil server (service role) dan selalu dibatasi company_id.

export const COMPANY_LEAD_STATUSES = ['new', 'contacted', 'converted', 'failed']

export const LEAD_STATUS_LABELS = {
    new: 'Baru',
    contacted: 'Dihubungi',
    converted: 'Jadi klien',
    failed: 'Gagal',
}

export function isCompanyLeadStatus(value) {
    return COMPANY_LEAD_STATUSES.includes(value)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Perusahaan yang boleh dilihat: admin perusahaan hanya perusahaannya sendiri;
 * super admin boleh membuka perusahaan mana pun lewat ?company=<id>.
 * Kembalikan { status, companyId }.
 */
export function companyAccess(actor, requestedCompanyId) {
    if (!actor) return { status: 401, companyId: null }
    if (actor.role === 'super_admin') {
        if (requestedCompanyId && UUID.test(requestedCompanyId)) return { status: 200, companyId: requestedCompanyId }
        if (actor.companyId) return { status: 200, companyId: actor.companyId }
        return { status: 400, companyId: null }
    }
    if (actor.role === 'company_admin' && typeof actor.companyId === 'string' && actor.companyId) {
        return { status: 200, companyId: actor.companyId }
    }
    return { status: 403, companyId: null }
}

const DAY = 86400000

function weekStart(ts) {
    const d = new Date(ts)
    d.setUTCHours(0, 0, 0, 0)
    const day = (d.getUTCDay() + 6) % 7 // Senin = 0
    return d.getTime() - day * DAY
}

/**
 * Ringkasan dashboard perusahaan.
 * people: [{ id, user_id, display_name, ... }]
 * serials: [{ owner_id, is_claimed, nfc_tap_count, last_tapped_at }]
 * analytics: [{ profile_id, event_type, created_at }] (30 hari terakhir)
 * leads: [{ id, profile_id, created_at, status }]
 * @param {{ people?: any[], serials?: any[], analytics?: any[], leads?: any[] }} input
 * @param {number} [now]
 */
export function summarizeCompany({ people = [], serials = [], analytics = [], leads = [] }, now = Date.now()) {
    const byProfile = new Map(people.map(p => [p.id, {
        id: p.id, devices: 0, taps: 0, views30: 0, clicks30: 0, leads: 0, leadsNew: 0, leadsConverted: 0,
        lastTap: null, lastLead: null,
    }]))
    const profileByUser = new Map(people.map(p => [p.user_id, p.id]))

    for (const s of serials) {
        const pid = profileByUser.get(s.owner_id)
        const row = pid && byProfile.get(pid)
        if (!row) continue
        row.devices += 1
        row.taps += s.nfc_tap_count || 0
        if (s.last_tapped_at && (!row.lastTap || s.last_tapped_at > row.lastTap)) row.lastTap = s.last_tapped_at
    }
    for (const a of analytics) {
        const row = byProfile.get(a.profile_id)
        if (!row || Date.parse(a.created_at) < now - 30 * DAY) continue
        if (a.event_type === 'view') row.views30 += 1
        else if (a.event_type === 'click') row.clicks30 += 1
    }

    const status = Object.fromEntries(COMPANY_LEAD_STATUSES.map(s => [s, 0]))
    const thisWeek = weekStart(now)
    const weeks = Array.from({ length: 8 }, (_, i) => ({ start: new Date(thisWeek - (7 - i) * 7 * DAY).toISOString(), count: 0 }))
    let leads30 = 0
    for (const l of leads) {
        const row = byProfile.get(l.profile_id)
        if (!row) continue
        const st = isCompanyLeadStatus(l.status) ? l.status : 'new'
        status[st] += 1
        row.leads += 1
        if (st === 'new') row.leadsNew += 1
        if (st === 'converted') row.leadsConverted += 1
        if (!row.lastLead || l.created_at > row.lastLead) row.lastLead = l.created_at
        const t = Date.parse(l.created_at)
        if (t >= now - 30 * DAY) leads30 += 1
        const idx = 7 - Math.floor((thisWeek - weekStart(t)) / (7 * DAY))
        if (idx >= 0 && idx < 8) weeks[idx].count += 1
    }

    const perPerson = [...byProfile.values()]
    const totalLeads = perPerson.reduce((n, r) => n + r.leads, 0)
    return {
        counts: {
            people: people.length,
            devices: perPerson.reduce((n, r) => n + r.devices, 0),
            taps: perPerson.reduce((n, r) => n + r.taps, 0),
            views30: perPerson.reduce((n, r) => n + r.views30, 0),
            leads: totalLeads,
            leads30,
            conversion: totalLeads ? Math.round((status.converted / totalLeads) * 100) : 0,
        },
        status,
        weeks,
        perPerson,
        topPeople: [...perPerson].filter(r => r.leads > 0).sort((a, b) => b.leads - a.leads || b.leadsConverted - a.leadsConverted).slice(0, 5),
    }
}
