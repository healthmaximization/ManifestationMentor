import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { DEFAULT_SUBLIMINAL_IDEA_PROMPT } from "@/lib/config";
import { askOpenRouter } from "@/lib/openrouter";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isOwner(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { seed = "" } = await request.json();
  const admin = createAdminSupabase();
  const { data: config } = await admin
    .from("subliminal_generation_config")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  const reply = await askOpenRouter([
    {
      role: "system",
      content: config?.idea_prompt || DEFAULT_SUBLIMINAL_IDEA_PROMPT
    },
    {
      role: "user",
      content: `Generate 12 subliminal audio ideas.${seed?.trim() ? `\nDirection or audience: ${seed.trim()}` : ""}\nReturn only one idea title per line.`
    }
  ]);

  const ideas = reply
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);

  return NextResponse.json({ ideas });
}
