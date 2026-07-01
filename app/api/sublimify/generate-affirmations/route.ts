import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { askOpenRouter } from "@/lib/openrouter";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanLines(text: string, limit: number) {
  return extractListItems(text)
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .map((line) => line.replace(/^["'`]+|["'`,]+$/g, "").trim())
    .filter((line) => line.length >= 6 && line.length <= 180)
    .filter((line) => /^i\s/i.test(line))
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

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const hasPro = await hasProductAccess(admin, { id: user.id, email: user.email }, "subliminal_maker");

  if (!hasPro) {
    return NextResponse.json({ error: "AI-generated affirmations are included in Pro." }, { status: 403 });
  }

  const { topic, count = 24, tone = "calm, confident, emotionally believable" } = await request.json();

  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const safeCount = Math.max(8, Math.min(32, Number(count) || 24));
  const safeTopic = topic.trim().slice(0, 700);
  const safeTone = String(tone).slice(0, 180);

  const { data: config } = await admin
    .from("subliminal_generation_config")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  try {
    const reply = await askOpenRouter([
      {
        role: "system",
        content: config?.prompt?.trim() || DEFAULT_SUBLIMINAL_PROMPT
      },
      {
        role: "user",
        content: `Topic or user details:\n${safeTopic}

Requested number of affirmations:
${safeCount}

Tone:
${safeTone}

Output rules:
- Return only a JSON array of first-person affirmation strings.
- Do not explain, analyze, summarize, or use markdown.
- Every affirmation must start with "I".`
      }
    ], {
      temperature: 0.62,
      maxTokens: Math.min(900, safeCount * 24),
      timeoutMs: 45000,
      retries: 1,
      models: [
        process.env.OPENROUTER_AFFIRMATION_MODEL ?? "",
        "qwen/qwen3-coder:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free"
      ].filter(Boolean)
    });

    const affirmations = cleanLines(reply, safeCount);
    if (affirmations.length < Math.min(6, safeCount)) {
      return NextResponse.json({ error: "The AI did not return clean affirmations. Try again or adjust the affirmation prompt." }, { status: 502 });
    }

    return NextResponse.json({ affirmations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate affirmations." }, { status: 504 });
  }
}
