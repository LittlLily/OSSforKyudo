"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineClipboardDocumentList,
  HiOutlineReceiptRefund,
} from "react-icons/hi2";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; role: "admin" | "user" }
  | { status: "error"; message: string };

type InvoiceLog = {
  id: string;
  created_at: string;
  action: string;
  operator_display_name: string | null;
  operator_student_number: string | null;
  target_display_name: string | null;
  target_student_number: string | null;
  target_label: string | null;
  detail: string | null;
};

export default function InvoiceLogsPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [logs, setLogs] = useState<InvoiceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/logs/invoices";
          return;
        }
        const data = (await res.json()) as {
          user?: { role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "failed to load user");
        setAuth({
          status: "authed",
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
    void loadLogs();
  }, [auth.status]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      return right - left;
    });
  }, [logs]);

  const formatTime = (value: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
    });
  };

  const renderPerson = (
    name: string | null,
    studentNumber: string | null,
    fallbackLabel: string
  ) => {
    if (!name && !studentNumber) {
      return <span>{fallbackLabel}</span>;
    }
    return (
      <div className="leading-tight">
        <div>{name ?? fallbackLabel}</div>
        {studentNumber ? (
          <div className="text-xs text-[color:var(--muted)]">
            ({studentNumber})
          </div>
        ) : null}
      </div>
    );
  };

  const loadLogs = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/logs/invoices", { cache: "no-store" });
      if (res.status === 401) {
        location.href = "/login?next=/dashboard/logs/invoices";
        return;
      }
      const data = (await res.json()) as {
        logs?: InvoiceLog[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "failed to load logs");
      setLogs(data.logs ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <HiOutlineReceiptRefund className="text-2xl" />
            Invoice Logs
          </h1>
          <p className="page-subtitle">
            {auth.role === "admin"
              ? "全請求の会計ログ"
              : "自分に紐づく請求の会計ログ"}
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-ghost inline-flex items-center gap-2" href="/dashboard/logs">
            <HiOutlineArrowLeft className="text-base" />
            Back
          </Link>
        </div>
      </div>

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineClipboardDocumentList className="text-base" />
          会計ログ
        </h2>
        <div className="table-wrap border border-[color:var(--border)]">
          <table>
            <thead>
              <tr>
                <th>時刻</th>
                <th>操作者</th>
                <th>対象</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4}>ログがありません</td>
                </tr>
              ) : (
                sortedLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTime(log.created_at)}</td>
                    <td>
                      {renderPerson(
                        log.operator_display_name,
                        log.operator_student_number,
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="leading-tight">
                        <div>{log.target_label ?? "-"}</div>
                        {(log.target_display_name || log.target_student_number) ? (
                          <div className="text-xs text-[color:var(--muted)]">
                            {log.target_display_name ?? "-"}
                            {log.target_student_number
                              ? ` (${log.target_student_number})`
                              : ""}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="leading-tight">
                        <div>{log.action}</div>
                        {log.detail ? (
                          <div className="text-xs text-[color:var(--muted)]">
                            {log.detail}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {loading ? <p className="text-sm">loading...</p> : null}
        {message ? <p className="text-sm">error: {message}</p> : null}
      </section>
    </main>
  );
}
