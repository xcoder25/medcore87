import { NextRequest, NextResponse } from 'next/server';
import {
  isS3Configured,
  uploadBufferToS3,
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
  'application/octet-stream', // DICOM binary images
  'application/dicom',
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
    case 'application/dicom':
    case 'application/octet-stream':
      return 'dcm';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

export async function POST(req: NextRequest) {
  if (!isS3Configured()) {
    const config = getS3Config();
    return NextResponse.json(
      {
        ok: false,
        error: 'S3_NOT_CONFIGURED',
        message: 'AWS S3 object storage is not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in environment variables.',
        region: config.region,
      },
      { status: 503 }
    );
  }

  const contentType = req.headers.get('content-type') || '';

  try {
    let buffer: Buffer;
    let mimeType = 'image/jpeg';
    let folder = 'general';
    let originalFilename: string | undefined;

    // Handle Multipart Form Data (standard file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      folder = String(formData.get('folder') || 'general').trim();

      if (!file) {
        return NextResponse.json({ ok: false, error: 'File is required in formData under key "file"' }, { status: 400 });
      }

      mimeType = file.type || 'image/jpeg';
      originalFilename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
    // Handle JSON payload (base64 Data URL or raw base64)
    else if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      const dataUrl = String(body.dataUrl || body.image || body.base64 || '').trim();
      folder = String(body.folder || 'general').trim();
      originalFilename = body.filename;

      if (!dataUrl) {
        return NextResponse.json({ ok: false, error: 'dataUrl or image field is required in JSON body' }, { status: 400 });
      }

      // Check if dataUrl has prefix: data:image/jpeg;base64,...
      const match = dataUrl.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1] || 'image/jpeg';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        // Raw base64 string
        mimeType = body.mimeType || 'image/jpeg';
        buffer = Buffer.from(dataUrl, 'base64');
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
        { status: 415 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      return NextResponse.json(
        { ok: false, error: `Disallowed mime type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF, SVG, DICOM.` },
        { status: 400 }
      );
    }

    // Limit maximum image upload size (e.g. 15MB)
    const MAX_BYTES = 15 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File too large (${Math.round(buffer.length / (1024 * 1024))}MB). Maximum allowed is 15MB.` },
        { status: 413 }
      );
    }

    const ext = originalFilename && originalFilename.includes('.')
      ? originalFilename.split('.').pop() || getExtensionFromMime(mimeType)
      : getExtensionFromMime(mimeType);

    const key = generateS3ImageKey(folder, ext);
    const metadata: Record<string, string> = {
      uploadedAt: new Date().toISOString(),
      folder,
      ...(originalFilename ? { originalFilename } : {}),
    };

    const result = await uploadBufferToS3(buffer, key, mimeType, metadata);

    return NextResponse.json({
      ok: true,
      url: result.url,
      key: result.key,
      bucket: result.bucket,
      size: result.size,
      mimeType,
      message: 'Image uploaded successfully to AWS S3 object storage.',
    });
  } catch (err: any) {
    console.error('[api/storage/upload error]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to upload image to AWS S3' },
      { status: 500 }
    );
  }
}

