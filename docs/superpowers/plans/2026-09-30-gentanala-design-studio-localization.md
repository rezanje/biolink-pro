# Gentanala Design Studio and Localization — Delivery Plan

> Planning only. No application change, migration, push, or deployment is authorized by this document. Follow the companion product design and request implementation approval before starting Phase 1.

**Goal:** Accurate draft preview, stable curated templates, controlled typography/color, and English/Indonesian/Simplified Chinese UI across the owner dashboard and public business card.

**Current stack:** Next.js App Router, React, Tailwind, Supabase. Reuse current dashboard shell, public card, and theme storage. Do not add an external design or translation service.

## Phase 0 — Lock baseline and content inventory

**Inspect:** `src/app/dashboard/appearance/page.tsx`, `src/app/dashboard/profile/page.tsx`, `src/components/dashboard/DesktopPreview.tsx`, `src/components/dashboard/PhonePreview.tsx`, `src/app/[slug]/page.tsx`, `src/app/dashboard/layout.tsx`, `src/components/LeadCaptureModal.tsx`, current theme writers and public-card child components.

- [ ] Capture current Light/Dark/Glass output on a narrow phone and desktop; note all saved-card actions and tier behavior.
- [ ] Inventory owner-dashboard and public-card UI text, including modals, errors, empty states, and dates. Identify product text versus user-authored content.
- [x] Approve both Atelier and Dial mockups alongside Classic (Reza chose option C on 2026-09-30).
- [ ] Review initial font/palette options before Phase 2.
- [ ] Identify every read/write of `profiles.theme`; document fields that must survive appearance saves.

**Exit:** agreed visual samples and complete inventory; no user data changes.

## Phase 1 — Trustworthy preview and draft/save flow

**Likely files:** `src/app/dashboard/appearance/page.tsx`, `src/components/dashboard/DesktopPreview.tsx`, `src/components/dashboard/PhonePreview.tsx`, `src/app/[slug]/page.tsx`; add only the smallest shared presentational component(s) under `src/components/profile/` if needed.

- [ ] Separate saved appearance from a local unsaved draft. Preview renders the draft directly rather than polling browser storage.
- [ ] Share card layout and visual rules with the public card. Keep public-only analytics, lead capture, navigation, and external links out of preview mode.
- [ ] Put compact preview above controls on mobile, expandable for detail; keep beside controls on desktop. Avoid taking so much height that settings become unreachable.
- [ ] Provide Save, Discard, unsaved indicator, save-error recovery, and navigation warning. A refresh before Save must leave the public card unchanged.
- [ ] Save only appearance fields, preserving all other theme keys and current Free/Premium rules. Re-read latest saved data before merging to reduce stale-write risk.
- [ ] Add a focused regression check: draft != public before Save; draft == public after Save; Discard restores saved design; preview does not increment views/clicks.

**Exit:** owner can safely experiment and trust the preview before publishing.

## Phase 2 — Curated templates, fonts, and colors

**Likely files:** `src/app/dashboard/appearance/page.tsx`, shared card presentation from Phase 1, `src/app/[slug]/page.tsx`, `src/app/layout.tsx` or existing font setup, and a small template catalog under `src/lib/` if several layouts need one source of truth.

- [ ] Add Classic plus two approved layout templates, each with a stable identifier and thumbnail that represents the real card.
- [ ] Persist template ID and permitted appearance settings in the existing theme object; missing ID means Classic. Do not migrate or silently alter old cards.
- [ ] Add a few approved font pairings with Latin and Chinese glyph coverage; load only used fonts.
- [ ] Extend curated palettes; if custom accent is included, validate input and enforce readable contrast or reject unsafe combinations.
- [ ] Keep content and functions identical when switching layouts: contacts, links, gallery, files, QR, save/share, AI/translate entry, and lead capture where eligible.
- [ ] Add a focused compatibility check for old profiles, invalid/removed template IDs, free-tier gates, and each template at phone/desktop widths.

**Exit:** choosing a template changes presentation only; developer can add another stable catalog entry later without modifying existing cards.

## Phase 3 — Three-language interface

**Likely files:** owner dashboard pages/components, `src/app/[slug]/page.tsx`, `src/components/LeadCaptureModal.tsx`, `src/app/layout.tsx`, a small locale dictionary/helper under `src/lib/`, and `supabase/migrations/020_profile_ui_language.sql` for an account-level language preference.

- [ ] Define English, Indonesian, and Simplified Chinese message catalogs with stable keys and English fallback. Use product-owned strings only; leave owner/visitor text as entered.
- [ ] Add a dedicated owner language preference with English/Indonesian/Simplified Chinese validation, separate from appearance JSON. Add visible owner selection that survives sign-in and device changes; add an independent public visitor selector persisted in that browser. Determine language from saved choice first, then a supported browser language, else English.
- [ ] Translate the complete in-scope dashboard and public-card inventory, including dialogs, validation, empty states, lead capture, and formatted dates. Keep QR targets, slugs, contact data, and AI/interpreter content unchanged.
- [ ] Set document language appropriately for accessibility without changing the language of unrelated storefront/admin routes. Verify keyboard access and screen-reader names for selectors.
- [ ] Add checks for all three catalogs: missing keys, interpolation, fallback, mixed-language names/bios, and long Chinese labels on narrow screens.

**Exit:** owner and visitor can independently complete their in-scope journeys in any of the three languages.

## Phase 4 — Release checks, separate from implementation

- [ ] Run focused automated checks, TypeScript validation, lint on changed files, and production build.
- [ ] Manually compare preview and real public card for each template/language at phone and desktop widths, including slow connection and save failure.
- [ ] Test a legacy card, Free card, Premium/B2B card, long bio, many links, missing photo, Chinese text, and guest visitor.
- [ ] Confirm no analytics events originate from preview and no existing theme data disappears after save.
- [ ] Stage release only after visual approval and authenticated smoke test. Commit/push/deploy are separate actions needing explicit go-ahead.

## Suggested order and release slices

1. **Preview accuracy and safe Save** — foundation; can deliver independently.
2. **Templates and customization** — use the trusted preview; require template mockup sign-off.
3. **Language selector and translations** — independent workstream after string inventory, but final QA runs against all templates.
4. **Production release** — only after each slice passes checks and owner asks to deploy.

## Explicitly deferred

Traditional Chinese, automatic translation of owner content, unlimited drag-and-drop design, monetization changes, gift/NFC claim localization, and changes to AI or interpreter behavior. Revisit only with separate product decisions.
