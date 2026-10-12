// Public translation is paused during the founder pilot. Saved card settings stay intact.
const PUBLIC_TRANSLATE_ENABLED = false

export function getCompanyDisplayName(company) {
    if (typeof company === 'string') return company
    if (company && typeof company === 'object' && typeof company.name === 'string') return company.name
    return ''
}

export function isPublicTranslateEnabled(theme) {
    // Existing cards keep their current behavior until the owner switches it off.
    return theme?.public_translate_enabled !== false
}

export function canUsePublicTranslate(profile) {
    return Boolean(PUBLIC_TRANSLATE_ENABLED && profile
        && profile.is_public !== false
        && (profile.tier === 'PREMIUM' || profile.tier === 'B2B')
        && isPublicTranslateEnabled(profile.theme))
}

export function canUseInterpreter(userId) {
    // Use the verified founder account ID, never an editable profile or role.
    return userId === '47a89ca1-a84b-429d-a7d4-cabb92b5508e'
}
