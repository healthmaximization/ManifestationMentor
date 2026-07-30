import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_IMPORT_SIZE = 250 * 1024 * 1024;

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isSupportedAudioFile(fileName: string, fileType = "") {
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

  const { fileName, fileType = "", fileSize = 0 } = await request.json().catch(() => ({}));

  if (typeof fileName !== "string" || !fileName.trim()) {
    return NextResponse.json({ error: "File name is required." }, { status: 400 });
  }

  if (!isSupportedAudioFile(fileName, String(fileType))) {
    return NextResponse.json({ error: "Please upload an MP3 or WAV file." }, { status: 400 });
  }

  if (Number(fileSize) > MAX_IMPORT_SIZE) {
    return NextResponse.json({ error: "Please upload an MP3 or WAV file under 250 MB." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const hasPro = await hasProductAccess(admin, { id: user.id, email: user.email }, "subliminal_maker");

  if (!hasPro) {
    const { count } = await admin
      .from("subliminal_projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= 1) {
      return NextResponse.json({ error: "Lite includes 1 active custom subliminal in your library. Upgrade to Pro for more." }, { status: 403 });
    }
  }

  const storagePath = `${user.id}/imports/${Date.now()}-${safeFileName(fileName)}`;
  const signed = await admin.storage.from("subliminal-imports").createSignedUploadUrl(storagePath);

  if (signed.error) {
    return NextResponse.json({ error: signed.error.message }, { status: 500 });
  }

  return NextResponse.json({
    path: storagePath,
    token: signed.data.token
  });
}
