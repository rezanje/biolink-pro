import assert from 'node:assert/strict'
import { getCompanyDisplayName } from './profile-display.mjs'
import * as profileDisplay from './profile-display.mjs'

assert.equal(getCompanyDisplayName('Gentanala'), 'Gentanala')
assert.equal(getCompanyDisplayName({ name: 'Gentanala', logo_url: '/logo.png' }), 'Gentanala')
assert.equal(getCompanyDisplayName(null), '')
assert.equal(getCompanyDisplayName({ logo_url: '/logo.png' }), '')

assert.equal(typeof profileDisplay.isPublicTranslateEnabled, 'function', 'Public translate needs a saved visibility setting')
assert.equal(typeof profileDisplay.canUsePublicTranslate, 'function', 'Public translate must respect visibility and plan eligibility')

const { isPublicTranslateEnabled, canUsePublicTranslate } = profileDisplay
assert.equal(isPublicTranslateEnabled(undefined), true)
assert.equal(isPublicTranslateEnabled(null), true)
assert.equal(isPublicTranslateEnabled({}), true)
assert.equal(isPublicTranslateEnabled({ public_translate_enabled: true }), true)
assert.equal(isPublicTranslateEnabled({ public_translate_enabled: false }), false)

for (const tier of ['PREMIUM', 'B2B']) {
    assert.equal(canUsePublicTranslate({ tier }), true)
    assert.equal(canUsePublicTranslate({ tier, theme: { public_translate_enabled: true } }), true)
    assert.equal(canUsePublicTranslate({ tier, theme: { public_translate_enabled: false } }), false)
    assert.equal(canUsePublicTranslate({ tier, is_public: false }), false)
}
assert.equal(canUsePublicTranslate({ tier: 'FREE', theme: { public_translate_enabled: true } }), false)
assert.equal(canUsePublicTranslate(null), false)
assert.equal(canUsePublicTranslate(undefined), false)
