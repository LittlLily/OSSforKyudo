import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logInvoiceAction } from "@/lib/audit";
import {
  hasAdminOrSubPermission,
  requireUserWithSubPermissions,
} from "@/lib/permissions.server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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
  if (!hasAdminOrSubPermission(auth, "invoice_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    const body = (await request.json()) as {
      id?: string;
      ids?: string[];
    };

    const ids = body.ids ?? (body.id ? [body.id] : []);
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const invoiceLookup = await adminClient
      .from("invoices")
      .select("id, account_id, title, description")
      .in("id", ids);
    if (invoiceLookup.error) {
      throw invoiceLookup.error;
    }
    const invoiceById = new Map(
      (invoiceLookup.data ?? []).map((invoice) => [invoice.id, invoice])
    );

    const updateResponse = await adminClient
      .from("invoices")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approver_id: auth.userId,
      })
      .in("id", ids)
      .eq("status", "pending")
      .select("id");

    if (updateResponse.error) {
      throw updateResponse.error;
    }

    await Promise.all(
      (updateResponse.data ?? []).map((entry) => {
        const invoice = invoiceById.get(entry.id);
        return logInvoiceAction(adminClient, {
          action: "請求承認",
          operatorId: auth.userId,
          subjectUserId: invoice?.account_id ?? null,
          invoiceId: invoice?.id ?? entry.id,
          targetLabel: invoice?.title ?? "請求",
          detail: invoice?.description ?? null,
        });
      })
    );

    return NextResponse.json({ updated: updateResponse.data?.length ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "approve failed" },
      { status: 500 }
    );
  }
}
