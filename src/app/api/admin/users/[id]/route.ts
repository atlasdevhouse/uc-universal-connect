import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";

async function sendTelegram(chatId: string, text: string) {
  if (!TG_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch { /* silent */ }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.subscription) updates.subscription = body.subscription;
  if (body.role) updates.role = body.role;

  // Get user before update to check state changes
  const { data: userBefore } = await supabase.from("users").select("*").eq("id", id).single();

  const { error } = await supabase.from("users").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send Telegram notifications for status/subscription changes
  if (userBefore) {
    const chatId = userBefore.telegram_chat_id;
    
    // User activated (approved)
    if (body.status === "active" && userBefore.status === "pending") {
      await sendTelegram(chatId,
        `✅ <b>UC - ACCOUNT APPROVED</b>\n\n` +
        `Welcome to Universal Connect!\n\n` +
        `Your account has been activated. You can now:\n` +
        `• Login at the dashboard\n` +
        `• Deploy agents on your PCs\n` +
        `• Monitor devices remotely\n\n` +
        `🔗 https://uc-universal-connect-omega.vercel.app/login`
      );
    }
    
    // User suspended
    if (body.status === "suspended" && userBefore.status !== "suspended") {
      await sendTelegram(chatId,
        `⚠️ <b>UC - ACCOUNT SUSPENDED</b>\n\nYour UC account has been suspended. Contact admin for details.`
      );
    }
    
    // User reactivated
    if (body.status === "active" && userBefore.status === "suspended") {
      await sendTelegram(chatId,
        `✅ <b>UC - ACCOUNT REACTIVATED</b>\n\nYour account is active again. Login at:\n🔗 https://uc-universal-connect-omega.vercel.app/login`
      );
    }
    
    // Subscription upgraded
    if (body.subscription && body.subscription !== userBefore.subscription) {
      const tierEmoji = body.subscription === "pro" ? "💎" : body.subscription === "basic" ? "⭐" : "🆓";
      await sendTelegram(chatId,
        `${tierEmoji} <b>UC - SUBSCRIPTION UPDATED</b>\n\n` +
        `<b>New Plan:</b> ${body.subscription.toUpperCase()}\n` +
        (body.subscription !== "free" ? `\nYou now receive Telegram alerts when your devices connect/disconnect.` : `\nUpgrade to Basic or Pro for Telegram device alerts.`)
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Notify user before deletion
  const { data: user } = await supabase.from("users").select("telegram_chat_id").eq("id", id).single();
  if (user) {
    await sendTelegram(user.telegram_chat_id, `❌ <b>UC - ACCOUNT REMOVED</b>\n\nYour UC account has been deleted.`);
  }
  
  await supabase.from("devices").update({ user_id: null }).eq("user_id", id);
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
