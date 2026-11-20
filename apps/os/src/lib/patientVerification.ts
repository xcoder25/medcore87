/**
 * Patient Registry Verification
 *
 * Ensures any operational, clinical, financial, or interoperability form that
 * requires a patient name or hospital number verifies that the patient/number
 * actually exists in the facility registry before saving or billing.
 */
import {
  listPatients,
  hydratePatientsFromPostgres,
  type FacilityPatient,
} from './patientRegistryStore';

export type PatientVerificationStatus =
  | 'verified'
  | 'not_found'
  | 'mismatch'
  | 'ambiguous_name'
  | 'empty';

export type PatientMatchedBy =
  | 'hospitalNumber'
  | 'id'
  | 'mrn'
  | 'shid'
  | 'nhiaNumber'
  | 'nin'
  | 'name';

export interface PatientVerificationResult {
  valid: boolean;
  status: PatientVerificationStatus;
  patient?: FacilityPatient;
  matches?: FacilityPatient[];
  matchedBy?: PatientMatchedBy;
  error?: string;
}

/** Return clean full patient name from structured fields. */
export function formatFullPatientName(p: FacilityPatient): string {
  const parts = [p.firstName, p.middleName, p.lastName]
    .map((x) => (x || '').trim())
    .filter(Boolean);
  return (parts.join(' ') || p.name || '').trim();
}

