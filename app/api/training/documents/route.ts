import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return isOwner(user?.email) ? user : null;
}

export async function GET() {
  const user = await requireOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await createAdminSupabase()
    .from("manifestation_training_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

export async function POST(request: Request) {
  const user = await requireOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = await file.arrayBuffer();
  const textLike = /text|markdown|plain/.test(file.type) || /\.(txt|md)$/i.test(file.name);
  const extractedText = textLike ? await file.text() : null;
  const status = extractedText ? "ready" : "indexed";

  const upload = await admin.storage.from("training-files").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("manifestation_training_documents")
    .insert({
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      storage_path: storagePath,
      extracted_text: extractedText,
      status
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
