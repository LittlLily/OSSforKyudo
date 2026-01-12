"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

export default function AdminProfilePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "failed to load user");
        setAuth({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
        });
      } catch (err) {
        setAuth({
          status: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      }
    })();
  }, []);

  if (auth.status === "loading") {
    return <main className="page">loading...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="page">
        <p className="text-sm">error: {auth.message}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex w-full flex-col gap-3">
        {auth.role === "admin" ? (
          <>
            <Link
              className="btn btn-primary py-6"
              href="/dashboard/profile/profile-edit"
            >
              Profile edit
            </Link>
            <Link
              className="btn btn-primary py-6"
              href="/dashboard/profile/profile-create"
            >
              Profile create
            </Link>
            <Link
              className="btn btn-primary py-6"
              href="/dashboard/profile/profile-delete"
            >
              Profile delete
            </Link>
          </>
        ) : null}
        <Link
          className="btn btn-primary py-6"
          href="/dashboard/profile/profile-list"
        >
          Profile list
        </Link>
      </div>
    </main>
  );
}
