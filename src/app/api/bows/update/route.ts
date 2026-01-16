import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logBowAction } from "@/lib/audit";
import {
  hasAdminOrSubPermission,
  requireUserWithSubPermissions,
} from "@/lib/permissions.server";

const LENGTH_VALUES = ["並寸", "二寸伸", "四寸伸", "三寸詰"] as const;
type BowLength = (typeof LENGTH_VALUES)[number];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function normalizeLength(value?: string | null): BowLength | null {
  if (!value) return null;
  if ((LENGTH_VALUES as readonly string[]).includes(value)) {
    return value as BowLength;
  }
  return null;
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing supabase service role config");
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function POST(request: Request) {
  const auth = await requireUserWithSubPermissions();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (!hasAdminOrSubPermission(auth, "bow_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(await cookies());
  let adminClient;
  try {
    adminClient = getAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "config error" },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      bowNumber?: string;
      name?: string;
      strength?: number | string;
      length?: string;
      note?: string;
    };

    const id = body.id?.trim() ?? "";
    const bowNumber = body.bowNumber?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const strengthValue =
      typeof body.strength === "string"
        ? Number(body.strength)
        : body.strength;
    const length = normalizeLength(body.length);
    const note = body.note?.trim() || null;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!bowNumber) {
      return NextResponse.json(
        { error: "bowNumber required" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "name required" },
        { status: 400 }
      );
    }
    if (
      typeof strengthValue !== "number" ||
      Number.isNaN(strengthValue) ||
      strengthValue < 0
    ) {
      return NextResponse.json(
        { error: "strength must be 0 or greater" },
        { status: 400 }
      );
    }
    if (!length) {
      return NextResponse.json(
        { error: "length invalid" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("japanese_bows")
      .update({
        bow_number: bowNumber,
        name,
        strength: strengthValue,
        length,
        note,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logBowAction(adminClient, {
      action: "弓編集",
      operatorId: auth.userId,
      bowNumber,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "update failed" },
      { status: 500 }
    );
  }
}
