import assert from 'node:assert/strict'
import { promoPackagePayload, describePromoPackage, promoPackageStatus, emptyPromoPackage, PROMO_TEMPLATES } from './promo-packages.mjs'

assert.deepEqual(PROMO_TEMPLATES.map(t => t.id), ['neon'])
assert.equal(promoPackagePayload({ ...emptyPromoPackage(), name: ' ' }).error, 'Nama paket wajib diisi')
assert.equal(promoPackagePayload({ ...emptyPromoPackage(), name: 'X', premium_days: 0 }).error, 'Lama Premium harus 1–3650 hari')
assert.equal(promoPackagePayload({ ...emptyPromoPackage(), name: 'X', starts_at: '2026-12-02T00:00', ends_at: '2026-12-01T00:00' }).error, 'Tanggal selesai harus setelah tanggal mulai')

const ok = promoPackagePayload({ ...emptyPromoPackage(), name: ' Promo Awal ', premium_mode: 'unlimited', premium_days: 30, templates: ['neon', 'dial', 'x'], features: ['analytics_leads', 'hack'], is_active: true })
assert.equal(ok.name, 'Promo Awal')
assert.equal(ok.premium_days, null)
assert.deepEqual(ok.templates, ['neon'])
assert.deepEqual(ok.features, ['analytics_leads'])
assert.equal(ok.starts_at, null)

assert.equal(describePromoPackage(ok), 'Premium tanpa batas · tema Neon Coast · fitur Analytics & Leads')
assert.equal(describePromoPackage({ premium_mode: 'days', premium_days: 30 }), 'Premium 30 hari')
assert.equal(describePromoPackage({ premium_mode: 'none' }), 'Tanpa hak tambahan')

const now = Date.parse('2026-11-24T00:00:00Z')
assert.equal(promoPackageStatus({ is_active: false }, now), 'off')
assert.equal(promoPackageStatus({ is_active: true }, now), 'on')
assert.equal(promoPackageStatus({ is_active: true, starts_at: '2026-12-01T00:00:00Z' }, now), 'scheduled')
assert.equal(promoPackageStatus({ is_active: true, ends_at: '2026-11-01T00:00:00Z' }, now), 'ended')
