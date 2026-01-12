import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logInvoiceAction } from "@/lib/audit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AuthResult =
  | { ok: true; role: "admin" | "user"; userId: string }
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
  return { ok: true, role, userId: data.user.id };
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing supabase service role config");
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "pending";

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
    let invoicesQuery = adminClient
      .from("invoices")
      .select(
        "id, account_id, amount, billed_at, approved_at, requester_id, approver_id, title, description, status"
      )
      .eq("account_id", auth.userId)
      .order("billed_at", { ascending: false });

    if (status) {
      invoicesQuery = invoicesQuery.eq("status", status);
    }

    const invoicesResponse = await invoicesQuery;
    if (invoicesResponse.error) {
      throw invoicesResponse.error;
    }

    const invoices = invoicesResponse.data ?? [];

    await Promise.all(
      invoices.map((invoice) =>
        logInvoiceAction(adminClient, {
          action: "請求閲覧",
          operatorId: auth.userId,
          subjectUserId: invoice.account_id ?? null,
          invoiceId: invoice.id ?? null,
          targetLabel: invoice.title ?? "請求",
          detail: invoice.description ?? null,
        })
      )
    );

    return NextResponse.json({ invoices });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "fetch failed") },
      { status: 500 }
    );
  }
}
