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

function parseFilters(url: URL) {
  return {
    display_name: url.searchParams.get("display_name")?.trim() ?? "",
    student_number: url.searchParams.get("student_number")?.trim() ?? "",
    generation: url.searchParams.get("generation")?.trim() ?? "",
    gender: url.searchParams.get("gender")?.trim() ?? "",
  };
}

async function resolveAccountIds(
  adminClient: ReturnType<typeof getAdminClient>,
  filters: ReturnType<typeof parseFilters>
) {
  const hasFilters = Object.values(filters).some(Boolean);
  if (!hasFilters) return null;

  let profilesQuery = adminClient
    .from("profiles")
    .select("id, display_name, student_number, generation, gender");

  if (filters.display_name) {
    profilesQuery = profilesQuery.ilike(
      "display_name",
      `%${filters.display_name}%`
    );
  }
  if (filters.student_number) {
    profilesQuery = profilesQuery.ilike(
      "student_number",
      `%${filters.student_number}%`
    );
  }
  if (filters.generation) {
    const generationParts = filters.generation
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (generationParts.length > 1) {
      profilesQuery = profilesQuery.in("generation", generationParts);
    } else {
      profilesQuery = profilesQuery.ilike(
        "generation",
        `%${filters.generation}%`
      );
    }
  }
  if (filters.gender) {
    profilesQuery = profilesQuery.eq("gender", filters.gender);
  }

  const profilesResponse = await profilesQuery;
  if (profilesResponse.error) {
    throw profilesResponse.error;
  }

  return (profilesResponse.data ?? []).map((profile) => profile.id as string);
}

export async function GET(request: Request) {
  const auth = await requireUserWithSubPermissions();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (!hasAdminOrSubPermission(auth, "invoice_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseFilters(url);
  const status = url.searchParams.get("status")?.trim() || "pending";

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
    const accountIds = await resolveAccountIds(adminClient, filters);
    if (accountIds && accountIds.length === 0) {
      return NextResponse.json({ invoices: [] });
    }

    let invoicesQuery = adminClient
      .from("invoices")
      .select(
        "id, account_id, amount, billed_at, approved_at, requester_id, approver_id, title, description, status"
      )
      .order("billed_at", { ascending: false });

    if (status) {
      invoicesQuery = invoicesQuery.eq("status", status);
    }
    if (accountIds) {
      invoicesQuery = invoicesQuery.in("account_id", accountIds);
    }

    const invoicesResponse = await invoicesQuery;
    if (invoicesResponse.error) {
      throw invoicesResponse.error;
    }

    const rawInvoices = invoicesResponse.data ?? [];
    const profileIds = Array.from(
      new Set(
        rawInvoices.flatMap((invoice) => [
          invoice.account_id,
          invoice.requester_id,
          invoice.approver_id,
        ])
      )
    ).filter(Boolean);

    let profilesById = new Map<
      string,
      { display_name: string | null; student_number: string | null }
    >();
    if (profileIds.length > 0) {
      const profilesResponse = await adminClient
        .from("profiles")
        .select("id, display_name, student_number")
        .in("id", profileIds);
      if (profilesResponse.error) {
        throw profilesResponse.error;
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

    const invoices = rawInvoices.map((invoice) => ({
      id: invoice.id,
      account_id: invoice.account_id,
      amount: invoice.amount,
      billed_at: invoice.billed_at,
      approved_at: invoice.approved_at,
      requester_id: invoice.requester_id,
      approver_id: invoice.approver_id,
      title: invoice.title,
      description: invoice.description,
      status: invoice.status,
      account_display_name:
        profilesById.get(invoice.account_id)?.display_name ?? null,
      account_student_number:
        profilesById.get(invoice.account_id)?.student_number ?? null,
      requester_display_name:
        profilesById.get(invoice.requester_id)?.display_name ?? null,
      approver_display_name:
        invoice.approver_id
          ? profilesById.get(invoice.approver_id)?.display_name ?? null
          : null,
    }));

    await Promise.all(
      rawInvoices.map((invoice) =>
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
      accountIds?: string[];
      amount?: number;
      title?: string;
      description?: string;
    };

    const accountIds = body.accountIds ?? [];
    const amount = body.amount;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: "accountIds required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be greater than 0" },
        { status: 400 }
      );
    }

    const title = body.title?.trim() ?? null;
    const description = body.description?.trim() ?? null;

    const rows = accountIds.map((accountId) => ({
      account_id: accountId,
      amount,
      requester_id: auth.userId,
      title,
      description,
      status: "pending",
    }));

    const insertResponse = await adminClient
      .from("invoices")
      .insert(rows)
      .select("id, account_id, title, description");
    if (insertResponse.error) {
      throw insertResponse.error;
    }

    const createdRows = insertResponse.data ?? [];
    await Promise.all(
      createdRows.map((invoice) =>
        logInvoiceAction(adminClient, {
          action: "請求作成",
          operatorId: auth.userId,
          subjectUserId: invoice.account_id ?? null,
          invoiceId: invoice.id ?? null,
          targetLabel: invoice.title ?? "請求",
          detail: invoice.description ?? null,
        })
      )
    );

    return NextResponse.json({ created: rows.length });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "create failed") },
      { status: 500 }
    );
  }
}
