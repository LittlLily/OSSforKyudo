"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type AuthState = { message: string };

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { message: "エラー: メールアドレスとパスワードは必須です" };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { message: `エラー: ${error.message}` };

  redirect(nextPath);
}

export async function signOut(): Promise<void> {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect("/login");
}
