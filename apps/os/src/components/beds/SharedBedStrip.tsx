'use client';

/**
 * Compact bed board strip — same bed IDs as Bed & Ward Occupancy.
 * Embed in Nursing, Theatre PACU, Maternity.
 */
import React, { useEffect, useState } from 'react';
import {
  listBeds,
  ensureDefaultBeds,
  subscribeBeds,
  type BedRecord,
} from '../../lib/bedBoardStore';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';

export const SharedBedStrip: React.FC<{
  facilityId?: string;
  wardFilter?: string | string[];
  title?: string;
}> = ({ facilityId: facilityIdProp, wardFilter, title = 'Live beds (shared board)' }) => {
  const facilityId =
    facilityIdProp && facilityIdProp !== 'IGH-EKT'
      ? facilityIdProp
      : (typeof window !== 'undefined' && getActiveFacilityId()) || facilityIdProp || 'IGH-EKT';
  const [beds, setBeds] = useState<BedRecord[]>([]);

  useEffect(() => {
    const load = () => {
      ensureDefaultBeds(facilityId);
      let list = listBeds(facilityId);
      if (wardFilter) {
        const set = new Set(Array.isArray(wardFilter) ? wardFilter : [wardFilter]);
        list = list.filter((b) => set.has(b.ward) || [...set].some((w) => b.ward.toLowerCase().includes(w.toLowerCase())));
      }
      setBeds(list.slice(0, 24));
    };
    load();
    return subscribeBeds(load);
  }, [facilityId, wardFilter]);

  const occ = beds.filter((b) => b.status === 'occupied' || b.status === 'isolation').length;

  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
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
