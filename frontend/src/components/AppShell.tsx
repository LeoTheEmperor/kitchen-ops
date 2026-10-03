"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Me } from "@/lib/api";
import { logout } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  KITCHEN: "Kitchen",
  DISPATCH: "Dispatch",
  DRIVER: "Driver",
};

export function AppShell({ user, children }: { user: Me; children: ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div>
          <span className="font-semibold">Fernleaf Kitchen</span>
          <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-600">
          <span>{user.name}</span>
          <button onClick={() => logout(router)} className="rounded border px-3 py-1 hover:bg-neutral-100">
            Sign out
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}