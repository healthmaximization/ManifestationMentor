import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { askGemini } from "@/lib/gemini";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanLines(text: string, limit: number) {
  const seen = new Set<string>();

  return extractListItems(text)
    .split("\n")
    .flatMap((line) => line.split(/(?<=\.)\s+(?=(?:I|My|Every|Each|More|It)\b)/i))
    .map(normalizeAffirmation)
    .filter((line) => line.length >= 6 && line.length <= 180)
    .filter((line) => !isMetaLine(line))
    .filter(isAffirmationLine)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function isAffirmationLine(line: string) {
  return /^(i|i'm|i've|i already|i have|i choose|i allow|i feel|i trust|i welcome|i create|i become|my|every day|each day|more and more|it feels natural|it is safe|it is easy)/i.test(line);
}

function isMetaLine(line: string) {
  return (
    /[{}]|=>|<=|^\w+\d+\s/.test(line) ||
    /\b(user|prompt|rule|cannot|okay|starts?|varied|category|analysis|markdown|format|response)\b/i.test(line)
  );
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

function normalizeAffirmation(line: string) {
  return line
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/^(affirmation|line|text)\s*\d*\s*[:.)-]\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/^["'`]+|["'`,]+$/g, "")
    .trim();
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

  const { topic, count, tone } = await request.json();

  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const hasRequestedCount = count !== undefined && count !== null && count !== "";
  const safeCount = hasRequestedCount ? Math.max(8, Math.min(32, Number(count) || 20)) : 24;
  const safeTopic = topic.trim().slice(0, 700);
  const safeTone = tone ? String(tone).slice(0, 180) : "";

  const { data: config } = await admin
    .from("subliminal_generation_config")
    .select("*")
    .eq("id", "main")
    .maybeSingle();
  const messages = [
    {
      role: "system" as const,
      content: config?.prompt?.trim() || DEFAULT_SUBLIMINAL_PROMPT
    },
    {
      role: "user" as const,
      content: `Use the creator prompt as the only writing instructions.

Topic or user details:
${safeTopic}

${hasRequestedCount ? `Requested amount, unless the creator prompt says otherwise:\n${safeCount}\n\n` : ""}${safeTone ? `Tone, unless the creator prompt says otherwise:\n${safeTone}\n\n` : ""}Return only the affirmations, one per line. Do not add intro text, explanations, categories, analysis, markdown, or notes.`
    }
  ];
  const minimumCleanAffirmations = Math.min(6, safeCount);

  try {
    const reply = await askGemini(messages, {
      temperature: 0.62,
      maxTokens: Math.min(1200, safeCount * 34),
      timeoutMs: 30000,
      model: process.env.GEMINI_AFFIRMATION_MODEL || process.env.GEMINI_MODEL
    });
    const affirmations = cleanLines(reply, safeCount);

    if (affirmations.length >= minimumCleanAffirmations) {
      return NextResponse.json({ affirmations });
    }

    return NextResponse.json(
      { error: "The AI did not return enough clean affirmations. Try again or adjust the affirmation prompt." },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json({ error: getPublicGenerationError(error) }, { status: 504 });
  }
}

function getPublicGenerationError(error: unknown) {
  if (!(error instanceof Error)) return "Could not generate affirmations. Please try again.";

  const message = error.message.toLowerCase();
  if (message.includes("429") || message.includes("rate-limit") || message.includes("rate limit")) {
    return "The AI model is busy right now. Please try again in a few seconds.";
  }

  if (message.includes("took too long") || message.includes("abort")) {
    return "The AI took too long to respond. Please try again.";
  }

  return "Could not generate affirmations. Please try again.";
}
