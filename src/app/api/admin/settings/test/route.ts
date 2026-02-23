import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  // Get saved settings or use env defaults
  let botToken = process.env.TG_BOT_TOKEN || "";
  let chatId = "2102262384";

  const { data } = await supabase.from("settings").select("value").eq("key", "telegram").single();
  if (data) {
    const parsed = JSON.parse(data.value);
    if (parsed.botToken) botToken = parsed.botToken;
    if (parsed.adminChatId) chatId = parsed.adminChatId;
  }

  if (!botToken) return NextResponse.json({ error: "No bot token configured" }, { status: 400 });

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🧪 <b>UC - TEST NOTIFICATION</b>\n\nTelegram notifications are working correctly!",
        parse_mode: "HTML",
      }),
    });
    const result = await res.json();
    if (!result.ok) return NextResponse.json({ error: result.description }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
