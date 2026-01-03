import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role =
    (data.user.app_metadata?.role as "admin" | "user") ?? "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role,
    },
    profile: {
      displayName: profile?.display_name ?? null,
    },
  });
}
