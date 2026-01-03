"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionState =
  | { status: "loading" }
  | { status: "ok"; session: "yes" | "no" }
  | { status: "error"; message: string };

export default function Home() {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data = (await res.json()) as { user?: { id: string } | null; error?: string };
        if (!res.ok) throw new Error(data.error || "failed to load session");
        setState({
          status: "ok",
          session: data.user ? "yes" : "no",
        });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      }
    })();
  }, []);

  const msg =
    state.status === "loading"
      ? "checking..."
      : state.status === "error"
      ? `error: ${state.message}`
      : `ok: session=${state.session}`;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Supabase connection test</h1>
      <p className="mt-4">{msg}</p>
      <p className="mt-4">
        <Link className="underline" href="/login">
          Go to login
        </Link>
      </p>
    </main>
  );
}
