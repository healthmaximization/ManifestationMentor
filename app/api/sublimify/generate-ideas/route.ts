import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { DEFAULT_SUBLIMINAL_IDEA_PROMPT } from "@/lib/config";
import { askOpenRouter } from "@/lib/openrouter";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanLines(text: string, limit: number) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export async function POST(request: Request) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isOwner(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { seed = "" } = await request.json();
  const safeSeed = String(seed).slice(0, 500);
  const admin = createAdminSupabase();
  const { data: config } = await admin
    .from("subliminal_generation_config")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  try {
    const reply = await askOpenRouter([
      {
        role: "system",
        content: config?.idea_prompt?.trim() || DEFAULT_SUBLIMINAL_IDEA_PROMPT
      },
      {
        role: "user",
        content: `Requested number of ideas:\n12${safeSeed.trim() ? `\n\nDirection, audience, or extra context:\n${safeSeed.trim()}` : ""}`
      }
    ], {
      temperature: 0.72,
      maxTokens: 220,
      timeoutMs: 12000,
      retries: 1
    });

    const ideas = cleanLines(reply, 12);
    return NextResponse.json({ ideas });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate ideas." }, { status: 504 });
  }
}
