import assert from 'node:assert/strict'
import { parsePilotUserIds, isArPilot, arCardFromProfile, normalizeSlug, arModeFor } from './ar-pilot.mjs'

const P = 'a0000000-0000-0000-0000-0000000000a1'
const ids = parsePilotUserIds(` ${P.toUpperCase()} , bukan-uuid,,`)
assert.equal(ids.size, 1)
assert.equal(isArPilot(ids, P), true)
assert.equal(isArPilot(ids, 'a0000000-0000-0000-0000-0000000000b2'), false)
assert.equal(isArPilot(ids, null), false)
assert.equal(isArPilot(parsePilotUserIds(''), P), false)

const card = arCardFromProfile({ slug: 'pilot', display_name: 'Pilot', job_title: 'CEO', company: 'Contoh', avatar_url: 'javascript:alert(1)', email: 'x@y', phone: '1', role: 'super_admin', tier: 'B2B' })
assert.deepEqual(card, { slug: 'pilot', display_name: 'Pilot', job_title: 'CEO', company: 'Contoh', avatar_url: null })
assert.equal(normalizeSlug(' ReZanje '), 'rezanje')
assert.equal(normalizeSlug('../etc'), null)

// Pilot vs preview privat
const OWNER = 'a0000000-0000-0000-0000-0000000000c3', OTHER = 'a0000000-0000-0000-0000-0000000000d4'
const pilotIds = parsePilotUserIds(P), previewIds = parsePilotUserIds(OWNER)
assert.equal(arModeFor({ pilotIds, previewIds, ownerUserId: P, viewerUserId: null }), 'pilot')            // pemindai anonim, kartu pilot
assert.equal(arModeFor({ pilotIds, previewIds, ownerUserId: OWNER, viewerUserId: OWNER }), 'preview')     // pemilik login
assert.equal(arModeFor({ pilotIds, previewIds, ownerUserId: OWNER, viewerUserId: null }), null)           // anonim, kartu preview
assert.equal(arModeFor({ pilotIds, previewIds, ownerUserId: OWNER, viewerUserId: OTHER }), null)          // akun lain, kartu preview
assert.equal(arModeFor({ pilotIds, previewIds, ownerUserId: OTHER, viewerUserId: OTHER }), null)          // tidak terdaftar sama sekali
