import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

async function getSmtpConfig(userId: number, subscription: string): Promise<SmtpConfig | null> {
  // Premium users use global SMTP config (from environment variables)
  if (subscription === "basic" || subscription === "pro") {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn("Global SMTP configuration is incomplete. Check environment variables.");
      return null;
    }
    return { host, port, secure, user, pass };
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
  if (!userSmtpConfig.host || !userSmtpConfig.user || !userSmtpConfig.pass) {
    return null;
  }
  return userSmtpConfig;
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
    // Recommended: disable TLS rejection for self-signed certificates in dev, but use proper CAs in prod
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: `UC Universal Connect <${smtpConfig.user}>`,
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
