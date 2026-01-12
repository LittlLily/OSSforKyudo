import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logBowAction } from "@/lib/audit";

const LENGTH_VALUES = ["並寸", "二寸伸", "四寸伸", "三寸詰"] as const;
type BowLength = (typeof LENGTH_VALUES)[number];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AuthResult =
  | { ok: true; userId: string; role: "admin" | "user" }
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
  return { ok: true, userId: data.user.id, role };
}

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

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let adminClient;
  try {
    adminClient = getAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "config error" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  const bowNumber = url.searchParams.get("bow_number")?.trim() ?? "";
  const name = url.searchParams.get("name")?.trim() ?? "";
  const borrower = url.searchParams.get("borrower")?.trim() ?? "";
  const lengthParam = url.searchParams.get("length")?.trim() ?? "";
  const lengthFilter = normalizeLength(lengthParam) ?? "";
  const strengthParam = url.searchParams.get("strength")?.trim() ?? "";
  const strengthValue = strengthParam ? Number(strengthParam) : null;

  let bowsQuery = adminClient
    .from("japanese_bows")
    .select(
      "id, bow_number, name, strength, length, borrower_profile_id, note, created_at"
    )
    .order("created_at", { ascending: false });

  if (status === "borrowed") {
    bowsQuery = bowsQuery.not("borrower_profile_id", "is", null);
  } else if (status === "available") {
    bowsQuery = bowsQuery.is("borrower_profile_id", null);
  }

  if (borrower === "me") {
    bowsQuery = bowsQuery.eq("borrower_profile_id", auth.userId);
  }

  if (bowNumber) {
    bowsQuery = bowsQuery.ilike("bow_number", `%${bowNumber}%`);
  }
  if (name) {
    bowsQuery = bowsQuery.ilike("name", `%${name}%`);
  }
  if (lengthFilter) {
    bowsQuery = bowsQuery.eq("length", lengthFilter);
  }
  if (typeof strengthValue === "number" && !Number.isNaN(strengthValue)) {
    bowsQuery = bowsQuery.eq("strength", strengthValue);
  }

  if (query) {
    bowsQuery = bowsQuery.or(
      `bow_number.ilike.%${query}%,name.ilike.%${query}%`
    );
  }

  const { data, error } = await bowsQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bows = data ?? [];
  const borrowerIds = Array.from(
    new Set(
      bows
        .map((bow) => bow.borrower_profile_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let profilesById = new Map<
    string,
    { display_name: string | null; student_number: string | null }
  >();

  if (borrowerIds.length > 0) {
    const profilesResponse = await adminClient
      .from("profiles")
      .select("id, display_name, student_number")
      .in("id", borrowerIds);
    if (profilesResponse.error) {
      return NextResponse.json(
        { error: profilesResponse.error.message },
        { status: 500 }
      );
    }
    profilesById = new Map(
      (profilesResponse.data ?? []).map((profile) => [
        profile.id,
        {
          display_name: profile.display_name ?? null,
          student_number: profile.student_number ?? null,
        },
      ])
    );
  }

  const withBorrower = bows.map((bow) => ({
    ...bow,
    borrower_display_name: bow.borrower_profile_id
      ? profilesById.get(bow.borrower_profile_id)?.display_name ?? null
      : null,
    borrower_student_number: bow.borrower_profile_id
      ? profilesById.get(bow.borrower_profile_id)?.student_number ?? null
      : null,
  }));

  return NextResponse.json({ bows: withBorrower });
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
      bowNumber?: string;
      name?: string;
      strength?: number | string;
      length?: string;
      note?: string;
    };

    const bowNumber = body.bowNumber?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const strengthValue =
      typeof body.strength === "string"
        ? Number(body.strength)
        : body.strength;
    const length = normalizeLength(body.length);
    const note = body.note?.trim() || null;

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

    const { error } = await supabase.from("japanese_bows").insert({
      bow_number: bowNumber,
      name,
      strength: strengthValue,
      length,
      note,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logBowAction(adminClient, {
      action: "弓作成",
      operatorId: auth.userId,
      bowNumber,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "create failed" },
      { status: 500 }
    );
  }
}
