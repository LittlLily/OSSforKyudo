"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SurveyDetail = {
  survey: {
    id: string;
    title: string;
    description: string | null;
    status: "draft" | "open" | "closed";
    opens_at: string | null;
    closes_at: string | null;
    is_anonymous: boolean;
    created_at: string;
    created_by: string | null;
  };
  availability: "open" | "upcoming" | "closed";
  eligible: boolean;
  canAnswer: boolean;
  response: {
    id: string;
    created_at: string;
    updated_at: string;
    answers: Record<string, string[]>;
  } | null;
  questions: {
    id: string;
    prompt: string;
    type: "single" | "multiple";
    allow_option_add: boolean;
    options: {
      id: string;
      label: string;
      created_by: string | null;
      created_at: string;
    }[];
  }[];
  results: {
    eligibleCount: number;
    respondedCount: number;
    responseRate: number;
    countsByOption: Record<string, number>;
    respondentsByOption: Record<
      string,
      { id: string; display_name: string | null; student_number: string | null }[]
    >;
    unresponded: {
      id: string;
      display_name: string | null;
      student_number: string | null;
    }[];
  };
};

type DetailResponse = SurveyDetail & { error?: string };

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
};

const statusLabel = (detail: SurveyDetail) => {
  if (detail.survey.status === "draft") return "draft";
  if (detail.survey.status === "closed") return "closed";
  if (detail.availability === "upcoming") return "upcoming";
  if (detail.availability === "closed") return "closed";
  return "open";
};

export default function SurveyDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

  const loadDetail = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/surveys/${params.id}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        location.href = `/login?next=/dashboard/surveys/${params.id}`;
        return;
      }
      const data = (await res.json()) as DetailResponse;
      if (!res.ok) throw new Error(data.error || "failed to load survey");
      setDetail(data);
      setAnswers(data.response?.answers ?? {});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params?.id) {
      void loadDetail();
    }
  }, [params?.id]);

  const updateAnswer = (questionId: string, optionId: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (checked) {
        return { ...prev, [questionId]: [...new Set([...current, optionId])] };
      }
      return {
        ...prev,
        [questionId]: current.filter((id) => id !== optionId),
      };
    });
  };

  const setSingleAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
  };

  const submit = async () => {
    if (!detail) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        surveyId: detail.survey.id,
        answers: detail.questions.map((question) => ({
          questionId: question.id,
          optionIds: answers[question.id] ?? [],
        })),
      };
      const res = await fetch("/api/surveys/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to submit");
      await loadDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSaving(false);
    }
  };

  const addOption = async (questionId: string) => {
    const label = optionDrafts[questionId]?.trim();
    if (!label) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/surveys/option", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, label }),
      });
      const data = (await res.json()) as { option?: { id: string; label: string }; error?: string };
      if (!res.ok) throw new Error(data.error || "failed to add option");
      setDetail((prev) => {
        const newOption = data.option;
        if (!prev || !newOption) return prev;
        const nextOption = {
          id: newOption.id,
          label: newOption.label,
          created_by: null,
          created_at: new Date().toISOString(),
        };
        const nextQuestions = prev.questions.map((question) =>
          question.id === questionId
            ? {
                ...question,
                options: [...question.options, nextOption],
              }
            : question
        );
        return { ...prev, questions: nextQuestions };
      });
      setOptionDrafts((prev) => ({ ...prev, [questionId]: "" }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSaving(false);
    }
  };

  const responseSummary = useMemo(() => {
    if (!detail) return "";
    return `${detail.results.respondedCount}/${detail.results.eligibleCount} (${detail.results.responseRate}%)`;
  }, [detail]);

  if (loading) return <main className="p-6">loading...</main>;
  if (!detail) {
    return (
      <main className="p-6">
        <p>survey not found</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link className="underline" href="/dashboard/surveys">
          Back
        </Link>
        <h1 className="text-2xl font-bold">{detail.survey.title}</h1>
        <span className="text-xs border rounded px-2 py-0.5">
          {statusLabel(detail)}
        </span>
      </div>

      {detail.survey.description ? (
        <p className="text-sm">{detail.survey.description}</p>
      ) : null}

      <div className="text-xs text-gray-600">
        <span>open: {formatDate(detail.survey.opens_at)}</span>
        <span className="ml-3">close: {formatDate(detail.survey.closes_at)}</span>
      </div>

      {message ? <p className="text-sm">error: {message}</p> : null}

      {!detail.eligible ? (
        <p className="text-sm">回答権がありません</p>
      ) : detail.canAnswer ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">回答</h2>
          {detail.questions.map((question, index) => (
            <div key={question.id} className="border rounded p-4 space-y-2">
              <div className="font-semibold">
                Q{index + 1}. {question.prompt}
              </div>
              <div className="space-y-1">
                {question.options.map((option) => {
                  const selected = answers[question.id] ?? [];
                  const checked = selected.includes(option.id);
                  if (question.type === "single") {
                    return (
                      <label key={option.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={question.id}
                          checked={checked}
                          onChange={() => setSingleAnswer(question.id, option.id)}
                        />
                        {option.label}
                      </label>
                    );
                  }
                  return (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          updateAnswer(question.id, option.id, event.target.checked)
                        }
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              {question.allow_option_add ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="border rounded px-3 py-1 text-sm"
                    placeholder="Add option"
                    value={optionDrafts[question.id] ?? ""}
                    onChange={(event) =>
                      setOptionDrafts((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="text-xs underline"
                    type="button"
                    onClick={() => addOption(question.id)}
                    disabled={saving}
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <button
            className="border rounded px-4 py-2"
            type="button"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving..." : detail.response ? "Update response" : "Submit response"}
          </button>
        </section>
      ) : (
        <p className="text-sm">
          {detail.response ? "回答済み" : "回答期間外です"}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">結果</h2>
        <p className="text-sm">回答率: {responseSummary}</p>
        {!detail.survey.is_anonymous ? (
          <h3 className="font-semibold">選択肢ごとの回答者</h3>
        ) : null}
        {detail.questions.map((question, index) => (
          <div key={question.id} className="border rounded p-4 space-y-2">
            <div className="font-semibold">
              Q{index + 1}. {question.prompt}
            </div>
            <div className="space-y-1 text-sm">
              {question.options.map((option) => (
                <div key={option.id} className="flex items-center justify-between gap-2">
                  <span>{option.label}</span>
                  <span>
                    {detail.results.countsByOption[option.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
            {!detail.survey.is_anonymous ? (
              <div className="space-y-2 text-sm">
                {question.options.map((option) => {
                  const respondents =
                    detail.results.respondentsByOption[option.id] ?? [];
                  return (
                    <div key={option.id}>
                      <div className="font-semibold">{option.label}</div>
                      {respondents.length === 0 ? (
                        <p className="text-xs text-gray-600">no respondents</p>
                      ) : (
                        <ul className="list-disc pl-4 space-y-1">
                          {respondents.map((user) => (
                            <li key={user.id}>
                              {user.display_name ?? "-"} (
                              {user.student_number ?? "-"})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
        <div className="space-y-2">
          <h3 className="font-semibold">未回答者</h3>
          {detail.results.unresponded.length === 0 ? (
            <p className="text-sm">no unresponded accounts</p>
          ) : (
            <ul className="text-sm list-disc pl-4 space-y-1">
              {detail.results.unresponded.map((user) => (
                <li key={user.id}>
                  {user.display_name ?? "-"} ({user.student_number ?? "-"})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
