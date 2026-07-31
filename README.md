# AI Manifestation Advisor

A Next.js app for an AI manifestation coach with owner-only training controls, Supabase persistence, and OpenRouter chat completion.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Create a storage bucket named `training-files`.
3. In Supabase Auth, enable the Email provider. Keep "Confirm email" on for production accounts.
4. Add these redirect URLs in Supabase Auth:

```text
http://localhost:3000/auth/callback
https://your-vercel-domain.vercel.app/auth/callback
https://subliminal-academy.com/auth/callback
```

5. Copy `.env.example` to `.env.local` and fill in the values.
6. Run:

```bash
npm install
npm run dev
```

The owner account is hard-coded as `jelmer.huysmans123@gmail.com` in `lib/config.ts`.

## OpenRouter

The default model is `nvidia/nemotron-3-ultra-550b-a55b:free`. You can override it with `OPENROUTER_MODEL`.
If OpenRouter removes a configured model, the app automatically falls back to the current free defaults.
For higher-quality Subliminal Studio generations, you can also set task-specific model overrides. Affirmations intentionally ignore the global model and only accept free `:free` model ids because reasoning/coder models can return analysis instead of clean affirmations.

```text
OPENROUTER_IDEA_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_AFFIRMATION_MODEL=google/gemma-4-31b-it:free
```

## Membership

Subliminal Studio Pro access is controlled by `profiles.membership` in Supabase:

```text
lite
pro
```

All users default to `lite`. Zapier can grant or remove Skool Premium access by updating the matching profile row:

```text
membership=pro
membership=lite
```

For the first manual Skool Premium signups:

1. Ask the member to create a Studio account and enter their Skool username during signup.
2. Open Supabase Table Editor.
3. Go to `profiles`.
4. Find the row by `skool_username`.
5. Change `membership` from `lite` to `pro`.
6. If they cancel Skool Premium, change `membership` back to `lite`.

Future Skool webhook automation should send `skool_username` or `username` in the payload. The webhook matches on Skool username first, with email only as a legacy fallback.

The upgrade popup links to:

```text
https://www.skool.com/subliminal-academy-6300/plans?src=upgrade
```

## Sublimify

Subliminal Studio lives at:

```text
/studio
```

Run the latest `supabase/schema.sql` again after pulling this version. It adds `subliminal_generation_config`, which stores the owner-editable affirmation and idea prompts.

AI affirmation generation uses OpenRouter. Text-to-speech narrator audio uses Google Cloud Text-to-Speech through the server route at `/api/sublimify/tts`.

Add this in Vercel when you enable Google Cloud TTS:

```text
GOOGLE_TTS_API_KEY=your_google_cloud_api_key
```

Optional tuning values:

```text
GOOGLE_TTS_VOICE=en-US-Standard-J
GOOGLE_TTS_LANGUAGE_CODE=en-US
GOOGLE_TTS_SPEAKING_RATE=0.92
GOOGLE_TTS_PITCH=-2
```
