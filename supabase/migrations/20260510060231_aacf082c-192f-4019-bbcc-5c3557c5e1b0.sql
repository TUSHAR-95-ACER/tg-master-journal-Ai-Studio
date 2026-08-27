UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp'],
    file_size_limit = 10485760
WHERE id = 'journal-media';

UPDATE public.daily_plans SET analysis_video_url = NULL WHERE analysis_video_url IS NOT NULL;
UPDATE public.weekly_plans SET analysis_video_url = NULL WHERE analysis_video_url IS NOT NULL;