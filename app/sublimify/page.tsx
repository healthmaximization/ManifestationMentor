import { createServerSupabase } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import AuthScreen from "@/components/auth-screen";
import SetupScreen from "@/components/setup-screen";
import SublimifyBuilder from "@/components/sublimify-builder";

export default async function SublimifyPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <SetupScreen />;
  }

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthScreen />;
  }

  return <SublimifyBuilder userEmail={user.email ?? ""} owner={isOwner(user.email)} />;
}

export const dynamic = "force-dynamic";

