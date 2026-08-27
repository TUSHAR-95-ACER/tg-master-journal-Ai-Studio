// Media types — IMAGES ONLY. Videos are no longer accepted in this journal.

export const ACCEPTED_IMAGE_MIMES = new Set<string>([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

export const ACCEPTED_IMAGE_EXTENSIONS = new Set<string>([
  'jpg', 'jpeg', 'png', 'webp',
]);

export const IMAGE_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

// Backwards-compat exports — kept so existing imports don't break, but they
// now point to the image-only allowlist. Video uploads are rejected.
export const VIDEO_ACCEPT_ATTR = IMAGE_ACCEPT_ATTR;
export const IMAGE_VIDEO_ACCEPT_ATTR = IMAGE_ACCEPT_ATTR;
export const ACCEPTED_VIDEO_MIMES = new Set<string>();
export const ACCEPTED_VIDEO_EXTENSIONS = new Set<string>();

export function getFileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

export function isAcceptedImage(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (ACCEPTED_IMAGE_MIMES.has(mime)) return true;
  return ACCEPTED_IMAGE_EXTENSIONS.has(getFileExt(file.name));
}

// Videos are no longer accepted anywhere.
export function isAcceptedVideo(_file: File): boolean {
  return false;
}

export function isAcceptedMedia(file: File): boolean {
  return isAcceptedImage(file);
}

export function effectiveContentType(file: File): string {
  if (file.type && file.type.startsWith('image/')) return file.type;
  const ext = getFileExt(file.name);
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 0; // videos disabled
