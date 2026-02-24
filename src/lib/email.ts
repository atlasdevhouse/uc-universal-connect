import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string; // SMTP authentication username (e.g., 'apikey')
  pass: string; // SMTP authentication password (API key)
  fromAddress: string; // The actual email address used in the 'From:' header
}

async function getSmtpConfig(userId: number, subscription: string): Promise<SmtpConfig | null> {
  // Premium users use global SMTP config (from environment variables)
  if (subscription === "basic" || subscription === "pro") {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true"; // This was false
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromAddress = process.env.FROM_EMAIL_ADDRESS;

    console.log("DEBUG: SMTP Environment Variables:");
    console.log(`DEBUG: SMTP_HOST: ${host ? 'set' : 'NOT SET'}`);
    console.log(`DEBUG: SMTP_PORT: ${port ? 'set' : 'NOT SET'}`);
    console.log(`DEBUG: SMTP_SECURE: ${process.env.SMTP_SECURE} (evaluated as ${secure})`);
    console.log(`DEBUG: SMTP_USER: ${user ? 'set' : 'NOT SET'}`);
    console.log(`DEBUG: SMTP_PASS: ${pass ? 'set' : 'NOT SET' ? 'length='+ pass.length : 'NOT SET' }`); // Avoid logging full pass
    console.log(`DEBUG: FROM_EMAIL_ADDRESS: ${fromAddress ? 'set' : 'NOT SET'}`);

    if (!host || !user || !pass || !fromAddress) {
      console.warn("Global SMTP configuration is incomplete. Critical check failed."); // Added 'Critical check failed' to distinguish
      return null; 
    }
    return { host, port, secure, user, pass, fromAddress };
  }

  // Free tier users must provide their own SMTP settings
  const { data, error } = await supabase
    .from("user_settings")
    .select("setting_value")
    .eq("user_id", userId)
    .eq("setting_key", "smtp_config")
    .maybeSingle();

  if (error || !data?.setting_value) {
    console.warn(`User ${userId} (free tier) has no SMTP settings configured.`);
    return null;
  }

  const userSmtpConfig = data.setting_value as SmtpConfig;
  // For free users, their configured 'user' is also their 'fromAddress'
  if (!userSmtpConfig.host || !userSmtpConfig.user || !userSmtpConfig.pass) {
    return null;
  }
  return { ...userSmtpConfig, fromAddress: userSmtpConfig.user }; // Use their SMTP user as fromAddress
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  html: string,
  attachmentFilename: string,
  attachmentContent: Buffer | string,
  userId: number,
  subscription: string
): Promise<{ success: boolean; message?: string }> {
  const smtpConfig = await getSmtpConfig(userId, subscription);
  if (!smtpConfig) {
    return { success: false, message: "SMTP configuration is missing or incomplete." };
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: { rejectUnauthorized: false } // Needed for some SMTP servers, but generally recommend `true` for security
  });

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: `UC Universal Connect <${smtpConfig.fromAddress}>`, // <-- Use the correct fromAddress here
      to,
      subject,
      html,
      attachments: [
        {
          filename: attachmentFilename,
          content: attachmentContent,
          contentType: "text/plain", // C# source code
        },
      ],
    });
    console.log("Email sent: %s", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, message: `Failed to send email: ${(error as Error).message}` };
  }
}
