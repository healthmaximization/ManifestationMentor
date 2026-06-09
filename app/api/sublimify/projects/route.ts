import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubliminalProjectMetadata = {
  style?: string;
  duration?: number;
  affirmationCount?: number;
  ambience?: string;
  binaural?: boolean;
  musicFileName?: string | null;
  voiceSource?: string;
  voiceVolume?: number;
  soundVolume?: number;
  beatVolume?: number;
  importSource?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
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
    voiceSource: typeof metadata.voiceSource === "string" ? metadata.voiceSource : undefined,
    voiceVolume: typeof metadata.voiceVolume === "number" ? metadata.voiceVolume : undefined,
    soundVolume: typeof metadata.soundVolume === "number" ? metadata.soundVolume : undefined,
    beatVolume: typeof metadata.beatVolume === "number" ? metadata.beatVolume : undefined,
    importSource: typeof metadata.importSource === "string" ? metadata.importSource : undefined,
    storagePath: typeof metadata.storagePath === "string" ? metadata.storagePath : undefined,
    fileName: typeof metadata.fileName === "string" ? metadata.fileName : undefined,
    fileSize: typeof metadata.fileSize === "number" ? metadata.fileSize : undefined,
    mimeType: typeof metadata.mimeType === "string" ? metadata.mimeType : undefined
  };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function toClientProject(
  project: {
  id: string;
  title: string;
  intention: string | null;
  created_at: string;
  metadata: unknown;
  },
  admin = createAdminSupabase()
) {
  const metadata = normalizeMetadata(project.metadata);
  const signed = metadata.storagePath
    ? await admin.storage.from("subliminal-imports").createSignedUrl(metadata.storagePath, 60 * 60)
    : { data: null };

  return {
    id: project.id,
    title: project.title,
    intention: project.intention,
    style: metadata.style ?? "normal",
    createdAt: project.created_at,
    duration: metadata.duration ?? 180,
    affirmationCount: metadata.affirmationCount ?? 0,
    ambience: metadata.ambience ?? "none",
    binaural: metadata.binaural ?? false,
    imported: metadata.importSource === "upload",
    fileName: metadata.fileName,
    audioUrl: signed.data?.signedUrl ?? null
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

  const admin = createAdminSupabase();

  const { data, error } = await supabase
    .from("subliminal_projects")
    .select("id,title,intention,created_at,metadata")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: await Promise.all((data ?? []).map((project) => toClientProject(project, admin))) });
}

export async function POST(request: Request) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const hasPro = await hasProductAccess(admin, { id: user.id, email: user.email }, "subliminal_maker");

  if (!hasPro) {
    const { count } = await admin
      .from("subliminal_projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= 1) {
      return NextResponse.json({ error: "Free includes 1 custom subliminal in your library. Upgrade to Pro for more." }, { status: 403 });
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  const form = contentType.includes("multipart/form-data") ? await request.formData() : null;
  const payload = form ? null : await request.json();
  const audio = form?.get("audio");
  let storagePath: string | undefined;
  let fileName: string | undefined;
  let fileSize: number | undefined;
  let mimeType: string | undefined;

  if (audio instanceof File) {
    fileName = audio.name || "sublimify.wav";
    fileSize = audio.size;
    mimeType = audio.type || "audio/wav";
    storagePath = `${user.id}/exports/${Date.now()}-${safeFileName(fileName)}`;
    const upload = await admin.storage.from("subliminal-imports").upload(storagePath, await audio.arrayBuffer(), {
      contentType: mimeType,
      upsert: false
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }
  }

  const readValue = (key: string) => (form ? form.get(key) : payload?.[key]);
  const readString = (key: string) => {
    const value = readValue(key);
    return typeof value === "string" ? value : "";
  };
  const readNumber = (key: string, fallback: number) => {
    const value = readValue(key);
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) ? number : fallback;
  };

  const title = readString("title").trim() || "Untitled subliminal";
  const intention = readString("intention").trim();
  const script = readString("script").trim();
  const metadata: SubliminalProjectMetadata = {
    style: readString("style") || "normal",
    duration: readNumber("duration", 180),
    affirmationCount: readNumber("affirmationCount", 0),
    ambience: readString("ambience") || "none",
    binaural: readValue("binaural") === true || readString("binaural") === "true",
    musicFileName: readString("musicFileName") || null,
    voiceSource: readString("voiceSource") || "unknown",
    voiceVolume: readNumber("voiceVolume", 0.15),
    soundVolume: readNumber("soundVolume", 0.5),
    beatVolume: readNumber("beatVolume", 0.25),
    importSource: storagePath ? "generated" : undefined,
    storagePath,
    fileName,
    fileSize,
    mimeType
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

  return NextResponse.json({ project: await toClientProject(project, admin) });
}
