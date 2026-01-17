import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logBowAction } from "@/lib/audit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AuthResult =
  | { ok: true; userId: string }
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
  return { ok: true, userId: data.user.id };
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
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
      bowId?: string;
      returnedAt?: string;
    };

    const bowId = body.bowId?.trim() ?? "";
    const returnedAt = parseDate(body.returnedAt) ?? new Date().toISOString();

    if (!bowId) {
      return NextResponse.json({ error: "bowId required" }, { status: 400 });
    }

    const openLoan = await supabase
      .from("bow_loans")
      .select("id")
      .eq("bow_id", bowId)
      .is("returned_at", null)
      .order("loaned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openLoan.error) {
      return NextResponse.json(
        { error: openLoan.error.message },
        { status: 500 }
      );
    }
    if (!openLoan.data) {
      return NextResponse.json(
        { error: "open loan not found" },
        { status: 404 }
      );
    }

    const bowResponse = await supabase
      .from("japanese_bows")
      .select("bow_number")
      .eq("id", bowId)
      .maybeSingle();
    if (bowResponse.error) {
      return NextResponse.json(
        { error: bowResponse.error.message },
        { status: 500 }
      );
    }

    const updateLoan = await supabase
      .from("bow_loans")
      .update({ returned_at: returnedAt })
      .eq("id", openLoan.data.id);
    if (updateLoan.error) {
      return NextResponse.json(
        { error: updateLoan.error.message },
        { status: 500 }
      );
    }

    const updateBow = await supabase
      .from("japanese_bows")
      .update({ borrower_profile_id: null })
      .eq("id", bowId);
    if (updateBow.error) {
      return NextResponse.json(
        { error: updateBow.error.message },
        { status: 500 }
      );
    }

    await logBowAction(adminClient, {
      action: "弓返却",
      operatorId: auth.userId,
      bowNumber: bowResponse.data?.bow_number ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "return failed" },
      { status: 500 }
    );
  }
}
