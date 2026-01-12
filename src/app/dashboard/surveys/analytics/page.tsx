"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowDownTray,
  HiOutlineChartBarSquare,
} from "react-icons/hi2";

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
        setMessage("日付が不正です");
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
      if (!res.ok)
        throw new Error(data.error || "分析の読み込みに失敗しました");
      setRows(data.rows ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
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
    <main className="page">
      <div className="inline-list">
        <Link className="btn btn-ghost inline-flex items-center gap-2" href="/dashboard/surveys">
          <HiOutlineArrowLeft className="text-base" />
          戻る
        </Link>
      </div>

      <section className="section">
        <div className="flex flex-wrap items-end gap-3">
          <div className="field">
            <label className="text-sm font-semibold text-[color:var(--muted)]">
              開始
            </label>
            <input
              className="w-52"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="text-sm font-semibold text-[color:var(--muted)]">
              終了
            </label>
            <input
              className="w-52"
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={load}
            disabled={loading}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineArrowDownTray className="text-base" />
              {loading ? "読み込み中..." : "読み込み"}
            </span>
          </button>
        </div>
        {message ? <p className="text-sm">エラー: {message}</p> : null}
      </section>

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineChartBarSquare className="text-base" />
          回答率一覧
        </h2>
        {sortedRows.length === 0 ? (
          <p className="text-sm">データがありません</p>
        ) : (
          <div className="table-wrap">
            <table className="min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="text-left">氏名</th>
                  <th className="text-left">学籍番号</th>
                  <th className="text-right">対象数</th>
                  <th className="text-right">回答数</th>
                  <th className="text-right">回答率</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.account_id}>
                    <td>{row.display_name ?? "-"}</td>
                    <td>{row.student_number ?? "-"}</td>
                    <td className="text-right">{row.eligible}</td>
                    <td className="text-right">{row.responded}</td>
                    <td className="text-right">
                      {formatRate(row.responseRate)}
                    </td>
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
