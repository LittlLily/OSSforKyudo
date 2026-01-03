"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type AdminCreateState = { message: string };

export async function createUser(
  _prevState: AdminCreateState,
  formData: FormData
): Promise<AdminCreateState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const role = String(formData.get("role") ?? "user");

  if (!email || !password) {
    return { message: "error: email and password are required" };
  }

  if (role !== "admin" && role !== "user") {
    return { message: "error: invalid role" };
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      email,
      password,
      display_name: displayName || null,
      role,
    },
  });

  if (error) return { message: `error: ${error.message}` };

  return { message: `created: ${data?.user_id ?? "ok"}` };
}
