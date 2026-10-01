/** Facility backup / export for pilot safety */

import { listPatients } from './patientRegistryStore';
import { todayVisits, listAppointments, todayPayments } from './receptionOpsStore';
import { listOrders } from './clinicalEventBus';
import { listAudit } from './auditLogStore';
import { getAdminSettings } from './adminSettingsStore';

export function buildFacilityBackup(facilityId: string) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    facilityId,
    patients: listPatients(facilityId),
    visitsToday: todayVisits(facilityId),
    appointmentsToday: listAppointments(facilityId),
    paymentsToday: todayPayments(facilityId),
    clinicalOrders: listOrders(facilityId),
    audit: listAudit(facilityId, 500),
    settings: getAdminSettings(facilityId),
    staffRegistry: safeJson('medcore_os_staff_registry'),
    staffCards: safeJson('medcore_staff_id_cards'),
  };
}

function safeJson(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function downloadFacilityBackup(facilityId: string) {
  const payload = buildFacilityBackup(facilityId);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medcore-backup-${facilityId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}
