type SupabaseLike = {
  from: (table: string) => any;
};

export type Membership = "lite" | "pro";

export function normalizeMembershipEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export async function applyMembershipEntitlement(
  supabase: SupabaseLike,
  params: {
    email: string;
    membership: Membership;
    source?: string;
    externalId?: string | null;
    eventType?: string | null;
    rawPayload?: unknown;
  }
) {
  const email = normalizeMembershipEmail(params.email);
  if (!email) throw new Error("Missing membership email.");

  const source = params.source ?? "skool";
  const now = new Date().toISOString();
  const status = params.membership === "pro" ? "active" : "inactive";

  const { data: entitlement, error: entitlementError } = await supabase
    .from("membership_entitlements")
    .upsert(
      {
        email,
        membership: params.membership,
        source,
        external_id: params.externalId ?? null,
        status,
        event_type: params.eventType ?? null,
        raw_payload: params.rawPayload ?? {},
        updated_at: now
      },
      { onConflict: "source,email" }
    )
    .select("id,email,membership,status")
    .single();

  if (entitlementError) throw entitlementError;

  const { data: profile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id,email,membership")
    .eq("email", email)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  if (!profile?.id) {
    return { entitlement, profileUpdated: false };
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      membership: params.membership,
      updated_at: now
    })
    .eq("id", profile.id);

  if (profileUpdateError) throw profileUpdateError;

  return { entitlement, profileUpdated: true };
}

export async function syncProfileMembershipFromEntitlement(
  supabase: SupabaseLike,
  userId: string,
  email?: string | null
) {
  const normalizedEmail = normalizeMembershipEmail(email);
  if (!normalizedEmail) return null;

  const { data: entitlement, error: entitlementError } = await supabase
    .from("membership_entitlements")
    .select("membership,status")
    .eq("source", "skool")
    .eq("email", normalizedEmail)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (entitlementError) throw entitlementError;
  if (!entitlement?.membership) return null;

  const membership: Membership = entitlement.membership === "pro" && entitlement.status === "active" ? "pro" : "lite";

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      membership,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (profileError) throw profileError;

  return membership;
}
