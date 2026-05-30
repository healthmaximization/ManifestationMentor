import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import { createAdminSupabase, createRouteSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isOwner(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: doc } = await admin.from("manifestation_training_documents").select("*").eq("id", params.id).single();

  if (doc?.storage_path) {
    await admin.storage.from("training-files").remove([doc.storage_path]);
  }

  const { error } = await admin.from("manifestation_training_documents").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
