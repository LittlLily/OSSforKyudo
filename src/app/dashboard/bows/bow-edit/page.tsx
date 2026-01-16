"use client";

import { useEffect, useState } from "react";
import {
  HiOutlineArrowDownTray,
  HiOutlineCheckCircle,
  HiOutlinePencilSquare,
} from "react-icons/hi2";

const lengthOptions = ["並寸", "二寸伸", "四寸伸", "三寸詰"] as const;

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type Bow = {
  id: string;
  bow_number: string;
  name: string;
  strength: number;
  length: (typeof lengthOptions)[number];
  note: string | null;
};

export default function BowEditPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [searchNumber, setSearchNumber] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [bowNumber, setBowNumber] = useState("");
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [length, setLength] = useState<(typeof lengthOptions)[number]>("並寸");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/bows/bow-edit";
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

  const handleLoad = async () => {
    if (!searchNumber.trim()) {
      setMessage("エラー: 弓番号は必須です");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/bows?q=${encodeURIComponent(searchNumber.trim())}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { bows?: Bow[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "弓一覧の読み込みに失敗しました");
      }
      const bows = data.bows ?? [];
      if (bows.length === 0) {
        setLoadedId(null);
        setMessage("エラー: 該当する弓が見つかりませんでした");
        return;
      }

      const exact = bows.find(
        (bow) => bow.bow_number.trim() === searchNumber.trim()
      );
      const target = exact ?? bows[0];

      setLoadedId(target.id);
      setBowNumber(target.bow_number);
      setName(target.name);
      setStrength(String(target.strength ?? ""));
      setLength(target.length ?? "並寸");
      setNote(target.note ?? "");
      setMessage("読み込み完了");
    } catch (err) {
      setMessage(err instanceof Error ? `エラー: ${err.message}` : "エラー");
      setLoadedId(null);
    } finally {
      setLoading(false);
    }
  };

  const update = async () => {
    if (!loadedId) {
      setMessage("エラー: 先に弓を読み込んでください");
      return;
    }
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
    setMessage(null);
    try {
      const res = await fetch("/api/bows/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: loadedId,
          bowNumber,
          name,
          strength: strengthValue,
          length,
          note,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "更新に失敗しました");
      }
      setMessage("更新しました");
    } catch (err) {
      setMessage(err instanceof Error ? `エラー: ${err.message}` : "エラー");
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
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card space-y-4">
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            弓番号
          </span>
          <input
            className="w-full"
            value={searchNumber}
            onChange={(event) => setSearchNumber(event.target.value)}
          />
        </label>
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleLoad}
          disabled={loading}
        >
          <span className="inline-flex items-center gap-2">
            <HiOutlineArrowDownTray className="text-base" />
            {loading ? "読み込み中..." : "弓を読み込む"}
          </span>
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlinePencilSquare className="text-base" />
          弓編集
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              弓番号
            </span>
            <input
              className="w-full"
              value={bowNumber}
              onChange={(event) => setBowNumber(event.target.value)}
              disabled={!loadedId}
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
              disabled={!loadedId}
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
              disabled={!loadedId}
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
              disabled={!loadedId}
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
              disabled={!loadedId}
            />
          </label>
        </div>
        <div className="inline-list">
          <button
            className="btn btn-primary"
            type="button"
            onClick={update}
            disabled={saving || !loadedId}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineCheckCircle className="text-base" />
              {saving ? "保存中..." : "保存"}
            </span>
          </button>
          {message ? <p className="text-sm">{message}</p> : null}
        </div>
      </div>
    </main>
  );
}
