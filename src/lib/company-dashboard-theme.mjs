// Tema dashboard perusahaan mengikuti tema kartu perusahaannya
// (companies.card_template), supaya portal terasa milik perusahaan itu.
// Hasilnya variabel warna Kabut yang ditimpa di pembungkus dashboard.

import { CARD_TEMPLATES, cardThemeForTemplate } from './card-design.mjs'

const CNY_NAMES = ['candra naya lestari', 'pt candra naya lestari', 'cny']

const DARK_SUPPORT = {
    '--color-avatar': '#2d3a2f',
    '--color-avatar-ink': '#e9e5d3',
    '--color-sky': '#3e5873',
    '--color-butter': '#7b6326',
    '--color-moss': '#4d6b48',
    '--color-success-soft': '#23402a',
    '--color-success-soft-ink': '#a9d6a0',
    '--shadow-card': '0 18px 38px -24px rgba(0, 0, 0, 0.8)',
    '--shadow-row': '0 10px 24px -18px rgba(0, 0, 0, 0.75)',
    '--shadow-ink': '0 18px 36px -20px rgba(0, 0, 0, 0.8)',
    '--shadow-nav': '0 16px 36px -18px rgba(0, 0, 0, 0.8)',
}

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(hex, base, amount) {
    const a = hexToRgb(hex), b = hexToRgb(base)
    if (!a || !b) return base
    return '#' + a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount)).toString(16).padStart(2, '0')).join('')
}

function darkPalette(accent, canvas = '#121214', surface = '#1c1c20') {
    return {
        '--color-canvas': canvas,
        '--color-surface': surface,
        '--color-fill-subtle': mix('#ffffff', surface, 0.06),
        '--color-track': mix('#ffffff', surface, 0.12),
        '--color-ink': '#f5f3e9',
        '--color-ink-2': '#b8bcb3',
        '--color-ink-3': '#80857d',
        '--color-hairline': 'rgba(245, 243, 233, 0.09)',
        // Aturan border global situs memakai --border.
        '--border': 'rgba(245, 243, 233, 0.09)',
        '--color-coral': accent,
        '--color-coral-soft': mix(accent, surface, 0.22),
        '--color-coral-soft-ink': mix(accent, '#ffffff', 0.55),
        '--company-accent': accent,
        ...DARK_SUPPORT,
    }
}

function lightPalette(accent) {
    return {
        '--color-coral': accent,
        '--color-coral-soft': mix(accent, '#ffffff', 0.16),
        '--color-coral-soft-ink': mix(accent, '#000000', 0.6),
        '--company-accent': accent,
    }
}

/**
 * Tema dashboard untuk satu perusahaan, atau null (pakai gaya Kabut bawaan).
 * { template, mode, vars, logo, hero, headingFont, tagline }
 */
export function companyDashboardTheme(company) {
    const template = CARD_TEMPLATES.find(t => t.id === company?.card_template)
    if (!template || template.id === 'classic') return null
    const preset = cardThemeForTemplate(template.id, {})
    const accent = /^#[0-9a-f]{6}$/i.test(preset.primary || '') ? preset.primary : '#E8703A'

    if (template.id === 'cny') {
        const isCny = CNY_NAMES.includes(String(company?.name || '').trim().toLowerCase())
        return {
            template: 'cny',
            mode: 'dark',
            vars: { ...darkPalette(accent, '#111811', '#1b231c'), '--color-fill-subtle': '#253026', '--color-track': '#324034', '--color-hairline': 'rgba(245, 243, 233, 0.1)', '--border': 'rgba(245, 243, 233, 0.1)' },
            logo: company?.logo_url || (isCny ? '/cny-logo.png' : null),
            hero: isCny ? '/cny-sprouts.jpg' : null,
            headingFont: "Georgia, 'Noto Serif CJK SC', 'Songti SC', serif",
            tagline: isCny ? 'Sustainable growth enabler' : null,
        }
    }

    const dark = preset.theme_mode === 'dark'
    return {
        template: template.id,
        mode: dark ? 'dark' : 'light',
        vars: dark ? darkPalette(accent) : lightPalette(accent),
        logo: company?.logo_url || null,
        hero: null,
        headingFont: null,
        tagline: null,
    }
}
