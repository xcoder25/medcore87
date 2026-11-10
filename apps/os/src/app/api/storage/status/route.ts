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
    authMethod: config.authMethod,
    roleArnMasked: config.roleArn ? `${config.roleArn.slice(0, 15)}...${config.roleArn.slice(-6)}` : null,
    bucketMasked: maskBucket(config.bucket),
    region: config.region,
    hasCredentials: config.authMethod !== 'none',
    customDomain: config.customDomain || null,
    message: configured
      ? `AWS S3 Object Storage is ready (${config.authMethod === 'oidc_role' ? 'Vercel OIDC Role' : 'IAM Access Keys'}).`
      : 'AWS S3 Object Storage is unconfigured. Set AWS_ROLE_ARN (Vercel OIDC) or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, alongside S3_BUCKET_NAME.',
  });
}

