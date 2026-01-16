"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineHome,
  HiOutlineReceiptPercent,
  HiOutlineClipboardDocumentCheck,
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

export default function Home() {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [dashboard, setDashboard] = useState<DashboardState>({
    status: "loading",
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
    </main>
  );
}
