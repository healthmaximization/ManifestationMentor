import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { hasProductAccess } from "@/lib/access";
import { normalizeMembershipEmail, normalizeSkoolUsername, syncProfileMembershipFromEntitlement } from "@/lib/membership";
import SetupScreen from "@/components/setup-screen";
import SublimifyBuilder from "@/components/sublimify-builder";
import SublimifyLanding from "@/components/sublimify-landing";

export default async function StudioPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <SetupScreen />;
  }

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return <SublimifyLanding />;
  }

  const owner = isOwner(user.email);
  const admin = createAdminSupabase();
  const metadata = user.user_metadata as { skool_username?: string | null } | null;
  const skoolUsername = normalizeSkoolUsername(metadata?.skool_username);
  const profileUpsert: { id: string; email: string | null; skool_username?: string | null; updated_at: string } = {
    id: user.id,
    email: normalizeMembershipEmail(user.email) || null,
    updated_at: new Date().toISOString()
  };
  if (skoolUsername) profileUpsert.skool_username = skoolUsername;
  await admin.from("profiles").upsert(
    profileUpsert,
    { onConflict: "id" }
  );
  const { data: profile } = await admin
    .from("profiles")
    .select("skool_username")
    .eq("id", user.id)
    .maybeSingle();
  const membershipSkoolUsername = skoolUsername || normalizeSkoolUsername(profile?.skool_username);
  const accountLabel = membershipSkoolUsername ? `@${membershipSkoolUsername}` : user.email ?? "";
  let syncedMembership: "lite" | "pro" | null = null;
  try {
    syncedMembership = await syncProfileMembershipFromEntitlement(admin, user.id, user.email, membershipSkoolUsername);
  } catch (error) {
    console.error("Could not sync Skool membership entitlement", error);
  }
  const hasPro = owner || syncedMembership === "pro" || (await hasProductAccess(supabase, { id: user.id, email: user.email }, "subliminal_maker"));

  return <SublimifyBuilder userEmail={user.email ?? ""} accountLabel={accountLabel} owner={owner} hasPro={hasPro} />;
}

export const dynamic = "force-dynamic";
