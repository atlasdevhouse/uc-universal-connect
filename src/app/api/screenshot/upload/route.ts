import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Compatibility route for agents posting to /api/screenshot/upload
export async function POST(req: Request) {
  const body = await req.json();

  const deviceId = body.deviceId ?? body.device_id ?? body.machineName ?? body.machine_name;
  const image = body.image ?? body.screenshot ?? body.frame;

  if (!deviceId || !image) {
    return NextResponse.json(
      { error: "deviceId and image required", receivedKeys: Object.keys(body || {}) },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("screenshots")
    .upsert(
      {
        device_id: String(deviceId),
        image: String(image),
        timestamp: Date.now(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, route: "/api/screenshot/upload" });
}
