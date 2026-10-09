import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSerialAssignment } from './serial-assignment.mjs'

const superAdmin = { role: 'super_admin', companyId: null }
test('accepts event serials with a chosen device', () => {
    assert.equal(validateSerialAssignment(superAdmin, { count: 2, device_type_id: 'device', event_id: 'event' }), null)
})
test('rejects conflicting company and event assignments', () => {
    assert.match(validateSerialAssignment(superAdmin, { count: 1, company_id: 'company', event_id: 'event' }), /company.*event/i)
})
test('company admins cannot assign events or another company', () => {
    const actor = { role: 'company_admin', companyId: 'own' }
    assert.ok(validateSerialAssignment(actor, { count: 1, event_id: 'event' }))
    assert.ok(validateSerialAssignment(actor, { count: 1, company_id: 'other' }))
    assert.equal(validateSerialAssignment(actor, { count: 1, company_id: 'own' }), null)
})
test('rejects invalid quantities and malformed identifiers', () => {
    for (const count of [0, 101, 1.5, '2']) assert.ok(validateSerialAssignment(superAdmin, { count }))
    assert.ok(validateSerialAssignment(superAdmin, { count: 1, device_type_id: {} }))
})
