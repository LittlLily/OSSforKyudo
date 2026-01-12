"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineMagnifyingGlass,
  HiOutlineReceiptRefund,
  HiOutlineSquares2X2,
  HiOutlineUserGroup,
} from "react-icons/hi2";

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
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({
          status: "authed",
          email: data.user?.email ?? "",
          role: data.user?.role ?? "user",
        });
      } catch (err) {
        setAuth({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
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
      if (!res.ok)
        throw new Error(data.error || "ユーザーの読み込みに失敗しました");
      setUsers(data.users ?? []);
      setSelectedIds([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setLoading(false);
    }
  };

  const allSelected = useMemo(() => {
    return users.length > 0 && selectedIds.length === users.length;
  }, [selectedIds.length, users.length]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
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
      setMessage("金額は必須です");
      return;
    }
    if (selectedIds.length === 0) {
      setMessage("対象アカウントを1件以上選択してください");
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
      if (!res.ok) throw new Error(data.error || "請求の作成に失敗しました");
      setMessage("作成しました");
      setSelectedIds([]);
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
        <div className="inline-list">
          <Link
            className="btn btn-ghost inline-flex items-center gap-2"
            href="/dashboard/invoices"
          >
            <HiOutlineArrowLeft className="text-base" />
            請求一覧
          </Link>
        </div>
        <p className="text-sm">エラー: {auth.message}</p>
      </main>
    );
  }

  if (auth.role !== "admin") {
    return (
      <main className="page">
        <div className="inline-list">
          <Link
            className="btn btn-ghost inline-flex items-center gap-2"
            href="/dashboard/invoices"
          >
            <HiOutlineArrowLeft className="text-base" />
            請求一覧
          </Link>
        </div>
        <p className="text-sm">管理者のみ</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="inline-list">
        <Link
          className="btn btn-ghost inline-flex items-center gap-2"
          href="/dashboard/invoices"
        >
          <HiOutlineArrowLeft className="text-base" />
          請求一覧
        </Link>
      </div>

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineMagnifyingGlass className="text-base" />
          アカウント検索
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
              className="btn btn-primary"
              onClick={() => void searchUsers()}
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
                void searchUsers(emptyFilters);
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
          <HiOutlineReceiptRefund className="text-base" />
          請求を作成
        </h2>
        <div className="card space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field text-sm">
              <span className="text-[color:var(--muted)]">金額</span>
              <input
                className="w-full"
                type="number"
                min={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="field text-sm">
              <span className="text-[color:var(--muted)]">件名</span>
              <input
                className="w-full"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field text-sm md:col-span-2">
              <span className="text-[color:var(--muted)]">内容</span>
              <input
                className="w-full"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
          <div className="inline-list">
            <button
              className="btn btn-primary"
              onClick={submitInvoices}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <HiOutlineCheckCircle className="text-base" />
                請求を作成
              </span>
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="inline-list">
          <h2 className="section-title flex items-center gap-2">
            <HiOutlineUserGroup className="text-base" />
            アカウント
          </h2>
          <button
            className="btn btn-ghost"
            onClick={toggleSelectAll}
            type="button"
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineSquares2X2 className="text-base" />
              {allSelected ? "全解除" : "全選択"}
            </span>
          </button>
        </div>
        {loading ? <p className="text-sm">読み込み中...</p> : null}
        {!loading && users.length === 0 ? (
          <p className="text-sm">アカウントがありません</p>
        ) : null}
        {users.length > 0 ? (
          <div className="table-wrap">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">選択</th>
                  <th className="text-left">表示名</th>
                  <th className="text-left">学籍番号</th>
                  <th className="text-left">代</th>
                  <th className="text-left">性別</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelect(user.id)}
                      />
                    </td>
                    <td>{user.display_name ?? "-"}</td>
                    <td>{user.student_number ?? "-"}</td>
                    <td>{user.generation ?? "-"}</td>
                    <td>{user.gender ?? "-"}</td>
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
