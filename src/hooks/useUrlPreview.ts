import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UrlMetadata {
  success: boolean;
  type: 'image' | 'video' | 'article' | 'link';
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string;
  siteName?: string;
  youtubeId?: string;
  error?: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const cache = new Map<string, UrlMetadata>();

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

export function useUrlPreview() {
  const [previews, setPreviews] = useState<Map<string, UrlMetadata>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const fetchPreview = useCallback(async (url: string) => {
    if (cache.has(url)) {
      setPreviews(prev => new Map(prev).set(url, cache.get(url)!));
      return;
    }

    setLoading(prev => new Set(prev).add(url));

    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-metadata', {
        body: { url },
      });

      const metadata: UrlMetadata = error
        ? { success: false, type: 'link', url, domain: '', title: '', description: '', image: '', error: error.message }
        : data;

      cache.set(url, metadata);
      setPreviews(prev => new Map(prev).set(url, metadata));
    } catch {
      const fallback: UrlMetadata = { success: false, type: 'link', url, domain: '', title: '', description: '', image: '' };
      cache.set(url, fallback);
      setPreviews(prev => new Map(prev).set(url, fallback));
    } finally {
      setLoading(prev => { const s = new Set(prev); s.delete(url); return s; });
    }
  }, []);

  const detectAndFetch = useCallback((text: string) => {
    const urls = extractUrls(text);
    urls.forEach(u => {
      if (!cache.has(u) && !loading.has(u)) fetchPreview(u);
    });
  }, [fetchPreview, loading]);

  const removePreview = useCallback((url: string) => {
    setPreviews(prev => { const m = new Map(prev); m.delete(url); return m; });
  }, []);

  return { previews, loading, fetchPreview, detectAndFetch, removePreview };
}
