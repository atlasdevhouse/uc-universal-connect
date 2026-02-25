import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { deviceId, installToken, status, timestamp, screenResolution, osName, localIP, publicIP, machineName } = await request.json();

    if (!deviceId || !installToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find user by install token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('install_token', installToken)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid install token' }, { status: 401 });
    }

    // Update or insert device record (match existing table structure)
    const deviceData = {
      id: deviceId, // existing table uses 'id' not 'device_id'
      user_id: user.id.toString(), // existing table uses text not integer
      name: machineName || deviceId.split('-')[0],
      os: osName || 'Windows', // existing table uses 'os' not 'os_name'
      ip: localIP || 'unknown', // existing table uses 'ip' not 'local_ip'
      public_ip: publicIP || 'unknown',
      resolution: screenResolution || '1920x1080', // existing table uses 'resolution'
      status: status || 'online',
      last_seen: new Date().toISOString(), // existing table uses 'last_seen'
      install_token: installToken
    };

    // Upsert device (update if exists, insert if new)
    const { error: deviceError } = await supabase
      .from('devices')
      .upsert(deviceData, {
        onConflict: 'id', // primary key is 'id' not 'device_id'
        ignoreDuplicates: false
      });

    if (deviceError) {
      console.error('Device upsert error:', deviceError);
      return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
    }

    // Send Telegram notification for new device connections
    const now = new Date();
    const deviceAge = now.getTime() - new Date(deviceData.last_heartbeat).getTime();
    
    // If this is a new connection (first heartbeat or reconnection after >5 minutes)
    if (deviceAge > 5 * 60 * 1000) {
      try {
        // Send Telegram notification (you can implement this later)
        // await sendTelegramNotification(`🖥️ New device connected: ${machineName} (${publicIP})`);
      } catch (error) {
        // Silent fail on notification
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Heartbeat received',
      deviceId: deviceId,
      status: 'online'
    });

  } catch (error) {
    console.error('Heartbeat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Heartbeat failed', details: errorMessage },
      { status: 500 }
    );
  }
}