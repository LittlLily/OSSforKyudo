"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowPath,
  HiOutlineArrowUturnLeft,
  HiOutlineCheckBadge,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMagnifyingGlass,
  HiOutlinePencilSquare,
  HiOutlinePlusCircle,
  HiOutlineReceiptRefund,
  HiOutlineTrash,
  HiOutlineXMark,
} from "react-icons/hi2";
import { hasSubPermission } from "@/lib/permissions";

type AuthState =
  | { status: "loading" }
  | {
      status: "authed";
      email: string;
      role: "admin" | "user";
      subPermissions: string[];
    }
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
  const isAdmin =
    auth.status === "authed" &&
    (auth.role === "admin" ||
      hasSubPermission(auth.subPermissions, "invoice_admin"));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/invoices";
          return;
        }
        const data = (await res.json()) as {
          user?: {
            email?: string | null;
            role?: "admin" | "user";
            subPermissions?: string[];
          };
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
          subPermissions: data.user?.subPermissions ?? [],
        });
      } catch (err) {
        setAuth({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (auth.status === "authed") {
      void loadInvoices();
    }
  }, [auth.status, isAdmin]);

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

  const baseInvoicePath = isAdmin ? "/api/admin/invoices" : "/api/invoices";

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
      const res = await fetch(`${baseInvoicePath}?${query}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        invoices?: Invoice[];
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || "請求の読み込みに失敗しました");
      setInvoices(data.invoices ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
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
      setMessage("金額は必須です");
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
        invoice?: {
          id: string;
          amount: number;
          title: string | null;
          description: string | null;
        } | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "請求の更新に失敗しました");
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
      setMessage("更新しました");
      cancelEdit();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
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
      if (!res.ok) throw new Error(data.error || "承認に失敗しました");
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setMessage("承認しました");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
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
      if (!res.ok) throw new Error(data.error || "差し戻しに失敗しました");
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setMessage("差し戻しました");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
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
      if (!res.ok) throw new Error(data.error || "削除に失敗しました");
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setMessage("削除しました");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    }
  };

  if (auth.status === "loading") {
    return <main className="page">読み込み中...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="page">
        <p className="text-sm">エラー: {auth.message}</p>
      </main>
    );
  }

  return (
    <main className="page">
      {isAdmin ? (
        <div className="inline-list">
          <Link
            className="btn btn-primary inline-flex items-center gap-2"
            href="/dashboard/invoices/create"
          >
            <HiOutlinePlusCircle className="text-base" />
            請求を作成
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
            <span className="inline-flex items-center gap-2">
              <HiOutlineClock className="text-base" />
              保留
            </span>
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
            <span className="inline-flex items-center gap-2">
              <HiOutlineCheckCircle className="text-base" />
              承認済み
            </span>
          </button>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineAdjustmentsHorizontal className="text-base" />
          絞り込み
        </h2>
        <div className="card space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field text-sm">
              <span className="text-[color:var(--muted)]">表示名</span>
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
              <span className="text-[color:var(--muted)]">学籍番号</span>
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
              <span className="text-[color:var(--muted)]">代</span>
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
              <span className="text-[color:var(--muted)]">性別</span>
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
                <option value="">すべて</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </label>
          </div>
          <div className="inline-list">
            <button
              className="btn btn-ghost"
              onClick={() => void loadInvoices()}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <HiOutlineMagnifyingGlass className="text-base" />
                検索
              </span>
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFilters(emptyFilters);
                void loadInvoices(emptyFilters);
              }}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <HiOutlineArrowPath className="text-base" />
                リセット
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <span className="text-base">
            {statusFilter === "pending" ? (
              <HiOutlineReceiptRefund />
            ) : (
              <HiOutlineCheckBadge />
            )}
          </span>
          {statusFilter === "pending" ? "保留中の請求" : "承認済みの請求"}
        </h2>
        {message ? <p className="text-sm">{message}</p> : null}
        {loading ? <p className="text-sm">読み込み中...</p> : null}
        {!loading && sortedInvoices.length === 0 ? (
          <p className="text-sm">請求がありません</p>
        ) : null}
        {sortedInvoices.length > 0 ? (
          <div className="table-wrap">
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">学籍番号</th>
                  <th className="text-left">表示名</th>
                  <th className="text-left">金額</th>
                  <th className="text-left">請求日</th>
                  {statusFilter === "approved" ? (
                    <th className="text-left">承認日</th>
                  ) : null}
                  {statusFilter === "approved" ? (
                    <th className="text-left">承認者</th>
                  ) : null}
                  <th className="text-left">申請者</th>
                  <th className="text-left">件名</th>
                  <th className="text-left">内容</th>
                  <th className="text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.account_student_number ?? "-"}</td>
                    <td>{invoice.account_display_name ?? "-"}</td>
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
                    <td>{billedAtLabel(invoice.billed_at)}</td>
                    {statusFilter === "approved" ? (
                      <td>
                        {invoice.approved_at
                          ? billedAtLabel(invoice.approved_at)
                          : "-"}
                      </td>
                    ) : null}
                    {statusFilter === "approved" ? (
                      <td>{invoice.approver_display_name ?? "-"}</td>
                    ) : null}
                    <td>{invoice.requester_display_name ?? "-"}</td>
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
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlineArrowUturnLeft className="text-base" />
                                  差し戻し
                                </span>
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => void deleteInvoice(invoice.id)}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlineTrash className="text-base" />
                                  削除
                                </span>
                              </button>
                            </>
                          ) : editingId === invoice.id ? (
                            <>
                              <button
                                className="btn btn-primary"
                                onClick={() => void saveEdit(invoice.id)}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlineCheckCircle className="text-base" />
                                  保存
                                </span>
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={cancelEdit}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlineXMark className="text-base" />
                                  キャンセル
                                </span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost"
                                onClick={() => beginEdit(invoice)}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlinePencilSquare className="text-base" />
                                  編集
                                </span>
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => void approveInvoice(invoice.id)}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlineCheckBadge className="text-base" />
                                  承認
                                </span>
                              </button>
                              <button
                                className="btn btn-ghost"
                                onClick={() => void deleteInvoice(invoice.id)}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <HiOutlineTrash className="text-base" />
                                  削除
                                </span>
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
