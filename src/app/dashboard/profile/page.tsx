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
    return <main className="p-6">loading...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link className="inline-block border rounded px-3 py-1" href="/dashboard">
            Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-4">error: {auth.message}</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-4">
        <Link className="inline-block border rounded px-3 py-1" href="/dashboard">
          Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="mt-2 text-sm">Signed in as: {auth.email}</p>
      {auth.role === "admin" ? (
        <Link
          className="mt-6 inline-block border rounded px-4 py-2"
          href="/dashboard/profile/profile-edit"
        >
          Profile edit
        </Link>
      ) : null}
    </main>
  );
}
