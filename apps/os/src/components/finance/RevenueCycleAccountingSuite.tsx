'use client';

/**
 * Revenue cycle entry — live AR desk (debtors, aging, claims, shift, worklist).
 */
import React, { useMemo } from 'react';
import { AccountingArDesk } from './AccountingArDesk';
import type { UserSession } from '../auth/AuthScreen';

function sessionFromStorage(): UserSession {
  try {
    const raw =
      localStorage.getItem('medcore_os_session') ||
      localStorage.getItem('medcore_user_session');
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.name) return s as UserSession;
    }
  } catch {
    /* ignore */
  }
  const fid =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('medcore_active_facility_id') ||
        localStorage.getItem('medcore_os_facility_id'))) ||
    'IGH-EKT';
  return {
    id: 'ar-desk',
    name: 'Accountant',
    role: 'Accountant',
    roleKey: 'accountant',
    title: 'Accounts',
    facility: 'Hospital',
    hospitalId: fid,
    department: 'Accounts',
    avatarInitials: 'AR',
    clearanceLabel: 'Finance',
    clearanceLevel: 3,
    permissions: [],
    badgeId: '',
  };
}

export const RevenueCycleAccountingSuite: React.FC<{ session?: UserSession }> = ({ session }) => {
  const s = useMemo(() => session || sessionFromStorage(), [session]);
  return <AccountingArDesk session={s} />;
};

export default RevenueCycleAccountingSuite;
