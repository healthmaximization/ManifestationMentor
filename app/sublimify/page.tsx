import { createServerSupabase } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { hasProductAccess } from "@/lib/access";
import SetupScreen from "@/components/setup-screen";
import SublimifyBuilder from "@/components/sublimify-builder";
import SublimifyLanding from "@/components/sublimify-landing";

export default async function SublimifyPage() {
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
  const hasPro = owner || (await hasProductAccess(supabase, { id: user.id, email: user.email }, "subliminal_maker"));

  return <SublimifyBuilder userEmail={user.email ?? ""} owner={owner} hasPro={hasPro} />;
}

export const dynamic = "force-dynamic";
