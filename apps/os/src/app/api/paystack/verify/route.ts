import { NextRequest, NextResponse } from 'next/server';
import { verifyPaystackReference, getPaystackSecretKey } from '../../../../lib/paystackServer';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!getPaystackSecretKey()) {
    return NextResponse.json({ error: 'Server secret not configured' }, { status: 503 });
  }
  const reference = req.nextUrl.searchParams.get('reference') || '';
  if (!reference.trim()) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }
  try {
    const result = await verifyPaystackReference(reference.trim());
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verify failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!getPaystackSecretKey()) {
    return NextResponse.json({ error: 'Server secret not configured' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const reference = String(body.reference || '').trim();
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }
  try {
    const result = await verifyPaystackReference(reference);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verify failed' }, { status: 500 });
  }
}
