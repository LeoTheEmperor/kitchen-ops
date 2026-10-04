"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-800">Fernleaf Kitchen</h1>
        <p className="mt-2 text-sm text-neutral-500">Loading...</p>
      </div>
    </main>
  );
}
