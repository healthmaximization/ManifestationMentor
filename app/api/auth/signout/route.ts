import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await createRouteSupabase().auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
