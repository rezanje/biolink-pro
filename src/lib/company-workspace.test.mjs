import assert from 'node:assert/strict'
import { canAccessCompanyWorkspace, companyWorkspaceEnabled, companyWorkspaceStatus, isCompanyLeadStatus, companyPage } from './company-workspace.mjs'

assert.equal(companyWorkspaceEnabled(undefined), false)
assert.equal(companyWorkspaceEnabled('false'), false)
assert.equal(companyWorkspaceEnabled('true'), true)

assert.equal(canAccessCompanyWorkspace(null), false)
assert.equal(canAccessCompanyWorkspace({ role: 'user', companyId: 'company-a' }), false)
assert.equal(canAccessCompanyWorkspace({ role: 'super_admin', companyId: 'company-a' }), false)
assert.equal(canAccessCompanyWorkspace({ role: 'company_admin', companyId: null }), false)
assert.equal(canAccessCompanyWorkspace({ role: 'company_admin', companyId: 'company-a' }), true)
assert.equal(companyWorkspaceStatus(null), 401)
assert.equal(companyWorkspaceStatus({ actor: { role: 'user', companyId: 'company-a' } }), 403)
assert.equal(companyWorkspaceStatus({ actor: { role: 'super_admin', companyId: 'company-a' } }), 403)
assert.equal(companyWorkspaceStatus({ actor: { role: 'company_admin', companyId: 'company-a' } }), 200)
for (const status of ['new', 'contacted', 'converted', 'failed']) assert.equal(isCompanyLeadStatus(status), true)
assert.equal(isCompanyLeadStatus('all'), false)
assert.equal(isCompanyLeadStatus('won'), false)
assert.equal(companyPage('2'), 2)
assert.equal(companyPage('-1'), 1)
assert.equal(companyPage('1001'), 1)
