import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const ADMIN_CHAT_ID = "2102262384";

async function sendTelegram(chatId: string, text: string) {
  if (!TG_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch { /* silent */ }
}

// Register
export async function POST(req: Request) {
  const { chatId, username } = await req.json();
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .single();

  if (existing) {
    if (existing.status === "pending") {
      return NextResponse.json({ error: "Account pending approval", status: "pending" }, { status: 403 });
    }
    if (existing.status === "suspended") {
      return NextResponse.json({ error: "Account suspended", status: "suspended" }, { status: 403 });
    }
    return NextResponse.json({ error: "Already registered", status: existing.status });
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ telegram_chat_id: chatId, telegram_username: username || null, display_name: username || chatId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendTelegram(ADMIN_CHAT_ID,
    `🆕 <b>UC - NEW USER REGISTRATION</b>\n\n` +
    `<b>Chat ID:</b> ${chatId}\n` +
    `<b>Username:</b> ${username || "N/A"}\n` +
    `<b>Status:</b> Pending Approval\n\n` +
    `Approve at your UC admin panel.`
  );

  return NextResponse.json({ ok: true, status: "pending", userId: data.id });
}
