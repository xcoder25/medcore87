import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const base = (process.env.DHIS2_BASE_URL || '').replace(/\/$/, '');
  const user = process.env.DHIS2_USER || '';
  const pass = process.env.DHIS2_PASSWORD || '';
  const payload = await req.json().catch(() => null);
  if (!base || !user) {
    return NextResponse.json({
      ok: false,
      message: 'Set DHIS2_BASE_URL, DHIS2_USER, DHIS2_PASSWORD for auto-submit',
    }, { status: 503 });
  }
  try {
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');
    const res = await fetch(`${base}/api/dataValueSets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return NextResponse.json({
      ok: res.ok,
      message: res.ok ? 'DHIS2 accepted data value set' : `DHIS2 ${res.status}: ${text.slice(0, 200)}`,
    }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 502 });
  }
}
