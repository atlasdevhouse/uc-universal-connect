import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const downloadId = params.id;

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

    // Get file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('temp-downloads')
      .download(`${downloadId}.exe`);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
    return NextResponse.json(
      { error: 'Download failed', details: error.message },
      { status: 500 }
    );
  }
}