import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "uc_salt_2026").digest("hex");
}

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const { data: user } = await supabase
    .from("users")
    .select("id, role, status, password_hash, display_name")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  if (user.password_hash !== hashPassword(password)) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  if (user.status === "pending") return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
  if (user.status === "suspended") return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  // Update last login
  await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

  const res = NextResponse.json({ ok: true, role: user.role, userId: user.id, name: user.display_name });
  res.cookies.set("uc_user_id", String(user.id), { path: "/", maxAge: 86400 * 30 });
  res.cookies.set("uc_role", user.role, { path: "/", maxAge: 86400 * 30 });
  res.cookies.set("uc_email", email.toLowerCase().trim(), { path: "/", maxAge: 86400 * 30 });
  return res;
}
