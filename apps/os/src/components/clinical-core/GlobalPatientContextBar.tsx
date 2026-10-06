'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  getPatientContext,
  clearPatientContext,
  resolveContextPatient,
  subscribePatientContext,
} from '../../lib/patientContextStore';
import { PatientChartBanner } from './PatientChartBanner';

interface Props {
  onOpen360?: () => void;
}

export const GlobalPatientContextBar: React.FC<Props> = ({ onOpen360 }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribePatientContext(() => setTick((t) => t + 1)), []);

  const ctx = getPatientContext();
  const patient = resolveContextPatient();
  if (!ctx || !patient) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        padding: '8px 12px',
        background: 'rgba(248,250,252,0.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #E2E8F0',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <PatientChartBanner
            patient={patient}
            compact
            encounterLabel="In context"
            onOpen360={onOpen360}
          />
        </div>
        <button
          type="button"
          onClick={() => clearPatientContext()}
          title="Clear patient context"
          style={{
            border: '1px solid #E2E8F0',
            background: '#fff',
            borderRadius: 10,
            padding: '0 12px',
            cursor: 'pointer',
            color: '#64748B',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default GlobalPatientContextBar;
