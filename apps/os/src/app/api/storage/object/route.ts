import { NextRequest, NextResponse } from 'next/server';
import { getS3ObjectBuffer, isS3Configured } from '../../../../lib/s3Server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Authenticated S3 Object Reader Proxy.
 * Protected by middleware.ts session cookie so private HIPAA S3 buckets (with Block Public Access ON)
 * can serve staff headshots and clinical images securely to authorized facility users.
 */
export async function GET(req: NextRequest) {
  if (!isS3Configured()) {
    return NextResponse.json(
      { ok: false, error: 'S3_NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  const rawKey = (req.nextUrl.searchParams.get('key') || '').trim();
  const key = rawKey.replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\')) {
    return NextResponse.json({ ok: false, error: 'Invalid object key' }, { status: 400 });
  }

  const facilityId = (req.headers.get('x-medcore-facility-id') || '').trim();
  const roleKey = (req.headers.get('x-medcore-role-key') || '').trim().toLowerCase();
  const clearance = Number(req.headers.get('x-medcore-clearance') || '0');
  const isSuperAdmin =
    roleKey === 'hospital_admin' ||
    roleKey === 'sysadmin' ||
    clearance >= 5;

  if (!isSuperAdmin && facilityId) {
    const safeFac = facilityId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!key.startsWith(`${safeFac}/`) && !key.startsWith('general-facility/')) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN: Object belongs to another facility' },
        { status: 403 }
      );
    }
  }

  try {
    const { buffer, contentType } = await getS3ObjectBuffer(key);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    const msg = String(err?.name || err?.message || '');
    if (msg.includes('NoSuchKey') || msg.includes('NotFound')) {
      return NextResponse.json({ ok: false, error: 'Object not found' }, { status: 404 });
    }
    console.error('[api/storage/object GET error]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to read object from S3' },
      { status: 500 }
    );
  }
}
