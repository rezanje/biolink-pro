import assert from 'node:assert/strict'
import { buildProfileUpdates, canOwnerUpdate, touchesSuperAdminFields } from './profile-updates.mjs'

assert.deepEqual(
    buildProfileUpdates({
        enable_special_greeting_anim: false,
        special_editions: ['aruna', 'prabowo'],
        selected_special_greeting_anim: 'aruna',
        theme: { welcome_word: 'halo' },
        display_name: 'Reza',
        unknown_field: 'ignore-me',
    }),
    {
        enable_special_greeting_anim: false,
        special_editions: ['aruna', 'prabowo'],
        selected_special_greeting_anim: 'aruna',
        theme: { welcome_word: 'halo' },
        display_name: 'Reza',
    }
)

assert.deepEqual(
    buildProfileUpdates({
        tier: 'PREMIUM',
        special_edition: null,
        company_id: null,
    }),
    {
        tier: 'PREMIUM',
        special_edition: null,
        company_id: null,
    }
)

assert.equal(canOwnerUpdate({ display_name: 'Reza', theme: {} }, null), true)
assert.equal(canOwnerUpdate({ tier: 'PREMIUM' }, null), false)
assert.equal(canOwnerUpdate({ company_id: 'another' }, null), false)
assert.equal(canOwnerUpdate({ special_editions: ['aruna'] }, null), false)
assert.equal(canOwnerUpdate({ display_name: 'Reza' }, 'serial-id'), false)
assert.equal(canOwnerUpdate({ subscription_valid_until: null }, null), false)
assert.equal(canOwnerUpdate({ unlocked_templates: ['neon'] }, null), false)
assert.equal(canOwnerUpdate({ feature_grants: ['ai_bot'] }, null), false)
assert.equal(canOwnerUpdate({ slug: 'rani' }, null), true)
assert.equal(touchesSuperAdminFields({ tier: 'B2B' }), true)
assert.equal(touchesSuperAdminFields({ display_name: 'x' }), false)
assert.deepEqual(buildProfileUpdates({ subscription_valid_until: null, unlocked_templates: ['neon'] }), { subscription_valid_until: null, unlocked_templates: ['neon'] })
assert.equal(canOwnerUpdate({ ar_access: 'pilot' }, null), false)
assert.equal(touchesSuperAdminFields({ ar_access: 'off' }), true)
