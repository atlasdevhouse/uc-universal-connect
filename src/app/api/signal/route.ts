import { NextResponse } from "next/server";

// WebRTC signaling endpoint
// Devices POST offers/answers/ICE candidates here
// Viewers GET them to establish P2P connection

interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate";
  deviceId: string;
  viewerId?: string;
  payload: unknown;
  timestamp: number;
}

const signals: SignalMessage[] = [];

export async function POST(req: Request) {
  const msg: SignalMessage = await req.json();
  msg.timestamp = Date.now();
  signals.push(msg);
  
  // Keep only last 100 signals
  if (signals.length > 100) signals.splice(0, signals.length - 100);
  
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  const since = parseInt(url.searchParams.get("since") || "0");
  
  const filtered = signals.filter(s => 
    (!deviceId || s.deviceId === deviceId) && s.timestamp > since
  );
  
  return NextResponse.json(filtered);
}
