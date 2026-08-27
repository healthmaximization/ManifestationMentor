import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { askGemini } from "@/lib/gemini";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OUTPUT_FORMAT_GUARD = `Output format requirements:
- Return only the final affirmation lines.
- Do not answer, verify, restate, or checklist the creator prompt.
- Do not include labels, headings, notes, markdown, or explanations.`;

function cleanLines(text: string, limit: number) {
  const seen = new Set<string>();

  return extractListItems(text)
    .split("\n")
    .map(normalizeAffirmation)
    .filter((line) => line.length > 0)
    .filter((line) => !isOutputArtifact(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function isOutputArtifact(line: string) {
  return (
    /^(yes|no|checked|done|correct|affirmations?|notes?|output|result|response)\.?$/i.test(line) ||
    /\b(emotionally believable|no negations|topic clear|checked|creator prompt|requirements?|criteria|markdown|checklist)\b/i.test(line) ||
    /^(here are|sure[,!]|of course|below are|these are)/i.test(line)
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
  const creatorPrompt = config?.prompt?.trim() || DEFAULT_SUBLIMINAL_PROMPT;
  const promptWithOutputGuard = `${creatorPrompt}\n\n${OUTPUT_FORMAT_GUARD}`;
  const userRequest = `Topic or user details:
${safeTopic}

${safeTone ? `Tone or extra context:\n${safeTone}` : ""}`;
  const messages = [
    {
      role: "system" as const,
      content: promptWithOutputGuard
    },
    {
      role: "user" as const,
      content: hasRequestedCount ? `${userRequest}\n\nRequested amount:\n${safeCount}` : userRequest
    }
  ];
  const minimumCleanAffirmations = Math.min(8, safeCount);

  try {
    const model = process.env.GEMINI_AFFIRMATION_MODEL || process.env.GEMINI_MODEL;
    let reply = await askGemini(messages, {
      temperature: 0.48,
      maxTokens: Math.min(1400, safeCount * 42),
      timeoutMs: 30000,
      model
    });
    let affirmations = cleanLines(reply, safeCount);

    if (affirmations.length < minimumCleanAffirmations) {
      reply = await askGemini([
        {
          role: "system" as const,
          content: promptWithOutputGuard
        },
        {
          role: "user" as const,
          content: `${userRequest}

The previous output was invalid because it included commentary, checklist text, or too few final lines.
Return the final affirmation lines only.`
        }
      ], {
        temperature: 0.35,
        maxTokens: Math.min(1400, safeCount * 42),
        timeoutMs: 30000,
        model
      });
      affirmations = cleanLines(reply, safeCount);
    }

    if (affirmations.length >= minimumCleanAffirmations) {
      return NextResponse.json({ affirmations });
    }

    return NextResponse.json(
      { error: "The AI did not return affirmations. Try again or adjust the affirmation prompt." },
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
