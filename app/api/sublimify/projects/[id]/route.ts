import { NextResponse } from "next/server";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function readStoragePath(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const storagePath = (metadata as Record<string, unknown>).storagePath;
  return typeof storagePath === "string" ? storagePath : "";
}

function readProjectIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return [];
  const projectIds = (metadata as Record<string, unknown>).projectIds;
  return Array.isArray(projectIds) ? projectIds.filter((id): id is string => typeof id === "string") : [];
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: project, error: projectError } = await admin
    .from("subliminal_projects")
    .select("id,metadata")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Subliminal not found." }, { status: 404 });

  const storagePath = readStoragePath(project.metadata);
  if (storagePath) {
    const { error: storageError } = await admin.storage.from("subliminal-imports").remove([storagePath]);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin
    .from("subliminal_projects")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const { data: playlists } = await admin
    .from("subliminal_playlists")
    .select("id,metadata")
    .eq("user_id", user.id);

  await Promise.all((playlists ?? []).map(async (playlist) => {
    const projectIds = readProjectIds(playlist.metadata);
    if (!projectIds.includes(params.id)) return;
    await admin
      .from("subliminal_playlists")
      .update({
        metadata: {
          ...(playlist.metadata && typeof playlist.metadata === "object" ? playlist.metadata : {}),
          projectIds: projectIds.filter((id) => id !== params.id)
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", playlist.id)
      .eq("user_id", user.id);
  }));

  return NextResponse.json({ ok: true });
}
