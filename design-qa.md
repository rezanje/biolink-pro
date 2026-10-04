# Card theme QA

Final result: passed

## Evidence and scope

The requested addition is a selectable card theme inspired by the supplied board, with each owner's existing profile data and app controls.

- Source visual: `/tmp/codex-remote-attachments/01a100e2-9e1e-711a-854c-f638dd02108c/5F52FEBD-956D-458A-A7FA-26CCF51FFB58/1-Photo-1.jpg` (736 × 736 px, two presentation states).
- Rendered cover: `/tmp/portrait-cover-390.png`.
- Rendered detail: `/tmp/portrait-details-390.png`.
- Rendered desktop: `/tmp/portrait-desktop-768.png`.
- Settings: `/tmp/portrait-settings-390.png`.
- Mobile captures: 390 × 844 px, CSS viewport 390 × 844, device scale factor 1. Desktop capture: 768 × 844 px at factor 1.
- Source and both mobile captures were viewed together in one comparison input. The board's two cards are presentation examples; live captures show one interactive card. Content, card scale, available controls, and viewport differ intentionally, so pixel-for-pixel comparison is inappropriate.

## Fidelity surfaces

- Typography: Inter uses a heavy, tightly spaced cover heading and smaller detail heading, with readable body and compact labels. Long names and professions wrap within the panel. The reference's exact font is unspecified; Inter is the app's existing sans-serif.
- Layout: cream surround, dominant portrait, overlapping white panel, 36 px corners, black profession pill, round detail avatar, and horizontal gallery retain the reference's hierarchy. Expanded detail presents the full bio. Language selection, save contact, QR, links, and files remain available.
- Colors: cream `#f1eadb`, white panel, near-black heading/pill, and social brand colors. Dark mode uses brown backgrounds. Fallback avatar explicitly uses dark lettering on cream.
- Images: uploaded owner portrait is reused for the hero and round avatar; gallery uses existing uploaded items. Browser evidence uses existing demo/public assets. Hero uses a top-aligned cover crop; thumbnails preserve square crops. Reference portraits and music artwork are not part of this general-purpose profile theme.
- Content: real profile fields replace the board's sample identity. Gallery and social sections reflect the owner's data; empty gallery is omitted. New controls have English, Indonesian, and Chinese labels.

Focused typography, avatar/pill alignment, language control, gallery captions, and social controls were readable in the full-resolution mobile captures; additional cropped comparisons were unnecessary.

## Comparison history and fixes

1. Initial implementation placed the language selector on its own row, pushing the heading downward. Moved it into the panel's top-right corner; revised cover evidence shows the heading directly beneath the pull control.
2. Expanding the profile retained the prior scroll position, hiding the avatar and heading. Reset card scroll on expansion/collapse; revised detail evidence shows the avatar, name, profession, and full bio. Browser assertion checks scroll position zero.
3. Independent code review identified pale fallback initials in dark mode. Added explicit `#111` avatar text color against the cream avatar background.

No actionable P0/P1/P2 findings remain for the requested style adaptation. Different profile photography, gallery content, brand icons, and extra app controls are expected product differences.

## Verification

- Production-build browser integration: draft preview without publishing, expand/collapse, save/reload, gallery lightbox, files, QR, and contact download.
- Both states checked for horizontal page and panel overflow at 320, 375, 390, 430, and 768 px.
- Long name/role, dark mode, missing portrait, and existing Free-tier restrictions checked.
- Browser page-error collection empty.
- 28 Node tests passed. Modified files add no ESLint findings relative to the existing baseline. Production build passed.
- Independent read-only code review completed; fallback contrast finding fixed.

## Implementation checklist

- [x] Add Portrait to Appearance and persisted template validation.
- [x] Preserve existing features, data, and tier restrictions.
- [x] Verify mobile and desktop rendering and preview interactions.
- [x] Fix visual/interaction findings and complete build verification.

## Voyage and Statement additions

