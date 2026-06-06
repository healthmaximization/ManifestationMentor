import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TTS_MODEL ?? "tts-1";
  const voice = process.env.OPENAI_TTS_VOICE ?? "echo";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY. Add it in Vercel env vars to enable basic narrator export." },
      { status: 501 }
    );
  }

  const { text } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: "mp3",
      instructions: "Speak slowly, calmly, and evenly like a simple meditation narrator. Keep the delivery neutral and clear."
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }

  const audio = await response.arrayBuffer();
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": "inline; filename=sublimify-voice.mp3"
    }
  });
}
