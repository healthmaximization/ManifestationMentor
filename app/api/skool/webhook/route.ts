import { NextResponse } from "next/server";
import { applyMembershipEntitlement, type Membership } from "@/lib/membership";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PayloadRecord = Record<string, unknown>;

function readNestedString(payload: unknown, paths: string[][]) {
  for (const path of paths) {
    let current = payload;
    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        current = null;
        break;
      }
      current = (current as PayloadRecord)[key];
    }
    if (typeof current === "string" && current.trim()) return current.trim();
  }
  return "";
}

function verifyWebhookSecret(request: Request): NextResponse | null {
  const expectedSecret = process.env.SKOOL_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json({ error: "Missing SKOOL_WEBHOOK_SECRET." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerSecret = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-skool-webhook-secret")?.trim() ?? "";

  if (bearerSecret !== expectedSecret && headerSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  return null;
}

function inferMembership(payload: unknown): Membership | null {
  const explicitMembership = readNestedString(payload, [
    ["membership"],
    ["tier"],
    ["plan"],
    ["plan", "name"],
    ["data", "membership"],
    ["data", "tier"],
    ["data", "plan"],
    ["data", "plan", "name"]
  ]).toLowerCase();

  if (["pro", "premium", "paid"].some((value) => explicitMembership.includes(value))) return "pro";
  if (["lite", "free", "standard"].some((value) => explicitMembership.includes(value))) return "lite";

  const eventText = [
    readNestedString(payload, [["event"], ["type"], ["action"], ["status"], ["data", "event"], ["data", "type"], ["data", "action"], ["data", "status"]]),
    readNestedString(payload, [["membership_status"], ["subscription_status"], ["data", "membership_status"], ["data", "subscription_status"]])
  ].join(" ").toLowerCase();

  if (/(cancel|cancelled|canceled|remove|removed|delete|deleted|expire|expired|refund|refunded|inactive|paused|revoked)/.test(eventText)) {
    return "lite";
  }

  if (/(paid|payment|purchase|join|joined|active|subscribe|subscribed|created|upgrade|upgraded|approved)/.test(eventText)) {
    return "pro";
  }

  return null;
}

export async function POST(request: Request) {
  const secretCheck = verifyWebhookSecret(request);
  if (secretCheck) return secretCheck;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const email = readNestedString(payload, [
    ["email"],
    ["member_email"],
    ["user_email"],
    ["customer_email"],
    ["member", "email"],
    ["user", "email"],
    ["customer", "email"],
    ["data", "email"],
    ["data", "member_email"],
    ["data", "user_email"],
    ["data", "customer_email"],
    ["data", "member", "email"],
    ["data", "user", "email"],
    ["data", "customer", "email"]
  ]);

  if (!email) {
    return NextResponse.json({ error: "Could not find member email in webhook payload." }, { status: 400 });
  }

  const membership = inferMembership(payload);
  if (!membership) {
    return NextResponse.json({ error: "Could not infer membership. Send membership as 'pro' or 'lite'." }, { status: 400 });
  }

  const externalId = readNestedString(payload, [
    ["id"],
    ["member_id"],
    ["subscription_id"],
    ["membership_id"],
    ["data", "id"],
    ["data", "member_id"],
    ["data", "subscription_id"],
    ["data", "membership_id"],
    ["member", "id"],
    ["user", "id"]
  ]) || null;

  const eventType = readNestedString(payload, [
    ["event"],
    ["type"],
    ["action"],
    ["data", "event"],
    ["data", "type"],
    ["data", "action"]
  ]) || null;

  try {
    const result = await applyMembershipEntitlement(createAdminSupabase(), {
      email,
      membership,
      source: "skool",
      externalId,
      eventType,
      rawPayload: payload
    });

    return NextResponse.json({
      ok: true,
      email: email.trim().toLowerCase(),
      membership,
      profileUpdated: result.profileUpdated
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update membership." },
      { status: 500 }
    );
  }
}
