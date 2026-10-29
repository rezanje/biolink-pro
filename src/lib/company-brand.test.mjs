import assert from 'node:assert/strict'
import { companyBrand } from './company-brand.mjs'
assert.deepEqual(companyBrand({ name: 'Candra Naya Lestari', theme: { primary: '#0F172A', accent: '#3B82F6' }, logo_url: null }), { primary: '#171e18', accent: '#e1563f', logo: '/cny-logo.png', isCny: true })
assert.equal(companyBrand({ name: 'Other Co', theme: { primary: '#123456', accent: '#abcdef' }, logo_url: 'https://example.test/a.png' }).primary, '#123456')
assert.equal(companyBrand({ name: 'Candra Naya Lestari', theme: { primary: '#223344', accent: '#556677' }, logo_url: null }).primary, '#223344')
assert.equal(companyBrand({ name: 'Other Co', theme: { primary: 'invalid', accent: '' }, logo_url: null }).primary, '#13283d')
