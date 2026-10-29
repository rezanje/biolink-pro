export function companyBrand(company) {
    const cny = company?.name?.trim().toLowerCase() === 'candra naya lestari'
    const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null
    const usesLegacyDefault = company?.theme?.primary?.toLowerCase() === '#0f172a' &&
        company?.theme?.accent?.toLowerCase() === '#3b82f6'
    return {
        primary: cny && usesLegacyDefault ? '#171e18' : (hex(company?.theme?.primary) || (cny ? '#171e18' : '#13283d')),
        accent: cny && usesLegacyDefault ? '#e1563f' : (hex(company?.theme?.accent) || (cny ? '#e1563f' : '#2563eb')),
        logo: company?.logo_url || (cny ? '/cny-logo.png' : null),
        isCny: cny,
    }
}
