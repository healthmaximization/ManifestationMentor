import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth-screen";
import SetupScreen from "@/components/setup-screen";
import { createServerSupabase } from "@/lib/supabase/server";

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: { next?: string | string[]; authMode?: string | string[] };
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <SetupScreen />;
  }

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect(safeNextPath(searchParams?.next));
  }

  return <AuthScreen />;
}

export const dynamic = "force-dynamic";
