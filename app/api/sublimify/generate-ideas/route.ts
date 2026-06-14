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

function fallbackIdeas(seed: string) {
  const direction = seed.trim().replace(/\s+/g, " ");
  const focus = direction ? ` ${direction}` : "";
  return [
    `Clear Skin Confidence${focus}`,
    `Magnetic Self Concept${focus}`,
    `Deep Sleep Reset${focus}`,
    `Body Confidence Upgrade${focus}`,
    `Calm Focus Mode${focus}`,
    `Relationship Confidence${focus}`,
    `Money Mindset Reset${focus}`,
    `Social Ease and Charisma${focus}`,
    `Workout Consistency Identity${focus}`,
    `Glow Up Self Image${focus}`,
    `Discipline Without Pressure${focus}`,
    `Morning Confidence Reset${focus}`
  ].map((idea) => idea.trim());
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
        content: `${(config?.idea_prompt || DEFAULT_SUBLIMINAL_IDEA_PROMPT).slice(0, 2500)}\n\nKeep titles short. No intro, no headings, no explanations.`
      },
      {
        role: "user",
        content: `Generate exactly 12 subliminal audio idea titles.${safeSeed.trim() ? `\nDirection or audience: ${safeSeed.trim()}` : ""}\nReturn only one concise title per line.`
      }
    ], {
      temperature: 0.72,
      maxTokens: 220,
      timeoutMs: 7500
    });

    const ideas = cleanLines(reply, 12);
    return NextResponse.json({ ideas: ideas.length ? ideas : fallbackIdeas(safeSeed) });
  } catch {
    return NextResponse.json({ ideas: fallbackIdeas(safeSeed) });
  }
}
