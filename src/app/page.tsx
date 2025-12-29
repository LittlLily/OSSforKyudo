"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const [msg, setMsg] = useState("checking...");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) setMsg(`error: ${error.message}`);
      else setMsg(`ok: session=${data.session ? "yes" : "no"}`);
    })();
  }, []);

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
