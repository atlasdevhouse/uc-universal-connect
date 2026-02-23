import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const { data } = await supabase
    .from("users")
    .select("install_token")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ token: data.install_token });
}
