import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isSupportedAudioFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();
  return extension === "mp3" || extension === "wav" || mimeType === "audio/mpeg" || mimeType === "audio/mp3" || mimeType === "audio/wav" || mimeType === "audio/x-wav";
}

function contentTypeFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();
  if (extension === "mp3" || mimeType === "audio/mpeg" || mimeType === "audio/mp3") return "audio/mpeg";
  if (extension === "wav" || mimeType === "audio/wav" || mimeType === "audio/x-wav") return "audio/wav";
  return file.type || "application/octet-stream";
}

function contentTypeForMetadata(fileName: string, fileType = "") {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const mimeType = fileType.toLowerCase();
  if (extension === "mp3" || mimeType === "audio/mpeg" || mimeType === "audio/mp3") return "audio/mpeg";
  if (extension === "wav" || mimeType === "audio/wav" || mimeType === "audio/x-wav") return "audio/wav";
  return fileType || "application/octet-stream";
}

function isSupportedAudioMetadata(fileName: string, fileType = "") {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const mimeType = fileType.toLowerCase();
  return extension === "mp3" || extension === "wav" || mimeType === "audio/mpeg" || mimeType === "audio/mp3" || mimeType === "audio/wav" || mimeType === "audio/x-wav";
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
  let storagePath = "";
  let fileName = "";
  let fileSize = 0;
  let mimeType = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!isSupportedAudioFile(file)) {
      return NextResponse.json({ error: "Please upload an MP3 or WAV file." }, { status: 400 });
    }

    storagePath = `${user.id}/imports/${Date.now()}-${safeFileName(file.name)}`;
    fileName = file.name;
    fileSize = file.size;
    mimeType = contentTypeFor(file);

    const upload = await admin.storage.from("subliminal-imports").upload(storagePath, await file.arrayBuffer(), {
      contentType: mimeType,
      upsert: false
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }
  } else {
    const payload = await request.json().catch(() => ({}));
    storagePath = typeof payload.storagePath === "string" ? payload.storagePath : "";
    fileName = typeof payload.fileName === "string" ? payload.fileName : "";
    fileSize = Number(payload.fileSize) || 0;
    mimeType = contentTypeForMetadata(fileName, typeof payload.fileType === "string" ? payload.fileType : "");

    if (!storagePath.startsWith(`${user.id}/imports/`)) {
      return NextResponse.json({ error: "Invalid import path." }, { status: 400 });
    }

    if (!isSupportedAudioMetadata(fileName, mimeType)) {
      return NextResponse.json({ error: "Please upload an MP3 or WAV file." }, { status: 400 });
    }
  }

  const metadata = {
    importSource: "upload",
    storagePath,
    fileName,
    fileSize,
    mimeType,
    style: "normal",
    duration: 0,
    affirmationCount: 0,
    ambience: "none",
    binaural: false
  };

  const { data: project, error } = await admin
    .from("subliminal_projects")
    .insert({
      user_id: user.id,
      title: fileName.replace(/\.[^.]+$/, "") || "Imported subliminal",
      intention: "Imported audio file",
      status: "ready",
      metadata,
      updated_at: new Date().toISOString()
    })
    .select("id,title,intention,created_at,metadata")
    .single();

  if (error) {
    await admin.storage.from("subliminal-imports").remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const signed = await admin.storage.from("subliminal-imports").createSignedUrl(storagePath, 60 * 60);

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      intention: project.intention,
      style: "normal",
      createdAt: project.created_at,
      duration: 0,
      affirmationCount: 0,
      ambience: "none",
      binaural: false,
      imported: true,
      fileName,
      audioUrl: signed.data?.signedUrl ?? null
    }
  });
}
