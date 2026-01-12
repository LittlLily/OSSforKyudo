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

const limitedFields: Array<keyof ProfileRow> = [
  "display_name",
  "student_number",
  "generation",
  "department",
  "ryuha",
  "position",
];

const adminFields: Array<keyof ProfileRow> = [
  "display_name",
  "student_number",
  "name_kana",
  "generation",
  "gender",
  "department",
  "ryuha",
  "position",
];

export default function AdminProfileListPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [form, setForm] = useState<SearchForm>(() => buildInitialSearch());

  const sortedUsers =
    list.status === "loaded"
      ? [...list.users].sort((a, b) => {
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
          location.href = "/login?next=/dashboard/profile/profile-list";
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
    if (auth.status !== "authed") return;
    handleSearch();
  }, [auth]);

  const handleSearch = async () => {
    setList({ status: "loading" });
    try {
      const params = new URLSearchParams();
      if (form.display_name) params.set("display_name", form.display_name);
      if (form.student_number) params.set("student_number", form.student_number);
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
      if (!res.ok) throw new Error(data.error || "failed to load list");
      setList({ status: "loaded", users: data.users ?? [] });
    } catch (err) {
      setList({
        status: "error",
        message: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  const handleReset = () => {
    setForm(emptySearch);
    setList({ status: "idle" });
  };

  const updateField = (key: keyof SearchForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (list.status !== "idle") return;
    const isBlank = Object.values(form).every((value) => value === "");
    if (!isBlank) return;
    handleSearch();
  }, [form, list.status]);

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

  return (
    <main className="page">
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineMagnifyingGlass className="text-base" />
          Search
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              display_name
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
              student_number
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
              generation
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
              gender
            </span>
            <select
              className="w-full"
              value={form.gender}
              onChange={(event) => updateField("gender", event.target.value)}
            >
              <option value="">(any)</option>
              <option value="male">male</option>
              <option value="female">female</option>
            </select>
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              department
            </span>
            <input
              className="w-full"
              value={form.department}
              onChange={(event) => updateField("department", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              ryuha
            </span>
            <input
              className="w-full"
              value={form.ryuha}
              onChange={(event) => updateField("ryuha", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="text-sm font-semibold text-[color:var(--muted)]">
              position
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
              Search
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
              Reset
            </span>
          </button>
        </div>
      </div>

      {list.status === "loading" ? (
        <p className="text-sm">loading...</p>
      ) : list.status === "error" ? (
        <p className="text-sm">error: {list.message}</p>
      ) : list.status === "loaded" ? (
        <div className="space-y-4">
          {sortedUsers.map((user) => {
            const fields =
              auth.role === "admin" ? adminFields : limitedFields;
            return (
              <div key={user.id} className="card">
                {auth.role === "admin" ? (
                  <div className="text-sm">
                    <p>
                      <span className="font-semibold">email:</span>{" "}
                      {user.email ?? "-"}
                    </p>
                    <p>
                      <span className="font-semibold">role:</span>{" "}
                      {user.role ?? "user"}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {fields.map((field) => (
                    <p key={field}>
                      <span className="font-semibold">{field}:</span>{" "}
                      {user[field] ?? "-"}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm">ready</p>
      )}

      <Link className="btn btn-ghost inline-flex items-center gap-2" href="/dashboard/profile">
        <HiOutlineArrowLeft className="text-base" />
        Back
      </Link>
    </main>
  );
}