Final result: passed

### Comparison evidence

- Voyage source: `/tmp/codex-remote-attachments/01a100e2-9e1e-711a-854c-f638dd02108c/3CE6AB6A-177A-44B5-8B2D-B5BFDFE4C74F/1-Photo-1.jpg` (736 × 920 px).
- Statement source: `/tmp/codex-remote-attachments/01a100e2-9e1e-711a-854c-f638dd02108c/3CE6AB6A-177A-44B5-8B2D-B5BFDFE4C74F/2-Photo-2.jpg` (736 × 736 px).
- Final mobile captures: `/tmp/voyage-cover-390.png`, `/tmp/statement-cover-390.png`; 390 × 844 px, CSS viewport 390 × 844, scale factor 1.
- Narrow and desktop captures: `/tmp/{voyage,statement}-cover-{320,768}.png`; matching viewport width × 844 px, scale factor 1.
- Dark fallback captures: `/tmp/{voyage,statement}-dark-no-avatar-320.png`.
- Each source was viewed together with its rendered implementation in one comparison input. Source phone photography is a presentation frame; live captures show the app viewport. No density normalization was required, and source/implementation content and card scale intentionally differ. This is a style adaptation with owner profile content.

### Fidelity surfaces

- Typography: Voyage uses Archivo Black for heavy uppercase headings and Inter for readable green body text. Statement uses Anton for tall, tightly spaced headings and Georgia for the centered bio. Fonts are self-hosted through Next fonts and only fetched when used. Alternate font selections remain effective. Long names wrap inside the card.
- Spacing/layout: Voyage preserves the yellow header/hero, green identity, cream body, and rectangular green action. Statement preserves the large typographic introduction, warm white surface, serif supporting copy, and green accent. The owner's photo sits below the bio in a green-ringed circle. All original card controls remain below the introduction.
- Colors: Voyage light palette is `#f7e77a`, `#123d1b`, `#fff8ef`; Statement is `#fcfbf5`, `#211f1c`, `#16ae69`, with `#40ce7a` desktop surround. Dark variants retain clear foreground/background contrast. User accent changes still control the contact action.
- Images: use existing owner photos rather than advertising illustrations or sample brand artwork. Voyage center-crops the hero so the sample portrait subject is visible; Statement uses a round crop. Missing Voyage portraits retain the yellow/green cover and initial; missing Statement photos omit the portrait gracefully.
- Copy/content: owner name, company, role and full bio remain intact. Statement greeting follows the visitor UI language. Original music/travel/product copy is outside the scope of reusable profile themes.

Headings, language selection, bio text and portrait crops were readable in the full-resolution captures; no extra crop was necessary for focused inspection. No actionable P0/P1/P2 style-adaptation findings remain.

### Findings and iteration history

1. Initial screenshots captured the existing welcome animation instead of the completed card. Corrected the capture procedure to wait for the welcome overlay to finish; all final captures show the intended profile state.
2. Voyage's initial top-aligned photo cropped the sample portrait subject. Centered its hero crop; final Voyage evidence shows the subject clearly.
3. Review found dark Voyage language text inherited a dark color against dark green. Applied `color: var(--poster-ink)`; final dark capture and computed-style assertion confirm readable yellow text. The missing-photo cover now also uses the theme color.
4. Review found a 93-character bio could need four lines in Statement while the old three-line clamp offered no expansion below 150 characters. Both new themes now show the full bio. Production browser assertions at 320 px confirm the short bio's scroll height fits its client height; final screenshots also show the complete longer bio.

### Verification and checklist

- [x] Draft preview does not publish; save/reload preserves the template, font, accent, gallery and translation settings.
- [x] Both themes checked at 320, 375, 390, 430 and 768 px with no page/panel overflow.
- [x] Actual heading font families, alternate font selection and custom accent changes verified.
- [x] Language change, gallery lightbox, QR, files and contact download verified.
- [x] Long name/role, short bio, dark/missing photo, Liquid Glass and Free-tier restrictions verified.
- [x] Browser page-error collection empty; 28 Node tests pass; no new ESLint findings against the existing baseline.
- [x] Independent read-only review completed and both P2 findings corrected and checked in the production browser fixture.

