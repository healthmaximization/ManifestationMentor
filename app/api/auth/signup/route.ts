import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Enter a valid email and a password of at least 6 characters." }, { status: 400 });
    }

    const admin = createAdminSupabase();
    const { error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true
    });

    if (error) {
      const alreadyExists = /already|registered|exists/i.test(error.message);
      return NextResponse.json(
        { error: alreadyExists ? "An account with this email already exists. Log in instead." : error.message },
        { status: alreadyExists ? 409 : 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create account." },
      { status: 500 }
    );
  }
}
