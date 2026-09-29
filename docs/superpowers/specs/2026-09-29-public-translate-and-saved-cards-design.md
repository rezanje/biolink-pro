# Public Translate and Saved Cards Design

## Goal

Let visitors use short live translation on an eligible public card and let signed-in Gentanala members save that card into a private collection.

## Public profile

- Show a compact **Live Translate** card directly after the AI Concierge card for Premium and B2B owners.
- Open the existing push-to-talk translation interface in a sheet. The visitor chooses spoken and heard languages, records one sentence, then can play the result.
- A visitor receives five translations per owner card per hour. Audio and transcript are never stored.
- Keep the existing owner dashboard interpreter unlimited for its eligible owner.

## Saved cards

- Add a bookmark icon beside Save Contact, QR, and Share.
- A signed-in Gentanala member can save or remove the current public card. A signed-out visitor is taken to sign in first.
- After saving, show a short confirmation with a link to `/dashboard/saved`.
- `/dashboard/saved` lists the member's saved public cards with photo, name, company, title, and an open-card action.

## Data and safety

- `saved_profiles` stores one saved profile per member and cannot expose one member's collection to another.
- `public_interpreter_usage` stores only anonymous browser ID, owner profile ID, and hourly usage count; it stores neither audio nor text.
- A database function checks the public owner is Premium or B2B and atomically consumes the five-use allowance.
- The translation endpoint accepts either an eligible signed-in owner or a public eligible profile with a valid visitor ID.

## Visual direction

Use the public card's existing soft glass panels. Live Translate uses the language icon and a single calm call to action; bookmark remains a compact secondary icon so Save Contact stays primary.
