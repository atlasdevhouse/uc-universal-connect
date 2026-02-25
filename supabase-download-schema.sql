-- Create download_links table for temporary file storage
CREATE TABLE download_links (
    id SERIAL PRIMARY KEY,
    download_id UUID UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL DEFAULT 'UCAgent.exe',
    file_size INTEGER,
    downloads INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_downloaded_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX idx_download_links_download_id ON download_links(download_id);
CREATE INDEX idx_download_links_expires_at ON download_links(expires_at);

-- Create Supabase storage bucket for temporary downloads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('temp-downloads', 'temp-downloads', false);

-- Create policy for authenticated access to temp-downloads bucket
CREATE POLICY "Allow authenticated users to upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'temp-downloads' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to download" ON storage.objects 
FOR SELECT USING (bucket_id = 'temp-downloads' AND auth.role() = 'authenticated');

-- Function to cleanup expired downloads (run this periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_downloads()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    expired_record RECORD;
BEGIN
    -- Get all expired download records
    FOR expired_record IN 
        SELECT download_id FROM download_links 
        WHERE expires_at < NOW()
    LOOP
        -- Delete from storage
        PERFORM storage.delete(ARRAY['temp-downloads/' || expired_record.download_id || '.exe']);
        
        -- Delete from database
        DELETE FROM download_links WHERE download_id = expired_record.download_id;
    END LOOP;
END;
$$;