"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HiOutlineArrowLeft, HiOutlineCheckCircle } from "react-icons/hi2";
import { hasSubPermission } from "@/lib/permissions";
import { CALENDAR_COLOR_OPTIONS } from "@/lib/calendarColors";

type AuthState =
  | { status: "loading" }
  | {
      status: "authed";
      role: "admin" | "user";
      subPermissions: string[];
    }
  | { status: "error"; message: string };

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: string | null;
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

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

type RouteParams = { params: Promise<{ id: string }> };

export default function CalendarEditPage({ params }: RouteParams) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [eventId, setEventId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [durationMs, setDurationMs] = useState(60 * 60 * 1000);
  const [allDaySpan, setAllDaySpan] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/calendar";
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
    if (auth.status !== "authed") return;
    (async () => {
      try {
        const { id } = await params;
        setEventId(id);
        const res = await fetch(`/api/calendar/${id}`, { cache: "no-store" });
        const data = (await res.json()) as {
          event?: CalendarEvent;
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "予定の読み込みに失敗しました");
        if (!data.event) throw new Error("予定が見つかりません");

        const event = data.event;
        setTitle(event.title);
        setDescription(event.description ?? "");
        setAllDay(event.all_day);
        setColor(event.color ?? null);

        const start = new Date(event.starts_at);
        const end = new Date(event.ends_at);
        setStartDate(formatDateInput(start));
        setEndDate(formatDateInput(end));
        setStartDateTime(formatDateTimeInput(start));
        setEndDateTime(formatDateTimeInput(end));
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const diff = end.getTime() - start.getTime();
          if (diff >= 0) setDurationMs(diff);
          setAllDaySpan(differenceInDays(start, end));
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "不明なエラー");
      }
    })();
  }, [auth.status, params]);

  useEffect(() => {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = end.getTime() - start.getTime();
      if (diff >= 0) setDurationMs(diff);
    }
  }, [endDateTime, startDateTime]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);
    setAllDaySpan(differenceInDays(start, end));
  }, [startDate, endDate]);

  const canEdit =
    auth.status === "authed" &&
    (auth.role === "admin" ||
      hasSubPermission(auth.subPermissions, "calendar_admin"));

  const handleSubmit = async () => {
    if (!eventId) return;
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

      const res = await fetch(`/api/calendar/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          color,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          allDay,
        }),
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "予定の更新に失敗しました");

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
        <div></div>
        <div className="page-actions"></div>
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

        <div className="space-y-2">
          <span className="text-sm font-semibold text-[color:var(--muted)]">
            色
          </span>
          <div className="flex flex-wrap gap-2">
            {CALENDAR_COLOR_OPTIONS.map((option) => {
              const isActive = color === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "border-[color:var(--accent)] shadow-[0_8px_18px_rgba(130,65,0,0.14)]"
                      : "border-[color:var(--border)] hover:border-[color:var(--accent)]"
                  }`}
                  onClick={() => setColor(option.value)}
                  aria-pressed={isActive}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-[color:var(--border)]"
                    style={
                      option.value
                        ? { backgroundColor: option.value }
                        : { backgroundColor: "var(--surface-strong)" }
                    }
                    aria-hidden="true"
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

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
                  formatDateTimeInput(new Date(start.getTime() + durationMs))
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
            disabled={loading || !eventId}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineCheckCircle className="text-base" />
              {loading ? "保存中..." : "保存"}
            </span>
          </button>
        </div>

        {message ? <p className="text-sm">{message}</p> : null}
      </section>
    </main>
  );
}
