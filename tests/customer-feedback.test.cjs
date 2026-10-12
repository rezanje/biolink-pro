const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(path, overrides = {}) {
    const module = { exports: {} }
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText
    new Function('require', 'module', 'exports', code)(name => {
        if (name in overrides) return overrides[name]
        if (name.startsWith('@/')) return { default: () => null }
        return require(name)
    }, module, module.exports)
    return module.exports
}

const english = { locale: 'en', t: (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '') }

test('visitor form remains English with an Indonesian or Chinese card', async () => {
    const { translate } = await import('../src/lib/ui-language.mjs')
    for (const locale of ['id', 'zh-CN']) {
        const Form = load('src/components/LeadCaptureModal.tsx', {
            '@/lib/supabase/client': { createClient: () => ({}) },
            '@/lib/ui-language.mjs': { translate },
            '@/components/UiLanguageProvider': { useUiLanguage: () => ({ locale, t: text => translate(text, locale) }) },
        }).default
        const html = renderToStaticMarkup(React.createElement(Form, { isOpen: true, onClose() {}, profileId: 'owner', profileName: 'Reza' }))
        assert.ok(html.includes('Connect with Reza'), locale)
        assert.ok(html.includes('Your name'), locale)
        assert.ok(html.includes('Submit'), locale)
    }
})

function componentHarness(path, overrides) {
    const state = []; const effects = []; let index = 0
    const fakeReact = {
        ...React,
        useState(initial) {
            const slot = index++
            if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial
            return [state[slot], next => { state[slot] = typeof next === 'function' ? next(state[slot]) : next }]
        },
        useRef(initial) {
            const slot = index++
            return state[slot] ||= { current: initial }
        },
        useCallback: fn => fn,
        useEffect: fn => effects.push(fn),
    }
    const Page = load(path, { react: fakeReact, ...overrides }).default
    return { effects, render(props) { index = 0; effects.length = 0; return Page(props) } }
}

function pageHarness(client) {
    return componentHarness('src/app/dashboard/analytics/page.tsx', {
        '@/lib/supabase/client': { createClient: () => client },
        '@/app/dashboard/tier-context': { useTier: () => ({ hasFeature: () => true }) },
        '@/components/UiLanguageProvider': { useUiLanguage: () => english },
        '@/lib/wa.mjs': { whatsappLink: () => null },
    })
}

function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return []
    if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}

function fakeClient() {
    let rows = []; let error = null; let reads = 0
    return {
        get reads() { return reads }, setRows(value) { rows = value }, fail(value) { error = value },
        auth: { getUser: async () => ({ data: { user: { id: 'owner-user' } } }) },
        from(table) {
            const filters = {}
            const query = {
                insert: async lead => { rows.push({ ...lead, id: 'submitted-lead', status: 'new', created_at: new Date().toISOString() }); return { error: null } },
                select() { return this }, eq(key, value) { filters[key] = value; return this }, gte() { return this }, lte() { return this },
                or() { return this }, order() { return this }, limit() { return this },
                single: async () => ({ data: { id: 'owner-profile' }, error: null }),
                then(resolve) { if (table === 'leads') reads++; return Promise.resolve({ data: table === 'leads' ? rows.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)) : [], error, count: rows.length }).then(resolve) },
            }
            return query
        },
    }
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('returning to dashboard refreshes leads and removes listeners on unmount', async () => {
    const previous = { window: global.window, document: global.document }
    global.window = new EventTarget()
    global.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const client = fakeClient(); const page = pageHarness(client)
    try {
        page.render()
        const cleanup = page.effects.map(effect => effect())
        await flush()
        client.setRows([{ id: 'new-lead', profile_id: 'owner-profile', name: 'Feedback test', status: 'new', created_at: new Date().toISOString() }])
        global.document.dispatchEvent(new Event('visibilitychange'))
        await flush()
        assert.ok(nodes(page.render(), node => node.props?.children === 'Feedback test').length, 'New lead should be visible after returning')
        const reads = client.reads
        cleanup.forEach(fn => typeof fn === 'function' && fn())
        global.window.dispatchEvent(new Event('focus'))
        await flush()
        assert.equal(client.reads, reads)
    } finally { Object.assign(global, previous) }
})

test('lead read failure shows an alert rather than an empty contacts claim', async () => {
    const previous = { window: global.window, document: global.document }
    global.window = new EventTarget()
    global.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const client = fakeClient(); client.fail(new Error('Database unavailable'))
    const page = pageHarness(client)
    try {
        page.render(); page.effects.forEach(effect => effect()); await flush()
        const tree = page.render()
        assert.ok(nodes(tree, node => node.props?.role === 'alert').length)
        assert.equal(nodes(tree, node => node.props?.children === 'No contacts yet').length, 0)
    } finally { Object.assign(global, previous) }
})

async function translateWithProvider(status, payload, options = {}) {
    const previous = { fetch: global.fetch, key: process.env.GOOGLE_GEMINI_API_KEY }
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
    global.fetch = async () => { options.onFetch?.(); return new Response(JSON.stringify(payload), { status }) }
    const policy = await import('../src/lib/profile-display.mjs')
    const route = load('src/app/api/interpreter/translate/route.ts', {
        '@/lib/supabase/server': { createClient: async () => ({
            auth: { getUser: async () => ({ data: { user: options.user === undefined ? { id: '47a89ca1-a84b-429d-a7d4-cabb92b5508e' } : options.user }, error: options.authError || null }) },
            from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { tier: 'PREMIUM', is_public: true, theme: {} } }) }),
        }) },
        '@/lib/profile-display.mjs': policy,
    })
    try {
        return await route.POST(new Request('https://example.com/api/interpreter/translate', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
            body: JSON.stringify({ sourceText: 'Selamat pagi', sourceLanguage: 'Indonesian', targetLanguage: 'English', ...(options.body || {}) }),
        }))
    } finally {
        global.fetch = previous.fetch
        if (previous.key === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
        else process.env.GOOGLE_GEMINI_API_KEY = previous.key
    }
}

