"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlinePlusCircle,
} from "react-icons/hi2";

type Survey = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  created_by: string | null;
  eligible: boolean;
  responded: boolean;
  availability: "open" | "upcoming" | "closed";
  canAnswer: boolean;
  requiresResponse: boolean;
};

type ListResponse = {
  surveys?: Survey[];
  role?: "admin" | "user";
  error?: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "authed"; role: "admin" | "user" }
  | { status: "error"; message: string };

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
};

const statusLabel = (survey: Survey) => {
  if (survey.status === "draft") return "下書き";
  if (survey.status === "closed") return "終了";
  if (survey.availability === "upcoming") return "開始前";
  if (survey.availability === "closed") return "終了";
  return "公開中";
};

const responseLabel = (survey: Survey) => {
  if (survey.responded) return "回答済み";
  if (survey.eligible) return "回答必要";
  return "回答不要";
};

export default function SurveysPage() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/surveys";
          return;
        }
        const data = (await res.json()) as {
          user?: { role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({ status: "authed", role: data.user?.role ?? "user" });
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
        setLoading(true);
        setMessage(null);
        const res = await fetch("/api/surveys", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/surveys";
          return;
        }
        const data = (await res.json()) as ListResponse;
        if (!res.ok)
          throw new Error(data.error || "アンケートの読み込みに失敗しました");
        setSurveys(data.surveys ?? []);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "不明なエラー");
      } finally {
        setLoading(false);
      }
    })();
  }, [auth.status]);

  const [pendingSurveys, completedSurveys] = useMemo(() => {
    const pending: Survey[] = [];
    const completed: Survey[] = [];
    surveys.forEach((survey) => {
      if (survey.responded) {
        completed.push(survey);
      } else {
        pending.push(survey);
      }
    });
    return [pending, completed];
  }, [surveys]);

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

  if (loading) {
    return <main className="page">読み込み中...</main>;
  }

  return (
    <main className="page">
      <div className="inline-list">
        <Link className="btn btn-primary inline-flex items-center gap-2" href="/dashboard/surveys/analytics">
          <HiOutlineChartBar className="text-base" />
          集計
        </Link>
        {auth.role === "admin" ? (
          <Link className="btn btn-primary inline-flex items-center gap-2" href="/dashboard/surveys/create">
            <HiOutlinePlusCircle className="text-base" />
            アンケート作成
          </Link>
        ) : null}
      </div>

      {message ? <p className="text-sm">エラー: {message}</p> : null}

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineClock className="text-base" />
          未回答
        </h2>
        {pendingSurveys.length === 0 ? (
          <p className="text-sm">未回答のアンケートはありません</p>
        ) : (
          <div className="space-y-3">
            {pendingSurveys.map((survey) => (
              <div key={survey.id} className="card">
                <div className="inline-list">
                  <Link href={`/dashboard/surveys/${survey.id}`}>
                    {survey.title}
                  </Link>
                  <span className="chip">{statusLabel(survey)}</span>
                  <span className="chip">{responseLabel(survey)}</span>
                </div>
                {survey.description ? (
                  <p className="mt-2 text-sm">{survey.description}</p>
                ) : null}
                <div className="mt-3 text-xs text-[color:var(--muted)]">
                  <span>開始: {formatDate(survey.opens_at)}</span>
                  <span className="ml-3">
                    終了: {formatDate(survey.closes_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineCheckCircle className="text-base" />
          回答済み
        </h2>
        {completedSurveys.length === 0 ? (
          <p className="text-sm">回答済みのアンケートはありません</p>
        ) : (
          <div className="space-y-3">
            {completedSurveys.map((survey) => (
              <div key={survey.id} className="card">
                <div className="inline-list">
                  <Link href={`/dashboard/surveys/${survey.id}`}>
                    {survey.title}
                  </Link>
                  <span className="chip">{statusLabel(survey)}</span>
                  <span className="chip">{responseLabel(survey)}</span>
                </div>
                {survey.description ? (
                  <p className="mt-2 text-sm">{survey.description}</p>
                ) : null}
                <div className="mt-3 text-xs text-[color:var(--muted)]">
                  <span>開始: {formatDate(survey.opens_at)}</span>
                  <span className="ml-3">
                    終了: {formatDate(survey.closes_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
