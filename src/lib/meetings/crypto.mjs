import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
const keyFor = secret => { if (!secret) throw new Error('Missing encryption key'); return createHash('sha256').update(`gentanala-calendar-v1:${secret}`).digest() }
export function encryptTokens(tokens, secret) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
    return { v: 1, iv: iv.toString('base64url'), data: data.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') }
}
export function decryptTokens(value, secret) {
    if (value?.v !== 1) throw new Error('Invalid encrypted credentials')
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(value.iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(value.tag, 'base64url'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64url')), decipher.final()]).toString('utf8'))
}
export function createOAuthState(userId, secret, now = Math.floor(Date.now() / 1000)) {
    const payload = Buffer.from(JSON.stringify({ userId, expires: now + 600, nonce: randomBytes(24).toString('base64url'), verifier: randomBytes(48).toString('base64url') })).toString('base64url')
    const mac = createHmac('sha256', keyFor(secret)).update(payload).digest('base64url')
    return `${payload}.${mac}`
}
export function readOAuthState(state, secret, userId, now = Math.floor(Date.now() / 1000)) {
    if (typeof state !== 'string' || state.length > 2000) throw new Error('Invalid OAuth state')
    const [payload, signature, extra] = state.split('.')
    const expected = createHmac('sha256', keyFor(secret)).update(payload || '').digest()
    const actual = Buffer.from(signature || '', 'base64url')
    if (extra || actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid OAuth state')
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (value.userId !== userId || value.expires <= now) throw new Error('OAuth state expired or owner changed')
    return value
}
