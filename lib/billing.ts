export type ProductKey = "manifestation_advisor" | "subliminal_maker" | "pro_bundle";

export type PlanKey = "monthly";

export const PRODUCT_ACCESS: Record<ProductKey, ProductKey[]> = {
  manifestation_advisor: ["manifestation_advisor"],
  subliminal_maker: ["subliminal_maker"],
  pro_bundle: ["manifestation_advisor", "subliminal_maker", "pro_bundle"]
};

const PRICE_ENV_BY_PRODUCT: Record<ProductKey, string> = {
  manifestation_advisor: "STRIPE_PRICE_MANIFESTATION_MONTHLY",
  subliminal_maker: "STRIPE_PRICE_SUBLIMIFY_MONTHLY",
  pro_bundle: "STRIPE_PRICE_PRO_MONTHLY"
};

export function getStripePriceId(productKey: ProductKey) {
  const envName = PRICE_ENV_BY_PRODUCT[productKey];
  const priceId = process.env[envName];

  if (!priceId) {
    throw new Error(`Missing ${envName}.`);
  }

  return priceId;
}

export function isProductKey(value: unknown): value is ProductKey {
  return value === "manifestation_advisor" || value === "subliminal_maker" || value === "pro_bundle";
}

export function isActiveSubscriptionStatus(status: string) {
  return status === "active" || status === "trialing" || status === "manual";
}

