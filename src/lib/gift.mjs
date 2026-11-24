// Mode Kado
//
// Jam yang dibeli sebagai hadiah bisa membawa kejutan: saat pertama di-tap,
// penerima melihat pesan dari pengirim beserta video pilihannya, lalu diajak
// mengaktifkan kartunya sendiri. Setelah kartu diaktifkan, kadonya tidak
// hilang — tersimpan sebagai kenangan yang bisa dibuka lagi dari dashboard.
//
// ponytail: isian kado ditaruh sebagai kolom biasa di serial_numbers, bukan
// tabel sendiri. Satu jam = satu kado; kalau nanti butuh riwayat banyak kado
// per jam, baru dipecah jadi tabel.

import { normalizeUrl } from './redirect-mode.mjs'

/** Isian kado sudah cukup kalau ada link/video atau ucapan. */
export function hasGiftContent(url, message) {
    return Boolean(String(url || '').trim() || String(message || '').trim())
}

/** Kado dianggap siap tampil kalau dinyalakan dan ada link/video atau ucapan. */
export function hasGift(serial) {
    return Boolean(serial?.gift_enabled && hasGiftContent(serial?.gift_url, serial?.gift_message))
}

/** Kunci rahasia halaman isian kado milik pembeli. */
export function newGiftToken() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '')
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * ID video YouTube dari berbagai bentuk link yang biasa disalin orang
 * (watch?v=, youtu.be, /shorts/, /embed/). Null kalau bukan YouTube.
 */
export function youtubeId(url) {
    if (!url) return null
    let parsed
    try {
        parsed = new URL(normalizeUrl(String(url).trim()))
    } catch {
        return null
    }

    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return null

    const v = parsed.searchParams.get('v')
    if (v) return v

    const path = parsed.pathname.split('/').filter(Boolean)
    if (path[0] === 'shorts' || path[0] === 'embed' || path[0] === 'live') return path[1] || null
    return null
}

/**
 * Alamat pemutar YouTube yang bisa ditanam di halaman kita sendiri.
 *
 * `autoplay` hanya dipakai kalau pemutarnya muncul karena penerima menekan
 * tombol "buka kejutannya" — itu yang bikin browser mengizinkan suara ikut
 * jalan. `playsinline` menahan iOS supaya videonya tidak melompat ke pemutar
 * layar penuh bawaan dan menelan seluruh halaman kejutan.
 */
export function youtubeEmbedUrl(url, { autoplay = false } = {}) {
    const id = youtubeId(url)
    if (!id) return null

    const params = ['rel=0', 'modestbranding=1', 'playsinline=1']
    if (autoplay) params.push('autoplay=1')

    return `https://www.youtube-nocookie.com/embed/${id}?${params.join('&')}`
}
