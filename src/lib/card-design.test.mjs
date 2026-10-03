import assert from 'node:assert/strict'
import { cardTemplate, cardFont, cardAccent, accentTextColor, canUsePremiumDesign, cardThemeForPreview, cardThemeForTemplate } from './card-design.mjs'

assert.equal(cardTemplate(undefined), 'classic')
assert.equal(cardTemplate('dial'), 'dial')
assert.equal(cardTemplate('portrait'), 'portrait')
assert.equal(cardTemplate('voyage'), 'voyage')
assert.equal(cardTemplate('statement'), 'statement')
assert.equal(cardFont('bold'), 'bold')
assert.equal(cardFont('condensed'), 'condensed')
assert.equal(cardTemplate('removed-template'), 'classic')
assert.equal(cardFont('editorial'), 'editorial')
assert.equal(cardFont('unknown'), 'classic')
assert.equal(cardAccent('red'), '#3B82F6')
assert.equal(cardAccent('#345648'), '#345648')
assert.equal(cardAccent('#345648; background:red'), '#3B82F6')
assert.equal(accentTextColor('#B49964'), '#111820')
assert.equal(accentTextColor('#345648'), '#FFFFFF')
assert.equal(canUsePremiumDesign('FREE', null), false)
assert.equal(canUsePremiumDesign('B2B', null), true)
assert.equal(canUsePremiumDesign('PREMIUM', '2026-10-01T00:00:00Z', Date.parse('2026-09-30T00:00:00Z')), true)
assert.equal(canUsePremiumDesign('PREMIUM', '2026-09-29T00:00:00Z', Date.parse('2026-09-30T00:00:00Z')), false)
const saved = { template_id: 'classic', welcome_word: 'Hello', view_count: 12 }
const draft = { template_id: 'dial' }
assert.equal(cardThemeForPreview(saved, draft, false).template_id, 'classic')
assert.deepEqual(cardThemeForPreview(saved, draft, true), { ...saved, ...draft })
assert.equal(cardThemeForPreview(saved, {}, true).template_id, 'classic')
assert.equal(cardThemeForPreview({ ...saved, ...draft }, {}, false).template_id, 'dial')

const custom = { template_id: 'voyage', primary: '#EC4899', font_pair: 'modern', theme_mode: 'dark', image_filter: 'grayscale', gallery: ['existing'] }
assert.deepEqual(cardThemeForPreview(saved, custom, true, 'voyage'), { ...saved, ...custom })
assert.deepEqual(cardThemeForPreview(saved, custom, true, 'statement'), { ...saved, ...custom, template_id: 'statement', primary: '#16AE69', font_pair: 'condensed', theme_mode: 'light' })
assert.deepEqual(cardThemeForPreview(saved, custom, false, 'statement'), saved)
assert.deepEqual(cardThemeForPreview(saved, custom, true, 'invalid'), { ...saved, ...custom })
assert.equal(cardThemeForTemplate('dial', custom).theme_mode, 'dark')
assert.equal(cardThemeForTemplate('classic', custom).primary, '#EC4899')
