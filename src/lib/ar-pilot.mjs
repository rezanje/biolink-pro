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

// Preview privat per deployment, tanpa perlu mengubah env Vercel:
// hanya berlaku di Vercel Preview dari cabang uji ini, dan selalu diabaikan di
// production. Berisi LINK profil (publik), bukan user id; pemiliknya dicari
// server, dan hologram tetap hanya untuk pemilik yang sedang login.
const BRANCH_PREVIEW = { branch: 'feat/ar-hologram', slugs: ['rezanje'] }

export function previewSlugsFor(env) {
    if (env.VERCEL_ENV === 'production') return new Set()
    const slugs = String(env.AR_PREVIEW_SLUGS || '').split(',').map(s => normalizeSlug(s)).filter(Boolean)
    if (env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === BRANCH_PREVIEW.branch) slugs.push(...BRANCH_PREVIEW.slugs)
    return new Set(slugs)
}

/** Ringkasan konfigurasi tanpa nilai (untuk verifikasi deployment). */
export function arConfigSummary(env) {
    return {
        environment: env.VERCEL_ENV || 'local',
        pilotProfiles: parsePilotUserIds(env.AR_PILOT_USER_IDS).size,
        previewAccounts: parsePilotUserIds(env.AR_PREVIEW_USER_IDS).size,
        previewProfiles: previewSlugsFor(env).size,
    }
}
