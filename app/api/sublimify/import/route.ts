import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
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

  const storagePath = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;
  const bytes = await file.arrayBuffer();

  const upload = await admin.storage.from("subliminal-imports").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const metadata = {
    importSource: "upload",
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
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
      title: file.name.replace(/\.[^.]+$/, "") || "Imported subliminal",
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
      fileName: file.name,
      audioUrl: signed.data?.signedUrl ?? null
    }
  });
}
