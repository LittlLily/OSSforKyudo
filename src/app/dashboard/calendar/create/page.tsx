"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { hasSubPermission } from "@/lib/permissions";

type AuthState =
  | { status: "loading" }
  | {
      status: "authed";
      role: "admin" | "user";
      subPermissions: string[];
    }
  | { status: "error"; message: string };

const pad2 = (value: number) => value.toString().padStart(2, "0");

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;

const formatDateTimeInput = (date: Date) =>
  `${formatDateInput(date)}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`;

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const differenceInDays = (start: Date, end: Date) => {
  const startMidnight = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endMidnight = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );
  return Math.max(
    0,
    Math.round(
      (endMidnight.getTime() - startMidnight.getTime()) / (24 * 60 * 60 * 1000)
    )
  );
};

export default function CalendarCreatePage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));
  const [startDateTime, setStartDateTime] = useState(
    formatDateTimeInput(new Date())
  );
  const [endDateTime, setEndDateTime] = useState(
    formatDateTimeInput(new Date(new Date().getTime() + 60 * 60 * 1000))
  );
  const [durationMs, setDurationMs] = useState(60 * 60 * 1000);
  const [allDaySpan, setAllDaySpan] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/calendar/create";
          return;
        }
        const data = (await res.json()) as {
          user?: { role?: "admin" | "user"; subPermissions?: string[] };
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({
          status: "authed",
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
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = end.getTime() - start.getTime();
      if (diff >= 0) setDurationMs(diff);
    }
  }, [endDateTime, startDateTime]);

  useEffect(() => {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);
    setAllDaySpan(differenceInDays(start, end));
  }, [startDate, endDate]);

  const canEdit =
    auth.status === "authed" &&
    (auth.role === "admin" || hasSubPermission(auth.subPermissions, "calendar_admin"));

  const handleSubmit = async () => {
    if (!title.trim()) {
      setMessage("タイトルを入力してください");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let startsAt: Date;
      let endsAt: Date;

      if (allDay) {
        startsAt = parseDateInput(startDate);
        const endBase = parseDateInput(endDate);
        endsAt = new Date(
          endBase.getFullYear(),
          endBase.getMonth(),
          endBase.getDate(),
          23,
          59,
          59,
          999
        );
      } else {
        startsAt = new Date(startDateTime);
        endsAt = new Date(endDateTime);
      }

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new Error("日付の入力が不正です");
      }
      if (endsAt < startsAt) {
        throw new Error("終了日時は開始日時以降にしてください");
      }

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          allDay,
        }),
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "予定の作成に失敗しました");

      location.href = "/dashboard/calendar";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setLoading(false);
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

  if (!canEdit) {
    return (
      <main className="page">
        <p className="text-sm">権限がありません。</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-subtitle">共有予定表</p>
          <h1 className="page-title">予定を作成</h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-ghost inline-flex items-center gap-2" href="/dashboard/calendar">
            <HiOutlineArrowLeft className="text-base" />
            戻る
          </Link>
        </div>
      </header>

      <section className="card space-y-4">
        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            タイトル
          </span>
          <input
            className="w-full"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            説明（任意）
          </span>
          <textarea
            className="w-full min-h-[120px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => {
              const next = event.target.checked;
              setAllDay(next);
              if (next) {
                const start = new Date(startDateTime);
                const end = new Date(endDateTime);
                if (
                  !Number.isNaN(start.getTime()) &&
                  !Number.isNaN(end.getTime())
                ) {
                  setStartDate(formatDateInput(start));
                  setEndDate(formatDateInput(end));
                }
              } else {
                const start = parseDateInput(startDate);
                setStartDateTime(formatDateTimeInput(start));
                setEndDateTime(
                  formatDateTimeInput(
                    new Date(start.getTime() + durationMs)
                  )
                );
              }
            }}
          />
          終日
        </label>

        {allDay ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              <span className="text-sm font-semibold text-[color:var(--muted)]">
                開始日
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStartDate(nextStart);
                  const start = parseDateInput(nextStart);
                  const nextEnd = addDays(start, allDaySpan);
                  setEndDate(formatDateInput(nextEnd));
                }}
              />
            </label>
            <label className="field">
              <span className="text-sm font-semibold text-[color:var(--muted)]">
                終了日
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  const nextEnd = event.target.value;
                  setEndDate(nextEnd);
                  const start = parseDateInput(startDate);
                  const end = parseDateInput(nextEnd);
                  setAllDaySpan(differenceInDays(start, end));
                }}
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              <span className="text-sm font-semibold text-[color:var(--muted)]">
                開始日時
              </span>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStartDateTime(nextStart);
                  const start = new Date(nextStart);
                  if (!Number.isNaN(start.getTime())) {
                    const nextEnd = new Date(start.getTime() + durationMs);
                    setEndDateTime(formatDateTimeInput(nextEnd));
                  }
                }}
              />
            </label>
            <label className="field">
              <span className="text-sm font-semibold text-[color:var(--muted)]">
                終了日時
              </span>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(event) => {
                  const nextEnd = event.target.value;
                  setEndDateTime(nextEnd);
                  const start = new Date(startDateTime);
                  const end = new Date(nextEnd);
                  if (
                    !Number.isNaN(start.getTime()) &&
                    !Number.isNaN(end.getTime())
                  ) {
                    const diff = end.getTime() - start.getTime();
                    if (diff >= 0) setDurationMs(diff);
                  }
                }}
              />
            </label>
          </div>
        )}

        <div className="inline-list">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={loading}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineCheckCircle className="text-base" />
              {loading ? "作成中..." : "作成"}
            </span>
          </button>
          <div className="inline-flex items-center gap-2 text-xs text-[color:var(--muted)]">
            <HiOutlineCalendarDays className="text-base" />
            月表示で共有されます
          </div>
        </div>

        {message ? <p className="text-sm">{message}</p> : null}
      </section>
    </main>
  );
}
