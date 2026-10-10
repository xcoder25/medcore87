import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const base = (process.env.AKSHIA_API_URL || '').replace(/\/$/, '');
  const key = (process.env.AKSHIA_API_KEY || '').trim();
  const body = await req.json().catch(() => ({}));
  if (!base || !key) {
    return NextResponse.json({
      ok: false,
      mode: 'unconfigured',
      message: 'Set AKSHIA_API_URL and AKSHIA_API_KEY on the server for live eligibility',
    }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}/eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ ...json, mode: 'live' }, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, mode: 'error', message: (e as Error).message }, { status: 502 });
  }
}
