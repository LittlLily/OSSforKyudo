import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type AuthResult =
  | { ok: true }
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
  return { ok: true };
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createClient(await cookies());

  try {
    const body = (await request.json()) as {
      bowId?: string;
      borrowerProfileId?: string;
      loanedAt?: string;
    };

    const bowId = body.bowId?.trim() ?? "";
    const borrowerProfileId = body.borrowerProfileId?.trim() ?? "";
    const loanedAt = parseDate(body.loanedAt) ?? new Date().toISOString();

    if (!bowId || !borrowerProfileId) {
      return NextResponse.json(
        { error: "bowId and borrowerProfileId required" },
        { status: 400 }
      );
    }

    const bowResponse = await supabase
      .from("japanese_bows")
      .select("borrower_profile_id")
      .eq("id", bowId)
      .maybeSingle();
    if (bowResponse.error) {
      return NextResponse.json(
        { error: bowResponse.error.message },
        { status: 500 }
      );
    }
    if (!bowResponse.data) {
      return NextResponse.json({ error: "bow not found" }, { status: 404 });
    }
    if (bowResponse.data.borrower_profile_id) {
      return NextResponse.json(
        { error: "bow already borrowed" },
        { status: 400 }
      );
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
    if (openLoan.data) {
      return NextResponse.json(
        { error: "open loan exists" },
        { status: 400 }
      );
    }

    const insertResponse = await supabase.from("bow_loans").insert({
      bow_id: bowId,
      borrower_profile_id: borrowerProfileId,
      loaned_at: loanedAt,
    });
    if (insertResponse.error) {
      return NextResponse.json(
        { error: insertResponse.error.message },
        { status: 500 }
      );
    }

    const updateResponse = await supabase
      .from("japanese_bows")
      .update({ borrower_profile_id: borrowerProfileId })
      .eq("id", bowId);
    if (updateResponse.error) {
      return NextResponse.json(
        { error: updateResponse.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "loan failed" },
      { status: 500 }
    );
  }
}
