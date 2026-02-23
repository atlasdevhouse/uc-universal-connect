"use client";
import { useState, useEffect } from "react";

export function useAuth() {
  const [role, setRole] = useState<"admin" | "user">("user");
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split("; ").reduce((acc, c) => {
      const [k, v] = c.split("=");
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);
    setRole((cookies.uc_role as "admin" | "user") || "user");
    setUserId(cookies.uc_user_id || null);
    setLoaded(true);
  }, []);

  return { role, userId, loaded };
}
