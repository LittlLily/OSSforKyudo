"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineDocumentText,
  HiOutlineReceiptRefund,
  HiOutlineUserCircle,
} from "react-icons/hi2";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; role: "admin" | "user" }
  | { status: "error"; message: string };

export default function LogsPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/logs";
          return;
        }
        const data = (await res.json()) as {
          user?: { role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({
          status: "authed",
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

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <HiOutlineDocumentText className="text-2xl" />
            ログ
          </h1>
          <p className="page-subtitle">
            監視用のアカウントログと会計ログを確認できます。
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link className="card" href="/dashboard/logs/account">
          <h2 className="section-title flex items-center gap-2">
            <HiOutlineUserCircle className="text-base" />
            アカウントログ
          </h2>
          <p className="mt-2 text-sm">
            {auth.role === "admin"
              ? "全ユーザーの操作履歴"
              : "自分の操作履歴"}
          </p>
        </Link>
        <Link className="card" href="/dashboard/logs/invoices">
          <h2 className="section-title flex items-center gap-2">
            <HiOutlineReceiptRefund className="text-base" />
            会計ログ
          </h2>
          <p className="mt-2 text-sm">
            {auth.role === "admin"
              ? "全請求の操作履歴"
              : "自分に紐づく請求の履歴"}
          </p>
        </Link>
      </div>
    </main>
  );
}
