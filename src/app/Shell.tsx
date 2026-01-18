"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  HiOutlineArrowRightCircle,
  HiOutlineArrowLeft,
  HiOutlineClipboardDocumentList,
  HiOutlineChartBar,
  HiOutlineCalendar,
  HiOutlineDocumentText,
  HiOutlineHome,
  HiOutlinePencilSquare,
  HiOutlinePlusCircle,
  HiOutlineReceiptRefund,
  HiOutlineTrash,
  HiOutlineUserCircle,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { TbBow } from "react-icons/tb";
import SidebarFooter from "./SidebarFooter";
import SidebarNav from "./SidebarNav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isLogin =
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/reset-password") ||
    pathname?.startsWith("/forgot-password");
  const currentLabel = (() => {
    const path = pathname ?? "/";
    if (path === "/") return "ダッシュボード";
    if (path.startsWith("/dashboard/profile/profile-edit"))
      return "プロフィール編集";
    if (path.startsWith("/dashboard/profile/profile-create"))
      return "プロフィール作成";
    if (path.startsWith("/dashboard/profile/profile-delete"))
      return "プロフィール削除";
    if (path.startsWith("/dashboard/profile/profile-list"))
      return "プロフィール一覧";
    if (path.startsWith("/dashboard/profile")) return "プロフィール";
    if (path.startsWith("/dashboard/bows/bow-list")) return "弓一覧";
    if (path.startsWith("/dashboard/bows/bow-create")) return "弓作成";
    if (path.startsWith("/dashboard/bows/bow-edit")) return "弓編集";
    if (path.startsWith("/dashboard/bows/bow-delete")) return "弓削除";
    if (path.startsWith("/dashboard/bows/bow-loan")) return "弓貸出";
    if (path.startsWith("/dashboard/bows")) return "弓管理";
    if (path.startsWith("/dashboard/invoices/create")) return "請求書作成";
    if (path.startsWith("/dashboard/invoices")) return "請求書";
    if (path.startsWith("/dashboard/logs/account")) return "アカウントログ";
    if (path.startsWith("/dashboard/logs/invoices")) return "請求書ログ";
    if (path.startsWith("/dashboard/logs/bows")) return "弓ログ";
    if (path.startsWith("/dashboard/logs")) return "ログ";
    if (path.startsWith("/dashboard/calendar/create")) return "予定作成";
    if (path.startsWith("/dashboard/calendar/") && path.endsWith("/edit"))
      return "予定編集";
    if (path.startsWith("/dashboard/calendar")) return "カレンダー";
    if (path.startsWith("/dashboard/surveys/analytics"))
      return "アンケート集計";
    if (path.startsWith("/dashboard/surveys/create")) return "アンケート作成";
    if (path.startsWith("/dashboard/surveys/") && path.endsWith("/edit"))
      return "アンケート編集";
    if (path.startsWith("/dashboard/surveys/")) return "アンケート詳細";
    if (path.startsWith("/dashboard/surveys")) return "アンケート";
    return "ダッシュボード";
  })();
  const currentIcon = useMemo(() => {
    switch (currentLabel) {
      case "ダッシュボード":
        return <HiOutlineHome />;
      case "プロフィール":
        return <HiOutlineUserGroup />;
      case "プロフィール編集":
        return <HiOutlineUserCircle />;
      case "プロフィール作成":
        return <HiOutlinePlusCircle />;
      case "プロフィール削除":
        return <HiOutlineTrash />;
      case "プロフィール一覧":
        return <HiOutlineClipboardDocumentList />;
      case "弓管理":
        return <TbBow />;
      case "弓一覧":
        return <HiOutlineClipboardDocumentList />;
      case "弓作成":
        return <HiOutlinePlusCircle />;
      case "弓編集":
        return <HiOutlinePencilSquare />;
      case "弓削除":
        return <HiOutlineTrash />;
      case "弓貸出":
        return <HiOutlineArrowRightCircle />;
      case "請求書":
        return <HiOutlineReceiptRefund />;
      case "請求書作成":
        return <HiOutlinePlusCircle />;
      case "ログ":
        return <HiOutlineDocumentText />;
      case "アカウントログ":
        return <HiOutlineUserCircle />;
      case "請求書ログ":
        return <HiOutlineReceiptRefund />;
      case "弓ログ":
        return <TbBow />;
      case "アンケート":
        return <HiOutlineClipboardDocumentList />;
      case "アンケート作成":
        return <HiOutlinePlusCircle />;
      case "アンケート編集":
        return <HiOutlinePencilSquare />;
      case "アンケート詳細":
        return <HiOutlineDocumentText />;
      case "アンケート集計":
        return <HiOutlineChartBar />;
      case "カレンダー":
        return <HiOutlineCalendar />;
      case "予定作成":
        return <HiOutlinePlusCircle />;
      case "予定編集":
        return <HiOutlinePencilSquare />;
      default:
        return <HiOutlineHome />;
    }
  }, [currentLabel]);
  const backLink = useMemo(() => {
    const path = pathname ?? "/";
    if (path.startsWith("/dashboard/profile/") && path !== "/dashboard/profile")
      return { href: "/dashboard/profile", label: "戻る" };
    if (path.startsWith("/dashboard/bows/") && path !== "/dashboard/bows")
      return { href: "/dashboard/bows", label: "戻る" };
    if (path.startsWith("/dashboard/logs/") && path !== "/dashboard/logs")
      return { href: "/dashboard/logs", label: "戻る" };
    if (path.startsWith("/dashboard/calendar/") && path !== "/dashboard/calendar")
      return { href: "/dashboard/calendar", label: "戻る" };
    if (path.startsWith("/dashboard/surveys/")) {
      if (path === "/dashboard/surveys") return null;
      if (
        path.startsWith("/dashboard/surveys/analytics") ||
        path.startsWith("/dashboard/surveys/create")
      ) {
        return { href: "/dashboard/surveys", label: "戻る" };
      }
      const parts = path.split("/").filter(Boolean);
      const surveyId = parts[2];
      if (!surveyId) return null;
      if (parts[3] === "edit") {
        return { href: `/dashboard/surveys/${surveyId}`, label: "戻る" };
      }
      return { href: "/dashboard/surveys", label: "戻る" };
    }
    return null;
  }, [pathname]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  if (isLogin) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto flex w-full max-w-3xl justify-center">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-[minmax(220px,260px)_minmax(0,1fr)] max-[768px]:block">
      <button
        aria-hidden={!isMobileNavOpen}
        className={`fixed inset-0 z-10 bg-black/30 transition min-[769px]:hidden ${
          isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileNavOpen(false)}
        tabIndex={isMobileNavOpen ? 0 : -1}
        type="button"
      />
      <aside
        className={`sticky top-0 flex h-screen flex-col border-r border-[color:var(--border)] bg-[linear-gradient(155deg,_#f7e9d2_0%,_#f1dfc1_55%,_#e9d3ad_100%)] px-6 py-7 transition max-[768px]:fixed max-[768px]:inset-x-4 max-[768px]:bottom-4 max-[768px]:top-4 max-[768px]:z-20 max-[768px]:h-auto max-[768px]:overflow-y-auto max-[768px]:rounded-3xl max-[768px]:border max-[768px]:border-[color:var(--border)] max-[768px]:shadow-[0_24px_50px_rgba(130,65,0,0.2)] ${
          isMobileNavOpen
            ? "max-[768px]:translate-y-0 max-[768px]:opacity-100"
            : "max-[768px]:invisible max-[768px]:pointer-events-none max-[768px]:-translate-y-2 max-[768px]:opacity-0"
        }`}
        id="mobile-sidebar"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold uppercase tracking-[0.08em] font-hiragino">
              セイシャ
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              弓道システム
            </p>
          </div>
          <button
            className="btn btn-ghost text-[10px] uppercase tracking-[0.2em] min-[769px]:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            type="button"
          >
            閉じる
          </button>
        </div>
        <SidebarNav />
        <div className="mt-auto pt-6">
          <SidebarFooter />
        </div>
      </aside>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-start gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] px-7 py-5 backdrop-blur max-[768px]:static max-[768px]:px-4 max-[768px]:py-4">
          <div className="flex items-center gap-3">
            <button
              aria-controls="mobile-sidebar"
              aria-expanded={isMobileNavOpen}
              className="btn btn-ghost text-[10px] uppercase tracking-[0.2em] min-[769px]:hidden"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              type="button"
            >
              メニュー
            </button>
            <div className="min-[769px]:hidden">
              <p className="text-base font-extrabold uppercase tracking-[0.08em] text-[color:var(--muted)] font-hiragino">
                セイシャ
              </p>
              <p className="text-xs font-semibold tracking-[0.16em]">
                弓道システム
              </p>
            </div>
          </div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-wide">
            <span className="text-xl">{currentIcon}</span>
            {currentLabel}
          </h2>
          {backLink ? (
            <Link
              className="btn btn-ghost inline-flex items-center gap-2 ml-auto"
              href={backLink.href}
            >
              <HiOutlineArrowLeft className="text-base" />
              {backLink.label}
            </Link>
          ) : null}
        </header>
        <div className="flex justify-center px-7 py-6 max-[768px]:px-4">
          {children}
        </div>
      </div>
    </div>
  );
}
