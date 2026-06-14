import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlaylistRow = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  metadata: unknown;
};

function readProjectIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return [];
  const projectIds = (metadata as Record<string, unknown>).projectIds;
  return Array.isArray(projectIds) ? projectIds.filter((id): id is string => typeof id === "string") : [];
}

function toClientPlaylist(playlist: PlaylistRow) {
  return {
    id: playlist.id,
    title: playlist.title,
    createdAt: playlist.created_at,
    projectIds: readProjectIds(playlist.metadata)
  };
}

async function requireProUser() {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminSupabase();
  const hasPro = await hasProductAccess(admin, { id: user.id, email: user.email }, "subliminal_maker");

  if (!hasPro) {
    return {
      error: NextResponse.json({ error: "Playlists are included in Pro. Upgrade to organize subliminals into listening flows." }, { status: 403 })
    };
  }

  return { user, admin };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireProUser();
  if (auth.error) return auth.error;

  const payload = await request.json().catch(() => ({}));
  const { data: playlist, error: playlistError } = await auth.admin
    .from("subliminal_playlists")
    .select("id,title,user_id,created_at,metadata")
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .single();

  if (playlistError || !playlist) {
    return NextResponse.json({ error: playlistError?.message ?? "Playlist not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof payload.title === "string" && payload.title.trim()) {
    updates.title = payload.title.trim().slice(0, 80);
  }

  if (Array.isArray(payload.projectIds)) {
    const requestedIds: string[] = [...new Set<string>(payload.projectIds.filter((id: unknown): id is string => typeof id === "string"))].slice(0, 100);
    const { data: ownedProjects, error: projectsError } = await auth.admin
      .from("subliminal_projects")
      .select("id")
      .eq("user_id", auth.user.id)
      .in("id", requestedIds.length ? requestedIds : ["00000000-0000-0000-0000-000000000000"]);

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const ownedIds = new Set((ownedProjects ?? []).map((project) => project.id as string));
    const projectIds = requestedIds.filter((id) => ownedIds.has(id));
    updates.metadata = { ...(playlist.metadata && typeof playlist.metadata === "object" ? playlist.metadata : {}), projectIds };
  }

  const { data, error } = await auth.admin
    .from("subliminal_playlists")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", auth.user.id)
    .select("id,title,user_id,created_at,metadata")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlist: toClientPlaylist(data as PlaylistRow) });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireProUser();
  if (auth.error) return auth.error;

  const { error } = await auth.admin
    .from("subliminal_playlists")
    .delete()
    .eq("id", params.id)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
