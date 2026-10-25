/**
 * Staff ID photo — compress headshot client-side, optional Firebase Storage upload.
 * Keeps Firestore payloads small; falls back to compact data URL when Storage is unavailable.
 */

export type StaffPhotoResult = {
  dataUrl: string;
  width: number;
  height: number;
  bytesApprox: number;
};

/** Max edge for ID card preview (keeps under Firestore practical limits). */
const MAX_EDGE = 360;
const JPEG_QUALITY = 0.72;
const MAX_DATA_URL_CHARS = 90_000; // ~67KB binary — safe for staff doc field

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function canvasToJpegDataUrl(
  img: HTMLImageElement,
  maxEdge: number,
  quality: number
): StaffPhotoResult {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) {
    throw new Error('Invalid image dimensions');
  }

  // Center-crop to near-square for ID badge (3:4 portrait)
  const targetRatio = 3 / 4;
  const srcRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = w;
  let sh = h;
  if (srcRatio > targetRatio) {
    sw = Math.round(h * targetRatio);
    sx = Math.round((w - sw) / 2);
  } else if (srcRatio < targetRatio) {
    sh = Math.round(w / targetRatio);
    sy = Math.round((h - sh) / 2);
  }

  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  let q = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', q);
  // Step down quality if still huge
  while (dataUrl.length > MAX_DATA_URL_CHARS && q > 0.4) {
    q -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    // Last resort: smaller edge
    return canvasToJpegDataUrl(img, Math.floor(maxEdge * 0.75), 0.55);
  }

  return {
    dataUrl,
    width: dw,
    height: dh,
    bytesApprox: Math.round((dataUrl.length * 3) / 4),
  };
}

export async function compressStaffPhotoFile(file: File): Promise<StaffPhotoResult> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    throw new Error('Photo must be JPG, PNG, or WebP');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Photo must be under 12 MB before compression');
  }
  const img = await loadImageFromFile(file);
  return canvasToJpegDataUrl(img, MAX_EDGE, JPEG_QUALITY);
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) return null;
    const binary = atob(m[2]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || 'image/jpeg' });
  } catch {
    return null;
  }
}

/**
 * Upload compressed photo to Firebase Storage.
 * Path: staff-photos/{facilityId}/{badgeId}.jpg
 * Returns download URL or null if Storage is unavailable / denied.
 */
export async function uploadStaffPhotoToStorage(
  facilityId: string,
  badgeId: string,
  dataUrl: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!dataUrl.startsWith('data:')) return dataUrl; // already remote
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  try {
    const { getFirebaseApp } = await import('./firebase');
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const app = getFirebaseApp();
    const storage = getStorage(app);
    const fid = (facilityId || 'DEFAULT').replace(/[\/#?]/g, '_');
    const bid = String(badgeId || 'unknown')
      .toUpperCase()
      .replace(/\s+/g, '');
    const path = `staff-photos/${fid}/${bid}.jpg`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000',
      customMetadata: { facilityId: fid, badgeId: bid },
    });
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.warn('[staff-photo] storage upload skipped', e);
    return null;
  }
}

/**
 * Resolve final photo URL for enrolment: prefer Storage URL, else compact data URL.
 */
export async function resolveStaffPhotoForEnrol(
  facilityId: string,
  badgeId: string,
  localDataUrl: string | undefined
): Promise<string | undefined> {
  if (!localDataUrl) return undefined;
  if (!localDataUrl.startsWith('data:')) return localDataUrl;
  const remote = await uploadStaffPhotoToStorage(facilityId, badgeId, localDataUrl);
  if (remote) return remote;
  // Fallback: keep compact data URL for ID card offline display
  if (localDataUrl.length <= MAX_DATA_URL_CHARS) return localDataUrl;
  return localDataUrl.slice(0, MAX_DATA_URL_CHARS);
}
