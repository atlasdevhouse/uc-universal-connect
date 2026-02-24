import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { promises as fs } from "fs";
import path from "path";

const VERCEL_APP_URL = process.env.VERCEL_APP_URL || "https://uc-universal-connect-omega.vercel.app";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const installToken = url.searchParams.get("token");

  if (!installToken) {
    return new NextResponse("Unauthorized. Install token required.", { status: 401 });
  }

  // Verify install token exists and is active
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, status")
    .eq("install_token", installToken)
    .single();

  if (userError || !user || user.status !== "active") {
    return new NextResponse("Unauthorized. Invalid or inactive install token.", { status: 401 });
  }

  try {
    const agentPath = path.join(process.cwd(), "agent", "UCAgent.cs");
    let agentCode = await fs.readFile(agentPath, "utf-8");

    // Replace placeholders
    agentCode = agentCode.replace(/##SERVER_URL##/g, VERCEL_APP_URL);
    agentCode = agentCode.replace(/##INSTALL_TOKEN##/g, installToken);

    return new NextResponse(agentCode, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="UCAgent_${installToken.substring(0, 8)}.cs"`,
      },
    });
  } catch (error) {
    console.error("Error generating agent file:", error);
    return new NextResponse("Error generating agent file.", { status: 500 });
  }
}
