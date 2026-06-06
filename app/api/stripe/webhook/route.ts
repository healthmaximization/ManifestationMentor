import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isActiveSubscriptionStatus, isProductKey, PRODUCT_ACCESS, type ProductKey } from "@/lib/billing";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function fromUnix(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminSupabase();
  const productKey = subscription.metadata.product_key;
  const userId = subscription.metadata.user_id;
  const planKey = subscription.metadata.plan_key ?? "monthly";
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const itemWithPeriod = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;
  const currentPeriodStart = subscriptionWithPeriod.current_period_start ?? itemWithPeriod?.current_period_start;
  const currentPeriodEnd = subscriptionWithPeriod.current_period_end ?? itemWithPeriod?.current_period_end;

  if (!userId || !isProductKey(productKey)) {
    return;
  }

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      product_key: productKey,
      plan_key: planKey,
      source: "stripe",
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: fromUnix(currentPeriodStart),
      current_period_end: fromUnix(currentPeriodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end,
      metadata: subscription as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,product_key,source" }
  );

  const active = isActiveSubscriptionStatus(subscription.status);
  const accessProducts = PRODUCT_ACCESS[productKey as ProductKey];

  await Promise.all(
    accessProducts.map((accessProduct) =>
      admin.from("entitlements").upsert(
        {
          user_id: userId,
          product_key: accessProduct,
          access_level: productKey === "pro_bundle" ? "pro" : "standard",
          source: `stripe:${subscription.id}`,
          active,
          starts_at: fromUnix(currentPeriodStart) ?? new Date().toISOString(),
          ends_at: active ? null : new Date().toISOString(),
          metadata: {
            stripe_subscription_id: subscription.id,
            purchased_product_key: productKey,
            stripe_price_id: priceId
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,product_key,source" }
      )
    )
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Missing webhook secret or signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertSubscription(event.data.object as Stripe.Subscription);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (typeof session.subscription === "string") {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await upsertSubscription(subscription);
    }
  }

  return NextResponse.json({ received: true });
}
