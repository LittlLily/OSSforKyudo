"use client";

import { useEffect, useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineMagnifyingGlass,
  HiOutlineTrash,
} from "react-icons/hi2";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; id: string; email: string; role: "admin" | "user" }
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
  public_field_1?: string | null;
  public_field_2?: string | null;
  restricted_field_1?: string | null;
  restricted_field_2?: string | null;
};

type ListState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; users: ProfileRow[] }
  | { status: "error"; message: string };

type SearchForm = {
  display_name: string;
  student_number: string;
  generation: string;
  gender: string;
  department: string;
  ryuha: string;
  position: string;
};

const emptySearch: SearchForm = {
  display_name: "",
  student_number: "",
  generation: "",
  gender: "",
  department: "",
  ryuha: "",
  position: "",
};

const getFiscalYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? year : year - 1;
};

const buildInitialSearch = (): SearchForm => {
  const fiscalYear = getFiscalYear();
  const generations = [
    fiscalYear - 1961,
    fiscalYear - 1962,
    fiscalYear - 1963,
    fiscalYear - 1964,
  ]
    .map(String)
    .join(",");

  return {
    ...emptySearch,
    generation: generations,
  };
};

const adminFields: Array<keyof ProfileRow> = [
  "display_name",
  "student_number",
  "name_kana",
  "generation",
  "gender",
  "department",
  "ryuha",
  "position",
  "public_field_1",
  "public_field_2",
  "restricted_field_1",
  "restricted_field_2",
];

const fieldLabels: Record<keyof ProfileRow, string> = {
  id: "ID",
  email: "メール",
  role: "権限",
  display_name: "表示名",
  student_number: "学籍番号",
  name_kana: "氏名（カナ）",
  generation: "代",
  gender: "性別",
  department: "学科",
  ryuha: "流派",
  position: "役職",
  public_field_1: "誰でも1",
  public_field_2: "誰でも2",
  restricted_field_1: "制限1",
  restricted_field_2: "制限2",
};

const roleLabel = (role?: "admin" | "user") =>
  role === "admin" ? "管理者" : "ユーザー";

