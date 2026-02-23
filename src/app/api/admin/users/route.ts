import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: users } = await supabase.from("users").select("*").order("id", { ascending: false });
  const { data: devices } = await supabase.from("devices").select("id, status");
  
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => u.status === "active").length || 0;
  const pendingUsers = users?.filter(u => u.status === "pending").length || 0;
  const totalDevices = devices?.length || 0;
  const onlineDevices = devices?.filter(d => d.status === "online").length || 0;

  return NextResponse.json({
    stats: { totalUsers, activeUsers, pendingUsers, totalDevices, onlineDevices },
    users: users || [],
  });
}
