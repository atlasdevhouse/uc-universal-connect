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

// Cron-callable: marks stale devices offline and notifies owners
export async function GET() {
  const cutoff = new Date(Date.now() - 60000).toISOString(); // 60s stale threshold
  
  const { data: staleDevices } = await supabase
    .from("devices")
    .select("id, name, user_id, status")
    .eq("status", "online")
    .lt("last_seen", cutoff);
  
  if (!staleDevices || staleDevices.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }
  
  const staleIds = staleDevices.map(d => d.id);
  await supabase.from("devices").update({ status: "offline" }).in("id", staleIds);
  
  // Notify for each stale device
  for (const device of staleDevices) {
    await sendTelegram(ADMIN_CHAT_ID, `🔴 <b>UC - DEVICE WENT OFFLINE</b>\n\n<b>Device:</b> ${device.name || device.id}\n<b>Reason:</b> No heartbeat for 60s`);
    
    if (device.user_id) {
      const { data: owner } = await supabase
        .from("users")
        .select("telegram_chat_id, subscription")
        .eq("id", device.user_id)
        .single();
      if (owner && owner.telegram_chat_id !== ADMIN_CHAT_ID && (owner.subscription === "basic" || owner.subscription === "pro")) {
        await sendTelegram(owner.telegram_chat_id, `🔴 <b>DEVICE OFFLINE</b>\n\n<b>Device:</b> ${device.name || device.id}\n<b>Status:</b> No heartbeat detected`);
      }
    }
  }
  
  return NextResponse.json({ ok: true, marked: staleDevices.length });
}
