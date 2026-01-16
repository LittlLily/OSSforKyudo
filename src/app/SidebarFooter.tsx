"use client";

import { useEffect, useState } from "react";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineIdentification,
  HiOutlineShieldCheck,
  HiOutlineTag,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import { signOut } from "@/app/actions/auth";

type ViewState =
  | { status: "loading" }
  | {
      status: "authed";
      email: string;
      role: "admin" | "user";
      displayName?: string | null;
      studentNumber?: string | null;
    }
  | { status: "error"; message: string };

export default function SidebarFooter() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          setState({ status: "error", message: "サインインしていません" });
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          profile?: {
            displayName?: string | null;
            studentNumber?: string | null;
          };
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setState({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
          displayName: data.profile?.displayName ?? null,
          studentNumber: data.profile?.studentNumber ?? null,
        });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, []);

  if (state.status === "loading") {
    return (
      <div className="text-xs text-[color:var(--muted)]">読み込み中...</div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="text-xs text-[color:var(--muted)]">
        {state.message}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2">
        <HiOutlineUserCircle className="text-base" />
        {state.displayName ?? "てすとさん"}
      </p>
      <p className="flex items-center gap-2">
        <HiOutlineIdentification className="text-base" />
        学籍番号: {state.studentNumber ?? "-"}
      </p>
      <form action={signOut}>
        <button className="btn btn-ghost inline-flex items-center gap-2" type="submit">
          <HiOutlineArrowRightOnRectangle className="text-base" />
          サインアウト
        </button>
      </form>
      <p className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
        <HiOutlineTag className="text-sm" />
        V0.0.0
      </p>
    </div>
  );
}
