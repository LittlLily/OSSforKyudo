import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normalizeSubPermissions } from "@/lib/permissions";

export async function GET() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (error.message.includes("Auth session missing")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role =
    (data.user.app_metadata?.role as "admin" | "user") ?? "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, student_number, sub_permissions")
    .eq("id", data.user.id)
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role,
      subPermissions: normalizeSubPermissions(profile?.sub_permissions),
    },
    profile: {
      displayName: profile?.display_name ?? null,
      studentNumber: profile?.student_number ?? null,
    },
  });
}
