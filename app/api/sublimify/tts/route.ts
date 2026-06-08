import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4800);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteSupabase();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Log in to create text to speech audio." }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY ?? process.env.GOOGLE_CLOUD_TTS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Text-to-Speech is not configured yet." }, { status: 503 });
    }

    const { text } = await request.json();
    const inputText = cleanText(text);
    if (!inputText) {
      return NextResponse.json({ error: "Add affirmations before creating text to speech." }, { status: 400 });
    }

    const voiceName = process.env.GOOGLE_TTS_VOICE ?? "en-US-Standard-J";
    const languageCode = process.env.GOOGLE_TTS_LANGUAGE_CODE ?? voiceName.split("-").slice(0, 2).join("-") ?? "en-US";

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: inputText },
        voice: {
          languageCode,
          name: voiceName
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: Number(process.env.GOOGLE_TTS_SPEAKING_RATE ?? 0.92),
          pitch: Number(process.env.GOOGLE_TTS_PITCH ?? -2)
        }
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.audioContent) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Google Text-to-Speech could not create audio." },
        { status: response.ok ? 500 : response.status }
      );
    }

    return new Response(base64ToBytes(data.audioContent), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create text to speech audio." },
      { status: 500 }
    );
  }
}
