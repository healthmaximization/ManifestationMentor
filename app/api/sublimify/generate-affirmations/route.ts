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

function cleanLines(text: string, limit: number, topicKeywords: string[] = []) {
  const seen = new Set<string>();

  return extractListItems(text)
    .split("\n")
    .flatMap((line) => line.split(/(?<=\.)\s+(?=(?:I|My|Every|Each|More|It)\b)/i))
    .map(normalizeAffirmation)
    .filter((line) => line.length >= 6 && line.length <= 180)
    .filter((line) => !isMetaLine(line))
    .filter((line) => !isVagueAffirmation(line))
    .filter(isAffirmationLine)
    .filter((line) => hasTopicKeyword(line, topicKeywords))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function hasTopicKeyword(line: string, topicKeywords: string[]) {
  if (topicKeywords.length === 0) return true;

  const normalizedLine = line.toLowerCase();
  return topicKeywords.some((keyword) => normalizedLine.includes(keyword));
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

function isVagueAffirmation(line: string) {
  return /\b(journey|process|change|growth|unfolds|nature's ability|nature's power|embrace nature|brings more strength)\b/i.test(line);
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

function getTopicKeywords(topic: string) {
  const stopWords = new Set([
    "and",
    "the",
    "with",
    "for",
    "your",
    "you",
    "powerful",
    "subliminal",
    "naturally",
    "natural",
    "topic",
    "about",
    "into",
    "from"
  ]);

  return [...new Set(topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stopWords.has(word))
    .slice(0, 8))];
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
  const topicKeywords = getTopicKeywords(safeTopic);

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
      content: `Create ${safeCount} first-person subliminal affirmations.

Topic or user details:
${safeTopic}

Concrete topic words to use often:
${topicKeywords.length > 0 ? topicKeywords.join(", ") : "Use the user's exact topic words."}

Tone:
${safeTone}

Return format:
One affirmation per line.

Output rules:
- No intro, no analysis, no categories, no markdown.
- Every affirmation must clearly mention the concrete topic/result.
- A user should understand the topic from each single line.
- Write as if the desired result is already happening or already true.
- Use varied sentence openings. Do not make every line start with "I am".
- Prefer direct patterns like "I already have...", "My ... is...", "My ... are...", "I have...", "Every day my ... becomes...", and "More and more...".
- Avoid vague lines about journeys, processes, change, nature, or trust.
- Do not give medical advice, diagnoses, or treatment instructions.`
    }
  ];
  const minimumCleanAffirmations = Math.min(6, safeCount);

  try {
    let lastError: unknown;

    for (const model of AFFIRMATION_MODELS) {
      try {
        const reply = await askOpenRouter(messages, {
          temperature: 0.68,
          maxTokens: Math.min(1200, safeCount * 34),
          timeoutMs: 22000,
          retries: 0,
          models: [model],
          includeConfiguredModel: false,
          includeDefaultFallbacks: false
        });
        const affirmations = cleanLines(reply, safeCount, topicKeywords);

        if (affirmations.length >= minimumCleanAffirmations) {
          return NextResponse.json({ affirmations });
        }
      } catch (error) {
        lastError = error;
      }
    }

    return NextResponse.json(
      { error: lastError ? getPublicGenerationError(lastError) : "The free AI models did not return enough clean affirmations. Please try again." },
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
    return "The free AI models are busy right now. Please try again in a few seconds.";
  }

  if (message.includes("took too long") || message.includes("abort")) {
    return "The AI took too long to respond. Please try again.";
  }

  return "Could not generate affirmations. Please try again.";
}
