import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID, createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "uc_salt_2026").digest("hex");
}

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
  const { email, password, displayName, telegramChatId, subscription, role } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const emailClean = email.toLowerCase().trim();

  // Check duplicate
  const { data: existing } = await supabase.from("users").select("id").eq("email", emailClean).single();
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const installToken = randomUUID();
  const { error } = await supabase.from("users").insert({
    email: emailClean,
    password_hash: hashPassword(password),
    display_name: displayName || emailClean.split("@")[0],
    telegram_chat_id: telegramChatId || null,
    subscription: subscription || "free",
    role: role || "user",
    status: "active",
    install_token: installToken,
    created_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
  if (TG_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: "2102262384",
          text: `✅ <b>UC - USER CREATED BY ADMIN</b>\n\n<b>Email:</b> ${emailClean}\n<b>Name:</b> ${displayName || "N/A"}\n<b>Subscription:</b> ${subscription || "free"}\n<b>Install Token:</b> <code>${installToken}</code>`,
          parse_mode: "HTML",
        }),
      });
    } catch { /* silent */ }
  }

  // If Telegram chat ID provided, notify user too
  if (telegramChatId && TG_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `✅ <b>UC - ACCOUNT CREATED</b>\n\nWelcome to Universal Connect!\n\nLogin at:\n🔗 https://uc-universal-connect-omega.vercel.app/login`,
          parse_mode: "HTML",
        }),
      });
    } catch { /* silent */ }
  }

  return NextResponse.json({ ok: true, installToken });
}
