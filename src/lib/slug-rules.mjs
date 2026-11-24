// Aturan link profil (my.gentanala.com/<slug>). Daftar ini harus sama dengan
// public.nfc_is_reserved_slug di supabase/migrations/025_promo_bundle_entitlements.sql.

export const RESERVED_SLUGS = new Set([
    'admin', 'administrator', 'api', 'app', 'auth', 'activate', 'login', 'logout',
    'register', 'signup', 'signin', 'dashboard', 'company', 'tap', 'gift', 'kado',
    'switch', 'get-started', 'customize', 'privacy', 'terms', 'legal', 'help',
    'support', 'about', 'contact', 'settings', 'account', 'billing', 'checkout',
    'shop', 'store', 'gentanala', 'gentanala-official', 'official', 'www', 'mail',
    'static', 'assets', 'public', 'images', 'favicon', 'robots', 'sitemap',
    'manifest', 'sw', 'offline', 'null', 'undefined', 'root', 'system',
])

export function isReservedSlug(slug) {
    const value = String(slug || '').trim().toLowerCase()
    return RESERVED_SLUGS.has(value) || value.startsWith('gentanala-')
}

/** Pesan galat (bahasa Inggris, diterjemahkan di UI) atau null kalau boleh. */
export function slugError(slug) {
    const value = String(slug || '')
    if (!/^[a-z0-9-]{3,40}$/.test(value)) return 'Your profile URL needs 3–40 lowercase letters, numbers, or hyphens.'
    if (isReservedSlug(value)) return 'This profile URL is reserved. Choose another one.'
    return null
}
