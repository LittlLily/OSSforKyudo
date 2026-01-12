"use client";

import { useEffect, useState } from "react";
import { HiOutlineHome } from "react-icons/hi2";

type ViewState =
  | { status: "loading" }
  | {
      status: "authed";
      email: string;
      role: "admin" | "user";
      displayName?: string | null;
    }
  | { status: "error"; message: string };

export default function Home() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          profile?: { displayName?: string | null };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setState({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
          displayName: data.profile?.displayName ?? null,
        });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, []);

  if (state.status === "loading")
    return <main className="page">読み込み中...</main>;

  if (state.status === "error") {
    return (
      <main className="page">
        <p className="text-sm">エラー: {state.message}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
        <HiOutlineHome className="text-base" />
        ダッシュボードは現在空です。
      </div>
    </main>
  );
}
