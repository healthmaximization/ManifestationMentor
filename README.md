# AI Manifestation Advisor

A Next.js app for an AI manifestation coach with owner-only training controls, Supabase persistence, and OpenRouter chat completion.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Create a storage bucket named `training-files`.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Run:

```bash
npm install
npm run dev
```

The owner account is hard-coded as `jelmer.huysmans123@gmail.com` in `lib/config.ts`.

## OpenRouter

The default model is `openrouter/owl-alpha`. You can override it with `OPENROUTER_MODEL`.

