import assert from 'node:assert/strict'
import {
    getAvailableSpecialEditions,
    getSelectedSpecialGreetingAnimation,
    shouldShowSpecialGreetingAnimation,
    getWelcomeCloseDelay
} from './special-greeting.mjs'

assert.deepEqual(
    getAvailableSpecialEditions({ special_editions: ['aruna', 'prabowo'], special_edition: 'aruna' }),
    ['aruna', 'prabowo']
)

assert.deepEqual(
    getAvailableSpecialEditions({ special_edition: 'aruna' }),
    ['aruna']
)

assert.equal(
    getSelectedSpecialGreetingAnimation({
        special_editions: ['aruna', 'prabowo'],
        selected_special_greeting_anim: 'prabowo',
    }),
    'prabowo'
)

assert.equal(
    getSelectedSpecialGreetingAnimation({
        special_editions: ['aruna', 'prabowo'],
        selected_special_greeting_anim: 'bukan-series',
    }),
    null
)

assert.equal(
    getSelectedSpecialGreetingAnimation({
        special_editions: [],
        special_edition: 'aruna',
    }),
    'aruna'
)

assert.equal(
    shouldShowSpecialGreetingAnimation({ special_edition: 'aruna', enable_special_greeting_anim: false }),
    false
)

assert.equal(
    shouldShowSpecialGreetingAnimation({
        special_editions: ['aruna', 'prabowo'],
        selected_special_greeting_anim: 'aruna',
        enable_special_greeting_anim: true
    }),
    true
)

assert.equal(
    shouldShowSpecialGreetingAnimation({ special_edition: 'prabowo', enable_special_greeting_anim: true }),
    true
)

assert.equal(
    shouldShowSpecialGreetingAnimation({ special_edition: null, enable_special_greeting_anim: true }),
    false
)

assert.equal(
    getWelcomeCloseDelay({ special_edition: 'aruna', enable_special_greeting_anim: false }),
    3000
)

assert.equal(
    getWelcomeCloseDelay({ special_edition: 'aruna', enable_special_greeting_anim: true }),
    3000
)

assert.equal(getWelcomeCloseDelay({ welcome_duration: 2 }), 2000)
assert.equal(getWelcomeCloseDelay({ welcome_duration: 5 }), 5000)
assert.equal(getWelcomeCloseDelay({}), 3000)
