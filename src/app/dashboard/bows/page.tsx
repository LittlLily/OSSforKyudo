"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowRightCircle,
  HiOutlineClipboardDocumentList,
  HiOutlinePencilSquare,
  HiOutlinePlusCircle,
  HiOutlineTrash,
} from "react-icons/hi2";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

export default function BowMenuPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/bows";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        }
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

  return (
    <main className="page">
      <div className="flex w-full flex-col gap-3">
        <Link
          className="btn btn-primary py-6 inline-flex items-center gap-3"
          href="/dashboard/bows/bow-list"
        >
          <HiOutlineClipboardDocumentList className="text-lg" />
          弓一覧
        </Link>
        <Link
          className="btn btn-primary py-6 inline-flex items-center gap-3"
          href="/dashboard/bows/bow-loan"
        >
          <HiOutlineArrowRightCircle className="text-lg" />
          弓貸出
        </Link>
        {auth.role === "admin" ? (
          <>
            <Link
              className="btn btn-primary py-6 inline-flex items-center gap-3"
              href="/dashboard/bows/bow-create"
            >
              <HiOutlinePlusCircle className="text-lg" />
              弓作成
            </Link>
            <Link
              className="btn btn-primary py-6 inline-flex items-center gap-3"
              href="/dashboard/bows/bow-edit"
            >
              <HiOutlinePencilSquare className="text-lg" />
              弓編集
            </Link>
            <Link
              className="btn btn-primary py-6 inline-flex items-center gap-3"
              href="/dashboard/bows/bow-delete"
            >
              <HiOutlineTrash className="text-lg" />
              弓削除
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}
