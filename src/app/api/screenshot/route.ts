import { NextResponse } from "next/server";

// Screenshot relay - agent POSTs screenshots here, dashboard GETs them
// Stored in memory per device (replaced each frame)
const screenshots: Map<string, { image: string; timestamp: number }> = new Map();

// Agent uploads a screenshot
export async function POST(req: Request) {
  const { deviceId, image } = await req.json();
  if (!deviceId || !image) {
    return NextResponse.json({ error: "deviceId and image required" }, { status: 400 });
  }
  screenshots.set(deviceId, { image, timestamp: Date.now() });
  return NextResponse.json({ ok: true });
}

// Dashboard fetches latest screenshot
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }
  const frame = screenshots.get(deviceId);
  if (!frame) {
    return NextResponse.json({ error: "no screenshot available" }, { status: 404 });
  }
  return NextResponse.json(frame);
}
