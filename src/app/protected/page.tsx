"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ViewState =
  | { status: "loading" }
  | { status: "authed"; email: string }
  | { status: "guest" }
  | { status: "error"; message: string };

export default function ProtectedPage() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return setState({ status: "error", message: error.message });

      const email = data.session?.user.email;
      if (!email) return setState({ status: "guest" });

      setState({ status: "authed", email });
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    location.href = "/login";
  };

  if (state.status === "loading") return <main className="p-6">loading...</main>;

  if (state.status === "guest") {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Protected</h1>
        <p className="mt-4">You are not signed in.</p>
        <p className="mt-4">
          <Link className="underline" href="/login">
            Go to login
          </Link>
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Protected</h1>
        <p className="mt-4">error: {state.message}</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Protected</h1>
      <p className="mt-4">Welcome, {state.email}</p>

      <div className="mt-6 flex gap-3">
        <Link className="underline" href="/">
          Home
        </Link>
        <button className="border rounded px-4 py-2" onClick={signOut}>
          Sign out
        </button>
      </div>
    </main>
  );
}
