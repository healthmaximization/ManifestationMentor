import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { askOpenRouter } from "@/lib/openrouter";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OUTPUT_FORMAT_GUARD = `Output format requirements:
- Return only the final affirmation lines.
- Do not answer, verify, restate, or checklist the creator prompt.
- Do not include labels, headings, notes, markdown, or explanations.`;

const BAD_AFFIRMATION_MODEL_PATTERNS = [
  /^qwen\/qwen3-coder(?::free)?$/i,
  /^nvidia\/nemotron/i
];

const AFFIRMATION_MODELS = [
  getSafeAffirmationModelOverride(),
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
].filter(Boolean);

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
    let lastError: unknown;

    for (const model of AFFIRMATION_MODELS) {
      try {
        let reply = await askOpenRouter(messages, {
          temperature: 0.48,
          maxTokens: Math.min(1400, safeCount * 42),
          timeoutMs: 30000,
          retries: 0,
          models: [model],
          includeConfiguredModel: false,
          includeDefaultFallbacks: false
        });
        let affirmations = cleanLines(reply, safeCount);

        if (affirmations.length < minimumCleanAffirmations) {
          reply = await askOpenRouter([
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
            retries: 0,
            models: [model],
            includeConfiguredModel: false,
            includeDefaultFallbacks: false
          });
          affirmations = cleanLines(reply, safeCount);
        }

        if (affirmations.length >= minimumCleanAffirmations) {
          return NextResponse.json({ affirmations });
        }
      } catch (error) {
        lastError = error;
      }
    }

    return NextResponse.json(
      { error: lastError ? getPublicGenerationError(lastError) : "The AI did not return affirmations. Try again or adjust the affirmation prompt." },
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
