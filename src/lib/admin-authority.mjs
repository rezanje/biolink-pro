export function canManageTarget(actor, targetCompanyId, action, targetUserId, serialOwnerId) {
    if (actor.role === 'super_admin') return true
    if (action === 'unclaim' && actor.userId === targetUserId && serialOwnerId === actor.userId) return true
    if (actor.role !== 'company_admin' || !actor.companyId || targetCompanyId !== actor.companyId) return false
    if (action === 'delete') return false
    return action !== 'unclaim' || serialOwnerId === targetUserId
}
