"use client";

import { useEffect, useState } from "react";
import AdminCreateUserForm from "../../AdminCreateUserForm";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

export default function AdminProfileCreatePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile/profile-create";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
        });
      } catch (err) {
        setAuth({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, []);

  if (auth.status === "loading") {
    return <main className="page">読み込み中...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="page">
        <p className="text-sm">エラー: {auth.message}</p>
      </main>
    );
  }

  if (auth.role !== "admin") {
    return (
      <main className="page">
        <p className="text-sm">権限がありません</p>
      </main>
    );
  }

  return (
    <main className="page">
      <AdminCreateUserForm />
    </main>
  );
}
