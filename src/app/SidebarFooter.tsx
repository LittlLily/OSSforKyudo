"use client";

import { useEffect, useState } from "react";
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
          setState({ status: "error", message: "not signed in" });
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
        if (!res.ok) throw new Error(data.error || "failed to load user");
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
          message: err instanceof Error ? err.message : "unknown error",
        });
      }
    })();
  }, []);

  if (state.status === "loading") {
    return <div className="text-xs text-[color:var(--muted)]">loading...</div>;
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
      <p>name: {state.displayName ?? "てすとさん"}</p>
      <p>student number: {state.studentNumber ?? "-"}</p>
      <p>role: {state.role}</p>
      <form action={signOut}>
        <button className="btn btn-ghost" type="submit">
          Sign out
        </button>
      </form>
      <p className="text-xs text-[color:var(--muted)]">V0.0.0</p>
    </div>
  );
}
