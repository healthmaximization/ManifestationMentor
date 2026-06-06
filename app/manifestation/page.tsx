import { createServerSupabase } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import AppShell from "@/components/app-shell";
import AuthScreen from "@/components/auth-screen";
import SetupScreen from "@/components/setup-screen";

export default async function ManifestationPage() {
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

  const { data: conversations } = await supabase
    .from("manifestation_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <AppShell
      userEmail={user.email ?? ""}
      owner={isOwner(user.email)}
      initialConversations={conversations ?? []}
    />
  );
}

export const dynamic = "force-dynamic";

