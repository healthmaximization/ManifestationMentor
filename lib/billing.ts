export type ProductKey = "manifestation_advisor" | "subliminal_maker" | "pro_bundle";

export type PlanKey = "monthly" | "yearly";

export const PRODUCT_ACCESS: Record<ProductKey, ProductKey[]> = {
  manifestation_advisor: ["manifestation_advisor"],
  subliminal_maker: ["subliminal_maker"],
  pro_bundle: ["manifestation_advisor", "subliminal_maker", "pro_bundle"]
};

const PRICE_ENV_BY_PRODUCT: Record<ProductKey, Record<PlanKey, string>> = {
  manifestation_advisor: {
    monthly: "STRIPE_PRICE_MANIFESTATION_MONTHLY",
    yearly: "STRIPE_PRICE_MANIFESTATION_YEARLY"
  },
  subliminal_maker: {
    monthly: "STRIPE_PRICE_SUBLIMIFY_MONTHLY",
    yearly: "STRIPE_PRICE_SUBLIMIFY_YEARLY"
  },
  pro_bundle: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY"
  }
};

export function getStripePriceId(productKey: ProductKey, planKey: PlanKey = "monthly") {
  const envName = PRICE_ENV_BY_PRODUCT[productKey][planKey];
  const priceId = process.env[envName];

  if (!priceId) {
    throw new Error(`Missing ${envName}.`);
  }

  if (!priceId.startsWith("price_")) {
    throw new Error(`${envName} must be a Stripe Price ID starting with price_, not a number or amount.`);
  }

  return priceId;
}

export function isProductKey(value: unknown): value is ProductKey {
  return value === "manifestation_advisor" || value === "subliminal_maker" || value === "pro_bundle";
}

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "monthly" || value === "yearly";
}

export function isActiveSubscriptionStatus(status: string) {
  return status === "active" || status === "trialing" || status === "manual";
}
