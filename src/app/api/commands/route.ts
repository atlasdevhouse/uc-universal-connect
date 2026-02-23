import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { deviceId, action, data } = await req.json();
  if (!deviceId || !action) {
    return NextResponse.json({ error: "deviceId and action required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("commands")
    .insert({ device_id: deviceId, action, data: data || {} });

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
    .from("commands")
    .select("id, action, data")
    .eq("device_id", deviceId)
    .eq("consumed", false)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json([], { status: 200 });

  // Mark as consumed
  if (data && data.length > 0) {
    const ids = data.map(c => c.id);
    await supabase.from("commands").update({ consumed: true }).in("id", ids);
  }

  return NextResponse.json(data || []);
}
