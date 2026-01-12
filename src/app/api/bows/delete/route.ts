import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type AuthResult =
  | { ok: true; role: "admin" | "user" }
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
  return { ok: true, role };
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(await cookies());

  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim() ?? "";

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("japanese_bows")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 }
    );
  }
}
