"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentChartBar,
  HiOutlineDocumentDuplicate,
  HiOutlineDocumentText,
  HiOutlineHome,
  HiOutlinePencilSquare,
  HiOutlineReceiptRefund,
  HiOutlineSquares2X2,
  HiOutlineUser,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import SidebarFooter from "./SidebarFooter";
import SidebarNav from "./SidebarNav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isLogin = pathname?.startsWith("/login");
  const currentLabel = (() => {
    const path = pathname ?? "/";
    if (path === "/") return "Dashboard";
    if (path.startsWith("/dashboard/profile/profile-edit"))
      return "Profile Edit";
    if (path.startsWith("/dashboard/profile/profile-create"))
      return "Profile Create";
    if (path.startsWith("/dashboard/profile/profile-delete"))
      return "Profile Delete";
    if (path.startsWith("/dashboard/profile/profile-list"))
      return "Profile List";
    if (path.startsWith("/dashboard/profile")) return "Profiles";
    if (path.startsWith("/dashboard/invoices/create")) return "Invoice Create";
    if (path.startsWith("/dashboard/invoices")) return "Invoices";
    if (path.startsWith("/dashboard/logs/account")) return "Account Logs";
    if (path.startsWith("/dashboard/logs/invoices")) return "Invoice Logs";
    if (path.startsWith("/dashboard/logs")) return "Logs";
    if (path.startsWith("/dashboard/surveys/analytics"))
      return "Survey Analytics";
    if (path.startsWith("/dashboard/surveys/create")) return "Survey Create";
    if (path.startsWith("/dashboard/surveys/") && path.endsWith("/edit"))
      return "Survey Edit";
    if (path.startsWith("/dashboard/surveys/")) return "Survey Detail";
    if (path.startsWith("/dashboard/surveys")) return "Surveys";
    return "Dashboard";
  })();
  const currentIcon = useMemo(() => {
    switch (currentLabel) {
      case "Dashboard":
        return <HiOutlineHome />;
      case "Profiles":
        return <HiOutlineUserGroup />;
      case "Profile Edit":
        return <HiOutlinePencilSquare />;
      case "Profile Create":
        return <HiOutlineUser />;
      case "Profile Delete":
        return <HiOutlineDocumentDuplicate />;
      case "Profile List":
        return <HiOutlineSquares2X2 />;
      case "Invoices":
        return <HiOutlineReceiptRefund />;
      case "Invoice Create":
        return <HiOutlineDocumentText />;
      case "Logs":
        return <HiOutlineDocumentText />;
      case "Account Logs":
        return <HiOutlineDocumentDuplicate />;
      case "Invoice Logs":
        return <HiOutlineDocumentChartBar />;
      case "Surveys":
        return <HiOutlineClipboardDocumentList />;
      case "Survey Create":
        return <HiOutlinePencilSquare />;
      case "Survey Edit":
        return <HiOutlinePencilSquare />;
      case "Survey Detail":
        return <HiOutlineDocumentText />;
      case "Survey Analytics":
        return <HiOutlineDocumentChartBar />;
      default:
        return <HiOutlineHome />;
    }
  }, [currentLabel]);

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
          isMobileNavOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
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
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em]">
          Kyudo Ops
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Enterprise Console
        </p>
          </div>
          <button
            className="btn btn-ghost text-[10px] uppercase tracking-[0.2em] min-[769px]:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            type="button"
          >
            Close
          </button>
        </div>
        <SidebarNav />
        <div className="mt-auto pt-6">
          <SidebarFooter />
        </div>
      </aside>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] px-7 py-5 backdrop-blur max-[768px]:static max-[768px]:px-4 max-[768px]:py-4">
          <div className="flex items-center gap-3">
            <button
              aria-controls="mobile-sidebar"
              aria-expanded={isMobileNavOpen}
              className="btn btn-ghost text-[10px] uppercase tracking-[0.2em] min-[769px]:hidden"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              type="button"
            >
              Menu
            </button>
            <div className="min-[769px]:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Kyudo Ops
              </p>
              <p className="text-xs font-semibold tracking-[0.16em]">
                Enterprise Console
              </p>
            </div>
          </div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-wide">
            <span className="text-xl">{currentIcon}</span>
            {currentLabel}
          </h2>
        </header>
        <div className="flex justify-center px-7 py-6 max-[768px]:px-4">
          {children}
        </div>
      </div>
    </div>
  );
}
