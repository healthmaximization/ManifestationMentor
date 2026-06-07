import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubliminalProjectMetadata = {
  style?: string;
  duration?: number;
  affirmationCount?: number;
  ambience?: string;
  binaural?: boolean;
  musicFileName?: string | null;
  voiceSource?: string;
};

function normalizeMetadata(value: unknown): SubliminalProjectMetadata {
  if (!value || typeof value !== "object") return {};
  const metadata = value as Record<string, unknown>;
  return {
    style: typeof metadata.style === "string" ? metadata.style : undefined,
    duration: typeof metadata.duration === "number" ? metadata.duration : undefined,
    affirmationCount: typeof metadata.affirmationCount === "number" ? metadata.affirmationCount : undefined,
    ambience: typeof metadata.ambience === "string" ? metadata.ambience : undefined,
    binaural: typeof metadata.binaural === "boolean" ? metadata.binaural : undefined,
    musicFileName: typeof metadata.musicFileName === "string" ? metadata.musicFileName : null,
    voiceSource: typeof metadata.voiceSource === "string" ? metadata.voiceSource : undefined
  };
}

function toClientProject(project: {
  id: string;
  title: string;
  intention: string | null;
  created_at: string;
  metadata: unknown;
}) {
  const metadata = normalizeMetadata(project.metadata);
  return {
    id: project.id,
    title: project.title,
    intention: project.intention,
    style: metadata.style ?? "layered",
    createdAt: project.created_at,
    duration: metadata.duration ?? 180,
    affirmationCount: metadata.affirmationCount ?? 0,
    ambience: metadata.ambience ?? "none",
    binaural: metadata.binaural ?? false
  };
}

export async function GET() {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subliminal_projects")
    .select("id,title,intention,created_at,metadata")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: (data ?? []).map(toClientProject) });
}

export async function POST(request: Request) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Untitled subliminal";
  const intention = typeof payload.intention === "string" ? payload.intention.trim() : "";
  const script = typeof payload.script === "string" ? payload.script.trim() : "";
  const metadata: SubliminalProjectMetadata = {
    style: typeof payload.style === "string" ? payload.style : "layered",
    duration: typeof payload.duration === "number" ? payload.duration : 180,
    affirmationCount: typeof payload.affirmationCount === "number" ? payload.affirmationCount : 0,
    ambience: typeof payload.ambience === "string" ? payload.ambience : "none",
    binaural: Boolean(payload.binaural),
    musicFileName: typeof payload.musicFileName === "string" ? payload.musicFileName : null,
    voiceSource: typeof payload.voiceSource === "string" ? payload.voiceSource : "unknown"
  };

  const { data: project, error: projectError } = await supabase
    .from("subliminal_projects")
    .insert({
      user_id: user.id,
      title,
      intention: intention || null,
      status: "ready",
      metadata,
      updated_at: new Date().toISOString()
    })
    .select("id,title,intention,created_at,metadata")
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  if (script) {
    const { error: scriptError } = await supabase.from("subliminal_scripts").insert({
      project_id: project.id,
      user_id: user.id,
      script_text: script,
      voice_style: metadata.voiceSource
    });

    if (scriptError) {
      return NextResponse.json({ error: scriptError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ project: toClientProject(project) });
}
