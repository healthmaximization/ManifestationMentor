import SublimifyLanding from "@/components/sublimify-landing";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeSkoolUsername } from "@/lib/membership";

export default async function HomePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <SublimifyLanding />;
  }

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let hasPro = false;
  let accountLabel = "";
  if (user) {
    const metadata = user.user_metadata as { skool_username?: string | null } | null;
    const metadataUsername = normalizeSkoolUsername(metadata?.skool_username);
    const { data } = await supabase
      .from("profiles")
      .select("membership,skool_username")
      .eq("id", user.id)
      .maybeSingle();

    hasPro = data?.membership === "pro";
    const skoolUsername = metadataUsername || normalizeSkoolUsername(data?.skool_username);
    accountLabel = skoolUsername ? `@${skoolUsername}` : user.email ?? "";
  }

  return <SublimifyLanding userEmail={user?.email ?? ""} accountLabel={accountLabel} hasPro={hasPro} />;
}

export const dynamic = "force-dynamic";