function norm(v?: string | null): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function tokenizeName(v?: string | null): string[] {
  return norm(v)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function hasNameOverlap(expectedName: string, p: FacilityPatient): boolean {
  const aTokens = tokenizeName(expectedName);
  const bTokens = new Set(tokenizeName(formatFullPatientName(p)));
  if (aTokens.length === 0) return true;
  return aTokens.some((t) => bTokens.has(t));
}

function findExactByIdentifier(
  patients: FacilityPatient[],
  rawCode: string
): { patient: FacilityPatient; matchedBy: PatientMatchedBy } | null {
  const code = norm(rawCode);
  if (!code) return null;
  const digits = code.replace(/\D/g, '');

  for (const p of patients) {
    if (norm(p.hospitalNumber) === code) return { patient: p, matchedBy: 'hospitalNumber' };
    if (norm(p.id) === code) return { patient: p, matchedBy: 'id' };
    if (p.mrn && norm(p.mrn) === code) return { patient: p, matchedBy: 'mrn' };
    if (p.shid && norm(p.shid) === code) return { patient: p, matchedBy: 'shid' };
    if (p.nhiaNumber && norm(p.nhiaNumber) === code) return { patient: p, matchedBy: 'nhiaNumber' };
    if (digits.length === 11 && (p.nin || '').replace(/\D/g, '') === digits) {
      return { patient: p, matchedBy: 'nin' };
    }
  }
  return null;
}

function findExactByName(patients: FacilityPatient[], rawName: string): FacilityPatient[] {
  const target = norm(rawName);
  if (!target) return [];
  const exact: FacilityPatient[] = [];
  for (const p of patients) {
    const full = norm(formatFullPatientName(p));
    const firstLast = norm(`${p.firstName || ''} ${p.lastName || ''}`);
    const reversed = norm(`${p.lastName || ''} ${p.firstName || ''}`);
    if (full === target || firstLast === target || reversed === target) {
      exact.push(p);
    }
  }
  return exact;
}

/**
 * Synchronously verify that a patient ID, hospital number, or patient name
 * exists in the facility registry and matches cleanly without ambiguity.
 */
export function verifyPatientExists(
  facilityId: string,
  input: {
    patientId?: string | null;
    hospitalNumber?: string | null;
    patientName?: string | null;
    query?: string | null;
  }
): PatientVerificationResult {
  const patients = listPatients(facilityId);
  const pid = String(input.patientId || '').trim();
  const hn = String(input.hospitalNumber || '').trim();
  const pname = String(input.patientName || '').trim();
  const q = String(input.query || '').trim();

  if (!pid && !hn && !pname && !q) {
    return {
      valid: false,
      status: 'empty',
      error: 'Enter or select a registered patient name or hospital number.',
    };
  }

  // 1. Explicit hospitalNumber takes strict precedence
  if (hn) {
    const hit = findExactByIdentifier(patients, hn);
    if (!hit) {
      return {
        valid: false,
        status: 'not_found',
        error: `Hospital number "${hn}" does not exist in the facility registry. Verify the folder number or register the patient at Reception first.`,
      };
    }
    if (pname && !hasNameOverlap(pname, hit.patient)) {
      const fullName = formatFullPatientName(hit.patient);
      return {
        valid: false,
        status: 'mismatch',
        patient: hit.patient,
        error: `Hospital number ${hit.patient.hospitalNumber} belongs to ${fullName}, not "${pname}".`,
      };
    }
    if (pid && norm(hit.patient.id) !== norm(pid) && norm(hit.patient.hospitalNumber) !== norm(pid)) {
      const pidHit = findExactByIdentifier(patients, pid);
      if (pidHit && pidHit.patient.id !== hit.patient.id) {
        return {
          valid: false,
          status: 'mismatch',
          patient: hit.patient,
          error: `Selected patient ID does not match hospital number ${hit.patient.hospitalNumber}.`,
        };
      }
    }
    return {
      valid: true,
      status: 'verified',
      patient: hit.patient,
      matchedBy: hit.matchedBy,
    };
  }

  // 2. Explicit patientId check
  if (pid) {
    const hit = findExactByIdentifier(patients, pid);
    if (!hit) {
      return {
        valid: false,
        status: 'not_found',
        error: `Patient ID "${pid}" does not exist in the facility registry.`,
      };
    }
    if (pname && !hasNameOverlap(pname, hit.patient)) {
      const fullName = formatFullPatientName(hit.patient);
      return {
        valid: false,
        status: 'mismatch',
        patient: hit.patient,
        error: `Patient record ${hit.patient.hospitalNumber} belongs to ${fullName}, not "${pname}".`,
      };
    }
    return {
      valid: true,
      status: 'verified',
      patient: hit.patient,
      matchedBy: hit.matchedBy,
    };
  }

  // 3. Single combined query / patientName lookup
  const lookup = q || pname;
  const idHit = findExactByIdentifier(patients, lookup);
  if (idHit) {
    if (pname && q && norm(pname) !== norm(q) && !hasNameOverlap(pname, idHit.patient)) {
      const fullName = formatFullPatientName(idHit.patient);
      return {
        valid: false,
        status: 'mismatch',
        patient: idHit.patient,
        error: `Hospital number ${idHit.patient.hospitalNumber} belongs to ${fullName}, not "${pname}".`,
      };
    }
    return {
      valid: true,
      status: 'verified',
      patient: idHit.patient,
      matchedBy: idHit.matchedBy,
    };
  }

  const nameMatches = findExactByName(patients, lookup);
  if (nameMatches.length === 1) {
    return {
      valid: true,
      status: 'verified',
      patient: nameMatches[0],
      matchedBy: 'name',
    };
  }
  if (nameMatches.length > 1) {
    const hns = nameMatches.map((m) => m.hospitalNumber).slice(0, 5).join(', ');
    return {
      valid: false,
      status: 'ambiguous_name',
      matches: nameMatches,
      error: `Multiple patients named "${lookup}" exist (${hns}). Select the exact patient or enter their Hospital Number.`,
    };
  }

  return {
    valid: false,
    status: 'not_found',
    error: `No registered patient found matching "${lookup}". Verify the Hospital Number or register the patient at Reception first.`,
  };
}

/**
 * Verify patient existence against local cache first; if not found locally,
 * sync matching patients from the facility server registry and re-verify.
 */
export async function verifyPatientExistsAsync(
  facilityId: string,
  input: {
    patientId?: string | null;
    hospitalNumber?: string | null;
    patientName?: string | null;
    query?: string | null;
  }
): Promise<PatientVerificationResult & { checkedServer?: boolean }> {
  const local = verifyPatientExists(facilityId, input);
  if (local.valid || local.status === 'empty' || local.status === 'mismatch') {
    return local;
  }
  const searchTerm = String(
    input.hospitalNumber || input.patientId || input.query || input.patientName || ''
  ).trim();
  if (!searchTerm) return local;

  try {
    await hydratePatientsFromPostgres(facilityId, searchTerm);
  } catch {
    /* keep offline resilience */
  }
  const rechecked = verifyPatientExists(facilityId, input);
  return { ...rechecked, checkedServer: true };
}

/** Check if a hospital/folder number is already assigned to another patient. */
export function isHospitalNumberTaken(
  facilityId: string,
  hospitalNumber: string,
  excludePatientId?: string
): FacilityPatient | undefined {
  const hn = norm(hospitalNumber);
  if (!hn) return undefined;
  return listPatients(facilityId).find(
    (p) => norm(p.hospitalNumber) === hn && (!excludePatientId || p.id !== excludePatientId)
  );
}
