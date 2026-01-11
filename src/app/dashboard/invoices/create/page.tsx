"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type UserProfile = {
  id: string;
  display_name: string | null;
  student_number: string | null;
  generation: string | null;
  gender: string | null;
};

type Filters = {
  display_name: string;
  student_number: string;
  generation: string;
  gender: string;
};

const emptyFilters: Filters = {
  display_name: "",
  student_number: "",
  generation: "",
  gender: "",
};

export default function InvoiceCreatePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/invoices/create";
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

  const buildSearchParams = (values: Filters) => {
    const params = new URLSearchParams();
    if (values.display_name) {
      params.set("display_name", values.display_name);
    }
    if (values.student_number) {
      params.set("student_number", values.student_number);
    }
    if (values.generation) {
      params.set("generation", values.generation);
    }
    if (values.gender) {
      params.set("gender", values.gender);
    }
    return params.toString();
  };

  const searchUsers = async (nextFilters?: Filters) => {
    setLoading(true);
    setMessage(null);
    try {
      const query = buildSearchParams(nextFilters ?? filters);
      const res = await fetch(`/api/admin/profile-list?${query}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        users?: UserProfile[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "failed to load users");
      setUsers(data.users ?? []);
      setSelectedIds([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  const allSelected = useMemo(() => {
    return users.length > 0 && selectedIds.length === users.length;
  }, [selectedIds.length, users.length]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((user) => user.id));
    }
  };

  const submitInvoices = async () => {
    setMessage(null);
    const amountValue = Number(amount);
    if (!amountValue || Number.isNaN(amountValue) || amountValue <= 0) {
      setMessage("amount is required");
      return;
    }
    if (selectedIds.length === 0) {
      setMessage("select at least one account");
      return;
    }

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: selectedIds,
          amount: amountValue,
          title,
          description,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to create invoices");
      setMessage("created");
      setSelectedIds([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    }
  };

  if (auth.status === "loading") {
    return <main className="p-6">loading...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link className="inline-block border rounded px-3 py-1" href="/dashboard/invoices">
            Invoices
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Invoice create</h1>
        <p className="mt-4">error: {auth.message}</p>
      </main>
    );
  }

  if (auth.role !== "admin") {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link className="inline-block border rounded px-3 py-1" href="/dashboard/invoices">
            Invoices
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Invoice create</h1>
        <p className="mt-4">admin only</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link className="inline-block border rounded px-3 py-1" href="/dashboard/invoices">
          Invoices
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Invoice create</h1>
      <p className="mt-2 text-sm">Signed in as: {auth.email}</p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Search accounts</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            display_name
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.display_name}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  display_name: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm">
            student_number
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.student_number}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  student_number: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm">
            generation
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.generation}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  generation: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm">
            gender
            <select
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.gender}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, gender: event.target.value }))
              }
            >
              <option value="">all</option>
              <option value="male">male</option>
              <option value="female">female</option>
              <option value="other">other</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="border rounded px-4 py-2"
            onClick={() => void searchUsers()}
            type="button"
          >
            Search
          </button>
          <button
            className="border rounded px-4 py-2"
            onClick={() => {
              setFilters(emptyFilters);
              void searchUsers(emptyFilters);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Create invoice</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            amount
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="text-sm">
            title
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="text-sm md:col-span-2">
            description
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="border rounded px-4 py-2"
            onClick={submitInvoices}
            type="button"
          >
            Create invoices
          </button>
          {message ? <p className="text-sm">{message}</p> : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Accounts</h2>
          <button
            className="border rounded px-3 py-1"
            onClick={toggleSelectAll}
            type="button"
          >
            {allSelected ? "Unselect all" : "Select all"}
          </button>
        </div>
        {loading ? <p className="mt-3">loading...</p> : null}
        {!loading && users.length === 0 ? (
          <p className="mt-3 text-sm">no accounts</p>
        ) : null}
        {users.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">select</th>
                  <th className="px-3 py-2 text-left">display_name</th>
                  <th className="px-3 py-2 text-left">student_number</th>
                  <th className="px-3 py-2 text-left">generation</th>
                  <th className="px-3 py-2 text-left">gender</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelect(user.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{user.display_name ?? "-"}</td>
                    <td className="px-3 py-2">{user.student_number ?? "-"}</td>
                    <td className="px-3 py-2">{user.generation ?? "-"}</td>
                    <td className="px-3 py-2">{user.gender ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
