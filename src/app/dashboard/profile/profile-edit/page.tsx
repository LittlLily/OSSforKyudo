"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  const setField = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLoad = async () => {
    if (!targetEmail.trim()) {
      setMessage("error: email is required");
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
        ? ((JSON.parse(bodyText) as {
            profile?: Partial<ProfileForm> & { id?: string | null };
            error?: string;
          }) ?? {})
        : {};
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "failed to load profile"
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
      setLoadedId(profile.id ?? null);
      if (profile.id) {
        setMessage(`loaded: ${profile.id}`);
      } else {
        setMessage("loaded");
      }
    } catch (err) {
      setMessage(err instanceof Error ? `error: ${err.message}` : "error");
      setLoadedId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!loadedId) {
      setMessage("error: load profile first");
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
        ? ((JSON.parse(bodyText) as { error?: string; id?: string }) ?? {})
        : {};
      if (!res.ok) {
        throw new Error(data.error || "failed to update profile");
      }
      setMessage("saved");
    } catch (err) {
      setMessage(err instanceof Error ? `error: ${err.message}` : "error");
    } finally {
      setSaving(false);
    }
  };

  if (auth.status === "loading") {
    return <main className="p-6">loading...</main>;
  }

  if (auth.status === "error") {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link className="inline-block border rounded px-3 py-1" href="/">
            Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Profile edit</h1>
        <p className="mt-4">error: {auth.message}</p>
      </main>
    );
  }

  if (auth.role !== "admin") {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link className="inline-block border rounded px-3 py-1" href="/">
            Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Profile edit</h1>
        <p className="mt-4">forbidden</p>
        <Link className="mt-4 inline-block underline" href="/">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl">
      <div className="mb-4">
        <Link className="inline-block border rounded px-3 py-1" href="/">
          Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Profile edit</h1>
      <p className="mt-2 text-sm">Signed in as: {auth.email}</p>

      <div className="mt-6 border rounded p-4">
        <label className="block">
          <span className="text-sm">User email</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={targetEmail}
            onChange={(event) => setTargetEmail(event.target.value)}
            placeholder="email@example.com"
          />
        </label>
        <button
          className="mt-3 border rounded px-4 py-2"
          type="button"
          onClick={handleLoad}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load profile"}
        </button>
      </div>

      <div className="mt-6 border rounded p-4">
        <h2 className="text-lg font-semibold">Profile edit</h2>
        <label className="block mt-4">
          <span className="text-sm">display_name</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.display_name}
            onChange={(event) => setField("display_name", event.target.value)}
          />
        </label>
        <label className="block mt-4">
          <span className="text-sm">student_number</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.student_number}
            onChange={(event) => setField("student_number", event.target.value)}
          />
        </label>
        <label className="block mt-4">
          <span className="text-sm">name_kana</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.name_kana}
            onChange={(event) => setField("name_kana", event.target.value)}
          />
        </label>
        <label className="block mt-4">
          <span className="text-sm">generation</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.generation}
            onChange={(event) => setField("generation", event.target.value)}
          />
        </label>
        <label className="block mt-4">
          <span className="text-sm">gender</span>
          <select
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.gender}
            onChange={(event) =>
              setField("gender", event.target.value as ProfileForm["gender"])
            }
          >
            <option value="">(empty)</option>
            <option value="male">male</option>
            <option value="female">female</option>
          </select>
        </label>
        <label className="block mt-4">
          <span className="text-sm">department</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.department}
            onChange={(event) => setField("department", event.target.value)}
          />
        </label>
        <label className="block mt-4">
          <span className="text-sm">ryuha</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.ryuha}
            onChange={(event) => setField("ryuha", event.target.value)}
          />
        </label>
        <label className="block mt-4">
          <span className="text-sm">position</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.position}
            onChange={(event) => setField("position", event.target.value)}
          />
        </label>

        <button
          className="mt-4 border rounded px-4 py-2"
          type="button"
          onClick={handleSave}
          disabled={saving || !loadedId}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </div>

      <div className="mt-6">
        <Link className="underline" href="/dashboard/profile">
          Back
        </Link>
      </div>
    </main>
  );
}
