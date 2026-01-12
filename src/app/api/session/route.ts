import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (error.message === "Auth session missing!") {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json(
      { user: null, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
  });
}
