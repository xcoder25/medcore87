import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = (process.env.SMS_API_URL || '').trim();
  const key = (process.env.SMS_API_KEY || '').trim();
  const body = await req.json().catch(() => ({}));
  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      mode: 'unconfigured',
      message: "Set SMS_API_URL and SMS_API_KEY for live SMS",
    }, { status: 503 });
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to: body.to, message: body.body, from: process.env.SMS_SENDER_ID || 'MedCore' }),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, mode: 'live', message: res.ok ? 'Sent' : 'SMS gateway error', ...json }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 502 });
  }
}
