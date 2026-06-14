import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
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

function fallbackAffirmations(topic: string, count: number) {
  const cleanTopic = topic.trim().replace(/\s+/g, " ");
  const templates = [
    `I am becoming more aligned with ${cleanTopic} every day.`,
    `I naturally choose thoughts and actions that support ${cleanTopic}.`,
    `I feel calm, confident, and steady as I grow into ${cleanTopic}.`,
    `My mind accepts ${cleanTopic} as normal for me.`,
    `I trust myself to take simple steps toward ${cleanTopic}.`,
    `I am worthy of experiencing ${cleanTopic}.`,
    `I return to focus whenever ${cleanTopic} matters to me.`,
    `My identity supports the habits that create ${cleanTopic}.`,
    `I allow ${cleanTopic} to feel familiar, safe, and possible.`,
    `I notice opportunities that support ${cleanTopic}.`,
    `I speak to myself like someone who already supports ${cleanTopic}.`,
    `I become more consistent with ${cleanTopic} in small, real ways.`,
    `I release pressure and keep moving toward ${cleanTopic}.`,
    `I am proud of the person I am becoming through ${cleanTopic}.`,
    `My body and mind can relax into ${cleanTopic}.`,
    `I choose evidence that strengthens my belief in ${cleanTopic}.`,
    `I let ${cleanTopic} become part of my daily reality.`,
    `I am available for the confidence that comes with ${cleanTopic}.`,
    `I make decisions from the version of me who lives ${cleanTopic}.`,
    `I keep returning to ${cleanTopic} with patience and trust.`,
    `I am safe to grow into ${cleanTopic}.`,
    `I naturally embody the energy of ${cleanTopic}.`,
    `I let my actions match my desire for ${cleanTopic}.`,
    `I am becoming someone who expects ${cleanTopic}.`
  ];

  return templates.slice(0, Math.max(8, Math.min(32, count)));
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
        content: `${(config?.prompt || DEFAULT_SUBLIMINAL_PROMPT).slice(0, 3000)}\n\nKeep the output compact. No intro, no headings, no explanations.`
      },
      {
        role: "user",
        content: `Topic: ${safeTopic}\nNumber of affirmations: ${safeCount}\nTone: ${safeTone}\nReturn exactly ${safeCount} short affirmations, one per line.`
      }
    ], {
      temperature: 0.62,
      maxTokens: Math.min(700, safeCount * 18),
      timeoutMs: 8500
    });

    const affirmations = cleanLines(reply, safeCount);
    return NextResponse.json({ affirmations: affirmations.length ? affirmations : fallbackAffirmations(safeTopic, safeCount) });
  } catch {
    return NextResponse.json({ affirmations: fallbackAffirmations(safeTopic, safeCount) });
  }
}
