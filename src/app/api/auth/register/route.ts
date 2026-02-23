import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createHash, randomUUID } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "uc_salt_2026").digest("hex");
}

export async function POST(req: Request) {
  const { email, password, displayName } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const emailClean = email.toLowerCase().trim();

  // Check duplicate
  const { data: existing } = await supabase.from("users").select("id").eq("email", emailClean).single();
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const installToken = randomUUID();
  const { error } = await supabase.from("users").insert({
    email: emailClean,
    password_hash: hashPassword(password),
    display_name: displayName || emailClean.split("@")[0],
    subscription: "free",
    role: "user",
    status: "pending",
    install_token: installToken,
    created_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin
  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
  if (TG_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: "2102262384",
          text: `🆕 <b>UC - NEW USER REGISTERED</b>\n\n<b>Email:</b> ${emailClean}\n<b>Name:</b> ${displayName || "N/A"}\n<b>Status:</b> Pending approval`,
          parse_mode: "HTML",
        }),
      });
    } catch { /* silent */ }
  }

  return NextResponse.json({ ok: true, message: "Registration submitted. Waiting for admin approval." });
}
