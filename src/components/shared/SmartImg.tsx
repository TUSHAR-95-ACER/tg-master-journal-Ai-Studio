import { useCallback, useState } from 'react';
import {
  extractJournalPath,
  invalidateResolvedMediaUrl,
  resignJournalPath,
  useResolvedMediaUrl,
} from '@/lib/mediaUrl';

/**
 * <img> wrapper that transparently resolves stored journal-media URLs to
 * a fresh signed URL, and auto-recovers from expired-token 400/403 errors
 * by evicting the cache entry and re-signing once.
 *
 * Behaves identically to <img> for every other src (data:, blob:, external
 * URLs, static assets). Use everywhere a stored media URL is rendered so
 * historical/migrated records never break again.
 */
interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
}

export function SmartImg({ src, onError, ...rest }: Props) {
  const resolved = useResolvedMediaUrl(src);
  const [override, setOverride] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!tried) {
      const path = extractJournalPath(src);
      if (path) {
        setTried(true);
        invalidateResolvedMediaUrl(src);
        resignJournalPath(path).then((u) => setOverride(u)).catch(() => onError?.(e));
        return;
      }
    }
    onError?.(e);
  }, [src, tried, onError]);

  const finalSrc = override ?? resolved ?? undefined;
  return <img {...rest} src={finalSrc} onError={handleError} />;
}
