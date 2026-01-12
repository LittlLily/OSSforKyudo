"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlinePencilSquare,
} from "react-icons/hi2";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; email: string; role: "admin" | "user" }
  | { status: "error"; message: string };

type ProfileForm = {
  display_name: string;
  student_number: string;
  name_kana: string;
  generation: string;
  gender: "" | "male" | "female";
  department: string;
  ryuha: string;
  position: string;
};

const emptyForm: ProfileForm = {
  display_name: "",
  student_number: "",
  name_kana: "",
  generation: "",
  gender: "",
  department: "",
  ryuha: "",
  position: "",
};

export default function AdminProfileEditPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [targetEmail, setTargetEmail] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [role, setRole] = useState<"" | "admin" | "user">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/profile/profile-edit";
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

  const setField = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLoad = async () => {
    if (!targetEmail.trim()) {
      setMessage("エラー: メールアドレスは必須です");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/admin/profile?email=${encodeURIComponent(targetEmail.trim())}`,
        { cache: "no-store" }
      );
      if (res.status === 401) {
        location.href = "/login?next=/dashboard/profile/profile-edit";
        return;
      }
      const bodyText = await res.text();
      const data = bodyText
        ? (JSON.parse(bodyText) as {
            profile?: Partial<ProfileForm> & { id?: string | null };
            role?: "admin" | "user";
            error?: string;
          }) ?? {}
        : {};
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            "プロフィールの読み込みに失敗しました"
        );
      }
      const profile = data.profile ?? {};
      setForm({
        display_name: profile.display_name ?? "",
        student_number: profile.student_number ?? "",
        name_kana: profile.name_kana ?? "",
        generation: profile.generation ?? "",
        gender: (profile.gender as "male" | "female") ?? "",
        department: profile.department ?? "",
        ryuha: profile.ryuha ?? "",
        position: profile.position ?? "",
      });
      setRole(data.role ?? "user");
      setLoadedId(profile.id ?? null);
      if (profile.id) {
        setMessage(`読み込み完了: ${profile.id}`);
      } else {
        setMessage("読み込み完了");
      }
    } catch (err) {
      setMessage(err instanceof Error ? `エラー: ${err.message}` : "エラー");
      setLoadedId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!loadedId) {
      setMessage("エラー: 先にプロフィールを読み込んでください");
      return;
    }

    const toNullable = (value: string) => {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    };

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: loadedId,
          role: role === "" ? undefined : role,
          profile: {
            display_name: toNullable(form.display_name),
            student_number: toNullable(form.student_number),
            name_kana: toNullable(form.name_kana),
            generation: toNullable(form.generation),
            gender: form.gender === "" ? null : form.gender,
            department: toNullable(form.department),
            ryuha: toNullable(form.ryuha),
            position: toNullable(form.position),
          },
        }),
      });
      if (res.status === 401) {
        location.href = "/login?next=/dashboard/profile/profile-edit";
        return;
      }
      const bodyText = await res.text();
      const data = bodyText
        ? (JSON.parse(bodyText) as { error?: string; id?: string }) ?? {}
        : {};
      if (!res.ok) {
        throw new Error(data.error || "プロフィールの更新に失敗しました");
      }
      setMessage("保存しました");
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
        <Link className="btn btn-ghost inline-flex items-center gap-2" href="/">
          <HiOutlineArrowLeft className="text-base" />
          戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card space-y-4">
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            ユーザーメール
          </span>
          <input
            className="w-full"
            value={targetEmail}
            onChange={(event) => setTargetEmail(event.target.value)}
            placeholder="example@example.com"
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
            {loading ? "読み込み中..." : "プロフィールを読み込む"}
          </span>
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlinePencilSquare className="text-base" />
          プロフィール編集
        </h2>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            表示名
          </span>
          <input
            className="w-full"
            value={form.display_name}
            onChange={(event) => setField("display_name", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            学籍番号
          </span>
          <input
            className="w-full"
            value={form.student_number}
            onChange={(event) => setField("student_number", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            氏名（カナ）
          </span>
          <input
            className="w-full"
            value={form.name_kana}
            onChange={(event) => setField("name_kana", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            代
          </span>
          <input
            className="w-full"
            value={form.generation}
            onChange={(event) => setField("generation", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            性別
          </span>
          <select
            className="w-full"
            value={form.gender}
            onChange={(event) =>
              setField("gender", event.target.value as ProfileForm["gender"])
            }
          >
            <option value="">(未設定)</option>
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
            onChange={(event) => setField("department", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            流派
          </span>
          <input
            className="w-full"
            value={form.ryuha}
            onChange={(event) => setField("ryuha", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            役職
          </span>
          <input
            className="w-full"
            value={form.position}
            onChange={(event) => setField("position", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            権限
          </span>
          <select
            className="w-full"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "admin" | "user" | "")
            }
          >
            <option value="">(未設定)</option>
            <option value="user">ユーザー</option>
            <option value="admin">管理者</option>
          </select>
        </label>

        <button
          className="btn btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving || !loadedId}
        >
          <span className="inline-flex items-center gap-2">
            <HiOutlineCheckCircle className="text-base" />
            {saving ? "保存中..." : "保存"}
          </span>
        </button>
        {message ? <p className="text-sm">{message}</p> : null}
      </div>

      <Link
        className="btn btn-ghost inline-flex items-center gap-2"
        href="/dashboard/profile"
      >
        <HiOutlineArrowLeft className="text-base" />
        戻る
      </Link>
    </main>
  );
}
