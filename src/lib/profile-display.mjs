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
    return Boolean(profile
        && profile.is_public !== false
        && (profile.tier === 'PREMIUM' || profile.tier === 'B2B')
        && isPublicTranslateEnabled(profile.theme))
}
