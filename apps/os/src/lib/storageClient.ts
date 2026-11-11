/**
 * Client-Side AWS S3 Storage Helper for MedCore OS
 *
 * Implements Pillar 1 of the EMR Architecture Directive:
 * - Direct Client-to-S3 streaming via Pre-signed PUT URLs.
 * - Entirely bypasses application compute memory and database storage limits.
 * - Database stores only the immutable S3 object key or clean URL.
 */

export interface S3UploadOptions {
  folder?: 'staff' | 'patients' | 'clinical' | 'radiology' | 'general';
  filename?: string;
  facilityId?: string;
  patientId?: string;
}

export interface S3UploadResult {
  ok: boolean;
  url: string;
  key?: string;
  size?: number;
  error?: string;
  isS3: boolean;
  method?: 'presigned_put_direct' | 'server_relay';
}

/**
 * Stream a binary File or Blob directly to AWS S3 using a Pre-signed URL.
 * Highest efficiency: zero byte transit through application server compute.
 */
export async function streamDirectToS3Presigned(
  file: File | Blob,
  options: S3UploadOptions = {}
): Promise<S3UploadResult> {
  const folder = options.folder || 'general';
  const filename = options.filename || (file as File).name || 'upload.jpg';
  const contentType = file.type || 'image/jpeg';

  try {
    // 1. Request a secure pre-signed PUT URL from the backend
    const presignRes = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType,
        folder,
        filename,
        facilityId: options.facilityId,
        patientId: options.patientId,
      }),
    });

    const presignData = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok || !presignData?.uploadUrl) {
      throw new Error(presignData?.message || presignData?.error || 'Failed to acquire S3 pre-signed URL');
    }

    // 2. Stream payload directly from browser to Amazon S3
    const s3PutRes = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!s3PutRes.ok) {
      throw new Error(`S3 direct upload rejected with HTTP status ${s3PutRes.status}`);
    }

    return {
      ok: true,
      url: presignData.fileUrl,
      key: presignData.s3Key,
      size: file.size,
      isS3: true,
      method: 'presigned_put_direct',
    };
  } catch (err: any) {
    console.warn('[streamDirectToS3Presigned] Direct stream failed, falling back to server relay:', err?.message);
    // Fallback to server multipart upload if pre-signed direct PUT encounters CORS or network restriction
    return uploadImageToS3(file, options);
  }
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
    // If it's a File or Blob, prefer direct pre-signed PUT streaming
    if (typeof fileOrDataUrl !== 'string') {
      const directResult = await streamDirectToS3Presigned(fileOrDataUrl, options);
      if (directResult.ok) return directResult;

      // Secondary fallback: Multipart Form Data via server
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
          method: 'server_relay',
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
        method: 'server_relay',
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
