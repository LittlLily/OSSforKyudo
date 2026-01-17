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
      amount?: number;
      title?: string;
      description?: string;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const currentResponse = await adminClient
      .from("invoices")
      .select("id, account_id, title, description")
      .eq("id", id)
      .maybeSingle();
    if (currentResponse.error) {
      throw currentResponse.error;
    }

    const amount = body.amount;
    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be greater than 0" },
        { status: 400 }
      );
    }

    const updates = {
      amount,
      title: body.title?.trim() ?? null,
      description: body.description?.trim() ?? null,
    };

    const updateResponse = await adminClient
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("status", "pending")
      .select("id, amount, title, description");

    if (updateResponse.error) {
      throw updateResponse.error;
    }

    if (!updateResponse.data || updateResponse.data.length === 0) {
      return NextResponse.json({ error: "invoice not found" }, { status: 404 });
    }

    const updatedInvoice = updateResponse.data?.[0];
    await logInvoiceAction(adminClient, {
      action: "請求更新",
      operatorId: auth.userId,
      subjectUserId: currentResponse.data?.account_id ?? null,
      invoiceId: currentResponse.data?.id ?? null,
      targetLabel: updatedInvoice?.title ?? currentResponse.data?.title ?? "請求",
      detail: updatedInvoice?.description ?? currentResponse.data?.description ?? null,
    });

    return NextResponse.json({ invoice: updateResponse.data?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "update failed" },
      { status: 500 }
    );
  }
}
