import type { Persona } from '../rbac/permissions';
import type { StaffSession } from '../components/auth/StaffAuthScreen';

export type { StaffSession };

export interface PatientSession {
  patientId: string;
  shid?: string;
  name: string;
  facilityId: string;
  facility: string;
  phone?: string;
  email?: string;
  emrSynced?: boolean;
  persona: 'patient';
}

export type AppSession =
  | ({ persona: 'staff' } & StaffSession)
  | PatientSession;

export function isStaffSession(s: AppSession): s is StaffSession & { persona: 'staff' } {
  return s.persona === 'staff';
}

export type { Persona };
