import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmailWithAttachment } from "@/lib/email";
import { promises as fs } from "fs";
import path from "path";

const VERCEL_APP_URL = process.env.VERCEL_APP_URL || "https://uc-universal-connect-omega.vercel.app";

export async function POST(req: Request) {
  const { userId, recipientEmail } = await req.json();

  if (!userId || !recipientEmail) {
    return NextResponse.json({ success: false, message: "User ID and recipient email required." }, { status: 400 });
  }

  // 1. Verify if user exists and has a premium subscription (basic or pro)
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("install_token, subscription, display_name")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    console.error("User not found or database error:", userError);
    return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  }

  if (user.subscription !== "basic" && user.subscription !== "pro") {
    return NextResponse.json({ success: false, message: "Subscription required to email agent." }, { status: 403 });
  }

  const installToken = user.install_token;
  if (!installToken) {
    return NextResponse.json({ success: false, message: "Install token not available for user." }, { status: 500 });
  }

  // 2. Generate customized C# agent source code
  let agentCode = "";
  try {
    const agentPath = path.join(process.cwd(), "agent", "UCAgent.cs");
    agentCode = await fs.readFile(agentPath, "utf-8");

    agentCode = agentCode.replace(/##SERVER_URL##/g, VERCEL_APP_URL);
    agentCode = agentCode.replace(/##INSTALL_TOKEN##/g, installToken);
  } catch (error) {
    console.error("Error reading or processing agent template:", error);
    return NextResponse.json({ success: false, message: "Failed to generate agent file." }, { status: 500 });
  }

  // 3. Send email with the generated source code attached
  const subject = "Your Custom UC Connect Agent Source Code";
  const htmlBody = `
    <p>Dear ${user.display_name || "User"},</p>
    <p>Thank you for being a ${user.subscription} subscriber to UC Universal Connect!</p>
    <p>As requested, attached is your customized C# agent source code (UCAgent_${installToken.substring(0, 8)}.cs).</p>
    <p>To deploy it, follow these steps:</p>
    <ol>
      <li>Save the attached <code>.cs</code> file to <code>C:\\UC\\agent.cs</code> on your Windows PC.</li>
      <li>Open Command Prompt (as Administrator) and run:</li>
      <li><code>C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /target:winexe /out:C:\\UC\\UCService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll /r:System.Web.Extensions.dll C:\\UC\\agent.cs</code></li>
      <li>Then run the compiled executable: <code>C:\\UC\\UCService.exe</code></li>
    </ol>
    <p>Your devices will appear in your dashboard automatically.</p>
    <p>Need support? Reply to this email or visit our <a href="${VERCEL_APP_URL}/support">support page</a>.</p>
    <p>Best regards,</p>
    <p>The Universal Connect Team</p>
  `;
  const attachmentFilename = `UCAgent_${installToken.substring(0, 8)}.cs`;

  const { success, message } = await sendEmailWithAttachment(
    recipientEmail,
    subject,
    htmlBody,
    attachmentFilename,
    Buffer.from(agentCode)
  );

  if (!success) {
    console.error("Failed to send email:", message);
    return NextResponse.json({ success: false, message: message || "Failed to send email." }, { status: 500 });
  }

  // Optionally, send a Telegram notification to the user that the email has been sent.
  // This would require fetching the user's telegram_chat_id and using sendTelegram().

  return NextResponse.json({ success: true, message: "Agent source code emailed successfully." });
}
