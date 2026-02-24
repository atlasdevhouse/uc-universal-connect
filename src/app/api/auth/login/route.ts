import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "uc_salt_2026").digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json();

  // Admin login via Chat ID
  if (body.chatId) {
    const { data: user } = await supabase
      .from("users")
      .select("id, role, status, display_name, subscription") // Added subscription
      .eq("telegram_chat_id", body.chatId)
      .eq("role", "admin")
      .single();

    if (!user) return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
    if (user.status !== "active") return NextResponse.json({ error: "Account not active" }, { status: 403 });

    await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

    const res = NextResponse.json({ ok: true, role: "admin", userId: user.id, name: user.display_name, subscription: user.subscription });
    res.cookies.set("uc_user_id", String(user.id), { path: "/", maxAge: 86400 * 30 });
    res.cookies.set("uc_role", "admin", { path: "/", maxAge: 86400 * 30 });
    res.cookies.set("uc_chat_id", body.chatId, { path: "/", maxAge: 86400 * 30 });
    res.cookies.set("uc_subscription", user.subscription, { path: "/", maxAge: 86400 * 30 }); // Added subscription cookie
    return res;
  }

  // User login via email + password
  const { email, password } = body;
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const { data: user } = await supabase
    .from("users")
    .select("id, role, status, password_hash, display_name, subscription") // Added subscription
    .eq("email", email.toLowerCase().trim())
    .single();

  if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  if (!user.password_hash) return NextResponse.json({ error: "Account not set up for email login" }, { status: 401 });
  if (user.password_hash !== hashPassword(password)) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  if (user.status === "pending") return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
  if (user.status === "suspended") return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

  const res = NextResponse.json({ ok: true, role: user.role, userId: user.id, name: user.display_name, subscription: user.subscription });
  res.cookies.set("uc_user_id", String(user.id), { path: "/", maxAge: 86400 * 30 });
  res.cookies.set("uc_role", user.role, { path: "/", maxAge: 86400 * 30 });
  res.cookies.set("uc_email", email.toLowerCase().trim(), { path: "/", maxAge: 86400 * 30 });
  res.cookies.set("uc_subscription", user.subscription, { path: "/", maxAge: 86400 * 30 }); // Added subscription cookie
  return res;
}
