import { NextRequest, NextResponse } from 'next/server';
import {
  isS3Configured,
  generateS3PresignedUploadUrl,
  generateS3ImageKey,
  getS3Config,
} from '../../../../lib/s3Server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/octet-stream', // DICOM binary
  'application/dicom',
  'application/pdf',          // Scanned clinical reports
]);

function getExtensionFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'application/pdf':
      return 'pdf';
    case 'application/dicom':
    case 'application/octet-stream':
      return 'dcm';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

/**
 * Pillar 1: Core Data Layer Separation — Pre-signed URL Generator
 *
 * Generates secure, short-lived S3 pre-signed PUT URLs.
 * Enables client browsers to stream media/imaging payloads DIRECTLY to Amazon S3,
 * entirely bypassing application compute memory and database storage limits.
 * The database only retains the immutable S3 object key.
 */
export async function POST(req: NextRequest) {
  if (!isS3Configured()) {
    const config = getS3Config();
    return NextResponse.json(
      {
        ok: false,
        error: 'S3_NOT_CONFIGURED',
        message: 'AWS S3 object storage is not configured. Set AWS_ROLE_ARN or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY with S3_BUCKET_NAME.',
        region: config.region,
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const contentType = String(body.contentType || body.mimeType || 'image/jpeg').trim();
    const folder = String(body.folder || 'general').trim();
    const filename = String(body.filename || '').trim();

    if (!ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
      return NextResponse.json(
        {
          ok: false,
          error: `Disallowed content type: ${contentType}. Allowed: JPEG, PNG, WebP, GIF, SVG, PDF, DICOM.`,
        },
        { status: 400 }
      );
    }

    const ext = filename && filename.includes('.')
      ? filename.split('.').pop() || getExtensionFromMime(contentType)
      : getExtensionFromMime(contentType);

    // Generate an immutable, unique S3 key
    const s3Key = generateS3ImageKey(folder, ext);

    // Expiration: 5 minutes (300 seconds) for direct streaming
    const { uploadUrl, fileUrl } = await generateS3PresignedUploadUrl(s3Key, contentType, 300);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      fileUrl,
      s3Key,
      expiresInSeconds: 300,
      contentType,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      instructions: 'Stream payload directly from client using HTTP PUT with the specified Content-Type header.',
    });
  } catch (err: any) {
    console.error('[api/storage/presigned-url error]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to generate S3 pre-signed upload URL' },
      { status: 500 }
    );
  }
}

