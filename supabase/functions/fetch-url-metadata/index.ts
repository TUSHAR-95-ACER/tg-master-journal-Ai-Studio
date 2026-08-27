import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractMeta(html: string, property: string): string {
  const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
  if (ogMatch) return ogMatch[1];

  const twMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:${property}["']`, 'i'));
  if (twMatch) return twMatch[1];

  if (property === 'description') {
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    if (descMatch) return descMatch[1];
  }

  return '';
}

function detectContentType(url: string, contentType: string): 'image' | 'video' | 'article' | 'link' {
  const u = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(u) || contentType?.startsWith('image/')) return 'image';
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com') ||
      /\.(mp4|webm|mov)(\?|$)/i.test(u) || contentType?.startsWith('video/')) return 'video';
  if (contentType?.includes('text/html')) return 'article';
  return 'link';
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// SSRF protection: block private IP ranges and metadata endpoints
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  // Cloud metadata hosts
  if (h === '169.254.169.254' || h === 'metadata.google.internal' || h === 'metadata.goog') return true;
  // IPv6 loopback / link-local
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  // IPv4 private / loopback / link-local
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function validateUrl(input: string): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try { parsed = new URL(input); } catch { return { ok: false, error: 'Invalid URL' }; }
  if (!['https:', 'http:'].includes(parsed.protocol)) return { ok: false, error: 'Only HTTP(S) URLs allowed' };
  if (isPrivateHost(parsed.hostname)) return { ok: false, error: 'URL host not allowed' };
  return { ok: true, url: parsed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'URL required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const valid = validateUrl(url);
    if (!valid.ok) {
      return new Response(JSON.stringify({ success: false, error: valid.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(valid.url.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    // Re-validate final URL after redirects
    const finalCheck = validateUrl(response.url);
    if (!finalCheck.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Redirected to disallowed host' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalUrl = response.url;
    const contentType = response.headers.get('content-type') || '';
    const type = detectContentType(finalUrl, contentType);

    let domain = '';
    try { domain = new URL(finalUrl).hostname.replace('www.', ''); } catch {}

    if (type === 'image') {
      return new Response(JSON.stringify({
        success: true, type: 'image', url: finalUrl, domain,
        title: '', description: '', image: finalUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (type === 'video') {
      const ytId = getYouTubeId(finalUrl);
      const result: Record<string, unknown> = {
        success: true, type: 'video', url: finalUrl, domain,
        title: '', description: '', image: '',
      };

      if (ytId) {
        result.youtubeId = ytId;
        result.image = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }

      if (contentType.includes('text/html')) {
        const html = await response.text();
        result.title = extractMeta(html, 'title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
        result.description = extractMeta(html, 'description');
        if (!result.image) result.image = extractMeta(html, 'image');
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

    if (contentType.includes('text/html')) {
      const html = await response.text();
      const title = extractMeta(html, 'title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
      const description = extractMeta(html, 'description');
      let image = extractMeta(html, 'image');

      if (image && !image.startsWith('http')) {
        try { image = new URL(image, finalUrl).href; } catch {}
      }

      const siteName = extractMeta(html, 'site_name');

      // Published date: <meta property="article:published_time"> or <time datetime="…">
      let publishedAt = '';
      const pubMeta = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*)["']/i)
        || html.match(/<meta[^>]*name=["'](?:date|pubdate|publish-date)["'][^>]*content=["']([^"']*)["']/i);
      if (pubMeta) publishedAt = pubMeta[1];
      if (!publishedAt) {
        const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
        if (timeTag) publishedAt = timeTag[1];
      }

      return new Response(JSON.stringify({
        success: true, type: title || description ? 'article' : 'link',
        url: finalUrl, domain, title, description, image, siteName, favicon, publishedAt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true, type: 'link', url: finalUrl, domain,
      title: '', description: '', image: '', favicon,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('fetch-url-metadata error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch metadata' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
