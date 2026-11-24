import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  updateSupplyEquipmentRecord,
  upsertSupplyEquipmentRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get('district') || undefined;
    const snap = await buildLiveMohSnapshot({ district });
    return NextResponse.json({ ok: true, supplyChain: snap.supplyChain });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to load supply & equipment inventory.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (!String(body.facilityId || '').trim() || !String(body.itemName || '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'facilityId and itemName are required.' },
        { status: 400 }
      );
    }
    const item = await upsertSupplyEquipmentRecord({
      id: body.id ? String(body.id) : undefined,
      domain: body.domain || 'medicine_vaccine',
      facilityId: String(body.facilityId),
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
      lga: body.lga ? String(body.lga) : undefined,
      itemName: String(body.itemName),
      category: body.category ? String(body.category) : undefined,
      quantity: Number(body.quantity ?? 0),
      reorderLevel: Number(body.reorderLevel ?? 0),
      unit: body.unit ? String(body.unit) : undefined,
      coldChainTempC:
        body.coldChainTempC !== undefined && body.coldChainTempC !== null && body.coldChainTempC !== ''
          ? Number(body.coldChainTempC)
          : null,
      functionalStatus: body.functionalStatus,
      notes: body.notes ? String(body.notes) : undefined,
      updatedBy: body.updatedBy ? String(body.updatedBy) : undefined,
    });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to save inventory item.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required.' }, { status: 400 });
    }
    const updated = await updateSupplyEquipmentRecord(id, {
      quantity: typeof body.quantity === 'number' ? body.quantity : undefined,
      coldChainTempC:
        body.coldChainTempC !== undefined
          ? body.coldChainTempC === null
            ? null
            : Number(body.coldChainTempC)
          : undefined,
      functionalStatus: body.functionalStatus,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy : undefined,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Supply/equipment item not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to update inventory item.' },
      { status: 500 }
    );
  }
}
