// Hologram AR, dua tahap (dicek di server berdasarkan PEMILIK kartu, yaitu
// profiles.user_id, bukan link: link bisa diganti, user id tidak):
//   * preview privat  (AR_PREVIEW_USER_IDS): hanya pemilik kartu yang sedang
//     login yang bisa membuka hologram kartunya sendiri. Pemindai lain tidak.
//   * pilot           (AR_PILOT_USER_IDS): siapa pun yang memindai kartu itu
//     (pengunjung tanpa login) bisa melihat hologramnya, sama seperti NFC.

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

/**
 * Mode hologram untuk satu kartu: 'pilot' | 'preview' | null.
 * viewerUserId = user yang sedang login (dari sesi server), atau null.
 */
export function arModeFor({ pilotIds, previewIds, ownerUserId, viewerUserId }) {
    if (isArPilot(pilotIds, ownerUserId)) return 'pilot'
    if (isArPilot(previewIds, ownerUserId) && viewerUserId && String(viewerUserId).toLowerCase() === String(ownerUserId).toLowerCase()) return 'preview'
    return null
}