## Horizontal theme picker

Final result: passed

The layout picker now presents a single horizontal row of cards with native touch scrolling and centered snap stops. The next card peeks into view. Browsing leaves the current theme unchanged; tapping updates the draft and Save publishes it. Loaded saved selections scroll horizontally into view without moving the page vertically.

Browser-rendered evidence: `/tmp/theme-rail-start-390.png`, `/tmp/theme-rail-selected-390.png`, `/tmp/theme-rail-selected-320.png` (viewport width × 844, scale factor 1). Reviewed the unselected and selected states. The existing fixed Save button and bottom navigation remain available while scrolling the page.

Production browser checks passed: actual CDP touch swipe, one-row geometry, next-card peek, selected draft preview, save/reload visibility, 320/375/390/430/768/1280 px widths without page overflow, keyboard Tab/Enter, reduced motion, Free-tier restrictions, and no page errors. Targeted translation test passes. ESLint has only the existing Supabase effect dependency warning. Independent code review found no actionable issue.

## Actual phone-screen theme previews

Final result: passed

The picker now renders each actual public-card page at a 375 × 812 CSS-pixel phone viewport, scaled to the carousel card width. Source truth is the app's public profile renderer for the same owner and theme. Rendered evidence: `/tmp/real-mini-start-390.png`, `/tmp/real-mini-selected-390.png`, `/tmp/real-mini-selected-320.png` (viewport width × 844, density 1). Typography, photos, bio, spacing and colors come from the same renderer as the live card; dimensions preserve the phone-screen aspect ratio. Each card represents the first screen of a scrollable profile. Accessible theme labels remain outside the miniature.

All six independent layout previews and their 375 × 812 internal viewports were verified in a production browser fixture. Active custom color is preserved; unselected themes use the same defaults as the actual selection handler. Native touch swipe, tap over inert miniature content, draft-only changes, save/reload, six responsive widths, keyboard navigation and reduced motion pass. Locked layouts can be demonstrated while Free selection remains disabled; a standalone public URL ignores the preview override and retains tier restrictions. Welcome/analytics remain suppressed inside design previews. No page errors, 28 passing Node tests, and no new lint findings. Independent review found no actionable issue; native lazy loading may load several nearby frames with shared browser-cached assets.

## Dashboard motion and metric counters

Final result: passed

Overview statistics, Green Impact and Analytics summary metrics count up for 1.1 seconds when visible, then finish on the exact data. Decimal precision and locale formatting are retained; static final values are available to screen readers. Viewed counters do not restart when scrolling back. Navigation remounts the counters for a new page visit. Reduced-motion preferences show final values immediately, including when the preference changes mid-animation.

Dashboard cards enter with a short staggered fade/12 px lift; route content fades without a parent transform, preserving fixed action positioning. Buttons/links respond to press and icons to pointer hover. Navigation uses the same interaction treatment. Viewport and mutation observers process new cards, remove discarded targets, ignore counter text churn and clean up on navigation.

Production browser fixture verified intermediate values and final `1,076`, `4`, `81`, `10.76`, `0.1076`, Analytics totals and `7.5%` CTR; once-only counting on scroll; card entry animations; four viewport widths (320/390/768/1280); reduced motion/live preference changes; Indonesian formatting; Free restrictions; no retained removed-card targets; and no page errors. Evidence: `/tmp/dashboard-counts-final-390.png`. The narrow-screen fixture also exposed a long profile URL exceeding its container; the link now truncates within its available width.

28 Node tests pass. New components have clean ESLint results; modified legacy files add no lint findings. Independent review's removed-target retention finding was fixed and checked with the browser observer instrumentation.
