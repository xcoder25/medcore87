'use client';

/**
 * Current user's staff ID card — used by module key `my-card`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getStaffCard, listStaffCards } from '../../lib/staffCardStore';
import { StaffIdCardView } from './StaffIdCardView';
import type { StaffCardRecord } from '@medcore/types';
import type { UserSession } from '../auth/AuthScreen';

interface Props {
  session?: UserSession | null;
}

export const MyStaffIdPanel: React.FC<Props> = ({ session }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('medcore-staff-cards-updated', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('medcore-staff-cards-updated', on);
      window.removeEventListener('storage', on);
    };
  }, []);

  const card = useMemo(() => {
    void tick;
    const badge = (session?.badgeId || '').trim().toUpperCase();
    if (badge) {
      const hit = getStaffCard(badge);
      if (hit) return hit;
    }
    // fallback: match by name
    const name = (session?.name || '').trim().toLowerCase();
    if (name) {
      const all = listStaffCards();
      const byName = all.find((c) => c.fullName.toLowerCase() === name);
      if (byName) return byName;
    }
    // synthesise from session so card always renders
    if (!session) return null;
    const parts = (session.name || 'Staff').trim().split(/\s+/);
    const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    const synthetic: StaffCardRecord = {
      badgeId: session.badgeId || 'UNKNOWN',
      fullName: session.name || 'Staff',
      role: session.role || '',
      roleKey: session.roleKey || '',
      title: session.title || session.role || '',
      department: session.department || '',
      facilityId: session.hospitalId || '',
      facilityName: session.facility || session.hospitalId || 'Hospital',
      clearanceLevel: session.clearanceLevel || 2,
      clearanceLabel: session.clearanceLabel || 'Staff access',
      templateKey: 'TPL_CLINICAL',
      status: 'ACTIVE',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 365 * 864e5).toISOString().slice(0, 10),
      initials,
      qrPayload: JSON.stringify({ v: 1, badgeId: session.badgeId, facilityId: session.hospitalId }),
    };
    return synthetic;
  }, [session, tick]);

  if (!card) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
        No staff session — sign in to view your ID card.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '24px 16px 40px',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 40%)',
        borderRadius: 16,
        minHeight: 420,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0A2540' }}>My staff ID</div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
          Official facility badge · flip for QR & security notice
        </div>
      </div>
      <StaffIdCardView card={card} />
    </div>
  );
};

export default MyStaffIdPanel;
