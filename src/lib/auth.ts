import { cookies } from "next/headers";
import { supabase } from "./supabase";

export async function getSession() {
  const cookieStore = await cookies();
  const chatId = cookieStore.get("uc_chat_id")?.value;
  const role = cookieStore.get("uc_role")?.value;
  if (!chatId) return null;
  return { chatId, role: role || "user" };
}

export async function getUser() {
  const session = await getSession();
  if (!session) return null;
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", session.chatId)
    .single();
  return data;
}

export function isAdmin(user: { role: string } | null) {
  return user?.role === "admin";
}
