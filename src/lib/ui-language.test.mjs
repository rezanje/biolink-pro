import assert from 'node:assert/strict'
import { UI_LANGUAGES, UI_MESSAGES, translate, uiLanguage } from './ui-language.mjs'

assert.equal(uiLanguage('zh-TW'), 'zh-CN')
assert.equal(uiLanguage('id-ID'), 'id')
assert.equal(uiLanguage('fr-FR'), 'en')
assert.deepEqual(UI_LANGUAGES.map(({ code }) => code), ['en', 'id', 'zh-CN'])
for (const [key, translations] of Object.entries(UI_MESSAGES)) {
    assert.equal(translations.length, 2, key)
    assert.ok(translations.every(Boolean), key)
}
assert.equal(translate('Welcome, {name}! 👋', 'zh-CN', { name: 'Reza' }), '欢迎，Reza！👋')
assert.equal(translate('Unknown text', 'id'), 'Unknown text')
