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

## Stripe

Add Stripe values in Vercel Project Settings and `.env.local`:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_or_pk_live
STRIPE_SECRET_KEY=sk_test_or_sk_live
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_webhook
STRIPE_PRICE_MANIFESTATION_MONTHLY=price_...
STRIPE_PRICE_SUBLIMIFY_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
```

Use `/api/stripe/create-checkout-session` to create subscription Checkout Sessions. Configure the Stripe webhook endpoint as:

```text
https://your-domain.com/api/stripe/webhook
```

Listen for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

## Sublimify

Sublimify lives at:

```text
/sublimify
```

Run the latest `supabase/schema.sql` again after pulling this version. It adds `subliminal_generation_config`, which stores the owner-editable affirmation prompt.

AI affirmation generation uses OpenRouter. Narrator audio is generated locally in the browser as a simple robotic WAV voice, so it does not require ElevenLabs, OpenAI TTS, or any paid voice API.
