"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    getMe(token)
      .then((me) => setUser(me))
      .catch(() => {
        localStorage.removeItem("token");
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <main className="p-6">Loading...</main>;
  if (!user) return null;

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2">Signed in as {user.email}</p>

      {/* Role-based rendering: different users see different things */}
      {user.role === "ADMIN" ? (
        <div className="mt-4 rounded border border-amber-400 bg-amber-50 p-4">
          Admin panel — visible only to ADMIN role.
        </div>
      ) : (
        <div className="mt-4 rounded border p-4">
          Standard user view.
        </div>
      )}
    </main>
  );
}
