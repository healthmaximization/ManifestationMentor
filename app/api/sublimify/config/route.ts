import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { DEFAULT_SUBLIMINAL_IDEA_PROMPT, DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return isOwner(user?.email) ? user : null;
}

export async function GET() {
  const user = await requireOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await createAdminSupabase()
    .from("subliminal_generation_config")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    config: data ?? {
      id: "main",
      prompt: DEFAULT_SUBLIMINAL_PROMPT,
      idea_prompt: DEFAULT_SUBLIMINAL_IDEA_PROMPT,
      updated_at: new Date().toISOString()
    }
  });
}

export async function PUT(request: Request) {
  const user = await requireOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json();
  const { data, error } = await createAdminSupabase()
    .from("subliminal_generation_config")
    .upsert({
      id: "main",
      prompt: payload.prompt ?? DEFAULT_SUBLIMINAL_PROMPT,
      idea_prompt: payload.idea_prompt ?? DEFAULT_SUBLIMINAL_IDEA_PROMPT,
      updated_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
