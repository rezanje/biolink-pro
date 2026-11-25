import assert from 'node:assert/strict'
import { companyDashboardTheme } from './company-dashboard-theme.mjs'

assert.equal(companyDashboardTheme(null), null)
assert.equal(companyDashboardTheme({ name: 'X', card_template: null }), null)
assert.equal(companyDashboardTheme({ name: 'X', card_template: 'classic' }), null)
assert.equal(companyDashboardTheme({ name: 'X', card_template: 'bogus' }), null)

const cny = companyDashboardTheme({ name: 'Candra Naya Lestari', card_template: 'cny', logo_url: null })
assert.equal(cny.mode, 'dark')
assert.equal(cny.vars['--color-canvas'], '#111811')
assert.equal(cny.vars['--company-accent'], '#D73A2B')
assert.equal(cny.logo, '/cny-logo.png')
assert.equal(cny.hero, '/cny-sprouts.jpg')
assert.match(cny.headingFont, /Georgia/)

const otherCny = companyDashboardTheme({ name: 'PT Lain', card_template: 'cny', logo_url: 'https://example.test/l.png' })
assert.equal(otherCny.logo, 'https://example.test/l.png')
assert.equal(otherCny.hero, null)

const neon = companyDashboardTheme({ name: 'X', card_template: 'neon' })
assert.equal(neon.mode, 'dark')
assert.equal(neon.vars['--color-coral'], '#FF2E88')

const atelier = companyDashboardTheme({ name: 'X', card_template: 'atelier' })
assert.equal(atelier.mode, 'light')
assert.equal(atelier.vars['--color-coral'], '#345648')
assert.equal(atelier.vars['--color-canvas'], undefined)
