"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ViewState =
  | { status: "loading" }
  | {
      status: "authed";
      email: string;
      role: "admin" | "user";
      displayName?: string | null;
    }
  | { status: "guest" }
  | { status: "error"; message: string };

export default function ProtectedPage() {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [createMsg, setCreateMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return setState({ status: "error", message: error.message });

      const email = data.session?.user.email;
      if (!email) return setState({ status: "guest" });

      const role =
        (data.session?.user.app_metadata?.role as "admin" | "user") ?? "user";
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.session?.user.id)
        .maybeSingle();
      setState({
        status: "authed",
        email,
        role,
        displayName: profile?.display_name ?? null,
      });
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    location.href = "/login";
  };

  const createUser = async () => {
    setCreateMsg("creating...");
    const { data, error } = await supabase.functions.invoke(
      "admin-create-user",
      {
        body: {
          email: newEmail,
          password: newPassword,
          display_name: newDisplayName,
          role: newRole,
        },
      }
    );
    if (error) {
      setCreateMsg(`error: ${error.message}`);
      return;
    }
    setCreateMsg(`created: ${data?.user_id ?? "ok"}`);
    setNewEmail("");
    setNewPassword("");
    setNewDisplayName("");
    setNewRole("user");
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
      {state.displayName ? (
        <p className="mt-1 text-sm">name: {state.displayName}</p>
      ) : null}
      <p className="mt-1 text-sm">role: {state.role}</p>

      {state.role === "admin" ? (
        <section className="mt-8 border rounded p-4">
          <h2 className="text-lg font-semibold">Create user</h2>
          <label className="block mt-4">
            <span className="text-sm">Email</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block mt-4">
            <span className="text-sm">Password</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block mt-4">
            <span className="text-sm">Name (日本語)</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
          </label>
          <label className="block mt-4">
            <span className="text-sm">Role</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={newRole}
              onChange={(e) =>
                setNewRole(e.target.value as "admin" | "user")
              }
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button className="mt-4 border rounded px-4 py-2" onClick={createUser}>
            Create
          </button>
          {createMsg ? (
            <p className="mt-2 text-sm whitespace-pre-wrap">{createMsg}</p>
          ) : null}
        </section>
      ) : null}

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
