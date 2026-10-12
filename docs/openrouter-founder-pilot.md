# OpenRouter founder translation pilot

Status: implemented and tested locally; not activated in production.

The interpreter uses `google/gemma-4-26b-a4b-it:free` through the OpenRouter chat completions endpoint. The model is fixed server-side, with zero maximum prompt/completion prices. There is no paid model or Gemini fallback. Founder authorization, public translation pause, input validation, origin validation and 30-second timeout remain intact. Other AI features still use their existing provider.

## Activation

1. Create or use the owner OpenRouter account and create an API key at https://openrouter.ai/settings/keys. Do not paste credentials in chat or commit them.
2. Store `OPENROUTER_API_KEY` as a sensitive server environment variable on the existing Vercel biolink-pro project, Production and Preview. Local testing uses the ignored `.env.local`.
3. Test Indonesian to Mandarin and Mandarin to Indonesian with the actual account, checking response quality and latency. Read the account's `/api/v1/key` quota without logging credentials.
4. Merge and deploy after configuration is available. Verify authenticated founder translation and anonymous rejection in production; test voice capture/playback on the actual phone.

Without the key, the route returns a safe unavailable response and never calls another provider. Rate/capacity errors return a safe temporary-unavailable response; malformed answers are rejected.

## Verification

45 Node tests passed, TypeScript check passed, targeted ESLint passed, production build passed. Coverage includes founder-only access, spoofed model rejection, OpenRouter request shape, successful Mandarin fixture, missing key, provider quota errors and malformed answers.

No actual OpenRouter completion or phone voice/playback test has run. Local environment has no OpenRouter key. Production environment was not changed. No credits purchased or paid fallback enabled.

Official references: https://openrouter.ai/docs/quickstart ; https://openrouter.ai/docs/guides/routing/provider-selection ; https://openrouter.ai/google/gemma-4-26b-a4b-it:free
