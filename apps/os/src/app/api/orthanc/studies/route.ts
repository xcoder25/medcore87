import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Proxy Orthanc /studies to avoid browser CORS when hub is on LAN.
 * Query: ?base=http://10.0.0.10:8042&user=&pass=
 */
export async function GET(req: NextRequest) {
  const base = (req.nextUrl.searchParams.get('base') || '').replace(/\/$/, '');
  if (!base) {
    return NextResponse.json({ error: 'base required' }, { status: 400 });
  }
  const user = req.nextUrl.searchParams.get('user') || '';
  const pass = req.nextUrl.searchParams.get('pass') || '';
  const headers: HeadersInit = {};
  if (user) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
  try {
    const res = await fetch(`${base}/studies`, { headers, cache: 'no-store' });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message || 'orthanc unreachable' },
      { status: 502 }
    );
  }
}
