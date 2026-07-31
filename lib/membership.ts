type SupabaseLike = {
  from: (table: string) => any;
};

export type Membership = "lite" | "pro";

export function normalizeMembershipEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeSkoolUsername(username?: string | null) {
  return username
    ?.trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase() ?? "";
}

export async function applyMembershipEntitlement(
  supabase: SupabaseLike,
  params: {
    email?: string | null;
    skoolUsername?: string | null;
    membership: Membership;
    source?: string;
    externalId?: string | null;
    eventType?: string | null;
    rawPayload?: unknown;
  }
) {
  const email = normalizeMembershipEmail(params.email);
  const skoolUsername = normalizeSkoolUsername(params.skoolUsername);
  if (!email && !skoolUsername) throw new Error("Missing Skool username or membership email.");

  const source = params.source ?? "skool";
  const now = new Date().toISOString();
  const status = params.membership === "pro" ? "active" : "inactive";
  const conflictTarget = skoolUsername ? "source,skool_username" : "source,email";

  const { data: entitlement, error: entitlementError } = await supabase
    .from("membership_entitlements")
    .upsert(
      {
        email: email || null,
        skool_username: skoolUsername || null,
        membership: params.membership,
        source,
        external_id: params.externalId ?? null,
        status,
        event_type: params.eventType ?? null,
        raw_payload: params.rawPayload ?? {},
        updated_at: now
      },
      { onConflict: conflictTarget }
    )
    .select("id,email,skool_username,membership,status")
    .single();

  if (entitlementError) throw entitlementError;

  const profileQuery = supabase
    .from("profiles")
    .select("id,email,skool_username,membership");

  const { data: profile, error: profileLookupError } = skoolUsername
    ? await profileQuery.eq("skool_username", skoolUsername).maybeSingle()
    : await profileQuery.eq("email", email).maybeSingle();

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
  email?: string | null,
  skoolUsername?: string | null
) {
  const normalizedEmail = normalizeMembershipEmail(email);
  const normalizedSkoolUsername = normalizeSkoolUsername(skoolUsername);
  if (!normalizedEmail && !normalizedSkoolUsername) return null;

  const entitlementQuery = supabase
    .from("membership_entitlements")
    .select("membership,status")
    .eq("source", "skool")
    .order("updated_at", { ascending: false })
    .limit(1);

  const { data: entitlement, error: entitlementError } = normalizedSkoolUsername
    ? await entitlementQuery.eq("skool_username", normalizedSkoolUsername).maybeSingle()
    : await entitlementQuery.eq("email", normalizedEmail).maybeSingle();

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
