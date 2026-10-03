"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, Me, ApiError } from "./api";

// Shared "who's signed in" hook. Redirects to /login if there's no token or
// it's no longer valid; otherwise returns the decoded user so pages can
// branch on role without each repeating the same fetch/redirect boilerplate.
export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (!stored) {
      router.push("/login");
      return;
    }
    setToken(stored);
    getMe(stored)
      .then((me) => setUser(me))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem("token");
        }
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { user, token, loading };
}

export function logout(router: ReturnType<typeof useRouter>) {
  localStorage.removeItem("token");
  router.push("/login");
}