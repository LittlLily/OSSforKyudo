"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
};

const statusLabel = (survey: Survey) => {
  if (survey.status === "draft") return "draft";
  if (survey.status === "closed") return "closed";
  if (survey.availability === "upcoming") return "upcoming";
  if (survey.availability === "closed") return "closed";
  return "open";
};

const responseLabel = (survey: Survey) => {
  if (survey.responded) return "回答済み";
  if (survey.eligible) return "回答必要";
  return "回答不要";
};

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
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
        if (!res.ok) throw new Error(data.error || "failed to load surveys");
        setSurveys(data.surveys ?? []);
        setRole(data.role ?? "user");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  if (loading) {
    return <main className="page">loading...</main>;
  }

  return (
    <main className="page">
      <div className="inline-list">
        <Link className="btn btn-primary" href="/dashboard/surveys/analytics">
          Analytics
        </Link>
        {role === "admin" ? (
          <Link className="btn btn-primary" href="/dashboard/surveys/create">
            Create survey
          </Link>
        ) : null}
      </div>

      {message ? <p className="text-sm">error: {message}</p> : null}

      <section className="section">
        <h2 className="section-title">Pending Responses</h2>
        {pendingSurveys.length === 0 ? (
          <p className="text-sm">no pending surveys</p>
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
                  <span>open: {formatDate(survey.opens_at)}</span>
                  <span className="ml-3">
                    close: {formatDate(survey.closes_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Completed</h2>
        {completedSurveys.length === 0 ? (
          <p className="text-sm">no completed surveys</p>
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
                  <span>open: {formatDate(survey.opens_at)}</span>
                  <span className="ml-3">
                    close: {formatDate(survey.closes_at)}
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
