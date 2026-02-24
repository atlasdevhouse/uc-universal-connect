import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data } = await supabase
    .from("users")
    .select("install_token")
    .eq("id", userId)
    .single();

  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ token: data.install_token });
}
