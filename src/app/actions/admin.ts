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
    return { message: "エラー: メールアドレスとパスワードは必須です" };
  }

  if (role !== "admin" && role !== "user") {
    return { message: "エラー: 権限が不正です" };
  }

  const supabase = createClient(await cookies());
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      message: `エラー: 認証ユーザーが取得できません${
        userError ? ` / ${userError.message}` : ""
      }`,
    };
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return {
      message: `エラー: セッショントークンがありません${
        sessionError ? ` / ${sessionError.message}` : ""
      }`,
    };
  }

  const response = await supabase.functions.invoke("admin-create-user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      email,
      password,
      display_name: displayName || null,
      role,
    },
  });

  if (response.error) {
    const details = [
      response.error.message,
      response.error.name,
      response.error.context?.status
        ? `status=${response.error.context.status}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");
    return { message: `エラー: ${details}` };
  }

  return { message: `作成: ${response.data?.user_id ?? "ok"}` };
}
