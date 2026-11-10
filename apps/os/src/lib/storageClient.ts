/**
 * Client-Side AWS S3 Storage Helper for MedCore OS
 *
 * Uploads patient photos, staff badge headshots, ultrasound scans,
 * and clinical documents to AWS S3 Object Storage via /api/storage/upload.
 */

export interface S3UploadOptions {
  folder?: 'staff' | 'patients' | 'clinical' | 'radiology' | 'general';
  filename?: string;
  facilityId?: string;
}

export interface S3UploadResult {
  ok: boolean;
  url: string;
  key?: string;
  size?: number;
  error?: string;
  isS3: boolean;
}

/**
 * Upload an image (File, Blob, or base64 data URL) to AWS S3 Object Storage.
 */
export async function uploadImageToS3(
  fileOrDataUrl: File | Blob | string,
  options: S3UploadOptions = {}
): Promise<S3UploadResult> {
  const folder = options.folder || 'general';

  try {
    // If it's a File or Blob, upload as multipart/form-data
    if (typeof fileOrDataUrl !== 'string') {
      const formData = new FormData();
      formData.append('file', fileOrDataUrl, options.filename || (fileOrDataUrl as File).name || 'upload.jpg');
      formData.append('folder', folder);

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data?.url) {
        return {
          ok: true,
          url: data.url,
          key: data.key,
          size: data.size,
          isS3: true,
        };
      }

      return {
        ok: false,
        url: '',
        error: data?.message || data?.error || `Upload failed with HTTP ${res.status}`,
        isS3: false,
      };
    }

    // It is a base64 Data URL string
    const dataUrl = fileOrDataUrl.trim();
    if (!dataUrl) {
      return { ok: false, url: '', error: 'Empty image provided', isS3: false };
    }

    const res = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        folder,
        filename: options.filename,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok && data?.url) {
      return {
        ok: true,
        url: data.url,
        key: data.key,
        size: data.size,
        isS3: true,
      };
    }

    // If S3 is unconfigured, return the dataUrl as local fallback so app remains functional
    return {
      ok: false,
      url: dataUrl,
      error: data?.message || data?.error || 'S3 upload failed',
      isS3: false,
    };
  } catch (err: any) {
    console.warn('[uploadImageToS3] Network or server error:', err);
    return {
      ok: false,
      url: typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '',
      error: err?.message || 'Storage upload network error',
      isS3: false,
    };
  }
}

