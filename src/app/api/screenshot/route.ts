import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { deviceId, image } = await req.json();
  if (!deviceId || !image) {
    return NextResponse.json({ error: "deviceId and image required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("screenshots")
    .upsert({
      device_id: deviceId,
      image,
      timestamp: Date.now(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "device_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("screenshots")
    .select("image, timestamp")
    .eq("device_id", deviceId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "no screenshot" }, { status: 404 });
  }

  return NextResponse.json(data);
}
