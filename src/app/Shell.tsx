"use client";

import { usePathname } from "next/navigation";
import SidebarFooter from "./SidebarFooter";
import SidebarNav from "./SidebarNav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname?.startsWith("/login");
  const currentLabel = (() => {
    const path = pathname ?? "/";
    if (path === "/") return "Dashboard";
    if (path.startsWith("/dashboard/profile/profile-edit")) return "Profile Edit";
    if (path.startsWith("/dashboard/profile/profile-create"))
      return "Profile Create";
    if (path.startsWith("/dashboard/profile/profile-delete"))
      return "Profile Delete";
    if (path.startsWith("/dashboard/profile/profile-list"))
      return "Profile List";
    if (path.startsWith("/dashboard/profile")) return "Profiles";
    if (path.startsWith("/dashboard/invoices/create")) return "Invoice Create";
    if (path.startsWith("/dashboard/invoices")) return "Invoices";
    if (path.startsWith("/dashboard/surveys/analytics"))
      return "Survey Analytics";
    if (path.startsWith("/dashboard/surveys/create")) return "Survey Create";
    if (path.startsWith("/dashboard/surveys/") && path.endsWith("/edit"))
      return "Survey Edit";
    if (path.startsWith("/dashboard/surveys/")) return "Survey Detail";
    if (path.startsWith("/dashboard/surveys")) return "Surveys";
    return "Dashboard";
  })();

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
    <div className="min-h-screen grid grid-cols-[minmax(220px,260px)_minmax(0,1fr)] max-[900px]:grid-cols-1">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-[color:var(--border)] bg-[linear-gradient(155deg,_#f7e9d2_0%,_#f1dfc1_55%,_#e9d3ad_100%)] px-6 py-7 max-[900px]:static max-[900px]:h-auto max-[900px]:border-b max-[900px]:border-r-0">
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em]">
          Kyudo Ops
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Enterprise Console
        </p>
        <SidebarNav />
        <div className="mt-auto pt-6">
          <SidebarFooter />
        </div>
      </aside>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] px-7 py-5 backdrop-blur max-[900px]:static max-[900px]:px-4">
          <h2 className="text-lg font-semibold tracking-wide">
            {currentLabel}
          </h2>
        </header>
        <div className="px-7 py-6 max-[900px]:px-4">{children}</div>
      </div>
    </div>
  );
}
