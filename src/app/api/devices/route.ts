import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("last_seen", { ascending: false });

  if (error) return NextResponse.json([], { status: 200 });
  
  // Map DB fields to frontend format
  const devices = (data || []).map(d => ({
    id: d.id,
    name: d.name,
    os: d.os,
    ip: d.ip,
    resolution: d.resolution,
    status: d.status,
    lastSeen: d.last_seen,
  }));
  
  return NextResponse.json(devices);
}

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "2102262384";

async function sendTelegram(text: string) {
  if (!TG_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch { /* silent */ }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { deviceId, name, os, ip, publicIp, resolution, userId, user, version } = body;
  
  if (!deviceId && !name) {
    return NextResponse.json({ error: "deviceId or name required" }, { status: 400 });
  }

  const id = deviceId || name;
  
  // Check if device exists and was offline/new
  const { data: existing } = await supabase
    .from("devices")
    .select("id, status")
    .eq("id", id)
    .single();
  
  const isNew = !existing;
  const wasOffline = existing && existing.status !== "online";
  
  const { error } = await supabase
    .from("devices")
    .upsert({
      id,
      name: name || id,
      os: os || "Unknown",
      ip: ip || "Unknown",
      public_ip: publicIp || null,
      resolution: resolution || "Unknown",
      status: "online",
      user_id: userId || "jay",
      username: user || null,
      version: version || "1.0",
      last_seen: new Date().toISOString(),
    }, { onConflict: "id" });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Send Telegram notification for new or reconnected devices
  if (isNew || wasOffline) {
    const emoji = isNew ? "🆕" : "🟢";
    const action = isNew ? "NEW DEVICE CONNECTED" : "DEVICE RECONNECTED";
    await sendTelegram(
      `${emoji} <b>UC - ${action}</b>\n\n` +
      `<b>Name:</b> ${name || id}\n` +
      `<b>OS:</b> ${os || "Unknown"}\n` +
      `<b>Local IP:</b> ${ip || "Unknown"}\n` +
      `<b>Public IP:</b> ${publicIp || "Unknown"}\n` +
      `<b>Resolution:</b> ${resolution || "Unknown"}\n` +
      `<b>User:</b> ${user || userId || "Unknown"}\n` +
      `<b>Version:</b> ${version || "1.0"}`
    );
  }
  
  return NextResponse.json({ ok: true, deviceId: id });
}

export async function DELETE(req: Request) {
  const { deviceId } = await req.json();
  await supabase
    .from("devices")
    .update({ status: "offline", last_seen: new Date().toISOString() })
    .eq("id", deviceId);
  return NextResponse.json({ ok: true });
}
