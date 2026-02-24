import nodemailer from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

// Placeholder for SMTP configuration - will come from settings or env
// For now, hardcode with dummy values, replace later
const getSmtpConfig = async (): Promise<SmtpConfig | null> => {
  // In a real scenario, fetch from DB settings or environment variables
  // For now, hardcode as requested, but emphasize this should be dynamic
  const host = process.env.SMTP_HOST || "smtp.example.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER || "user@example.com";
  const pass = process.env.SMTP_PASS || "password";

  if (!host || !user || !pass) {
    console.error("SMTP configuration missing environment variables");
    return null;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
  };
};

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  html: string,
  attachmentFilename: string,
  attachmentContent: Buffer | string
): Promise<{ success: boolean; message?: string }> {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) {
    return { success: false, message: "SMTP configuration is incomplete." };
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
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
