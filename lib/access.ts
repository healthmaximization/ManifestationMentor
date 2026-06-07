import { isOwner } from "@/lib/auth";
import type { ProductKey } from "@/lib/billing";

type SupabaseLike = {
  from: (table: string) => any;
};

export async function hasProductAccess(
  supabase: SupabaseLike,
  user: { id: string; email?: string | null },
  productKey: ProductKey
) {
  if (isOwner(user.email)) return true;

  const { data } = await supabase
    .from("entitlements")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .in("product_key", [productKey, "pro_bundle"])
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}
