import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const downloadId = id;

    // Check if download link exists and is not expired
    const { data: downloadRecord, error: recordError } = await supabase
      .from('download_links')
      .select('*')
      .eq('download_id', downloadId)
      .single();

    if (recordError || !downloadRecord) {
      return NextResponse.json({ error: 'Download link not found' }, { status: 404 });
    }

    // Check if expired
    const expiresAt = new Date(downloadRecord.expires_at);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: 'Download link has expired' }, { status: 410 });
    }

    // Get file from Vercel filesystem
    const tempDir = path.join('/tmp', 'uc-downloads');
    const exePath = path.join(tempDir, `${downloadId}.exe`);
    
    if (!fs.existsSync(exePath)) {
      return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
    }
    
    // Read file from filesystem
    const buffer = fs.readFileSync(exePath);

    // Update download count (optional)
    await supabase
      .from('download_links')
      .update({ 
        downloads: (downloadRecord.downloads || 0) + 1,
        last_downloaded_at: new Date().toISOString()
      })
      .eq('download_id', downloadId);

    // Return file with download headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadRecord.filename || 'UCAgent.exe'}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Download failed', details: errorMessage },
      { status: 500 }
    );
  }
}