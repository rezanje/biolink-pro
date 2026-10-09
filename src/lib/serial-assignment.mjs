export function validateSerialAssignment(actor, input) {
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 100) return 'Count must be between 1 and 100'
    for (const field of ['company_id', 'event_id', 'device_type_id']) {
        if (input[field] != null && typeof input[field] !== 'string') return `Invalid ${field}`
    }
    if (input.company_id && input.event_id) return 'Choose either company or event'
    if (actor.role !== 'super_admin' && actor.role !== 'company_admin') return 'Forbidden'
    if (actor.role === 'company_admin' && (!actor.companyId || input.event_id || (input.company_id && input.company_id !== actor.companyId))) return 'Forbidden'
    return null
}
