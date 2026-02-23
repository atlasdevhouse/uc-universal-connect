import { NextResponse } from "next/server";

// Relay input commands to device
// Dashboard POSTs commands, agent polls for them
const commandQueue: Map<string, Array<{ action: string; data: Record<string, unknown>; id: string }>> = new Map();

// Dashboard sends a command
export async function POST(req: Request) {
  const { deviceId, action, data } = await req.json();
  if (!deviceId || !action) {
    return NextResponse.json({ error: "deviceId and action required" }, { status: 400 });
  }
  if (!commandQueue.has(deviceId)) commandQueue.set(deviceId, []);
  const id = Date.now().toString(36);
  commandQueue.get(deviceId)!.push({ action, data: data || {}, id });
  // Keep max 50 commands
  const q = commandQueue.get(deviceId)!;
  if (q.length > 50) q.splice(0, q.length - 50);
  return NextResponse.json({ ok: true, commandId: id });
}

// Agent polls for commands
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }
  const commands = commandQueue.get(deviceId) || [];
  commandQueue.set(deviceId, []); // Clear after read
  return NextResponse.json(commands);
}
