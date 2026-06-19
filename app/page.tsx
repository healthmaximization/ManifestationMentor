import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SetupScreen from "@/components/setup-screen";
import ToolSelector from "@/components/tool-selector";

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <SetupScreen />;
  }

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/studio");
  }

  return <ToolSelector userEmail={user.email ?? ""} />;
}

export const dynamic = "force-dynamic";
