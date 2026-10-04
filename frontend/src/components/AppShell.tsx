"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Me } from "@/lib/api";
import { logout } from "@/lib/auth";

const NAV_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/orders", label: "Orders" },
    { href: "/kitchen", label: "Kitchen Board" },
    { href: "/dispatch", label: "Dispatch Board" },
  ],
  KITCHEN: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/kitchen", label: "Kitchen Board" },
  ],
  DISPATCH: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dispatch", label: "Dispatch Board" },
  ],
  DRIVER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/driver", label: "My Deliveries" },
  ],
};

const ROLE_BADGES: Record<string, { label: string; style: string }> = {
  ADMIN: { label: "Admin", style: "bg-purple-100 text-purple-900 border-purple-200" },
  KITCHEN: { label: "Kitchen", style: "bg-amber-100 text-amber-900 border-amber-200" },
  DISPATCH: { label: "Dispatch", style: "bg-blue-100 text-blue-900 border-blue-200" },
  DRIVER: { label: "Driver", style: "bg-emerald-100 text-emerald-900 border-emerald-200" },
};

export function AppShell({ user, children }: { user: Me; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const roleConfig = ROLE_BADGES[user.role] ?? { label: user.role, style: "bg-slate-100 text-slate-900 border-slate-200" };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-xs">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-xs">
              🍃
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-base">Fernleaf Kitchen</span>
            <span className={`ml-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${roleConfig.style}`}>
              {roleConfig.label}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {(NAV_BY_ROLE[user.role] ?? []).map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-800 font-semibold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-slate-800">{user.name}</span>
          </div>
          <button
            onClick={() => logout(router)}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6 lg:p-8">{children}</main>
    </div>
  );
}
