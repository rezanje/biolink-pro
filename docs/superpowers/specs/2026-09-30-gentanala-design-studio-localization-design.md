# Gentanala Design Studio and Language Selection — Product Design

Date: 2026-09-30
Status: proposed; approved direction from chat, not approved for implementation or deployment

## Outcome

An owner can shape a digital business card in one calm **Design Studio**, see an accurate preview before publishing changes, and choose a curated layout, fonts, and colors. Owners and visitors can independently read the product interface in English, Indonesian, or Simplified Chinese.

## Current baseline

- Appearance already offers Light, Dark, Glass, photo filter, and eight accent colors. Font selection is marked “Coming soon.” Premium gates already apply.
- Desktop preview is visible only at `xl` width. It reads a local browser snapshot every 500 ms and separately approximates the public page; the two can diverge.
- Public card appearance is persisted in `profiles.theme`, alongside unrelated profile settings. Profile and appearance screens both write profile data.
- Dashboard and public-card interface strings are hardcoded in multiple places. There is no shared language layer yet. The existing AI/chat and live interpreter have separate language behavior.

## User journeys

1. Owner opens **Appearance / Design Studio**. On mobile, a compact preview is visible above controls, with an expand action; on desktop it remains alongside controls. The preview uses current saved data plus unsaved design draft.
2. Owner tries a template, photo treatment, font pair, or palette. Only the draft and preview change. A visible “Unsaved changes” state offers **Save** and **Discard**. Leaving the page warns about the draft. Saving updates the public card; failed saves leave the draft intact.
3. Owner opens the public card from the studio to compare. Preview must not count as a profile view, click, or lead interaction.
4. Owner chooses dashboard language from a persistent, easy-to-find control. A visitor independently chooses public-card language. The selector labels remain recognizable in all three languages (English / Bahasa Indonesia / 简体中文).

## Design rules

- Begin with three deliberately different, developer-curated layouts, including the current card as the **Classic** default. The other two layouts require visual review before implementation. Each has a stable ID; adding a new template never changes a saved card on its own.
- Keep existing Light/Dark/Glass choices and tier entitlements unless separately approved. Template additions must not silently grant or revoke Premium features.
- Offer a small compatible set of heading/body font pairs and broader palette choices, with an optional custom accent color only when text and controls remain readable. Do not expose arbitrary CSS or a drag-and-drop editor.
- A template changes presentation, not the owner’s photo, bio, links, gallery, files, contact details, analytics, or NFC destination.
- The preview and public card share their visual card composition and design tokens. Preview-only actions are inert. Opening a public card is the way to test real links.
- Language switching translates product-owned UI, labels, buttons, validation, empty states, and date formatting within the owner dashboard and public business card, including lead capture. It does **not** translate owner-entered bio, job title, company, link/file titles, gift messages, or visitor-entered text. No AI translation is introduced.
- Public language follows the visitor’s own choice, not the card owner’s dashboard choice. The owner choice persists across sign-ins; the visitor choice persists in that browser. With no saved choice, use a supported browser language, otherwise English.
- Chinese means Simplified Chinese (`zh-CN`) in this proposal. Use fonts with Chinese glyph coverage, and check mixed Latin/Chinese wrapping. Traditional Chinese is out of scope.

## Scope boundary

Included: `/dashboard` owner experience and its main subpages, `/[slug]` public card, their shared dialogs/notifications, and the lead-capture form. Excluded for this release: storefront, admin, NFC claim/gift screens, transactional email, AI-generated replies, live-interpreter language list, automatic translation of user content, and a freeform page builder.

## Success criteria

- Draft adjustments are visible immediately at phone and desktop widths; refresh or Discard restores the saved design, and Save is the only action that changes the public card.
- Three templates remain visually distinct yet preserve every card action and content item. Old cards keep their current look until owners opt in.
- English, Indonesian, and Simplified Chinese UI can be completed end to end on dashboard and public card without untranslated product-owned labels; personal content remains untouched.
- Public card remains usable on a small phone, contrast is legible, keyboard/screen-reader labels work, and preview activity does not inflate analytics.

## Risks and controls

- **Preview drift:** extract shared visual pieces instead of maintaining two card implementations; compare the same profile in preview and public view at mobile and desktop sizes.
- **Save collisions:** appearance writes must merge only their own fields, preserving gallery, files, greeting, redirects, and other data currently stored in `theme`.
- **Legacy designs:** missing template/font fields resolve to current design; no bulk rewrite of existing profiles.
- **Translation completeness:** maintain one inventory of visible product strings and test missing-key fallback; do not silently run user content through AI.
- **Font weight/performance:** load only approved font families and glyph subsets actually used; check mobile load and layout shift.

## Open visual review before coding

Approve the two new template mockups and initial font/palette set. This is visual sign-off, not a blocker to documenting the implementation sequence. No code, migration, or production release is authorized by this document.
