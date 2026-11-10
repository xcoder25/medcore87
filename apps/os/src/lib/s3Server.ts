import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

/**
 * AWS S3 Object Storage Service for MedCore OS Images
 *
 * Stores medical imagery, patient intake photos, staff badge headshots,
 * ultrasound captures, and DICOM attachments.
 */

function clean(v: string | undefined | null): string {
  let val = String(v || '').trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  customDomain?: string;
  isConfigured: boolean;
}

export function getS3Config(): S3StorageConfig {
  const bucket =
    clean(process.env.MEDCORE_S3_BUCKET) ||
    clean(process.env.MEDCORE_S3_BUCKET_NAME) ||
    clean(process.env.MEDCORE_AWS_S3_BUCKET) ||
    clean(process.env.AWS_S3_BUCKET) ||
    clean(process.env.AWS_BUCKET_NAME) ||
    clean(process.env.S3_BUCKET_NAME);

  const region =
    clean(process.env.MEDCORE_S3_REGION) ||
    clean(process.env.MEDCORE_AWS_S3_REGION) ||
    clean(process.env.AWS_REGION) ||
    clean(process.env.AWS_DEFAULT_REGION) ||
    'eu-west-1';

  const accessKeyId =
    clean(process.env.MEDCORE_S3_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_S3_ACCESS_KEY) ||
    clean(process.env.MEDCORE_S3_KEY) ||
    clean(process.env.MEDCORE_AWS_ACCESS_KEY_ID) ||
    clean(process.env.AWS_ACCESS_KEY_ID) ||
    clean(process.env.AWS_ACCESS_KEY);

  const secretAccessKey =
    clean(process.env.MEDCORE_S3_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_S3_SECRET_KEY) ||
    clean(process.env.MEDCORE_S3_SECRET) ||
    clean(process.env.MEDCORE_AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.AWS_SECRET_KEY);

  const endpoint =
    clean(process.env.MEDCORE_S3_ENDPOINT) ||
    clean(process.env.AWS_S3_ENDPOINT);

  const customDomain =
    clean(process.env.MEDCORE_S3_CUSTOM_DOMAIN) ||
    clean(process.env.AWS_S3_CUSTOM_DOMAIN) ||
    clean(process.env.NEXT_PUBLIC_S3_BASE_URL);

  const isConfigured = Boolean(bucket && accessKeyId && secretAccessKey);

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint || undefined,
    customDomain: customDomain || undefined,
    isConfigured,
  };
}

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance;
  const config = getS3Config();
  if (!config.isConfigured) {
    throw new Error('AWS S3 Object Storage is not configured. Missing AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY.');
  }

  s3ClientInstance = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });

  return s3ClientInstance;
}

export function isS3Configured(): boolean {
  return getS3Config().isConfigured;
}

export function buildS3ObjectUrl(key: string): string {
  const config = getS3Config();
  if (config.customDomain) {
    const base = config.customDomain.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType: string = 'image/jpeg',
  metadata?: Record<string, string>
): Promise<{ url: string; key: string; bucket: string; size: number }> {
  const client = getS3Client();
  const config = getS3Config();

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await client.send(command);

  return {
    url: buildS3ObjectUrl(key),
    key,
    bucket: config.bucket,
    size: buffer.length,
  };
}

export async function generateS3PresignedUploadUrl(
  key: string,
  contentType: string = 'image/jpeg',
  expiresInSeconds: number = 300
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  const client = getS3Client();
  const config = getS3Config();

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const fileUrl = buildS3ObjectUrl(key);

  return { uploadUrl, fileUrl, key };
}

export function generateS3ImageKey(folder: string = 'general', extension: string = 'jpg'): string {
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'general';
  const cleanExt = extension.replace(/^\./, '').toLowerCase() || 'jpg';
  const date = new Date().toISOString().slice(0, 10);
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `images/${safeFolder}/${date}/${Date.now()}-${randomHex}.${cleanExt}`;
}

