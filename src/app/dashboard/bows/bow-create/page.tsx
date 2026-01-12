"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";

const lengthOptions = ["並寸", "二寸伸", "四寸伸", "三寸詰"] as const;

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

export default function BowCreatePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [bowNumber, setBowNumber] = useState("");
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [length, setLength] = useState<(typeof lengthOptions)[number]>("並寸");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/bows/bow-create";
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

  const submit = async () => {
    setMessage(null);
    const strengthValue = Number(strength);
    if (!bowNumber.trim()) {
      setMessage("弓番号は必須です");
      return;
    }
    if (!name.trim()) {
      setMessage("弓名称は必須です");
      return;
    }
    if (Number.isNaN(strengthValue) || strengthValue < 0) {
      setMessage("強さは0以上の数値で入力してください");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/bows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bowNumber,
          name,
          strength: strengthValue,
          length,
          note,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "作成に失敗しました");
      }
      setMessage("作成しました");
      setBowNumber("");
      setName("");
      setStrength("");
      setLength("並寸");
      setNote("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setSaving(false);
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

  return (
    <main className="page">
      <div className="card space-y-4">
        <h2 className="section-title">弓作成</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              弓番号
            </span>
            <input
              className="w-full"
              value={bowNumber}
              onChange={(event) => setBowNumber(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              弓名称
            </span>
            <input
              className="w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
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
              value={strength}
              onChange={(event) => setStrength(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              長さ
            </span>
            <select
              className="w-full"
              value={length}
              onChange={(event) =>
                setLength(event.target.value as (typeof lengthOptions)[number])
              }
            >
              {lengthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field sm:col-span-2">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              補足
            </span>
            <textarea
              className="w-full"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
        <div className="inline-list">
          <button
            className="btn btn-primary"
            type="button"
            onClick={submit}
            disabled={saving}
          >
            作成
          </button>
          {message ? <p className="text-sm">{message}</p> : null}
        </div>
      </div>
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
