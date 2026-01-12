import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const LENGTH_VALUES = ["並寸", "二寸伸", "四寸伸", "三寸詰"] as const;
type BowLength = (typeof LENGTH_VALUES)[number];

type AuthResult =
  | { ok: true; role: "admin" | "user" }
  | { ok: false; status: number; message: string };

async function requireUser(): Promise<AuthResult> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { ok: false, status: 500, message: error.message };
  }
  if (!data.user) {
    return { ok: false, status: 401, message: "unauthorized" };
  }
  const role =
    (data.user.app_metadata?.role as "admin" | "user") ?? "user";
  return { ok: true, role };
}

function normalizeLength(value?: string | null): BowLength | null {
  if (!value) return null;
  if ((LENGTH_VALUES as readonly string[]).includes(value)) {
    return value as BowLength;
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(await cookies());

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "update failed" },
      { status: 500 }
    );
  }
}
