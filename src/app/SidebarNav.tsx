"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentText,
  HiOutlineHome,
  HiOutlineReceiptRefund,
  HiOutlineUserGroup,
} from "react-icons/hi2";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    match: (path) => path === "/",
    icon: <HiOutlineHome />,
  },
  {
    label: "Profiles",
    href: "/dashboard/profile",
    match: (path) => path.startsWith("/dashboard/profile"),
    icon: <HiOutlineUserGroup />,
  },
  {
    label: "Invoices",
    href: "/dashboard/invoices",
    match: (path) => path.startsWith("/dashboard/invoices"),
    icon: <HiOutlineReceiptRefund />,
  },
  {
    label: "Surveys",
    href: "/dashboard/surveys",
    match: (path) => path.startsWith("/dashboard/surveys"),
    icon: <HiOutlineClipboardDocumentList />,
  },
  {
    label: "Logs",
    href: "/dashboard/logs",
    match: (path) => path.startsWith("/dashboard/logs"),
    icon: <HiOutlineDocumentText />,
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 grid gap-3 max-[768px]:grid-cols-2 max-[640px]:grid-cols-1">
      {navItems.map((item) => {
        const isActive = item.match(pathname ?? "/");
        return (
          <Link
            key={item.href}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              isActive
                ? "border-[color:var(--accent)] bg-[color:var(--surface-strong)] text-[color:var(--accent-strong)] shadow-[0_10px_26px_rgba(130,65,0,0.2)]"
                : "border-transparent text-[color:var(--foreground)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface)]"
            }`}
            href={item.href}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
