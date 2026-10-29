export const COMPANY_LEAD_STATUSES = ['new', 'contacted', 'converted', 'failed']

export function canAccessCompanyWorkspace(actor) {
    return actor?.role === 'company_admin' && typeof actor.companyId === 'string' && actor.companyId.length > 0
}

export function companyWorkspaceStatus(session) {
    if (!session) return 401
    return canAccessCompanyWorkspace(session.actor) ? 200 : 403
}

export function isCompanyLeadStatus(value) {
    return COMPANY_LEAD_STATUSES.includes(value)
}

export function companyPage(value) {
    const page = Number(value)
    return Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1
}
