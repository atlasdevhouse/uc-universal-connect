import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const ADMIN_CHAT_ID = "2102262384";

async function sendTelegram(chatId: string, text: string) {
  if (!TG_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch { /* silent */ }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("userId");

  // Trust server-side cookies, not client query params
  const role = req.cookies.get("uc_role")?.value || "user";
  const cookieUserId = req.cookies.get("uc_user_id")?.value || null;

  let query = supabase.from("devices").select("*").order("last_seen", { ascending: false });

  if (role === "admin") {
    // Admin may optionally filter by user
    if (requestedUserId) query = query.eq("user_id", requestedUserId);
  } else {
    // Non-admins are always restricted to their own devices
    if (!cookieUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    query = query.eq("user_id", cookieUserId);
  }

  const { data } = await query;

  const now = Date.now();
  const ONLINE_MS = 2 * 60 * 1000; // 2 min
  const AWAY_MS = 5 * 60 * 1000;   // 5 min

  const devices = (data || []).map((d) => {
    const seenAt = d.last_seen ? new Date(d.last_seen).getTime() : 0;
    const age = seenAt ? now - seenAt : Number.MAX_SAFE_INTEGER;

    let derivedStatus: "online" | "away" | "offline" = "offline";
    if (age <= ONLINE_MS) derivedStatus = "online";
    else if (age <= AWAY_MS) derivedStatus = "away";

    // If device was explicitly set offline, keep it offline
    const status = d.status === "offline" ? "offline" : derivedStatus;

    return {
      id: d.id,
      name: d.name,
      os: d.os,
      ip: d.ip,
      publicIp: d.public_ip,
      resolution: d.resolution,
      status,
      lastSeen: d.last_seen,
      userId: d.user_id,
      version: d.version,
    };
  });

  return NextResponse.json(devices);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { deviceId, name, os, ip, publicIp, resolution, userId, user, version, token } = body;
  if (!deviceId && !name) return NextResponse.json({ error: "deviceId or name required" }, { status: 400 });

  const id = deviceId || name;
  
  // Look up user by install token
  let dbUserId: number | null = null;
  let ownerInfo: { telegram_chat_id: string; subscription: string; display_name: string; telegram_username: string } | null = null;
  
  if (token) {
    const { data: tokenUser } = await supabase
      .from("users")
      .select("id, telegram_chat_id, subscription, display_name, telegram_username, status")
      .eq("install_token", token)
      .single();
    if (tokenUser && tokenUser.status === "active") {
      dbUserId = tokenUser.id;
      ownerInfo = tokenUser;
    }
  }

  // Check if new or reconnecting
  const { data: existing } = await supabase.from("devices").select("id, status, user_id").eq("id", id).single();
  const isNew = !existing;
  const wasOffline = existing && existing.status !== "online";
  
  // If device exists but no token provided, keep existing user_id
  if (!token && existing?.user_id) {
    dbUserId = existing.user_id;
    const { data: existingOwner } = await supabase
      .from("users")
      .select("telegram_chat_id, subscription, display_name, telegram_username")
      .eq("id", existing.user_id)
      .single();
    if (existingOwner) ownerInfo = existingOwner;
  }

  const { error } = await supabase.from("devices").upsert({
    id, name: name || id, os: os || "Unknown", ip: ip || "Unknown",
    public_ip: publicIp || null, resolution: resolution || "Unknown",
    status: "online", user_id: dbUserId, username: user || null,
    version: version || "1.0", last_seen: new Date().toISOString(),
    install_token: token || null,
  }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send notifications on new connection or reconnection
  if (isNew || wasOffline) {
    const emoji = isNew ? "🆕" : "🟢";
    const action = isNew ? "NEW DEVICE CONNECTED" : "DEVICE RECONNECTED";
    const ownerLabel = ownerInfo ? (ownerInfo.display_name || ownerInfo.telegram_username || "Unknown") : "Unassigned";
    
    // Admin notification (always, with owner info)
    const adminMsg = `${emoji} <b>UC - ${action}</b>\n\n` +
      `<b>Name:</b> ${name || id}\n` +
      `<b>OS:</b> ${os || "Unknown"}\n` +
      `<b>Local IP:</b> ${ip || "Unknown"}\n` +
      `<b>Public IP:</b> ${publicIp || "Unknown"}\n` +
      `<b>Resolution:</b> ${resolution || "Unknown"}\n` +
      `<b>Owner:</b> ${ownerLabel}\n` +
      `<b>Version:</b> ${version || "1.0"}`;
    await sendTelegram(ADMIN_CHAT_ID, adminMsg);
    
    // Owner notification (only for active subscribers with basic or pro)
    if (ownerInfo && ownerInfo.telegram_chat_id !== ADMIN_CHAT_ID) {
      if (ownerInfo.subscription === "basic" || ownerInfo.subscription === "pro") {
        const userMsg = `${emoji} <b>${action}</b>\n\n` +
          `<b>Device:</b> ${name || id}\n` +
          `<b>OS:</b> ${os || "Unknown"}\n` +
          `<b>IP:</b> ${publicIp || ip || "Unknown"}\n` +
          `<b>Status:</b> Online\n\n` +
          `View at: https://uc-universal-connect-omega.vercel.app/dashboard`;
        await sendTelegram(ownerInfo.telegram_chat_id, userMsg);
      }
    }
  }

  return NextResponse.json({ ok: true, deviceId: id });
}

// Terminate device connection (full removal by default)
export async function DELETE(req: NextRequest) {
  const role = req.cookies.get("uc_role")?.value || "user";
  const cookieUserId = req.cookies.get("uc_user_id")?.value || null;

  const { deviceId, hardDelete = true } = await req.json();
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

  // Fetch target device and owner for authorization + notifications
  const { data: device } = await supabase
    .from("devices")
    .select("id, name, user_id, users!devices_user_id_fkey(telegram_chat_id, subscription, display_name)")
    .eq("id", deviceId)
    .single();

  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  // Authorization: admin or owner only
  if (role !== "admin") {
    if (!cookieUserId || String(device.user_id) !== String(cookieUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (hardDelete) {
    // Best-effort cleanup of related rows
    await supabase.from("screenshots").delete().eq("device_id", deviceId);
    await supabase.from("commands").delete().eq("device_id", deviceId);
    const { error: deleteErr } = await supabase.from("devices").delete().eq("id", deviceId);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  } else {
    const { error: offlineErr } = await supabase
      .from("devices")
      .update({ status: "offline", last_seen: new Date().toISOString() })
      .eq("id", deviceId);
    if (offlineErr) return NextResponse.json({ error: offlineErr.message }, { status: 500 });
  }

  // Notify admin
  await sendTelegram(
    ADMIN_CHAT_ID,
    `🔴 <b>UC - DEVICE ${hardDelete ? "TERMINATED" : "DISCONNECTED"}</b>\n\n<b>Device:</b> ${device?.name || deviceId}`
  );

  // Notify owner if subscribed
  const owner = Array.isArray(device?.users) ? device.users[0] : device?.users;
  if (owner && owner.telegram_chat_id !== ADMIN_CHAT_ID) {
    if (owner.subscription === "basic" || owner.subscription === "pro") {
      await sendTelegram(
        owner.telegram_chat_id,
        `🔴 <b>DEVICE ${hardDelete ? "TERMINATED" : "DISCONNECTED"}</b>\n\n<b>Device:</b> ${device.name || deviceId}\n<b>Status:</b> ${hardDelete ? "Removed" : "Offline"}`
      );
    }
  }

  return NextResponse.json({ ok: true, deleted: hardDelete });
}
