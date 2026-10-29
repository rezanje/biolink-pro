import assert from 'node:assert/strict'
import { canManageCnyAccess } from './custom-design-access.mjs'
import { canSelectCardTemplate } from './card-design.mjs'

assert.equal(canManageCnyAccess(null), false)
assert.equal(canManageCnyAccess('user'), false)
assert.equal(canManageCnyAccess('company_admin'), false)
assert.equal(canManageCnyAccess('super_admin'), true)

assert.equal(canSelectCardTemplate('cny'), false)
assert.equal(canSelectCardTemplate('cny', { premium: true }), false)
assert.equal(canSelectCardTemplate('cny', { cnyEnabled: true }), true)
assert.equal(canSelectCardTemplate('classic'), true)
assert.equal(canSelectCardTemplate('portrait'), false)
assert.equal(canSelectCardTemplate('portrait', { premium: true }), true)
assert.equal(canSelectCardTemplate('unknown', { premium: true, cnyEnabled: true }), false)
