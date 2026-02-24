"use client";
import { useState, useEffect } from "react";

export function useAuth() {
  const [role, setRole] = useState<"admin" | "user">("user");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split("; ").reduce((acc, c) => {
      const [k, v] = c.split("=");
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);
    setRole((cookies.uc_role as "admin" | "user") || "user");
    setUserId(cookies.uc_user_id || null);
    setUserEmail(cookies.uc_email || null);
    // Fetch subscription status based on user ID or other mechanism if not in cookie
    // For now, let's assume it's stored in a cookie. In a full system, this would be a lookup.
    setSubscription(cookies.uc_subscription || "free");

    setLoaded(true);
  }, []);

  return { role, userId, userEmail, subscription, loaded };
}
