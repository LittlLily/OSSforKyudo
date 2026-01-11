"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AnalyticsRow = {
  account_id: string;
  display_name: string | null;
  student_number: string | null;
  eligible: number;
  responded: number;
  responseRate: number;
};

type AnalyticsResponse = {
  rows?: AnalyticsRow[];
  error?: string;
};

const toLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatRate = (value: number) => `${value.toFixed(1)}%`;

export default function SurveyAnalyticsPage() {
  const now = new Date();
  const initialStart = new Date(now);
  initialStart.setDate(now.getDate() - 30);

  const [startAt, setStartAt] = useState(toLocalInputValue(initialStart));
  const [endAt, setEndAt] = useState(toLocalInputValue(now));
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setMessage("invalid date");
        return;
      }
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const res = await fetch(`/api/surveys/analytics?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        location.href = "/login?next=/dashboard/surveys/analytics";
        return;
      }
      const data = (await res.json()) as AnalyticsResponse;
      if (!res.ok) throw new Error(data.error || "failed to load analytics");
      setRows(data.rows ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (b.responseRate !== a.responseRate) {
        return b.responseRate - a.responseRate;
      }
      return b.eligible - a.eligible;
    });
  }, [rows]);

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link className="underline" href="/dashboard/surveys">
          Back
        </Link>
        <h1 className="text-2xl font-bold">Survey Analytics</h1>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-semibold">Start</label>
            <input
              className="mt-1 border rounded px-3 py-2"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold">End</label>
            <input
              className="mt-1 border rounded px-3 py-2"
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </div>
          <button
            className="border rounded px-4 py-2"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
        {message ? <p className="text-sm">error: {message}</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">回答率一覧</h2>
        {sortedRows.length === 0 ? (
          <p className="text-sm">no data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] text-sm border">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Student No</th>
                  <th className="text-right p-2">Eligible</th>
                  <th className="text-right p-2">Responded</th>
                  <th className="text-right p-2">Rate</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.account_id} className="border-b">
                    <td className="p-2">{row.display_name ?? "-"}</td>
                    <td className="p-2">{row.student_number ?? "-"}</td>
                    <td className="p-2 text-right">{row.eligible}</td>
                    <td className="p-2 text-right">{row.responded}</td>
                    <td className="p-2 text-right">{formatRate(row.responseRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
