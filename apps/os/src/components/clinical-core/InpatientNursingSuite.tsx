'use client';

import React from 'react';
import type { UserSession } from '../auth/AuthScreen';
import { NurseDeskHome } from '../dashboards/NurseDeskHome';

interface Props {
  session?: UserSession;
  onNavigate?: (moduleKey: any) => void;
}

export const InpatientNursingSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const activeSession: UserSession = session || {
    id: 'usr-nurse-01',
    name: 'Duty Nurse',
    role: 'Registered Nurse',
    roleKey: 'nurse',
    title: 'Senior Nursing Officer',
    facility: 'General Hospital',
    hospitalId: 'IGH-EKT',
    department: 'Nursing',
    avatarInitials: 'DN',
    clearanceLabel: 'L3 Clinical',
    clearanceLevel: 3,
    permissions: ['nursing', 'triage', 'patient-flow', 'beds', 'emr'],
    badgeId: 'NUR-01',
  };

  return <NurseDeskHome session={activeSession} onNavigate={onNavigate || (() => {})} />;
};

export default InpatientNursingSuite;
