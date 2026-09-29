# Public Translate and Saved Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public, rate-limited live translation and private saved-card collections to Gentanala profiles.

**Architecture:** Extract the recorder interface into one reusable client component. The existing API keeps the signed-in owner flow and gains a public profile flow backed by an atomic hourly quota. A small saved-card table and dashboard page provide the collection.

**Tech Stack:** Next.js App Router, Supabase, Gemini, browser MediaRecorder, Tailwind, Lucide.

---

### Task 1: Add safe collection and public-usage storage

**Files:**
- Create: `supabase/migrations/019_public_translate_and_saved_cards.sql`

- [x] Create `saved_profiles` with unique member/profile pairs and owner-only read, create, and delete permissions.
- [x] Create `public_interpreter_usage` with a per-profile, per-browser, per-hour counter.
- [x] Add `consume_public_interpreter_quota` to verify an eligible public profile and atomically allow at most five translations per hour.
- [x] Notify the API layer to reload its schema.

### Task 2: Reuse translation interface on public cards

**Files:**
- Create: `src/components/interpreter/InterpreterPanel.tsx`
- Create: `src/components/interpreter/PublicInterpreter.tsx`
- Modify: `src/app/dashboard/interpreter/page.tsx`
- Modify: `src/app/api/interpreter/translate/route.ts`
- Modify: `src/app/[slug]/page.tsx`

- [x] Move recording, language selection, translation display, and playback into `InterpreterPanel`.
- [x] Keep the dashboard page's paid-owner gate and render that panel.
- [x] Add a compact public-card entry that opens the same panel in a modal.
- [x] Extend the endpoint to consume quota for a public Premium/B2B owner card while preserving authenticated owner use.
- [x] Validate short recordings, origin, browser ID, tier, and quota before contacting the translation provider.

### Task 3: Save and open public-card collections

**Files:**
- Create: `src/components/profile/SaveCardButton.tsx`
- Create: `src/app/dashboard/saved/page.tsx`
- Modify: `src/app/[slug]/page.tsx`
- Modify: `src/components/dashboard/DashboardShell.tsx`

- [x] Add a bookmark control that saves/removes the viewed card for the signed-in member.
- [x] Route signed-out visitors to sign in with the return URL preserved.
- [x] Add a saved-cards dashboard page and include it in the dashboard shell styling.
- [x] Render only the signed-in member's saved cards and provide each card's public link.

### Task 4: Verify and release readiness

**Files:**
- Modify: affected files above only if verification finds an issue.

- [x] Run TypeScript validation.
- [x] Run focused lint for new and modified source.
- [x] Run production build with placeholder local public configuration.
- [ ] Inspect the public card and saved-card UI at mobile width.
- [ ] Commit source and migration separately from deployment.
