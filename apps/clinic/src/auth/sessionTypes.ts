import type { Persona } from '../rbac/permissions';
import type { StaffSession } from '../components/auth/StaffAuthScreen';

export type { StaffSession };

export interface PatientSession {
  patientId: string;
  name: string;
  facility: string;
  phone?: string;
  persona: 'patient';
}

export type AppSession =
  | ({ persona: 'staff' } & StaffSession)
  | PatientSession;

export function isStaffSession(s: AppSession): s is StaffSession & { persona: 'staff' } {
  return s.persona === 'staff';
}

export type { Persona };
