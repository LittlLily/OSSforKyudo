"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type SearchForm = {
  bow_number: string;
  name: string;
  length: string;
  strength: string;
  status: "" | "borrowed" | "available";
};

const emptySearch: SearchForm = {
  bow_number: "",
  name: "",
  length: "",
  strength: "",
  status: "available",
};

const lengthOptions = ["並寸", "二寸伸", "四寸伸", "三寸詰"] as const;

type Bow = {
  id: string;
  bow_number: string;
  name: string;
  strength: number;
  length: string;
  borrower_profile_id: string | null;
  borrower_display_name?: string | null;
  borrower_student_number?: string | null;
  note: string | null;
};

type ListState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; bows: Bow[] }
  | { status: "error"; message: string };

export default function BowListPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [form, setForm] = useState<SearchForm>(emptySearch);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/bows/bow-list";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        }
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

  useEffect(() => {
    if (auth.status !== "authed") return;
  }, [auth.status]);

  const updateField = (key: keyof SearchForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = async () => {
    setList({ status: "loading" });
    try {
      const params = new URLSearchParams();
      if (form.bow_number) params.set("bow_number", form.bow_number);
      if (form.name) params.set("name", form.name);
      if (form.length) params.set("length", form.length);
      if (form.strength) params.set("strength", form.strength);
      if (form.status) params.set("status", form.status);
      const query = params.toString();
      const res = await fetch(`/api/bows${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { bows?: Bow[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "弓一覧の読み込みに失敗しました");
      }
      setList({ status: "loaded", bows: data.bows ?? [] });
    } catch (err) {
      setList({
        status: "error",
        message: err instanceof Error ? err.message : "不明なエラー",
      });
    }
  };

  const handleReset = () => {
    setForm(emptySearch);
    setList({ status: "idle" });
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
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineMagnifyingGlass className="text-base" />
          検索
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              弓番号
            </span>
            <input
              className="w-full"
              value={form.bow_number}
              onChange={(event) =>
                updateField("bow_number", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              弓名称
            </span>
            <input
              className="w-full"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              長さ
            </span>
            <select
              className="w-full"
              value={form.length}
              onChange={(event) => updateField("length", event.target.value)}
            >
              <option value="">(指定なし)</option>
              {lengthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              強さ
            </span>
            <input
              className="w-full"
              type="number"
              min="0"
              step="0.1"
              value={form.strength}
              onChange={(event) => updateField("strength", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              貸出状況
            </span>
            <select
              className="w-full"
              value={form.status}
              onChange={(event) =>
                updateField(
                  "status",
                  event.target.value as SearchForm["status"]
                )
              }
            >
              <option value="">(指定なし)</option>
              <option value="available">未貸出</option>
              <option value="borrowed">貸出中</option>
            </select>
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
      </div>
      {list.status === "loading" ? (
        <p className="text-sm">読み込み中...</p>
      ) : list.status === "error" ? (
        <p className="text-sm">エラー: {list.message}</p>
      ) : list.status === "loaded" ? (
        <div className="space-y-3">
          {list.bows.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              登録された弓はありません
            </p>
          ) : (
            list.bows.map((bow) => (
              <div key={bow.id} className="rounded-2xl border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {bow.bow_number} / {bow.name}
                  </p>
                  <span className="text-xs text-[color:var(--muted)]">
                    {bow.borrower_profile_id ? "貸出中" : "未貸出"}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold">強さ:</span> {bow.strength}
                  </p>
                  <p>
                    <span className="font-semibold">長さ:</span> {bow.length}
                  </p>
                  <p>
                    <span className="font-semibold">借りている人:</span>{" "}
                    {bow.borrower_profile_id
                      ? `${bow.borrower_display_name ?? "-"} (${
                          bow.borrower_student_number ?? "-"
                        })`
                      : "-"}
                  </p>
                  <p>
                    <span className="font-semibold">補足:</span>{" "}
                    {bow.note ?? "-"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--muted)]">準備完了</p>
      )}
      <Link
        className="btn btn-ghost inline-flex items-center gap-2"
        href="/dashboard/bows"
      >
        <HiOutlineArrowLeft className="text-base" />
        戻る
      </Link>
    </main>
  );
}
