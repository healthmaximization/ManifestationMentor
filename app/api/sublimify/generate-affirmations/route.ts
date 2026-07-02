import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { askOpenRouter } from "@/lib/openrouter";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BAD_AFFIRMATION_MODEL_PATTERNS = [
  /^qwen\/qwen3-coder(?::free)?$/i,
  /^nvidia\/nemotron/i
];

const AFFIRMATION_MODELS = [
  getSafeAffirmationModelOverride(),
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
].filter(Boolean);

function cleanLines(text: string, limit: number) {
  const seen = new Set<string>();

  return extractListItems(text)
    .split("\n")
    .flatMap((line) => line.split(/(?<=\.)\s+(?=(?:I|My|Every|Each|More|It)\b)/i))
    .map(normalizeAffirmation)
    .filter((line) => line.length >= 6 && line.length <= 180)
    .filter((line) => !isMetaLine(line))
    .filter((line) => !hasUnfitClaim(line))
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
  return /^(i|i'm|i choose|i allow|i feel|i trust|my|every day|each day|more and more|it feels natural|it is safe)/i.test(line);
}

function isMetaLine(line: string) {
  return (
    /[(){}]|=>|<=|^\w+\d+\s|(?:^|\s)\d+(?:\s|\.|$)/.test(line) ||
    /\b(user|prompt|rule|must|cannot|okay|line|starts?|varied|category|analysis|markdown|format|response)\b/i.test(line)
  );
}

function hasUnfitClaim(line: string) {
  return /\b(regrow|grows?|appears?|heal(?:s|ing|ed)?|renew(?:s|ing|ed)?|new tooth|new teeth)\b/i.test(line);
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
    .replace(/^["'`]+|["'`,]+$/g, "")
    .trim();
}

function getSafeAffirmationModelOverride() {
  const model = process.env.OPENROUTER_AFFIRMATION_MODEL?.trim();
  if (!model) return "";
  if (!model.endsWith(":free")) return "";

  return BAD_AFFIRMATION_MODEL_PATTERNS.some((pattern) => pattern.test(model)) ? "" : model;
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
        content: `Create ${safeCount} first-person subliminal affirmations.

Topic or user details:
${safeTopic}

Tone:
${safeTone}

Return format:
One affirmation per line.

Output rules:
- No intro, no analysis, no categories, no markdown.
- Use varied sentence openings. Do not make every line start with "I am".
- Mix patterns like "I choose...", "I allow...", "I feel...", "My...", "Every day...", "More and more...", and "It feels natural...".
- Keep claims believable and safe. Do not say body parts regrow, enamel appears, teeth heal, or medical conditions are cured.`
      }
    ], {
      temperature: 0.68,
      maxTokens: Math.min(1200, safeCount * 34),
      timeoutMs: 22000,
      retries: 0,
      models: AFFIRMATION_MODELS,
      includeConfiguredModel: false,
      includeDefaultFallbacks: false
    });

    const affirmations = cleanLines(reply, safeCount);
    if (affirmations.length < Math.min(6, safeCount)) {
      return NextResponse.json({ error: "The AI did not return clean affirmations. Try again or adjust the affirmation prompt." }, { status: 502 });
    }

    return NextResponse.json({ affirmations });
  } catch (error) {
    return NextResponse.json({ error: getPublicGenerationError(error) }, { status: 504 });
  }
}

function getPublicGenerationError(error: unknown) {
  if (!(error instanceof Error)) return "Could not generate affirmations. Please try again.";

  const message = error.message.toLowerCase();
  if (message.includes("429") || message.includes("rate-limit") || message.includes("rate limit")) {
    return "The free AI models are busy right now. Please try again in a few seconds.";
  }

  if (message.includes("took too long") || message.includes("abort")) {
    return "The AI took too long to respond. Please try again.";
  }

  return "Could not generate affirmations. Please try again.";
}
