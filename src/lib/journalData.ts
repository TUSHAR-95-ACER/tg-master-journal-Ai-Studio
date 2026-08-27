import type { MediaAsset, RichJournalValue } from '@/components/shared/RichJournalBlock';
import { htmlToPlain } from '@/components/shared/RichTextEditor';

export const emptyJournal = (): RichJournalValue => ({ text: '', media: [] });

/** Plain-text view of a journal entry — strips Tiptap HTML for previews/AI context. */
export function journalPlainText(v?: RichJournalValue | null): string {
  if (!v) return '';
  return htmlToPlain(v.text || '');
}

/** Coerce any legacy value (string narrative, single image data URL) into a RichJournalValue. */
export function coerceRichJournal(
  raw: unknown,
  legacyText?: string,
  legacyImage?: string,
): RichJournalValue {
  // New format
  if (raw && typeof raw === 'object' && 'text' in (raw as object) && 'media' in (raw as object)) {
    const v = raw as RichJournalValue;
    return { text: v.text || '', media: Array.isArray(v.media) ? v.media : [] };
  }
  // Legacy: build from legacy text + image (image stays as base64 data URL)
  const media: MediaAsset[] = [];
  if (legacyImage) {
    // Could be |||-joined list (MultiMediaBox)
    const parts = legacyImage.includes('|||') ? legacyImage.split('|||').filter(Boolean) : [legacyImage];
    parts.forEach((p) => {
      const isVideo = /^data:video|\.(mp4|webm|mov)(\?|$)/i.test(p);
      media.push({
        id: crypto.randomUUID(),
        url: p,
        type: isVideo ? 'video' : 'image',
        legacy: true,
      });
    });
  }
  return { text: legacyText || '', media };
}

/** Serialize a RichJournalValue for DB storage (drops blob:/object URLs, keeps path + signed url metadata). */
export function serializeJournal(v: RichJournalValue): RichJournalValue {
  return {
    text: v.text || '',
    media: v.media.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      path: m.path,
      name: m.name,
      legacy: m.legacy,
    })),
  };
}
