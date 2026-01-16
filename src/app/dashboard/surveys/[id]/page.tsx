"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineChartBar,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineCheckCircle,
  HiOutlineClipboardDocumentList,
  HiOutlineInbox,
  HiOutlinePencilSquare,
  HiOutlinePlusCircle,
  HiOutlineTrash,
} from "react-icons/hi2";

type SurveyDetail = {
  role: "admin" | "user";
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

type AuthState =
  | { status: "loading" }
  | { status: "authed" }
  | { status: "error"; message: string };

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
};

const statusLabel = (detail: SurveyDetail) => {
  if (detail.survey.status === "draft") return "下書き";
  if (detail.survey.status === "closed") return "終了";
  if (detail.availability === "upcoming") return "開始前";
  if (detail.availability === "closed") return "終了";
  return "公開中";
};

export default function SurveyDetailPage() {
  const params = useParams<{ id: string }>();
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = `/login?next=/dashboard/surveys/${params.id}`;
          return;
        }
        const data = (await res.json()) as { error?: string };
        if (!res.ok)
          throw new Error(data.error || "ユーザーの読み込みに失敗しました");
        setAuth({ status: "authed" });
      } catch (err) {
        setAuth({
          status: "error",
          message: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    })();
  }, [params.id]);

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
      if (!res.ok)
        throw new Error(data.error || "アンケートの読み込みに失敗しました");
      setDetail(data);
      setAnswers(data.response?.answers ?? {});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params?.id && auth.status === "authed") {
      void loadDetail();
    }
  }, [params?.id, auth.status]);

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
      if (!res.ok) throw new Error(data.error || "送信に失敗しました");
      await loadDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setSaving(false);
    }
  };

  const deleteSurvey = async () => {
    if (!detail) return;
    const confirmed = window.confirm("このアンケートを削除しますか？");
    if (!confirmed) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/surveys/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.survey.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "削除に失敗しました");
      location.href = "/dashboard/surveys";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setDeleting(false);
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
      if (!res.ok)
        throw new Error(data.error || "選択肢の追加に失敗しました");
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
      setMessage(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setSaving(false);
    }
  };

  const responseSummary = useMemo(() => {
    if (!detail) return "";
    return `${detail.results.respondedCount}/${detail.results.eligibleCount} (${detail.results.responseRate}%)`;
  }, [detail]);

  if (auth.status === "loading") {
    return <main className="page">読み込み中...</main>;
  }
  if (auth.status === "error") {
    return (
      <main className="page">
        <p>エラー: {auth.message}</p>
      </main>
    );
  }
  if (loading) return <main className="page">読み込み中...</main>;
  if (!detail) {
    return (
      <main className="page">
        <p>アンケートが見つかりません</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <HiOutlineClipboardDocumentList className="text-xl" />
        {detail.survey.title}
      </h1>
      <div className="inline-list">
        <span className="chip">{statusLabel(detail)}</span>
        {detail.role === "admin" && detail.survey.status === "draft" ? (
          <>
            <Link
              className="btn btn-ghost inline-flex items-center gap-2"
              href={`/dashboard/surveys/${detail.survey.id}/edit`}
            >
              <HiOutlinePencilSquare className="text-base" />
              編集
            </Link>
            <button
              className="btn btn-ghost text-[color:var(--accent-strong)] inline-flex items-center gap-2"
              type="button"
              onClick={deleteSurvey}
              disabled={deleting}
            >
              <HiOutlineTrash className="text-base" />
              {deleting ? "削除中..." : "削除"}
            </button>
          </>
        ) : null}
      </div>

      {detail.survey.description ? (
        <p className="text-sm">{detail.survey.description}</p>
      ) : null}

      <div className="text-xs text-[color:var(--muted)]">
        <span>開始: {formatDate(detail.survey.opens_at)}</span>
        <span className="ml-3">終了: {formatDate(detail.survey.closes_at)}</span>
      </div>

      {message ? <p className="text-sm">エラー: {message}</p> : null}

      {!detail.eligible ? (
        <p className="text-sm">回答権がありません</p>
      ) : detail.canAnswer ? (
        <section className="section">
          <h2 className="section-title flex items-center gap-2">
            <HiOutlineChatBubbleBottomCenterText className="text-base" />
            回答
          </h2>
          {detail.questions.map((question, index) => (
            <div key={question.id} className="card space-y-2">
              <div className="font-semibold text-sm">
                Q{index + 1}. {question.prompt}
              </div>
              <div className="space-y-1">
                {question.options.map((option) => {
                  const selected = answers[question.id] ?? [];
                  const checked = selected.includes(option.id);
                  if (question.type === "single") {
                    return (
                      <label
                        key={option.id}
                        className="flex items-center gap-2 text-sm"
                      >
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
                    <label
                      key={option.id}
                      className="flex items-center gap-2 text-sm"
                    >
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
                <div className="inline-list">
                  <input
                    className="w-64"
                    placeholder="選択肢を追加"
                    value={optionDrafts[question.id] ?? ""}
                    onChange={(event) =>
                      setOptionDrafts((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => addOption(question.id)}
                    disabled={saving}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HiOutlinePlusCircle className="text-base" />
                      追加
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <button
            className="btn btn-primary"
            type="button"
            onClick={submit}
            disabled={saving}
          >
            <span className="inline-flex items-center gap-2">
              <HiOutlineCheckCircle className="text-base" />
              {saving
                ? "送信中..."
                : detail.response
                  ? "回答を更新"
                  : "回答を送信"}
            </span>
          </button>
        </section>
      ) : (
        <p className="text-sm">
          {detail.response ? "回答済み" : "回答期間外です"}
        </p>
      )}

      <section className="section">
        <h2 className="section-title flex items-center gap-2">
          <HiOutlineChartBar className="text-base" />
          集計結果
        </h2>
        <p className="text-sm">回答率: {responseSummary}</p>
        {!detail.survey.is_anonymous ? (
          <h3 className="font-semibold">選択肢ごとの回答者</h3>
        ) : null}
        {detail.questions.map((question, index) => (
          <div key={question.id} className="card space-y-2">
            <div className="font-semibold text-sm">
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
                        <p className="text-xs text-[color:var(--muted)]">
                          回答者なし
                        </p>
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
        <div className="card-soft space-y-2">
          <h3 className="flex items-center gap-2 font-semibold text-sm">
            <HiOutlineInbox className="text-base" />
            未回答者
          </h3>
          {detail.results.unresponded.length === 0 ? (
            <p className="text-sm">未回答者はいません</p>
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
