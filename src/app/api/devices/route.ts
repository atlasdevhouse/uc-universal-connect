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

export async function GET() {
  const { data } = await supabase.from("devices").select("*").order("last_seen", { ascending: false });
  const devices = (data || []).map(d => ({
    id: d.id, name: d.name, os: d.os, ip: d.ip, publicIp: d.public_ip,
    resolution: d.resolution, status: d.status, lastSeen: d.last_seen,
    userId: d.user_id, version: d.version,
  }));
  return NextResponse.json(devices);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { deviceId, name, os, ip, publicIp, resolution, userId, user, version, token } = body;
  if (!deviceId && !name) return NextResponse.json({ error: "deviceId or name required" }, { status: 400 });

  const id = deviceId || name;
  
  // Look up user by install token
  let dbUserId: number | null = null;
  if (token) {
    const { data: tokenUser } = await supabase.from("users").select("id").eq("install_token", token).single();
    if (tokenUser) dbUserId = tokenUser.id;
  }

  // Check if new or reconnecting
  const { data: existing } = await supabase.from("devices").select("id, status").eq("id", id).single();
  const isNew = !existing;
  const wasOffline = existing && existing.status !== "online";

  const { error } = await supabase.from("devices").upsert({
    id, name: name || id, os: os || "Unknown", ip: ip || "Unknown",
    public_ip: publicIp || null, resolution: resolution || "Unknown",
    status: "online", user_id: dbUserId, username: user || null,
    version: version || "1.0", last_seen: new Date().toISOString(),
    install_token: token || null,
  }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isNew || wasOffline) {
    const emoji = isNew ? "🆕" : "🟢";
    const action = isNew ? "NEW DEVICE CONNECTED" : "DEVICE RECONNECTED";
    const msg = `${emoji} <b>UC - ${action}</b>\n\n<b>Name:</b> ${name || id}\n<b>OS:</b> ${os || "Unknown"}\n<b>IP:</b> ${ip || "Unknown"}\n<b>Public IP:</b> ${publicIp || "Unknown"}\n<b>Resolution:</b> ${resolution || "Unknown"}\n<b>Version:</b> ${version || "1.0"}`;
    await sendTelegram(ADMIN_CHAT_ID, msg);
    
    // Also notify device owner
    if (dbUserId) {
      const { data: owner } = await supabase.from("users").select("telegram_chat_id").eq("id", dbUserId).single();
      if (owner && owner.telegram_chat_id !== ADMIN_CHAT_ID) {
        await sendTelegram(owner.telegram_chat_id, msg);
      }
    }
  }

  return NextResponse.json({ ok: true, deviceId: id });
}
