"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type Invoice = {
  id: string;
  account_id: string;
  amount: number;
  billed_at: string;
  approved_at: string | null;
  requester_id: string;
  approver_id?: string | null;
  title: string | null;
  description: string | null;
  status: "pending" | "approved";
  account_display_name: string | null;
  account_student_number: string | null;
  requester_display_name: string | null;
  approver_display_name?: string | null;
};

type Filters = {
  display_name: string;
  student_number: string;
  generation: string;
  gender: string;
};

type InvoiceStatus = "pending" | "approved";

const emptyFilters: Filters = {
  display_name: "",
  student_number: "",
  generation: "",
  gender: "",
};

export default function InvoicesPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("pending");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    title: "",
    description: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/invoices";
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
    if (auth.status === "authed") {
      void loadInvoices();
    }
  }, [auth.status]);

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const left = new Date(a.billed_at).getTime();
      const right = new Date(b.billed_at).getTime();
      return right - left;
    });
  }, [invoices]);

  const billedAtLabel = (value: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
    });
  };

  const buildSearchParams = (values: Filters, status: InvoiceStatus) => {
    const params = new URLSearchParams();
    params.set("status", status);
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

  const loadInvoices = async (
    nextFilters?: Filters,
    nextStatus?: InvoiceStatus
  ) => {
    setLoading(true);
    setMessage(null);
    try {
      const query = buildSearchParams(
        nextFilters ?? filters,
        nextStatus ?? statusFilter
      );
      const res = await fetch(`/api/admin/invoices?${query}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        invoices?: Invoice[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "failed to load invoices");
      setInvoices(data.invoices ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  const beginEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setEditForm({
      amount: String(invoice.amount ?? ""),
      title: invoice.title ?? "",
      description: invoice.description ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ amount: "", title: "", description: "" });
  };

  const saveEdit = async (invoiceId: string) => {
    setMessage(null);
    const amount = Number(editForm.amount);
    if (!amount || Number.isNaN(amount)) {
      setMessage("amount is required");
      return;
    }

    try {
      const res = await fetch("/api/admin/invoices/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invoiceId,
          amount,
          title: editForm.title,
          description: editForm.description,
        }),
      });
      const data = (await res.json()) as {
        invoice?: { id: string; amount: number; title: string | null; description: string | null } | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "failed to update invoice");
      if (data.invoice) {
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === invoiceId
              ? {
                  ...invoice,
                  amount: data.invoice?.amount ?? invoice.amount,
                  title: data.invoice?.title ?? null,
                  description: data.invoice?.description ?? null,
                }
              : invoice
          )
        );
      }
      setMessage("updated");
      cancelEdit();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    }
  };

  const approveInvoice = async (invoiceId: string) => {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/invoices/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to approve");
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setMessage("approved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    }
  };

  const revertInvoice = async (invoiceId: string) => {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/invoices/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to revert");
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setMessage("reverted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    if (!confirm("この請求を削除しますか？")) return;
    setMessage(null);
    try {
      const res = await fetch("/api/admin/invoices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to delete");
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setMessage("deleted");
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
          <Link className="inline-block border rounded px-3 py-1" href="/dashboard">
            Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="mt-4">error: {auth.message}</p>
      </main>
    );
  }

  const isAdmin = auth.role === "admin";

  return (
    <main className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link className="inline-block border rounded px-3 py-1" href="/dashboard">
          Dashboard
        </Link>
        {isAdmin ? (
          <Link
            className="inline-block border rounded px-3 py-1"
            href="/dashboard/invoices/create"
          >
            Create invoice
          </Link>
        ) : null}
      </div>
      <h1 className="text-2xl font-bold">Invoices</h1>
      <p className="mt-2 text-sm">Signed in as: {auth.email}</p>

      <section className="mt-6 flex flex-wrap gap-3">
        <button
          className={`border rounded px-4 py-2 ${
            statusFilter === "pending" ? "bg-gray-100" : ""
          }`}
          onClick={() => {
            setStatusFilter("pending");
            void loadInvoices(undefined, "pending");
          }}
          type="button"
        >
          Pending
        </button>
        <button
          className={`border rounded px-4 py-2 ${
            statusFilter === "approved" ? "bg-gray-100" : ""
          }`}
          onClick={() => {
            setStatusFilter("approved");
            void loadInvoices(undefined, "approved");
          }}
          type="button"
        >
          Approved
        </button>
      </section>

      {isAdmin ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Filters</h2>
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
              onClick={() => void loadInvoices()}
              type="button"
            >
              Search
            </button>
            <button
              className="border rounded px-4 py-2"
              onClick={() => {
                setFilters(emptyFilters);
                void loadInvoices(emptyFilters);
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          {statusFilter === "pending" ? "Pending invoices" : "Approved invoices"}
        </h2>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
        {loading ? <p className="mt-3">loading...</p> : null}
        {!loading && sortedInvoices.length === 0 ? (
          <p className="mt-3 text-sm">no invoices</p>
        ) : null}
        {sortedInvoices.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">student_number</th>
                  <th className="px-3 py-2 text-left">display_name</th>
                  <th className="px-3 py-2 text-left">amount</th>
                  <th className="px-3 py-2 text-left">billed_at</th>
                  {statusFilter === "approved" ? (
                    <th className="px-3 py-2 text-left">approved_at</th>
                  ) : null}
                  {statusFilter === "approved" ? (
                    <th className="px-3 py-2 text-left">approver</th>
                  ) : null}
                  <th className="px-3 py-2 text-left">requester</th>
                  <th className="px-3 py-2 text-left">title</th>
                  <th className="px-3 py-2 text-left">description</th>
                  <th className="px-3 py-2 text-left">actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b">
                    <td className="px-3 py-2">
                      {invoice.account_student_number ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {invoice.account_display_name ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === invoice.id ? (
                        <input
                          className="w-24 border rounded px-2 py-1"
                          type="number"
                          min={1}
                          value={editForm.amount}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              amount: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        invoice.amount
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {billedAtLabel(invoice.billed_at)}
                    </td>
                    {statusFilter === "approved" ? (
                      <td className="px-3 py-2">
                        {invoice.approved_at
                          ? billedAtLabel(invoice.approved_at)
                          : "-"}
                      </td>
                    ) : null}
                    {statusFilter === "approved" ? (
                      <td className="px-3 py-2">
                        {invoice.approver_display_name ?? "-"}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      {invoice.requester_display_name ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === invoice.id ? (
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={editForm.title}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        invoice.title ?? "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === invoice.id ? (
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        invoice.description ?? "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {isAdmin ? (
                          statusFilter === "approved" ? (
                            <>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={() => void revertInvoice(invoice.id)}
                                type="button"
                              >
                                Revert
                              </button>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={() => void deleteInvoice(invoice.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            </>
                          ) : editingId === invoice.id ? (
                            <>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={() => void saveEdit(invoice.id)}
                                type="button"
                              >
                                Save
                              </button>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={cancelEdit}
                                type="button"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={() => beginEdit(invoice)}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={() => void approveInvoice(invoice.id)}
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="border rounded px-2 py-1"
                                onClick={() => void deleteInvoice(invoice.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            </>
                          )
                        ) : null}
                      </div>
                    </td>
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
