import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AuthResult =
  | { ok: true; role: "admin" | "user" }
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

  return { ok: true, role };
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

    return NextResponse.json({ invoice: updateResponse.data?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "update failed" },
      { status: 500 }
    );
  }
}
