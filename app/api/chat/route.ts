import { NextResponse } from "next/server";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";
import { askOpenRouter } from "@/lib/openrouter";
import { buildCoachSystemPrompt } from "@/lib/training";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { message, conversationId, previewConfig } = await request.json();
  const supabase = createRouteSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !message?.trim()) {
    return NextResponse.json({ error: "Unauthorized or empty message" }, { status: 401 });
  }

  let activeConversationId = conversationId as string | undefined;

  if (!previewConfig) {
    if (!activeConversationId) {
      const { data: conversation, error } = await supabase
        .from("manifestation_conversations")
        .insert({ user_id: user.id, title: message.slice(0, 52) })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      activeConversationId = conversation.id;
    }

    await supabase.from("manifestation_messages").insert({
      conversation_id: activeConversationId,
      user_id: user.id,
      role: "user",
      content: message
    });
  }

  const [{ data: config }, { data: docs }, { data: history }] = await Promise.all([
    admin.from("manifestation_training_config").select("*").eq("id", "main").maybeSingle(),
    admin.from("manifestation_training_documents").select("*").eq("status", "ready").order("created_at", { ascending: false }),
    activeConversationId && !previewConfig
      ? supabase
          .from("manifestation_messages")
          .select("role, content")
          .eq("conversation_id", activeConversationId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(20)
      : Promise.resolve({ data: [] })
  ]);

  const systemPrompt = buildCoachSystemPrompt(previewConfig ?? config, docs ?? []);
  const aiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...((history ?? []) as { role: "user" | "assistant"; content: string }[]),
    { role: "user" as const, content: message }
  ];

  try {
    const reply = await askOpenRouter(aiMessages);

    if (activeConversationId && !previewConfig) {
      await supabase.from("manifestation_messages").insert({
        conversation_id: activeConversationId,
        user_id: user.id,
        role: "assistant",
        content: reply
      });
      await supabase.from("manifestation_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConversationId);
    }

    return NextResponse.json({ reply, conversationId: activeConversationId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI request failed" }, { status: 500 });
  }
}
