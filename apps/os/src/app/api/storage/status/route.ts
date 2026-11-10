import { NextResponse } from 'next/server';
import { getS3Config, isS3Configured } from '../../../../lib/s3Server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getS3Config();
  const configured = isS3Configured();

  const maskBucket = (b: string) => {
    if (!b) return 'Unset';
    if (b.length <= 4) return '****';
    return `${b.slice(0, 3)}***${b.slice(-3)}`;
  };

  return NextResponse.json({
    ok: true,
    configured,
    provider: 'AWS S3 (Simple Storage Service)',
    bucketMasked: maskBucket(config.bucket),
    region: config.region,
    hasCredentials: Boolean(config.accessKeyId && config.secretAccessKey),
    customDomain: config.customDomain || null,
    message: configured
      ? 'AWS S3 Object Storage is ready for medical images, patient photos, and PACS scans.'
      : 'AWS S3 Object Storage is unconfigured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.',
  });
}

