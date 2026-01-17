"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineXMark,
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

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CalendarOccurrence = {
  id: string;
  title: string;
  description: string | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  color: string | null;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const pad2 = (value: number) => value.toString().padStart(2, "0");

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  return addDays(startOfDay(date), -day);
};

const endOfWeek = (date: Date) => {
  const day = date.getDay();
  return endOfDay(addDays(date, 6 - day));
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
  });

const formatTime = (date: Date) =>
  date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDayTimeLabel = (event: CalendarOccurrence, day: Date) => {
  if (event.allDay) return "終日";
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const startsInDay = event.startsAt >= dayStart && event.startsAt <= dayEnd;
  const endsInDay = event.endsAt >= dayStart && event.endsAt <= dayEnd;
  if (startsInDay && endsInDay) {
    return `${formatTime(event.startsAt)}〜${formatTime(event.endsAt)}`;
  }
  if (startsInDay && !endsInDay) {
    return `${formatTime(event.startsAt)}〜`;
  }
  if (!startsInDay && endsInDay) {
    return `〜${formatTime(event.endsAt)}`;
  }
  return "終日";
};

export default function CalendarPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarOccurrence | null>(
    null
  );
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

  const range = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return { monthStart, monthEnd, gridStart, gridEnd };
  }, [month]);

  useEffect(() => {
    if (auth.status !== "authed") return;
    (async () => {
      try {
        setLoading(true);
        setMessage(null);
        const params = new URLSearchParams({
          start: range.gridStart.toISOString(),
          end: range.gridEnd.toISOString(),
        });
        const res = await fetch(`/api/calendar?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/calendar";
          return;
        }
        const data = (await res.json()) as {
          events?: CalendarEvent[];
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "予定の読み込みに失敗しました");
        setEvents(data.events ?? []);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "不明なエラー");
      } finally {
        setLoading(false);
      }
    })();
  }, [auth.status, range.gridEnd, range.gridStart]);

  const days = useMemo(() => {
    const items: Date[] = [];
    let cursor = new Date(range.gridStart);
    while (cursor <= range.gridEnd) {
      items.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return items;
  }, [range.gridEnd, range.gridStart]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrence[]>();
    const rangeStart = range.gridStart;
    const rangeEnd = range.gridEnd;

    const pushOccurrence = (occurrence: CalendarOccurrence) => {
      const occStartDay = startOfDay(occurrence.startsAt);
      const occEndDay = startOfDay(occurrence.endsAt);
      let cursor = occStartDay;
      while (cursor <= occEndDay) {
        if (cursor >= rangeStart && cursor <= rangeEnd) {
          const key = formatDateKey(cursor);
          const list = map.get(key) ?? [];
          list.push(occurrence);
          map.set(key, list);
        }
        cursor = addDays(cursor, 1);
      }
    };

    for (const event of events) {
      const startsAt = new Date(event.starts_at);
      const endsAt = new Date(event.ends_at);
      pushOccurrence({
        id: event.id,
        title: event.title,
        description: event.description,
        allDay: event.all_day,
        startsAt,
        endsAt,
        color: event.color ?? null,
      });
    }

    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startsAt.getTime() - b.startsAt.getTime();
      });
      map.set(key, list);
    }

    return map;
  }, [events, range.gridEnd, range.gridStart]);

  const canEdit =
    auth.status === "authed" &&
    (auth.role === "admin" ||
      hasSubPermission(auth.subPermissions, "calendar_admin"));

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!confirm("この予定を削除しますか？")) return;

    setDeleteLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/calendar/${selectedEvent.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "予定の削除に失敗しました");
      location.href = "/dashboard/calendar";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
      setDeleteLoading(false);
    }
  };

  const toggleBulkMode = () => {
    setBulkMode((prev) => {
      const next = !prev;
      if (!next) setBulkSelection([]);
      return next;
    });
  };

  const toggleBulkSelection = (eventId: string) => {
    setBulkSelection((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return Array.from(next);
    });
  };

  const clearBulkSelection = () => {
    setBulkSelection([]);
  };

  const handleBulkDelete = async () => {
    if (bulkSelection.length === 0) {
      setMessage("削除する予定を選択してください");
      return;
    }
    if (!confirm(`${bulkSelection.length}件の予定を削除しますか？`)) return;

    setBulkLoading(true);
    setMessage(null);

    try {
      const results = await Promise.all(
        bulkSelection.map((id) =>
          fetch(`/api/calendar/${id}`, { method: "DELETE" })
        )
      );
      for (const res of results) {
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "予定の削除に失敗しました");
      }
      location.href = "/dashboard/calendar";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
      setBulkLoading(false);
    }
  };

  if (auth.status === "loading" || loading) {
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
      <header className="page-header">
        <div></div>
        <div className="page-actions">
          {canEdit ? (
            <>
              <Link
                className="btn btn-primary inline-flex items-center gap-2"
                href="/dashboard/calendar/create"
              >
                <HiOutlinePlusCircle className="text-base" />
                予定作成
              </Link>
              <button
                className="btn btn-primary inline-flex items-center gap-2"
                type="button"
                onClick={toggleBulkMode}
              >
                {bulkMode ? "まとめて削除を終了" : "まとめて削除"}
              </button>
            </>
          ) : null}
        </div>
      </header>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <HiOutlineChevronLeft className="text-base" />
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <HiOutlineChevronRight className="text-base" />
            </button>
          </div>
          <div className="text-lg font-semibold tracking-wide">
            {formatMonthLabel(month)}
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            今月
          </button>
        </div>

        {message ? <p className="text-sm">エラー: {message}</p> : null}

        {bulkMode ? (
          <div className="inline-list">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkLoading}
            >
              {bulkLoading ? "削除中..." : "削除確定"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={clearBulkSelection}
              disabled={bulkLoading || bulkSelection.length === 0}
            >
              選択解除
            </button>
            <span className="text-xs text-[color:var(--muted)]">
              選択中: {bulkSelection.length} 件
            </span>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[720px] rounded-2xl border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(255,253,246,0.96),rgba(255,248,232,0.96))]">
            <div className="grid grid-cols-7 border-b border-[color:var(--border)] text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-3 py-2 text-center">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = formatDateKey(day);
                const dayEvents = eventsByDay.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === month.getMonth();
                const displayEvents = dayEvents.slice(0, 3);
                const remaining = dayEvents.length - displayEvents.length;
                return (
                  <div
                    key={key}
                    className={`min-h-[120px] border-b border-r border-[color:var(--border)] px-2 py-2 text-xs sm:min-h-[140px] ${
                      isCurrentMonth
                        ? "bg-transparent"
                        : "bg-[color:var(--surface)] text-[color:var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold ${
                          isCurrentMonth
                            ? "text-[color:var(--foreground)]"
                            : "text-[color:var(--muted)]"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {displayEvents.map((event) => {
                        const timeLabel = formatDayTimeLabel(event, day);
                        const content = (
                          <>
                            <span
                              className={`block text-[10px] uppercase tracking-[0.2em] ${
                                event.color
                                  ? "text-[color:var(--muted)]"
                                  : "text-[color:var(--muted)]"
                              }`}
                            >
                              {timeLabel}
                            </span>
                            <span className="text-sm font-semibold leading-snug">
                              {event.title}
                            </span>
                          </>
                        );
                        const occurrenceKey = `${event.id}-${key}-${timeLabel}`;
                        const isSelected = bulkSelection.includes(event.id);
                        const isColored = Boolean(event.color) && !isSelected;
                        const eventStyle = isColored
                          ? {
                              backgroundColor: event.color ?? undefined,
                              borderColor: event.color ?? undefined,
                            }
                          : undefined;
                        return (
                          <button
                            key={occurrenceKey}
                            type="button"
                            className={`block w-full text-left rounded-xl border px-2 py-2 shadow-[0_6px_14px_rgba(130,65,0,0.08)] transition ${
                              isSelected
                                ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                                : isColored
                                  ? "text-[color:var(--foreground)] hover:opacity-90"
                                  : "border-[color:var(--border)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)]"
                            }`}
                            onClick={() =>
                              bulkMode
                                ? toggleBulkSelection(event.id)
                                : setSelectedEvent(event)
                            }
                            style={eventStyle}
                          >
                            {content}
                          </button>
                        );
                      })}
                      {remaining > 0 ? (
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          他 {remaining} 件
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 shadow-[0_24px_60px_rgba(130,65,0,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  予定の詳細
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedEvent(null)}
                aria-label="閉じる"
              >
                <HiOutlineXMark className="text-base" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-[color:var(--muted)]">
                {selectedEvent.allDay
                  ? "終日"
                  : `${selectedEvent.startsAt.toLocaleString(
                      "ja-JP"
                    )} 〜 ${selectedEvent.endsAt.toLocaleString("ja-JP")}`}
              </p>
              {selectedEvent.description ? (
                <p className="whitespace-pre-wrap text-sm">
                  {selectedEvent.description}
                </p>
              ) : (
                <p className="text-sm text-[color:var(--muted)]">
                  説明はありません
                </p>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedEvent(null)}
              >
                閉じる
              </button>
              {canEdit ? (
                <>
                  <Link
                    className="btn btn-primary"
                    href={`/dashboard/calendar/${selectedEvent.id}/edit`}
                  >
                    編集
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary inline-flex items-center gap-2"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                  >
                    <HiOutlineTrash className="text-base" />
                    {deleteLoading ? "削除中..." : "削除"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
