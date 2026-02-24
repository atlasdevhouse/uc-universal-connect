import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const settingKey = url.searchParams.get("settingKey");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }
  if (!settingKey) {
    return NextResponse.json({ error: "Setting key is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("setting_value")
    .eq("user_id", userId)
    .eq("setting_key", settingKey)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user setting:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ value: null }, { status: 200 });
  }

  return NextResponse.json({ value: data.setting_value });
}

export async function POST(req: Request) {
  const { userId, settingKey, settingValue } = await req.json();

  if (!userId || !settingKey || !settingValue) {
    return NextResponse.json({ error: "User ID, setting key, and setting value are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, setting_key: settingKey, setting_value: settingValue },
      { onConflict: "user_id, setting_key" }
    );

  if (error) {
    console.error("Error upserting user setting:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
