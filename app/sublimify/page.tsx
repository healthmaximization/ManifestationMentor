import { createServerSupabase } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
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

  return <SublimifyBuilder userEmail={user.email ?? ""} owner={isOwner(user.email)} />;
}

export const dynamic = "force-dynamic";
