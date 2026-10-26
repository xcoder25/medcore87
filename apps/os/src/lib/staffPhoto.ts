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
  const okType =
    !file.type ||
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);
  if (!okType) {
    throw new Error('Photo must be JPG, PNG, or WebP');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Photo must be under 12 MB before compression');
  }
  try {
    const img = await loadImageFromFile(file);
    return canvasToJpegDataUrl(img, MAX_EDGE, JPEG_QUALITY);
  } catch {
    // Fallback: raw FileReader data URL (may be larger)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });
    if (!dataUrl.startsWith('data:')) throw new Error('Could not read image file');
    return {
      dataUrl: dataUrl.length > MAX_DATA_URL_CHARS ? dataUrl.slice(0, MAX_DATA_URL_CHARS) : dataUrl,
      width: 0,
      height: 0,
      bytesApprox: Math.round((dataUrl.length * 3) / 4),
    };
  }
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
 * Firebase Storage client upload is OFF by default.
 * Browser uploads to firebasestorage.googleapis.com fail with CORS when the
 * bucket has no CORS config / rules (common on new projects). Photos still
 * work via compressed data URLs on the ID card + staff profile.
 *
 * Opt-in: set NEXT_PUBLIC_ENABLE_STAFF_PHOTO_STORAGE=1 after configuring
 * Storage rules + CORS on the bucket.
 */
export function isStaffPhotoStorageEnabled(): boolean {
  try {
    return (
      String(process.env.NEXT_PUBLIC_ENABLE_STAFF_PHOTO_STORAGE || '').trim() === '1' ||
      String(process.env.NEXT_PUBLIC_ENABLE_STAFF_PHOTO_STORAGE || '').toLowerCase() === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Upload compressed photo to Firebase Storage (opt-in only).
 * Path: staff-photos/{facilityId}/{badgeId}.jpg
 */
export async function uploadStaffPhotoToStorage(
  facilityId: string,
  badgeId: string,
  dataUrl: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!isStaffPhotoStorageEnabled()) return null;
  if (!dataUrl.startsWith('data:')) return dataUrl;
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
    // Single attempt — no long SDK retry loop for CORS failures
    const result = await Promise.race([
      (async () => {
        await uploadBytes(storageRef, blob, {
          contentType: 'image/jpeg',
          cacheControl: 'public,max-age=31536000',
          customMetadata: { facilityId: fid, badgeId: bid },
        });
        return await getDownloadURL(storageRef);
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    return result;
  } catch {
    return null;
  }
}

/**
 * Resolve photo for enrolment — compressed data URL by default (no CORS).
 */
export async function resolveStaffPhotoForEnrol(
  facilityId: string,
  badgeId: string,
  localDataUrl: string | undefined
): Promise<string | undefined> {
  if (!localDataUrl) return undefined;
  if (!localDataUrl.startsWith('data:')) return localDataUrl;

  if (isStaffPhotoStorageEnabled()) {
    const remote = await uploadStaffPhotoToStorage(facilityId, badgeId, localDataUrl);
    if (remote) return remote;
  }

  if (localDataUrl.length <= MAX_DATA_URL_CHARS) return localDataUrl;
  return localDataUrl.slice(0, MAX_DATA_URL_CHARS);
}
