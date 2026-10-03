export const CARD_TEMPLATES = [
    { id: 'classic', name: 'Classic', description: 'The original Gentanala card' },
    { id: 'atelier', name: 'Atelier', description: 'Portrait-led and editorial' },
    { id: 'dial', name: 'Dial', description: 'Watch-inspired and precise' },
    { id: 'portrait', name: 'Portrait', description: 'Bold portrait and rounded white panels' },
    { id: 'voyage', name: 'Voyage', description: 'Sunny yellow and forest-green headlines' },
    { id: 'statement', name: 'Statement', description: 'Oversized type and a fresh green accent' },
]

export const CARD_FONTS = [
    { id: 'classic', name: 'Classic', description: 'Inter' },
    { id: 'editorial', name: 'Editorial', description: 'Serif heading · clean body' },
    { id: 'modern', name: 'Modern', description: 'Schibsted heading · clean body' },
    { id: 'bold', name: 'Bold', description: 'Archivo Black heading · clean body' },
    { id: 'condensed', name: 'Condensed', description: 'Anton heading · serif body' },
]

export const CARD_COLORS = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Green', value: '#10B981' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Forest', value: '#345648' },
    { name: 'Brass', value: '#B49964' },
    { name: 'Slate', value: '#2F4E52' },
    { name: 'Copper', value: '#9B6848' },
]

export function cardTemplate(value) {
    return CARD_TEMPLATES.some(template => template.id === value) ? value : 'classic'
}

export function cardFont(value) {
    return CARD_FONTS.some(font => font.id === value) ? value : 'classic'
}

export function cardAccent(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '#3B82F6'
}

export function canUsePremiumDesign(tier, validUntil, now = Date.now()) {
    if (tier === 'B2B') return true
    return tier === 'PREMIUM' && (!validUntil || new Date(validUntil).getTime() >= now)
}

const TEMPLATE_PRESETS = {
    atelier: { theme_mode: 'light', primary: '#345648', font_pair: 'editorial' },
    dial: { theme_mode: 'dark', primary: '#B49964', font_pair: 'modern' },
    portrait: { theme_mode: 'light', primary: '#111111', font_pair: 'classic' },
    voyage: { theme_mode: 'light', primary: '#123D1B', font_pair: 'bold' },
    statement: { theme_mode: 'light', primary: '#16AE69', font_pair: 'condensed' },
}

export function cardThemeForTemplate(value, currentTheme) {
    const template = cardTemplate(value)
    return { ...currentTheme, ...TEMPLATE_PRESETS[template], template_id: template }
}

export function cardThemeForPreview(savedTheme, draftTheme, isPreview, templateOverride) {
    if (!isPreview) return savedTheme
    const theme = { ...savedTheme, ...draftTheme }
    return CARD_TEMPLATES.some(template => template.id === templateOverride) && templateOverride !== theme.template_id
        ? cardThemeForTemplate(templateOverride, theme)
        : theme
}

export function accentTextColor(value) {
    const hex = cardAccent(value).slice(1)
    const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    const [red, green, blue] = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return luminance > 0.179 ? '#111820' : '#FFFFFF'
}
