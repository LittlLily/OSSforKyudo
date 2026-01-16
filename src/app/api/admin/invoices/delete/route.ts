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

    const deleteResponse = await adminClient
      .from("invoices")
      .delete()
      .eq("id", id)
      .in("status", ["pending", "approved"]);

    if (deleteResponse.error) {
      throw deleteResponse.error;
    }

    if (invoiceLookup.data) {
      await logInvoiceAction(adminClient, {
        action: "請求削除",
        operatorId: auth.userId,
        subjectUserId: invoiceLookup.data.account_id ?? null,
        invoiceId: invoiceLookup.data.id ?? id,
        targetLabel: invoiceLookup.data.title ?? "請求",
        detail: invoiceLookup.data.description ?? null,
      });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 }
    );
  }
}
