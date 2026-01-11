"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";

type ViewState =
  | { status: "loading" }
  | {
      status: "authed";
      email: string;
      role: "admin" | "user";
      displayName?: string | null;
    }
  | { status: "error"; message: string };

export default function ProtectedPage() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          profile?: { displayName?: string | null };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "failed to load user");
        setState({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
          displayName: data.profile?.displayName ?? null,
        });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      }
    })();
  }, []);

  if (state.status === "loading")
    return <main className="p-6">loading...</main>;

  if (state.status === "error") {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-4">error: {state.message}</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-4">
        <Link
          className="inline-block border rounded px-3 py-1"
          href="/dashboard"
        >
          Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <Link href="/dashboard/profile">
        <h2 className="text-lg font-semibold">profile</h2>
      </Link>
      <Link href="/dashboard/invoices">
        <h2 className="text-lg font-semibold">invoices</h2>
      </Link>
      <p className="mt-4">Welcome, {state.email}</p>
      {state.displayName ? (
        <p className="mt-1 text-sm">name: {state.displayName}</p>
      ) : null}
      <p className="mt-1 text-sm flex items-center gap-3">role: {state.role}</p>

      <div className="mt-6 flex gap-3">
        <Link className="underline" href="/">
          Home
        </Link>
        <form action={signOut}>
          <button className="border rounded px-4 py-2" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
