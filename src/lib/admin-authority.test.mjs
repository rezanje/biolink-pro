import assert from 'node:assert/strict'
import { canManageTarget } from './admin-authority.mjs'

const owner = { userId: 'owner', role: 'user', companyId: null }
const admin = { userId: 'admin', role: 'company_admin', companyId: 'company-a' }
const superAdmin = { userId: 'super', role: 'super_admin', companyId: null }
assert.equal(canManageTarget(owner, null, 'unclaim', 'owner', 'owner'), true)
assert.equal(canManageTarget(owner, null, 'unclaim', 'other', 'other'), false)
assert.equal(canManageTarget(owner, null, 'reset', 'owner', null), false)
assert.equal(canManageTarget(admin, 'company-a', 'reset', 'staff', null), true)
assert.equal(canManageTarget(admin, 'company-b', 'reset', 'staff', null), false)
assert.equal(canManageTarget(admin, 'company-a', 'delete', 'staff', null), false)
assert.equal(canManageTarget(admin, 'company-a', 'unclaim', 'staff', 'other'), false)
assert.equal(canManageTarget(superAdmin, null, 'delete', 'staff', null), true)
