# OpenRouter founder translation pilot

Status: implementation verified; server credential saved as Secret for Production and Preview. Production release pending.

The interpreter uses `dots-studio/dots-3-note-preview:free` through the OpenRouter chat completions endpoint. The model is fixed server-side, with zero maximum prompt/completion prices. There is no paid model or Gemini fallback. Founder authorization, public translation pause, input validation, origin validation and 30-second timeout remain intact. Other AI features still use their existing provider.

## Activation

1. Create or use the owner OpenRouter account and create an API key at https://openrouter.ai/settings/keys. Do not paste credentials in chat or commit them.
2. Store `OPENROUTER_API_KEY` as a sensitive server environment variable on the existing Vercel biolink-pro project, Production and Preview. Local testing uses the ignored `.env.local`.
3. Test Indonesian to Mandarin and Mandarin to Indonesian with the actual account, checking response quality and latency. Read the account's `/api/v1/key` quota without logging credentials.
4. Merge and deploy after configuration is available. Verify authenticated founder translation and anonymous rejection in production; test voice capture/playback on the actual phone.

Without the key, the route returns a safe unavailable response and never calls another provider. Rate/capacity errors return a safe temporary-unavailable response; malformed answers are rejected.

## Verification

45 Node tests passed, TypeScript check passed, targeted ESLint passed, production build passed. After replacing the unavailable Gemma model, all 45 tests and TypeScript passed again. Coverage includes founder-only access, spoofed model rejection, OpenRouter request shape, successful Mandarin fixture, missing key, provider quota errors and malformed answers.

Actual OpenRouter tests on 2026-10-12: Gemma 4 26B and 31B returned provider-capacity HTTP 429. The fixed Dots3-Note Preview free model returned HTTP 200, valid translatedText JSON, and usage.cost=0 for Indonesian greetings to Mandarin (17.3 seconds), Mandarin greetings to Indonesian (8.0 seconds), and Indonesian pricing/shipping questions to Mandarin (3.8 seconds). This is a small phrase check, not a professional quality benchmark. Account quota was 50/day; dedicated key has $0.01 total limit and expires after 30 days. No credits purchased or paid fallback enabled. Phone voice/playback and authenticated production completion remain untested. Temporary credential file is used only for direct provider tests and must be removed after verification.

Official references: https://openrouter.ai/docs/quickstart ; https://openrouter.ai/docs/guides/routing/provider-selection ; https://openrouter.ai/dots-studio/dots-3-note-preview:free
