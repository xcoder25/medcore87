import { NextResponse } from 'next/server';
import { getS3Config, isS3Configured } from '../../../../lib/s3Server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getS3Config();
  const configured = isS3Configured();

  return NextResponse.json({
    ok: true,
    configured,
    provider: 'MedCore Encrypted Media Storage',
    hasCredentials: config.authMethod !== 'none',
    customDomain: config.customDomain || null,
    message: configured
      ? 'Encrypted media storage is ready.'
      : 'Encrypted media storage is not configured.',
  });
}

