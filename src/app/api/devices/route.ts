import { NextResponse } from "next/server";

// Connected devices registry (in-memory, replace with DB)
interface Device {
  id: string;
  name: string;
  os: string;
  ip: string;
  resolution: string;
  status: "online" | "away" | "offline";
  lastSeen: string;
  userId: string;
}

const devices: Map<string, Device> = new Map();

// GET — list devices for user
export async function GET() {
  return NextResponse.json(Array.from(devices.values()));
}

// POST — register/heartbeat from Windows agent
export async function POST(req: Request) {
  const body = await req.json();
  const { deviceId, name, os, ip, resolution, userId } = body;
  
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }
  
  devices.set(deviceId, {
    id: deviceId,
    name: name || deviceId,
    os: os || "Unknown",
    ip: ip || "Unknown",
    resolution: resolution || "Unknown",
    status: "online",
    lastSeen: new Date().toISOString(),
    userId: userId || "default",
  });
  
  return NextResponse.json({ ok: true, deviceId });
}

// DELETE — device disconnect
export async function DELETE(req: Request) {
  const { deviceId } = await req.json();
  const device = devices.get(deviceId);
  if (device) {
    device.status = "offline";
    device.lastSeen = new Date().toISOString();
  }
  return NextResponse.json({ ok: true });
}
