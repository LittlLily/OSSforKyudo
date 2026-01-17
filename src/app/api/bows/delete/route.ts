import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logBowAction } from "@/lib/audit";
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
  if (!hasAdminOrSubPermission(auth, "bow_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(await cookies());
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
    const id = body.id?.trim() ?? "";

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const bowResponse = await supabase
      .from("japanese_bows")
      .select("bow_number")
      .eq("id", id)
      .maybeSingle();
    if (bowResponse.error) {
      return NextResponse.json(
        { error: bowResponse.error.message },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from("japanese_bows")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logBowAction(adminClient, {
      action: "弓削除",
      operatorId: auth.userId,
      bowNumber: bowResponse.data?.bow_number ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 }
    );
  }
}
