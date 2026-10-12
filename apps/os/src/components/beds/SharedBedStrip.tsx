'use client';

/**
 * Compact bed board strip — same bed IDs as Bed & Ward Occupancy.
 * Embed in Nursing, Theatre PACU, Maternity.
 *
 * Stable: does not re-fetch or setState when data is unchanged (avoids UI shake
 * when parent re-renders every clock tick or labour pulse).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  listBeds,
  ensureDefaultBeds,
  subscribeBeds,
  type BedRecord,
} from '../../lib/bedBoardStore';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';

function bedsSignature(list: BedRecord[]): string {
  return list
    .map((b) => `${b.id}|${b.status}|${b.patient || ''}|${b.bedNo}|${b.ward}`)
    .join(';');
}

export const SharedBedStrip: React.FC<{
  facilityId?: string;
  wardFilter?: string | string[];
  title?: string;
}> = ({ facilityId: facilityIdProp, wardFilter, title = 'Live beds (shared board)' }) => {
  const facilityId =
    facilityIdProp && facilityIdProp !== 'IGH-EKT'
      ? facilityIdProp
      : (typeof window !== 'undefined' && getActiveFacilityId()) || facilityIdProp || 'IGH-EKT';

  // Stabilize array/object filter so parent re-renders do not re-run the effect
  const wardKey = useMemo(() => {
    if (!wardFilter) return '';
    return Array.isArray(wardFilter) ? wardFilter.slice().sort().join('|') : String(wardFilter);
  }, [Array.isArray(wardFilter) ? wardFilter.join('|') : wardFilter]);

  const [beds, setBeds] = useState<BedRecord[]>([]);
  const sigRef = useRef('');

  useEffect(() => {
    const load = () => {
      ensureDefaultBeds(facilityId);
      let list = listBeds(facilityId);
      if (wardKey) {
        const set = new Set(wardKey.split('|').filter(Boolean));
        list = list.filter(
          (b) => set.has(b.ward) || [...set].some((w) => b.ward.toLowerCase().includes(w.toLowerCase()))
        );
      }
      const next = list.slice(0, 24);
      const sig = bedsSignature(next);
      if (sig === sigRef.current) return; // no visual change — skip setState (stops shake)
      sigRef.current = sig;
      setBeds(next);
    };
    load();
    return subscribeBeds(load);
  }, [facilityId, wardKey]);

  const occ = beds.filter((b) => b.status === 'occupied' || b.status === 'isolation').length;

  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        // Prevent layout thrash from child paint
        contain: 'layout style',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
        {title} · {occ}/{beds.length} occupied
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {beds.map((b) => (
          <span
            key={b.id}
            title={`${b.id} · ${b.patient || b.status}`}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: 8,
              background:
                b.status === 'occupied'
                  ? '#FFEDD5'
                  : b.status === 'isolation'
                    ? '#F3E8FF'
                    : b.status === 'available'
                      ? '#DCFCE7'
                      : '#F1F5F9',
              color: '#0F172A',
            }}
          >
            {b.bedNo}
            {b.patient ? ` · ${b.patient.split(' ')[0]}` : ''}
          </span>
        ))}
        {beds.length === 0 && (
          <span style={{ fontSize: 12, color: '#64748B' }}>No beds — open Bed & Ward Occupancy to create.</span>
        )}
      </div>
    </div>
  );
};

export default SharedBedStrip;
