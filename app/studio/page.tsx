import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { hasProductAccess } from "@/lib/access";
import { normalizeMembershipEmail, syncProfileMembershipFromEntitlement } from "@/lib/membership";
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
  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: normalizeMembershipEmail(user.email) || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  let syncedMembership: "lite" | "pro" | null = null;
  try {
    syncedMembership = await syncProfileMembershipFromEntitlement(admin, user.id, user.email);
  } catch (error) {
    console.error("Could not sync Skool membership entitlement", error);
  }
  const hasPro = owner || syncedMembership === "pro" || (await hasProductAccess(supabase, { id: user.id, email: user.email }, "subliminal_maker"));

  return <SublimifyBuilder userEmail={user.email ?? ""} owner={owner} hasPro={hasPro} />;
}

export const dynamic = "force-dynamic";
