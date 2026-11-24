// Paket promo (tabel promo_packages). Aturan pemberian hak ada di database
// (nfc_apply_promo); file ini hanya validasi form admin dan ringkasan teks.

import { CARD_TEMPLATES } from './card-design.mjs'

// Hanya fitur yang benar-benar dicek per pelanggan (hasFeature di dashboard).
// Fitur Premium lain (AI, desain, link custom) ikut lewat pilihan Premium.
export const PROMO_FEATURES = [
    { key: 'analytics_leads', label: 'Analytics & Leads' },
]

export const PROMO_TEMPLATES = CARD_TEMPLATES.filter(template => template.exclusive)

export function emptyPromoPackage() {
    return {
        name: '', description: '', is_active: false, applies_to_all: false,
        starts_at: '', ends_at: '', premium_mode: 'days', premium_days: 30,
        templates: [], features: [],
    }
}

/** Data siap simpan, atau { error }. Tanggal dari input datetime-local (waktu lokal). */
export function promoPackagePayload(form) {
    const name = String(form?.name || '').trim()
    if (!name) return { error: 'Nama paket wajib diisi' }
    if (!['none', 'days', 'unlimited'].includes(form.premium_mode)) return { error: 'Pilihan Premium tidak dikenal' }
    const days = Number(form.premium_days)
    if (form.premium_mode === 'days' && (!Number.isInteger(days) || days < 1 || days > 3650)) {
        return { error: 'Lama Premium harus 1–3650 hari' }
    }
    const startsAt = form.starts_at ? new Date(form.starts_at) : null
    const endsAt = form.ends_at ? new Date(form.ends_at) : null
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
        return { error: 'Tanggal tidak valid' }
    }
    if (startsAt && endsAt && startsAt >= endsAt) return { error: 'Tanggal selesai harus setelah tanggal mulai' }
    const templateIds = new Set(PROMO_TEMPLATES.map(template => template.id))
    const featureKeys = new Set(PROMO_FEATURES.map(feature => feature.key))
    return {
        name: name.slice(0, 100),
        description: String(form.description || '').trim().slice(0, 300) || null,
        is_active: Boolean(form.is_active),
        applies_to_all: Boolean(form.applies_to_all),
        starts_at: startsAt ? startsAt.toISOString() : null,
        ends_at: endsAt ? endsAt.toISOString() : null,
        premium_mode: form.premium_mode,
        premium_days: form.premium_mode === 'days' ? days : null,
        templates: (form.templates || []).filter(id => templateIds.has(id)),
        features: (form.features || []).filter(key => featureKeys.has(key)),
    }
}

/** Ringkasan isi paket untuk daftar admin. */
export function describePromoPackage(pkg) {
    const parts = []
    if (pkg.premium_mode === 'unlimited') parts.push('Premium tanpa batas')
    else if (pkg.premium_mode === 'days') parts.push(`Premium ${pkg.premium_days} hari`)
    const templates = PROMO_TEMPLATES.filter(template => (pkg.templates || []).includes(template.id)).map(template => template.name)
    if (templates.length) parts.push(`tema ${templates.join(', ')}`)
    const features = PROMO_FEATURES.filter(feature => (pkg.features || []).includes(feature.key)).map(feature => feature.label)
    if (features.length) parts.push(`fitur ${features.join(', ')}`)
    return parts.length ? parts.join(' · ') : 'Tanpa hak tambahan'
}

/** Status paket saat ini: 'on' | 'off' | 'scheduled' | 'ended'. */
export function promoPackageStatus(pkg, now = Date.now()) {
    if (!pkg.is_active) return 'off'
    if (pkg.starts_at && Date.parse(pkg.starts_at) > now) return 'scheduled'
    if (pkg.ends_at && Date.parse(pkg.ends_at) <= now) return 'ended'
    return 'on'
}
