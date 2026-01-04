"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type ProfileRow = {
  id: string;
  email?: string | null;
  role?: "admin" | "user";
  display_name: string | null;
  student_number: string | null;
  name_kana?: string | null;
  generation: string | null;
  gender?: string | null;
  department: string | null;
  ryuha: string | null;
  position: string | null;
};

type ListState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; users: ProfileRow[] }
  | { status: "error"; message: string };

const limitedFields: Array<keyof ProfileRow> = [
  "display_name",
  "student_number",
  "generation",
  "department",
  "ryuha",
  "position",
];

const adminFields: Array<keyof ProfileRow> = [
  "display_name",
  "student_number",
  "name_kana",
  "generation",
  "gender",
  "department",
  "ryuha",
  "position",
];

export default function AdminProfileListPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [list, setList] = useState<ListState>({ status: "idle" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile/profile-list";
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

  useEffect(() => {
    if (auth.status !== "authed") return;

    (async () => {
      setList({ status: "loading" });
      try {
        const res = await fetch("/api/admin/profile-list", {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          users?: ProfileRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "failed to load list");
        setList({ status: "loaded", users: data.users ?? [] });
      } catch (err) {
        setList({
          status: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      }
    })();
  }, [auth]);

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
        <h1 className="text-2xl font-bold">Profile list</h1>
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
      <h1 className="text-2xl font-bold">Profile list</h1>
      <p className="mt-2 text-sm">Signed in as: {auth.email}</p>

      {list.status === "loading" ? (
        <p className="mt-4">loading...</p>
      ) : list.status === "error" ? (
        <p className="mt-4">error: {list.message}</p>
      ) : list.status === "loaded" ? (
        <div className="mt-6 space-y-4">
          {list.users.map((user) => {
            const fields =
              auth.role === "admin" ? adminFields : limitedFields;
            return (
              <div key={user.id} className="border rounded p-4">
                {auth.role === "admin" ? (
                  <div className="text-sm">
                    <p>
                      <span className="font-semibold">email:</span>{" "}
                      {user.email ?? "-"}
                    </p>
                    <p>
                      <span className="font-semibold">role:</span>{" "}
                      {user.role ?? "user"}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {fields.map((field) => (
                    <p key={field}>
                      <span className="font-semibold">{field}:</span>{" "}
                      {user[field] ?? "-"}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4">ready</p>
      )}

      <div className="mt-6">
        <Link className="underline" href="/dashboard/profile">
          Back
        </Link>
      </div>
    </main>
  );
}
