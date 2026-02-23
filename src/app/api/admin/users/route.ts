import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function GET() {
  const { data: users } = await supabase.from("users").select("*").order("id", { ascending: false });
  const { data: devices } = await supabase.from("devices").select("id, status");
  
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => u.status === "active").length || 0;
  const pendingUsers = users?.filter(u => u.status === "pending").length || 0;
  const totalDevices = devices?.length || 0;
  const onlineDevices = devices?.filter(d => d.status === "online").length || 0;

  return NextResponse.json({
    stats: { totalUsers, activeUsers, pendingUsers, totalDevices, onlineDevices },
    users: users || [],
  });
}

export async function POST(req: Request) {
  const { chatId, username, displayName, subscription, role } = await req.json();
  if (!chatId) return NextResponse.json({ error: "Chat ID required" }, { status: 400 });

  // Check duplicate
  const { data: existing } = await supabase.from("users").select("id").eq("telegram_chat_id", chatId).single();
  if (existing) return NextResponse.json({ error: "User with this Chat ID already exists" }, { status: 409 });

  const installToken = randomUUID();
  const { error } = await supabase.from("users").insert({
    telegram_chat_id: chatId,
    telegram_username: username || null,
    display_name: displayName || username || null,
    subscription: subscription || "free",
    role: role || "user",
    status: "active",
    install_token: installToken,
    created_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify new user via Telegram
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
  if (TG_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ <b>UC - ACCOUNT CREATED</b>\n\nWelcome to Universal Connect!\n\n<b>Your Install Token:</b>\n<code>${installToken}</code>\n\nLogin at:\n🔗 https://uc-universal-connect-omega.vercel.app/login`,
          parse_mode: "HTML",
        }),
      });
    } catch { /* silent */ }
  }

  return NextResponse.json({ ok: true, installToken });
}
