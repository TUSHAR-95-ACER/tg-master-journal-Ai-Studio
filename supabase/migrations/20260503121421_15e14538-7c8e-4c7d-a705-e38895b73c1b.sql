-- Create private storage bucket for journal media (images + videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'journal-media',
  'journal-media',
  false,
  52428800, -- 50MB
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: per-user folder isolation. Path convention: <user_id>/<...>
CREATE POLICY "Users can view own journal media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'journal-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own journal media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'journal-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own journal media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'journal-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own journal media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'journal-media' AND auth.uid()::text = (storage.foldername(name))[1]);