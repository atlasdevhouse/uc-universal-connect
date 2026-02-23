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

export async function POST(req: Request) {
  const body = await req.json();
  const { deviceId, name, os, ip, publicIp, resolution, userId, user, version } = body;
  
  if (!deviceId && !name) {
    return NextResponse.json({ error: "deviceId or name required" }, { status: 400 });
  }

  const id = deviceId || name;
  
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
