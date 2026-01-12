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
    return <main className="page">loading...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="page">
        <p className="text-sm">error: {auth.message}</p>
      </main>
    );
  }

  const isAdmin = auth.role === "admin";

  return (
    <main className="page">
      {isAdmin ? (
        <div className="inline-list">
          <Link className="btn btn-primary" href="/dashboard/invoices/create">
            Create invoice
          </Link>
        </div>
      ) : null}

      <section className="section">
        <div className="inline-list">
          <button
            className={`btn ${
              statusFilter === "pending" ? "btn-primary" : "btn-ghost"
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
            className={`btn ${
              statusFilter === "approved" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => {
              setStatusFilter("approved");
              void loadInvoices(undefined, "approved");
            }}
            type="button"
          >
            Approved
          </button>
        </div>
      </section>

      {isAdmin ? (
        <section className="section">
          <h2 className="section-title">Filters</h2>
          <div className="card space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="field text-sm">
                <span className="text-[color:var(--muted)]">display_name</span>
                <input
                  className="w-full"
                  value={filters.display_name}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      display_name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field text-sm">
                <span className="text-[color:var(--muted)]">student_number</span>
                <input
                  className="w-full"
                  value={filters.student_number}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      student_number: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field text-sm">
                <span className="text-[color:var(--muted)]">generation</span>
                <input
                  className="w-full"
                  value={filters.generation}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      generation: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field text-sm">
                <span className="text-[color:var(--muted)]">gender</span>
                <select
                  className="w-full"
                  value={filters.gender}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      gender: event.target.value,
                    }))
                  }
                >
                  <option value="">all</option>
                  <option value="male">male</option>
                  <option value="female">female</option>
                  <option value="other">other</option>
                </select>
              </label>
            </div>
            <div className="inline-list">
              <button
                className="btn btn-primary"
                onClick={() => void loadInvoices()}
                type="button"
              >
                Search
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setFilters(emptyFilters);
                  void loadInvoices(emptyFilters);
                }}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2 className="section-title">
          {statusFilter === "pending" ? "Pending invoices" : "Approved invoices"}
        </h2>
        {message ? <p className="text-sm">{message}</p> : null}
        {loading ? <p className="text-sm">loading...</p> : null}
        {!loading && sortedInvoices.length === 0 ? (
          <p className="text-sm">no invoices</p>
        ) : null}
        {sortedInvoices.length > 0 ? (
          <div className="table-wrap">
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">student_number</th>
                  <th className="text-left">display_name</th>
                  <th className="text-left">amount</th>
                  <th className="text-left">billed_at</th>
                  {statusFilter === "approved" ? (
                    <th className="text-left">approved_at</th>
                  ) : null}
                  {statusFilter === "approved" ? (
                    <th className="text-left">approver</th>
                  ) : null}
                  <th className="text-left">requester</th>
                  <th className="text-left">title</th>
                  <th className="text-left">description</th>
                  <th className="text-left">actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      {invoice.account_student_number ?? "-"}
                    </td>
                    <td>
                      {invoice.account_display_name ?? "-"}
                    </td>
                    <td>
                      {editingId === invoice.id ? (
                        <input
                          className="w-24"
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
                    <td>
                      {billedAtLabel(invoice.billed_at)}
                    </td>
                    {statusFilter === "approved" ? (
                      <td>
                        {invoice.approved_at
                          ? billedAtLabel(invoice.approved_at)
                          : "-"}
                      </td>
                    ) : null}
                    {statusFilter === "approved" ? (
                      <td>
                        {invoice.approver_display_name ?? "-"}
                      </td>
                    ) : null}
                    <td>
                      {invoice.requester_display_name ?? "-"}
                    </td>
                    <td>
                      {editingId === invoice.id ? (
                        <input
                          className="w-full"
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
                    <td>
                      {editingId === invoice.id ? (
                        <input
                          className="w-full"
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
                    <td>
                      <div className="inline-list">
                        {isAdmin ? (
                          statusFilter === "approved" ? (
                            <>
                              <button
                                className="btn btn-ghost"
                                onClick={() => void revertInvoice(invoice.id)}
                                type="button"
                              >
                                Revert
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => void deleteInvoice(invoice.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            </>
                          ) : editingId === invoice.id ? (
                            <>
                              <button
                                className="btn btn-primary"
                                onClick={() => void saveEdit(invoice.id)}
                                type="button"
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={cancelEdit}
                                type="button"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost"
                                onClick={() => beginEdit(invoice)}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={() => void approveInvoice(invoice.id)}
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-ghost"
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
