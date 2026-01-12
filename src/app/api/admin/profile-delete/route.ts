import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAccountAction } from "@/lib/audit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function requireAdmin() {
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

async function listAllUsers(
  adminClient: ReturnType<typeof getAdminClient>
) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (page > 0) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw error;
    }
    users.push(...data.users);
    page = data.nextPage ?? 0;
  }

  return users;
}

export async function GET() {
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
    const users = await listAllUsers(adminClient);
    const list = users
      .filter((user) => user.id !== auth.userId)
      .map((user) => ({
        id: user.id,
        email: user.email ?? null,
        role: (user.app_metadata?.role as "admin" | "user") ?? "user",
      }));

    await logAccountAction(adminClient, {
      action: "削除対象一覧取得",
      operatorId: auth.userId,
      subjectUserId: auth.userId,
      targetLabel: "一覧",
    });

    return NextResponse.json({ users: list });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "fetch failed" },
      { status: 500 }
    );
  }
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
    const targetId = (body.id ?? "").trim();
    if (!targetId) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    if (targetId === auth.userId) {
      return NextResponse.json({ error: "cannot delete self" }, { status: 400 });
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAccountAction(adminClient, {
      action: "プロフィール削除",
      operatorId: auth.userId,
      targetId: targetId,
      subjectUserId: targetId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 }
    );
  }
}
