import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RESERVED_SLUGS, isReservedSlug, slugError } from './slug-rules.mjs'

assert.equal(isReservedSlug('admin'), true)
assert.equal(isReservedSlug(' Dashboard '), true)
assert.equal(isReservedSlug('gentanala-store'), true)
assert.equal(isReservedSlug('rani'), false)
assert.equal(slugError('rani'), null)
assert.equal(slugError('rani-putri-2026'), null)
assert.notEqual(slugError('ab'), null)
assert.notEqual(slugError('Rani'), null)
assert.notEqual(slugError('rani_putri'), null)
assert.notEqual(slugError('tap'), null)

// Daftar di kode harus sama dengan daftar di database.
const sql = fs.readFileSync(new URL('../../supabase/migrations/025_promo_bundle_entitlements.sql', import.meta.url), 'utf8')
const block = sql.slice(sql.indexOf('FUNCTION public.nfc_is_reserved_slug'), sql.indexOf("LIKE 'gentanala-%'"))
const sqlList = [...block.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1])
assert.deepEqual(new Set(sqlList), RESERVED_SLUGS)
