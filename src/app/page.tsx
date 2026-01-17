"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineReceiptPercent,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCalendarDays,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from "react-icons/hi2";

type ViewState =
  | { status: "loading" }
  | {
      status: "authed";
      email: string;
      displayName?: string | null;
    }
  | { status: "error"; message: string };

type Bow = {
  id: string;
  bow_number: string;
  name: string;
  strength: number;
  length: string;
  borrower_profile_id: string | null;
};

type Invoice = {
  id: string;
  amount: number;
  billed_at: string;
  approved_at: string | null;
  title: string | null;
  description: string | null;
  status: "pending" | "approved";
};

type Survey = {
  id: string;
  title: string;
  description: string | null;
  availability: "open" | "upcoming" | "closed";
  responded: boolean;
  requiresResponse: boolean;
  canAnswer: boolean;
};

type DashboardState =
  | { status: "loading" }
  | {
      status: "ready";
      bows: Bow[];
      invoices: Invoice[];
      surveys: Survey[];
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

type CalendarState =
  | { status: "loading" }
  | { status: "ready"; events: CalendarEvent[] }
  | { status: "error"; message: string };

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const pad2 = (value: number) => value.toString().padStart(2, "0");

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

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

export default function Home() {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [dashboard, setDashboard] = useState<DashboardState>({
    status: "loading",
  });
  const [calendar, setCalendar] = useState<CalendarState>({
    status: "loading",
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/";
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string | null; role?: "admin" | "user" };
          profile?: { displayName?: string | null };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setState({
          status: "authed",
          email: data.user?.email ?? "",
          displayName: data.profile?.displayName ?? null,
        });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (state.status !== "authed") return;
    (async () => {
      try {
        setDashboard({ status: "loading" });
        const [bowsRes, invoicesRes, surveysRes] = await Promise.all([
          fetch("/api/bows?borrower=me", { cache: "no-store" }),
          fetch("/api/invoices?status=pending&mine=1", { cache: "no-store" }),
          fetch("/api/surveys", { cache: "no-store" }),
        ]);

        if (
          bowsRes.status === 401 ||
          invoicesRes.status === 401 ||
          surveysRes.status === 401
        ) {
          location.href = "/login?next=/";
          return;
        }

        const bowsData = (await bowsRes.json()) as {
          bows?: Bow[];
          error?: string;
        };
        if (!bowsRes.ok) {
          throw new Error(bowsData.error || "弓の読み込みに失敗しました");
        }

        const invoicesData = (await invoicesRes.json()) as {
          invoices?: Invoice[];
          error?: string;
        };
        if (!invoicesRes.ok) {
          throw new Error(invoicesData.error || "請求の読み込みに失敗しました");
        }

        const surveysData = (await surveysRes.json()) as {
          surveys?: Survey[];
          error?: string;
        };
        if (!surveysRes.ok) {
          throw new Error(
            surveysData.error || "アンケートの読み込みに失敗しました"
          );
        }

        const pendingSurveys = (surveysData.surveys ?? []).filter(
          (survey) => survey.requiresResponse && survey.canAnswer
        );

        setDashboard({
          status: "ready",
          bows: bowsData.bows ?? [],
          invoices: invoicesData.invoices ?? [],
          surveys: pendingSurveys,
        });
      } catch (err) {
        setDashboard({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, [state.status]);

  const calendarRange = useMemo(() => {
    const monthStart = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );
    const monthEnd = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    );
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return { monthStart, monthEnd, gridStart, gridEnd };
  }, [calendarMonth]);

  useEffect(() => {
    if (state.status !== "authed") return;
    (async () => {
      try {
        setCalendar({ status: "loading" });
        const params = new URLSearchParams({
          start: calendarRange.gridStart.toISOString(),
          end: calendarRange.gridEnd.toISOString(),
        });
        const res = await fetch(`/api/calendar?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          location.href = "/login?next=/";
          return;
        }
        const data = (await res.json()) as {
          events?: CalendarEvent[];
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "予定の読み込みに失敗しました");
        setCalendar({ status: "ready", events: data.events ?? [] });
      } catch (err) {
        setCalendar({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, [calendarRange.gridEnd, calendarRange.gridStart, state.status]);

  const calendarDays = useMemo(() => {
    const items: Date[] = [];
    let cursor = new Date(calendarRange.gridStart);
    while (cursor <= calendarRange.gridEnd) {
      items.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return items;
  }, [calendarRange.gridEnd, calendarRange.gridStart]);

  const calendarEventsByDay = useMemo(() => {
    if (calendar.status !== "ready") return new Map<string, CalendarOccurrence[]>();
    const map = new Map<string, CalendarOccurrence[]>();
    const rangeStart = calendarRange.gridStart;
    const rangeEnd = calendarRange.gridEnd;

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

    for (const event of calendar.events) {
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
  }, [calendar, calendarRange.gridEnd, calendarRange.gridStart]);

  const borrowedBows = useMemo(() => {
    if (dashboard.status !== "ready") return [];
    return dashboard.bows;
  }, [dashboard]);

  const pendingInvoices = useMemo(() => {
    if (dashboard.status !== "ready") return [];
    return dashboard.invoices;
  }, [dashboard]);

  const pendingSurveys = useMemo(() => {
    if (dashboard.status !== "ready") return [];
    return dashboard.surveys;
  }, [dashboard]);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("ja-JP").format(amount);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

  if (state.status === "loading")
    return <main className="page">読み込み中...</main>;

  if (state.status === "error") {
    return (
      <main className="page">
        <p className="text-sm">エラー: {state.message}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            {state.displayName ? `${state.displayName}さん` : state.email}
          </p>
        </div>
        <div className="inline-list text-xs text-[color:var(--muted)]">
          <span className="chip">借用中 {borrowedBows.length}</span>
          <span className="chip">未承認 {pendingInvoices.length}</span>
          <span className="chip">未解答 {pendingSurveys.length}</span>
        </div>
      </div>

      {dashboard.status === "loading" ? (
        <p className="text-sm">ダッシュボードを読み込み中...</p>
      ) : null}
      {dashboard.status === "error" ? (
        <p className="text-sm">エラー: {dashboard.message}</p>
      ) : null}

      {dashboard.status === "ready" ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2">
                <HiOutlineClipboardDocumentList className="text-base" />
                借りている弓
              </h2>
              <Link className="text-xs" href="/dashboard/bows/bow-list">
                一覧へ
              </Link>
            </div>
            {borrowedBows.length === 0 ? (
              <p className="text-sm">借用中の弓はありません</p>
            ) : (
              <div className="space-y-3">
                {borrowedBows.slice(0, 3).map((bow) => (
                  <div key={bow.id} className="card-soft">
                    <p className="text-sm font-semibold">
                      {bow.bow_number} {bow.name}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {bow.length} / {bow.strength}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2">
                <HiOutlineReceiptPercent className="text-base" />
                未承認の請求
              </h2>
              <Link className="text-xs" href="/dashboard/invoices">
                一覧へ
              </Link>
            </div>
            {pendingInvoices.length === 0 ? (
              <p className="text-sm">未承認の請求はありません</p>
            ) : (
              <div className="space-y-3">
                {pendingInvoices.slice(0, 3).map((invoice) => (
                  <div key={invoice.id} className="card-soft">
                    <p className="text-sm font-semibold">
                      {invoice.title ?? "請求"} / ¥
                      {formatAmount(invoice.amount)}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      請求日: {formatDate(invoice.billed_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2">
                <HiOutlineClipboardDocumentCheck className="text-base" />
                未解答のアンケート
              </h2>
              <Link className="text-xs" href="/dashboard/surveys">
                一覧へ
              </Link>
            </div>
            {pendingSurveys.length === 0 ? (
              <p className="text-sm">未解答のアンケートはありません</p>
            ) : (
              <div className="space-y-3">
                {pendingSurveys.slice(0, 3).map((survey) => (
                  <div key={survey.id} className="card-soft">
                    <Link
                      className="text-sm font-semibold"
                      href={`/dashboard/surveys/${survey.id}`}
                    >
                      {survey.title}
                    </Link>
                    {survey.description ? (
                      <p className="text-xs text-[color:var(--muted)]">
                        {survey.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2">
            <HiOutlineCalendarDays className="text-base" />
            カレンダー
          </h2>
          <div className="inline-flex items-center gap-2">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth() - 1,
                    1
                  )
                )
              }
            >
              <HiOutlineChevronLeft className="text-base" />
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth() + 1,
                    1
                  )
                )
              }
            >
              <HiOutlineChevronRight className="text-base" />
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                const now = new Date();
                setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
            >
              今月
            </button>
          </div>
        </div>

        <div className="mt-2 text-lg font-semibold tracking-wide">
          {formatMonthLabel(calendarMonth)}
        </div>

        {calendar.status === "loading" ? (
          <p className="text-sm">カレンダーを読み込み中...</p>
        ) : null}
        {calendar.status === "error" ? (
          <p className="text-sm">エラー: {calendar.message}</p>
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
              {calendarDays.map((day) => {
                const key = formatDateKey(day);
                const dayEvents = calendarEventsByDay.get(key) ?? [];
                const isCurrentMonth =
                  day.getMonth() === calendarMonth.getMonth();
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
                        const occurrenceKey = `${event.id}-${key}-${timeLabel}`;
                        const isColored = Boolean(event.color);
                        const eventStyle = isColored
                          ? {
                              backgroundColor: event.color ?? undefined,
                              borderColor: event.color ?? undefined,
                            }
                          : undefined;
                        return (
                          <div
                            key={occurrenceKey}
                            className={`block w-full text-left rounded-xl border px-2 py-2 shadow-[0_6px_14px_rgba(130,65,0,0.08)] ${
                              isColored
                                ? "text-[color:var(--foreground)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                            }`}
                            style={eventStyle}
                          >
                            <span
                              className={`block text-[10px] uppercase tracking-[0.2em] ${
                                isColored
                                  ? "text-[color:var(--muted)]"
                                  : "text-[color:var(--muted)]"
                              }`}
                            >
                              {timeLabel}
                            </span>
                            <span className="text-sm font-semibold leading-snug">
                              {event.title}
                            </span>
                          </div>
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
    </main>
  );
}
