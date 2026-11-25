// Akun admin perusahaan tanpa kartu: email + password dari tim Gentanala.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAdminEmail(value) {
    const email = String(value || '').trim().toLowerCase()
    return EMAIL.test(email) && email.length <= 254 ? email : null
}

// Password acak 16 karakter tanpa huruf yang mirip (0/O, 1/l/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export function generateAdminPassword(randomBytes) {
    const bytes = randomBytes(32)
    let out = ''
    for (const b of bytes) {
        if (b >= 248) continue // hindari bias modulo (248 = 56 * 4,43…)
        out += ALPHABET[b % ALPHABET.length]
        if (out.length === 16) break
    }
    if (out.length < 16) return generateAdminPassword(randomBytes)
    // Pastikan ada huruf besar, kecil, dan angka.
    return /[A-Z]/.test(out) && /[a-z]/.test(out) && /[2-9]/.test(out) ? out : generateAdminPassword(randomBytes)
}

/** Link profil internal admin (tidak tampil publik). */
export function adminSlug(email, random4) {
    const base = email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 20) || 'admin'
    return `${base}-${random4}`
}