export default function AdminProfileDeletePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [form, setForm] = useState<SearchForm>(() => buildInitialSearch());
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedUsers =
    list.status === "loaded"
      ? [...list.users]
          .filter((user) =>
            auth.status === "authed" ? user.id !== auth.id : true
          )
          .sort((a, b) => {
            const aVal = (a.generation ?? "").trim();
            const bVal = (b.generation ?? "").trim();
            const aEmpty = aVal === "";
            const bEmpty = bVal === "";
            if (aEmpty && bEmpty) return 0;
            if (aEmpty) return 1;
            if (bEmpty) return -1;
            const aNum = Number(aVal);
            const bNum = Number(bVal);
            if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
              return bNum - aNum;
            }
            return bVal.localeCompare(aVal);
          })
      : [];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile/profile-delete";
          return;
        }
        const data = (await res.json()) as {
          user?: {
            id?: string;
            email?: string | null;
            role?: "admin" | "user";
          };
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({
          status: "authed",
          id: data.user?.id ?? "",
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

  useEffect(() => {
    if (auth.status !== "authed" || auth.role !== "admin") return;
    void handleSearch();
  }, [auth]);

  const handleSearch = async () => {
    setMessage("");
    setList({ status: "loading" });
    try {
      const params = new URLSearchParams();
      if (form.display_name) params.set("display_name", form.display_name);
      if (form.student_number)
        params.set("student_number", form.student_number);
      if (form.generation) params.set("generation", form.generation);
      if (form.gender) params.set("gender", form.gender);
      if (form.department) params.set("department", form.department);
      if (form.ryuha) params.set("ryuha", form.ryuha);
      if (form.position) params.set("position", form.position);
      const query = params.toString();
      const res = await fetch(
        `/api/admin/profile-list${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as {
        users?: ProfileRow[];
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || "一覧の読み込みに失敗しました");
      setList({ status: "loaded", users: data.users ?? [] });
    } catch (err) {
      setList({
        status: "error",
        message: err instanceof Error ? err.message : "不明なエラー",
      });
    }
  };

  const handleReset = () => {
    setForm(emptySearch);
    setMessage("");
    setList({ status: "idle" });
  };

  const updateField = (key: keyof SearchForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (list.status !== "idle") return;
    const isBlank = Object.values(form).every((value) => value === "");
    if (!isBlank) return;
    void handleSearch();
  }, [form, list.status]);

  const handleDelete = async (targetId: string) => {
    if (!targetId) return;
    if (auth.status === "authed" && auth.id === targetId) {
      setMessage("エラー: 自分は削除できません");
      return;
    }
    const confirmed = window.confirm("このユーザーを削除しますか？");
    if (!confirmed) return;
    setDeletingId(targetId);
    setMessage("");
    try {
      const res = await fetch("/api/admin/profile-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(data.error || "ユーザーの削除に失敗しました");
      setMessage("削除しました");
      setList((prev) =>
        prev.status === "loaded"
          ? {
              status: "loaded",
              users: prev.users.filter((user) => user.id !== targetId),
            }
          : prev
      );
    } catch (err) {
      setMessage(err instanceof Error ? `エラー: ${err.message}` : "エラー");
    } finally {
      setDeletingId(null);
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

  if (auth.role !== "admin") {
    return (
      <main className="page">
        <p className="text-sm">権限がありません</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineMagnifyingGlass className="text-base" />
          検索
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              表示名
            </span>
            <input
              className="w-full"
              value={form.display_name}
              onChange={(event) =>
                updateField("display_name", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              学籍番号
            </span>
            <input
              className="w-full"
              value={form.student_number}
              onChange={(event) =>
                updateField("student_number", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              代
            </span>
            <input
              className="w-full"
              value={form.generation}
              onChange={(event) =>
                updateField("generation", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              性別
            </span>
            <select
              className="w-full"
              value={form.gender}
              onChange={(event) => updateField("gender", event.target.value)}
            >
              <option value="">(指定なし)</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              学科
            </span>
            <input
              className="w-full"
              value={form.department}
              onChange={(event) =>
                updateField("department", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              流派
            </span>
            <input
              className="w-full"
              value={form.ryuha}
              onChange={(event) => updateField("ryuha", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              役職
            </span>
            <input
              className="w-full"
              value={form.position}
              onChange={(event) => updateField("position", event.target.value)}
            />
          </label>
        </div>
        <div className="inline-list">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSearch}
            disabled={list.status === "loading"}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineMagnifyingGlass className="text-base" />
              検索
            </span>
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={handleReset}
            disabled={list.status === "loading"}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineArrowPath className="text-base" />
              リセット
            </span>
          </button>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
      </div>

      {list.status === "loading" ? (
        <p className="text-sm">読み込み中...</p>
      ) : list.status === "error" ? (
        <p className="text-sm">エラー: {list.message}</p>
      ) : list.status === "loaded" ? (
        sortedUsers.length === 0 ? (
          <p className="text-sm">ユーザーがいません</p>
        ) : (
          <div className="space-y-4">
            {sortedUsers.map((user) => (
              <div key={user.id} className="card">
                <div className="text-sm">
                  <p>
                    <span className="font-semibold">メール:</span>{" "}
                    {user.email ?? "-"}
                  </p>
                  <p>
                    <span className="font-semibold">権限:</span>{" "}
                    {user.role ? roleLabel(user.role) : "-"}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {adminFields.map((field) => (
                    <p key={field}>
                      <span className="font-semibold">
                        {fieldLabels[field]}:
                      </span>{" "}
                      {user[field] ?? "-"}
                    </p>
                  ))}
                </div>
                <div className="mt-4 inline-list">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void handleDelete(user.id)}
                    disabled={deletingId === user.id}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineTrash className="text-base" />
                      {deletingId === user.id ? "削除中..." : "削除"}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <p className="text-sm">準備完了</p>
      )}

    </main>
  );
}
