import { isOwner } from "@/lib/auth";

type SupabaseLike = {
  from: (table: string) => any;
};

export async function hasProductAccess(
  supabase: SupabaseLike,
  user: { id: string; email?: string | null },
  _productKey?: string
) {
  if (isOwner(user.email)) return true;

  const { data } = await supabase
    .from("profiles")
    .select("membership")
    .eq("id", user.id)
    .maybeSingle();

  return data?.membership === "pro";
}
