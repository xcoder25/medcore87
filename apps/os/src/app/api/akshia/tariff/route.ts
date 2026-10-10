import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base = (process.env.AKSHIA_API_URL || '').replace(/\/$/, '');
  const key = (process.env.AKSHIA_API_KEY || '').trim();
  if (!base || !key) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'unconfigured',
        message: 'Set AKSHIA_API_URL and AKSHIA_API_KEY for live tariff',
        items: [],
      },
      { status: 503 }
    );
  }
  try {
    const res = await fetch(`${base}/tariff`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, mode: 'live', message: `AKSHIA tariff HTTP ${res.status}`, items: [] },
        { status: 502 }
      );
    }
    const items = json.items || json.tariff || json.data || [];
    return NextResponse.json({ ok: true, mode: 'live', items });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message, items: [] }, { status: 502 });
  }
}
