import { NextResponse } from "next/server";
import { getStripePriceId, isPlanKey, isProductKey, type PlanKey } from "@/lib/billing";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = createRouteSupabase();
    const admin = createAdminSupabase();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productKey, planKey = "monthly" } = await request.json();

    if (!isProductKey(productKey)) {
      return NextResponse.json({ error: "Invalid productKey" }, { status: 400 });
    }

    if (!isPlanKey(planKey)) {
      return NextResponse.json({ error: "Invalid planKey" }, { status: 400 });
    }

    const stripe = getStripe();
    const priceId = getStripePriceId(productKey, planKey);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    const { data: existingSubscription } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id
        }
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/sublimify?checkout=success`,
      cancel_url: `${siteUrl}/sublimify?checkout=cancelled`,
      client_reference_id: user.id,
      subscription_data: {
        metadata: {
          user_id: user.id,
          product_key: productKey,
          plan_key: planKey as PlanKey
        }
      },
      metadata: {
        user_id: user.id,
        product_key: productKey,
        plan_key: planKey as PlanKey
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create checkout session." },
      { status: 500 }
    );
  }
}
