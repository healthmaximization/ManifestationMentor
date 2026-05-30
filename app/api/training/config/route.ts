import { NextResponse } from "next/server";
import { DEFAULT_STYLE, DEFAULT_SYSTEM_PROMPT } from "@/lib/config";
import { isOwner } from "@/lib/auth";
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
    .from("manifestation_training_config")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    config:
      data ?? {
        id: "main",
        ...DEFAULT_STYLE,
        methodology: "hybrid",
        banned_phrases: [],
        qa_pairs: [],
        system_prompt: DEFAULT_SYSTEM_PROMPT
      }
  });
}

export async function PUT(request: Request) {
  const user = await requireOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json();
  const { data, error } = await createAdminSupabase()
    .from("manifestation_training_config")
    .upsert({
      id: "main",
      tone: payload.tone,
      response_length: payload.response_length,
      personality_traits: payload.personality_traits ?? [],
      custom_instructions: payload.custom_instructions ?? "",
      methodology: payload.methodology ?? "hybrid",
      banned_phrases: payload.banned_phrases ?? [],
      qa_pairs: payload.qa_pairs ?? [],
      system_prompt: payload.system_prompt ?? DEFAULT_SYSTEM_PROMPT,
      updated_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
