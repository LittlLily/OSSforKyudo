"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  const signIn = async () => {
    setMsg("signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMsg(error ? `error: ${error.message}` : "ok: signed in");
  };

  const signOut = async () => {
    setMsg("signing out...");
    const { error } = await supabase.auth.signOut();
    setMsg(error ? `error: ${error.message}` : "ok: signed out");
  };

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-2xl font-bold">Login</h1>
      <h1 className="text-2xl font-bold">V0.0.2</h1>

      <label className="block mt-6">
        <span className="text-sm">Email</span>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      <label className="block mt-4">
        <span className="text-sm">Password</span>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      <div className="mt-6 flex gap-3">
        <button className="border rounded px-4 py-2" onClick={signIn}>
          Sign in
        </button>
        <button className="border rounded px-4 py-2" onClick={signOut}>
          Sign out
        </button>
      </div>

      <p className="mt-4 text-sm whitespace-pre-wrap">{msg}</p>
    </main>
  );
}
