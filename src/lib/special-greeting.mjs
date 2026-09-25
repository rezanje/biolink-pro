export const SPECIAL_EDITIONS = [
    { id: 'aruna', label: 'Aruna Series', animationLabel: 'Bunga Bangkai' },
    { id: 'prabowo', label: 'Prabowo Series', animationLabel: 'Prabowo' },
]

export const WELCOME_DURATIONS = [2, 3, 5, 8]

const SPECIAL_EDITION_IDS = SPECIAL_EDITIONS.map((edition) => edition.id)

export function normalizeSpecialEditions(value) {
    if (Array.isArray(value)) {
        return value.filter((edition) => SPECIAL_EDITION_IDS.includes(edition))
    }

    if (typeof value === 'string' && SPECIAL_EDITION_IDS.includes(value)) {
        return [value]
    }

    return []
}

export function getAvailableSpecialEditions(profile) {
    const editions = normalizeSpecialEditions(profile?.special_editions)

    if (editions.length > 0) return editions

    return normalizeSpecialEditions(profile?.special_edition)
}

export function getSelectedSpecialGreetingAnimation(profile) {
    const availableEditions = getAvailableSpecialEditions(profile)
    const selectedEdition = profile?.selected_special_greeting_anim

    if (availableEditions.includes(selectedEdition)) {
        return selectedEdition
    }

    if (!Array.isArray(profile?.special_editions) || profile.special_editions.length === 0) {
        const legacyEdition = normalizeSpecialEditions(profile?.special_edition)[0]
        return legacyEdition || null
    }

    return null
}

export function shouldShowSpecialGreetingAnimation(profile) {
    return Boolean(
        profile?.enable_special_greeting_anim &&
        getSelectedSpecialGreetingAnimation(profile)
    )
}

// Durasi layar sapaan setelah teksnya selesai tampil. Profil lama memakai
// default tiga detik supaya tetap punya pembuka yang nyaman dibaca.
export function getWelcomeCloseDelay(profile) {
    const duration = Number(profile?.welcome_duration)
    return WELCOME_DURATIONS.includes(duration) ? duration * 1000 : 3000
}
