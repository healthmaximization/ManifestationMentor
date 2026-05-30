# AI Manifestation Advisor

A Next.js app for an AI manifestation coach with owner-only training controls, Supabase persistence, and OpenRouter chat completion.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Create a storage bucket named `training-files`.
3. In Supabase Auth, enable the Email provider. Turn off "Confirm email" if you want instant email/password signup without confirmation links.
4. Add these redirect URLs in Supabase Auth:

```text
http://localhost:3000/auth/callback
https://your-vercel-domain.vercel.app/auth/callback
```

5. Copy `.env.example` to `.env.local` and fill in the values.
6. Run:

```bash
npm install
npm run dev
```

The owner account is hard-coded as `jelmer.huysmans123@gmail.com` in `lib/config.ts`.

## OpenRouter

The default model is `openrouter/owl-alpha`. You can override it with `OPENROUTER_MODEL`.
