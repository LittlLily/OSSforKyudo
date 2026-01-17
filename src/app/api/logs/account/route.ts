import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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
    const logsQuery = adminClient
      .from("account_logs")
      .select(
        "id, created_at, action, operator_id, target_id, target_label, subject_user_id"
      )
      .order("created_at", { ascending: false });

    const logsResponse = await logsQuery;
    if (logsResponse.error) {
      throw logsResponse.error;
    }

    const logs = logsResponse.data ?? [];
    const profileIds = Array.from(
      new Set(
        logs.flatMap((log) => [log.operator_id, log.target_id]).filter(Boolean)
      )
    );

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
      target_id: log.target_id,
      target_display_name:
        log.target_id && profilesById.get(log.target_id)
          ? profilesById.get(log.target_id)?.display_name ?? null
          : null,
      target_student_number:
        log.target_id && profilesById.get(log.target_id)
          ? profilesById.get(log.target_id)?.student_number ?? null
          : null,
      target_label: log.target_label ?? null,
    }));

    return NextResponse.json({ logs: payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "fetch failed" },
      { status: 500 }
    );
  }
}
