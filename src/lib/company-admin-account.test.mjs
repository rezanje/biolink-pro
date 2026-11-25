import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { normalizeAdminEmail, generateAdminPassword, adminSlug } from './company-admin-account.mjs'

assert.equal(normalizeAdminEmail(' HRD@Contoh.Test '), 'hrd@contoh.test')
assert.equal(normalizeAdminEmail('bukan-email'), null)
assert.equal(normalizeAdminEmail(''), null)
for (let i = 0; i < 200; i++) {
    const p = generateAdminPassword(randomBytes)
    assert.equal(p.length, 16)
    assert.match(p, /[A-Z]/); assert.match(p, /[a-z]/); assert.match(p, /[2-9]/)
    assert.doesNotMatch(p, /[0O1lI]/)
}
assert.equal(adminSlug('hrd.cny@contoh.test', '0420'), 'hrdcny-0420')
assert.equal(adminSlug('___@contoh.test', '0001'), 'admin-0001')
