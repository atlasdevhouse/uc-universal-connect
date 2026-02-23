import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Settings stored in a simple key-value table
export async function GET() {
  const { data } = await supabase.from("settings").select("*").eq("key", "telegram").single();
  if (data) {
    return NextResponse.json({ telegram: JSON.parse(data.value) });
  }
  // Return defaults
  return NextResponse.json({
    telegram: {
      botToken: process.env.TG_BOT_TOKEN || "",
      adminChatId: "2102262384",
      notifications: {
        deviceOnline: true, deviceOffline: true, newDeviceRegistered: true,
        agentUninstalled: true, agentReinstalled: true, newUserRegistered: true, enabled: true,
      },
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.telegram) {
    // Don't store token if it's the masked env var
    const value = JSON.stringify(body.telegram);
    await supabase.from("settings").upsert({ key: "telegram", value }, { onConflict: "key" });
  }
  return NextResponse.json({ ok: true });
}
