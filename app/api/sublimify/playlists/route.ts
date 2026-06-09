import { NextResponse } from "next/server";
import { hasProductAccess } from "@/lib/access";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toClientPlaylist(playlist: { id: string; title: string; created_at: string }) {
  return {
    id: playlist.id,
    title: playlist.title,
    createdAt: playlist.created_at
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
    .from("subliminal_playlists")
    .select("id,title,created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlists: (data ?? []).map(toClientPlaylist) });
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
    return NextResponse.json({ error: "Playlists are included in Pro. Upgrade to organize subliminals into listening flows." }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "New playlist";

  const { data, error } = await supabase
    .from("subliminal_playlists")
    .insert({
      user_id: user.id,
      title,
      updated_at: new Date().toISOString()
    })
    .select("id,title,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlist: toClientPlaylist(data) });
}
