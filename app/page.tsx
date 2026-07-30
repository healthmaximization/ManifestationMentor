import SublimifyLanding from "@/components/sublimify-landing";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function HomePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <SublimifyLanding />;
  }

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let hasPro = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("membership")
      .eq("id", user.id)
      .maybeSingle();

    hasPro = data?.membership === "pro";
  }

  return <SublimifyLanding userEmail={user?.email ?? ""} hasPro={hasPro} />;
}

export const dynamic = "force-dynamic";
