"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type UserRow = {
  id: string;
  email: string | null;
  role: "admin" | "user";
};

type ListState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; users: UserRow[] }
  | { status: "error"; message: string };

export default function AdminProfileDeletePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile/profile-delete";
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
    if (auth.status !== "authed" || auth.role !== "admin") return;

    (async () => {
      setList({ status: "loading" });
      try {
        const res = await fetch("/api/admin/profile-delete", {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          users?: UserRow[];
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

  const handleDelete = async () => {
    if (!selectedId) {
      setMessage("error: select a user");
      return;
    }

    setDeleting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/profile-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to delete user");
      setMessage("deleted");
      setSelectedId("");
      setList((prev) =>
        prev.status === "loaded"
          ? {
              status: "loaded",
              users: prev.users.filter((user) => user.id !== selectedId),
            }
          : prev
      );
    } catch (err) {
      setMessage(err instanceof Error ? `error: ${err.message}` : "error");
    } finally {
      setDeleting(false);
    }
  };

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
        <Link className="btn btn-ghost" href="/dashboard/profile">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      {list.status === "loading" ? (
        <p className="text-sm">loading...</p>
      ) : list.status === "error" ? (
        <p className="text-sm">error: {list.message}</p>
      ) : (
        <div className="card space-y-4">
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              User
            </span>
            <select
              className="w-full"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Select user</option>
              {list.status === "loaded"
                ? list.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email ?? user.id} ({user.role})
                    </option>
                  ))
                : null}
            </select>
          </label>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleDelete}
            disabled={deleting || list.status !== "loaded"}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
          {message ? <p className="text-sm">{message}</p> : null}
        </div>
      )}

      <Link className="btn btn-ghost" href="/dashboard/profile">
        Back
      </Link>
    </main>
  );
}
