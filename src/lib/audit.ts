type AccountLogInsert = {
  action: string;
  operatorId?: string | null;
  targetId?: string | null;
  subjectUserId?: string | null;
  targetLabel?: string | null;
};

type InvoiceLogInsert = {
  action: string;
  operatorId?: string | null;
  subjectUserId?: string | null;
  invoiceId?: string | null;
  targetLabel?: string | null;
  detail?: string | null;
};

import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export async function logAccountAction(
  adminClient: AdminClient,
  entry: AccountLogInsert
) {
  const { error } = await adminClient.from("account_logs").insert({
    action: entry.action,
    operator_id: entry.operatorId ?? null,
    target_id: entry.targetId ?? null,
    subject_user_id: entry.subjectUserId ?? null,
    target_label: entry.targetLabel ?? null,
  });

  if (error) {
    console.error("account_logs insert failed", error.message ?? error);
  }
}

export async function logInvoiceAction(
  adminClient: AdminClient,
  entry: InvoiceLogInsert
) {
  const { error } = await adminClient.from("invoice_logs").insert({
    action: entry.action,
    operator_id: entry.operatorId ?? null,
    subject_user_id: entry.subjectUserId ?? null,
    invoice_id: entry.invoiceId ?? null,
    target_label: entry.targetLabel ?? null,
    detail: entry.detail ?? null,
  });

  if (error) {
    console.error("invoice_logs insert failed", error.message ?? error);
  }
}
