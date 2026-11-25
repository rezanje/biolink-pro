import assert from 'node:assert/strict'
import { companyAccess, summarizeCompany, isCompanyLeadStatus } from './company-workspace.mjs'

const CO = 'c0000000-0000-0000-0000-00000000000a'
assert.deepEqual(companyAccess(null), { status: 401, companyId: null })
assert.deepEqual(companyAccess({ role: 'user', companyId: CO }), { status: 403, companyId: null })
assert.deepEqual(companyAccess({ role: 'company_admin', companyId: CO }, 'c0000000-0000-0000-0000-00000000000b'), { status: 200, companyId: CO })
assert.deepEqual(companyAccess({ role: 'company_admin', companyId: null }), { status: 403, companyId: null })
assert.deepEqual(companyAccess({ role: 'super_admin', companyId: null }, CO), { status: 200, companyId: CO })
assert.deepEqual(companyAccess({ role: 'super_admin', companyId: null }, 'bukan-uuid'), { status: 400, companyId: null })
assert.equal(isCompanyLeadStatus('converted'), true)
assert.equal(isCompanyLeadStatus('hack'), false)

const now = Date.parse('2026-11-25T10:00:00Z')
const day = 86400000
const s = summarizeCompany({
    people: [{ id: 'p1', user_id: 'u1' }, { id: 'p2', user_id: 'u2' }],
    serials: [
        { owner_id: 'u1', nfc_tap_count: 10, last_tapped_at: '2026-11-20T00:00:00Z' },
        { owner_id: 'u1', nfc_tap_count: 5, last_tapped_at: '2026-11-24T00:00:00Z' },
        { owner_id: 'u2', nfc_tap_count: 3 },
        { owner_id: 'luar', nfc_tap_count: 99 },
    ],
    analytics: [
        { profile_id: 'p1', event_type: 'view', created_at: new Date(now - day).toISOString() },
        { profile_id: 'p1', event_type: 'click', created_at: new Date(now - day).toISOString() },
        { profile_id: 'p2', event_type: 'view', created_at: new Date(now - 40 * day).toISOString() },
        { profile_id: 'luar', event_type: 'view', created_at: new Date(now - day).toISOString() },
    ],
    leads: [
        { profile_id: 'p1', status: 'new', created_at: new Date(now - day).toISOString() },
        { profile_id: 'p1', status: 'converted', created_at: new Date(now - 10 * day).toISOString() },
        { profile_id: 'p2', status: 'contacted', created_at: new Date(now - 60 * day).toISOString() },
        { profile_id: 'luar', status: 'new', created_at: new Date(now - day).toISOString() },
    ],
}, now)
assert.deepEqual(s.counts, { people: 2, devices: 3, taps: 18, views30: 1, leads: 3, leads30: 2, conversion: 33 })
assert.deepEqual(s.status, { new: 1, contacted: 1, converted: 1, failed: 0 })
assert.equal(s.weeks.length, 8)
assert.equal(s.weeks.reduce((n, w) => n + w.count, 0), 2) // lead 60 hari lalu di luar 8 minggu
assert.equal(s.weeks[7].count, 1)
assert.equal(s.topPeople[0].id, 'p1')
const p1 = s.perPerson.find(r => r.id === 'p1')
assert.equal(p1.lastTap, '2026-11-24T00:00:00Z')
assert.equal(p1.leadsConverted, 1)
