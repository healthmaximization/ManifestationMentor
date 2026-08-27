import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { DEFAULT_SUBLIMINAL_IDEA_PROMPT } from "@/lib/config";
import { askGemini } from "@/lib/gemini";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanLines(text: string, limit: number) {
  const analysisPatterns = [
    /^the user wants/i,
    /^style analysis/i,
    /^format:/i,
    /^heavy use/i,
    /^target audience:/i,
    /^niches:/i,
    /^tone:/i,
    /^here are/i,
    /^sure[,!]/i
  ];

  return extractListItems(text)
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .map((line) => line.replace(/^["'`]+|["'`,]+$/g, "").trim())
    .filter((line) => line.length >= 8 && line.length <= 120)
    .filter((line) => !analysisPatterns.some((pattern) => pattern.test(line)))
    .slice(0, limit);
}

function extractListItems(text: string) {
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string").join("\n");
      }
    } catch {
      // Fall back to line parsing when a model returns malformed JSON.
    }
  }

  return text;
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
    const reply = await askGemini([
      {
        role: "system",
        content: config?.idea_prompt?.trim() || DEFAULT_SUBLIMINAL_IDEA_PROMPT
      },
      {
        role: "user",
        content: `Generate exactly 12 usable subliminal idea titles.

${safeSeed.trim() ? `Direction, audience, or extra context:\n${safeSeed.trim()}\n\n` : ""}Output rules:
- Return only a JSON array of strings.
- Do not explain, analyze, categorize, or describe the style.
- Do not include markdown.
- Each item must be a finished idea/title a user could click.`
      }
    ], {
      temperature: 0.82,
      maxTokens: 360,
      timeoutMs: 45000,
      model: process.env.GEMINI_IDEA_MODEL || process.env.GEMINI_MODEL
    });

    const ideas = cleanLines(reply, 12);
    if (ideas.length < 6) {
      return NextResponse.json({ error: "The AI did not return clean idea titles. Try again or adjust the idea prompt." }, { status: 502 });
    }

    return NextResponse.json({ ideas });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate ideas." }, { status: 504 });
  }
}
