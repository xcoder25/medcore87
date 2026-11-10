import { NextRequest, NextResponse } from 'next/server';
import { publishMedCoreEvent, MedCoreDomainEvent } from '../../../../lib/aws/eventBridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MedCoreDomainEvent;
    if (!body?.source || !body?.detailType || !body?.detail) {
      return NextResponse.json(
        { ok: false, error: 'source, detailType, and detail payload are required' },
        { status: 400 }
      );
    }

    const result = await publishMedCoreEvent(body);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to publish event' },
      { status: 500 }
    );
  }
}

