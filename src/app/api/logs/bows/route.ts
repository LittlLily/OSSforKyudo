import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing supabase service role config");
  }
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const auth = await requireUser();
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
    const logsResponse = await adminClient
      .from("bow_logs")
      .select("id, created_at, action, operator_id, bow_number")
      .order("created_at", { ascending: false });

    if (logsResponse.error) {
      throw logsResponse.error;
    }

    const logs = logsResponse.data ?? [];
    const operatorIds = Array.from(
      new Set(logs.map((log) => log.operator_id).filter(Boolean))
    );

    let profilesById = new Map<
      string,
      { display_name: string | null; student_number: string | null }
    >();

    if (operatorIds.length > 0) {
      const profilesResponse = await adminClient
        .from("profiles")
        .select("id, display_name, student_number")
        .in("id", operatorIds);
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

    const payload = logs.map((log) => ({
      id: log.id,
      created_at: log.created_at,
      action: log.action,
      operator_id: log.operator_id,
      operator_display_name:
        log.operator_id && profilesById.get(log.operator_id)
          ? profilesById.get(log.operator_id)?.display_name ?? null
          : null,
      operator_student_number:
        log.operator_id && profilesById.get(log.operator_id)
          ? profilesById.get(log.operator_id)?.student_number ?? null
          : null,
      bow_number: log.bow_number ?? null,
    }));

    return NextResponse.json({ logs: payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "fetch failed" },
      { status: 500 }
    );
  }
}
