// Pilot hologram AR: hanya kartu milik akun yang terdaftar di
// AR_PILOT_USER_IDS (user id, dipisah koma) yang bisa membuka hologram.
// Dicek di server berdasarkan PEMILIK kartu (user_id), bukan link: link bisa
// diganti, user id tidak.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parsePilotUserIds(value) {
    return new Set(String(value || '').split(',').map(s => s.trim().toLowerCase()).filter(s => UUID.test(s)))
}

export function isArPilot(pilotIds, ownerUserId) {
    return Boolean(ownerUserId) && pilotIds.has(String(ownerUserId).toLowerCase())
}

/** Data kartu yang boleh dikirim ke hologram (tanpa email, nomor, role, dll). */
export function arCardFromProfile(profile) {
    return {
        slug: profile.slug,
        display_name: profile.display_name || '',
        job_title: profile.job_title || '',
        company: profile.company || '',
        avatar_url: typeof profile.avatar_url === 'string' && /^https?:\/\//.test(profile.avatar_url) ? profile.avatar_url : null,
    }
}

export function normalizeSlug(value) {
    const s = String(value || '').trim().toLowerCase()
    return /^[a-z0-9_-]{1,64}$/.test(s) ? s : null
}
