import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const redirectUrl = new URL("/", request.url);
  const supabase = createRouteSupabase();

  if (error) {
    redirectUrl.searchParams.set("authError", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      redirectUrl.searchParams.set("authError", exchangeError.message);
      return NextResponse.redirect(redirectUrl);
    }
  } else if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash
    });
    if (verifyError) {
      redirectUrl.searchParams.set("authError", verifyError.message);
      return NextResponse.redirect(redirectUrl);
    }
  }

  redirectUrl.searchParams.set("authNotice", "Email confirmed. You can log in now.");
  return NextResponse.redirect(redirectUrl);
}
