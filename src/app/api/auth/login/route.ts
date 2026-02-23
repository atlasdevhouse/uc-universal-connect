import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { chatId } = await req.json();
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!user) return NextResponse.json({ error: "Not registered. Register first." }, { status: 404 });
  if (user.status === "pending") return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
  if (user.status === "suspended") return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

  const res = NextResponse.json({ ok: true, role: user.role, userId: user.id });
  res.cookies.set("uc_chat_id", chatId, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 86400 * 30 });
  res.cookies.set("uc_role", user.role, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 86400 * 30 });
  res.cookies.set("uc_user_id", String(user.id), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 86400 * 30 });
  return res;
}
