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

async function requireAdmin(): Promise<AuthResult> {
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
  if (role !== "admin") {
    return { ok: false, status: 403, message: "forbidden" };
  }

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

export async function POST(request: Request) {
  const auth = await requireAdmin();
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

  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const invoiceLookup = await adminClient
      .from("invoices")
      .select("id, account_id, title, description")
      .eq("id", id)
      .maybeSingle();
    if (invoiceLookup.error) {
      throw invoiceLookup.error;
    }

    const updateResponse = await adminClient
      .from("invoices")
      .update({ status: "pending", approved_at: null, approver_id: null })
      .eq("id", id)
      .eq("status", "approved")
      .select("id");

    if (updateResponse.error) {
      throw updateResponse.error;
    }

    if (updateResponse.data && updateResponse.data.length > 0) {
      const invoice = invoiceLookup.data;
      await logInvoiceAction(adminClient, {
        action: "請求承認取消",
        operatorId: auth.userId,
        subjectUserId: invoice?.account_id ?? null,
        invoiceId: invoice?.id ?? id,
        targetLabel: invoice?.title ?? "請求",
        detail: invoice?.description ?? null,
      });
    }

    return NextResponse.json({ updated: updateResponse.data?.length ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "revert failed" },
      { status: 500 }
    );
  }
}