test('depleted provider balance gives an unavailable message without billing or credential details', async () => {
    const response = await translateWithProvider(402, { error: { message: 'Private provider billing details' } })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'Translation is temporarily unavailable. Please try again later.' })
})

test('successful translation still returns the spoken sentence and translated text', async () => {
    const response = await translateWithProvider(200, { candidates: [{ content: { parts: [{ text: '{"translatedText":"Good morning"}' }] } }] })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { sourceText: 'Selamat pagi', translatedText: 'Good morning' })
})


test('submitted visitor details are readable by the matching owner tracker in an isolated fixture', async () => {
    const previous = { window: global.window, document: global.document, localStorage: global.localStorage, setTimeout: global.setTimeout }
    global.window = new EventTarget()
    global.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    global.localStorage = { setItem() {} }
    global.setTimeout = () => 0
    const client = fakeClient()
    const { translate } = await import('../src/lib/ui-language.mjs')
    const form = componentHarness('src/components/LeadCaptureModal.tsx', {
        '@/lib/supabase/client': { createClient: () => client }, '@/lib/ui-language.mjs': { translate },
    })
    const props = { isOpen: true, onClose() {}, profileId: 'owner-profile', profileName: 'Owner' }
    try {
        let tree = form.render(props)
        for (const [name, value] of Object.entries({ name: 'Fixture visitor', whatsapp: '+620000000000', email: 'fixture@example.test' })) {
            nodes(tree, node => node.props?.name === name)[0].props.onChange({ target: { name, value } })
        }
        tree = form.render(props)
        await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
        assert.ok(nodes(form.render(props), node => node.props?.children === 'Thank You!').length)
        const owner = pageHarness(client)
        owner.render(); const cleanup = owner.effects.map(effect => effect()); await flush()
        assert.ok(nodes(owner.render(), node => node.props?.children === 'Fixture visitor').length)
        cleanup.forEach(fn => typeof fn === 'function' && fn())
    } finally { Object.assign(global, previous) }
})

test('an older dashboard request cannot overwrite the newest lead results', async () => {
    const previous = { window: global.window, document: global.document }
    global.window = new EventTarget()
    global.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const client = fakeClient(); const pending = []; const from = client.from.bind(client)
    client.from = table => {
        const query = from(table); let head = false
        query.select = (fields, options) => { head = !!options?.head; return query }
        const then = query.then.bind(query)
        query.then = resolve => table === 'leads' && !head
            ? new Promise(done => pending.push(done)).then(resolve)
            : then(resolve)
        return query
    }
    const page = pageHarness(client)
    try {
        page.render(); const cleanup = page.effects.map(effect => effect()); await flush()
        global.window.dispatchEvent(new Event('focus')); await flush()
        assert.equal(pending.length, 2)
        pending[1]({ data: [{ id: 'latest', name: 'Latest visitor', status: 'new' }], error: null })
        await flush()
        pending[0]({ data: [{ id: 'older', name: 'Outdated visitor', status: 'new' }], error: null })
        await flush()
        const tree = page.render()
        assert.ok(nodes(tree, node => node.props?.children === 'Latest visitor').length)
        assert.equal(nodes(tree, node => node.props?.children === 'Outdated visitor').length, 0)
        cleanup.forEach(fn => typeof fn === 'function' && fn())
    } finally { Object.assign(global, previous) }
})


test('translation rejects anonymous and non-founder callers before any provider request', async () => {
    for (const user of [null, { id: 'ordinary-premium-user' }, { id: '53702a75-c7b3-41f9-8ec6-7571fa4518fc', role: 'super_admin' }]) {
        let calls = 0
        const response = await translateWithProvider(200, {}, {
            user, onFetch: () => calls++, body: { slug: 'rezanje', userId: '47a89ca1-a84b-429d-a7d4-cabb92b5508e', role: 'super_admin' },
        })
        assert.equal(response.status, 403)
        assert.equal(calls, 0)
    }
})

test('translation fails closed if the founder session cannot be verified', async () => {
    let calls = 0
    const response = await translateWithProvider(200, {}, { authError: new Error('Invalid session'), onFetch: () => calls++ })
    assert.equal(response.status, 403)
    assert.equal(calls, 0)
})

test('direct interpreter page hides the recording panel for non-founder users', () => {
    function Panel() {}
    for (const canTranslate of [false, true]) {
        const Page = load('src/app/dashboard/interpreter/page.tsx', {
            '@/app/dashboard/tier-context': { useTier: () => ({ canTranslate, isLoading: false, hasFeature: () => true }) },
            '@/components/UiLanguageProvider': { useUiLanguage: () => english },
            '@/components/interpreter/InterpreterPanel': Panel,
        }).default
        const panels = nodes(Page(), node => node.type === Panel)
        assert.equal(panels.length, canTranslate ? 1 : 0)
    }
})
