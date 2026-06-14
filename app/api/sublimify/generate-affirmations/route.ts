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
        content: `Topic or user details:\n${safeTopic}\n\nRequested number of affirmations:\n${safeCount}\n\nTone:\n${safeTone}`
      }
    ], {
      temperature: 0.62,
      maxTokens: Math.min(700, safeCount * 18),
      timeoutMs: 45000,
      retries: 0
    });

    const affirmations = cleanLines(reply, safeCount);
    return NextResponse.json({ affirmations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate affirmations." }, { status: 504 });
  }
}
