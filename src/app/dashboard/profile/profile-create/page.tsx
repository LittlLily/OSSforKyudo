"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import AdminCreateUserForm from "../../AdminCreateUserForm";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

export default function AdminProfileCreatePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile/profile-create";
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

  if (auth.role !== "admin") {
    return (
      <main className="page">
        <p className="text-sm">forbidden</p>
        <Link className="btn btn-ghost inline-flex items-center gap-2" href="/dashboard/profile">
          <HiOutlineArrowLeft className="text-base" />
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <AdminCreateUserForm />
      <Link className="btn btn-ghost inline-flex items-center gap-2" href="/dashboard/profile">
        <HiOutlineArrowLeft className="text-base" />
        Back
      </Link>
    </main>
  );
}
