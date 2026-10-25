/**
 * Legacy data migration toolkit — inventory, map, validate, import.
 */
import type { FacilityPatient } from './patientRegistryStore';
import { upsertPatient } from './patientRegistryStore';

export type MigrationRow = Record<string, string>;
export type FieldMap = Record<string, keyof FacilityPatient | ''>;

export function parseCsv(text: string): MigrationRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: MigrationRow = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] || '';
    });
    return row;
  });
}

export function suggestFieldMap(headers: string[]): FieldMap {
  const map: FieldMap = {};
  for (const h of headers) {
    const k = h.toLowerCase();
    if (/hospital|mrn|folder|hosp/.test(k)) map[h] = 'hospitalNumber';
    else if (/first/.test(k)) map[h] = 'firstName';
    else if (/last|surname/.test(k)) map[h] = 'lastName';
    else if (/middle/.test(k)) map[h] = 'middleName';
    else if (/sex|gender/.test(k)) map[h] = 'sex';
    else if (/dob|birth/.test(k)) map[h] = 'dob';
    else if (/phone|mobile|tel/.test(k)) map[h] = 'phone';
    else if (/nin/.test(k)) map[h] = 'nin';
    else if (/nhia|insurance/.test(k)) map[h] = 'nhiaNumber';
    else if (/address|addr/.test(k)) map[h] = 'address';
    else if (/lga/.test(k)) map[h] = 'lga';
    else if (/state/.test(k)) map[h] = 'state';
    else map[h] = '';
  }
  return map;
}

export function rowToPatient(
  facilityId: string,
  row: MigrationRow,
  map: FieldMap
): FacilityPatient | null {
  const get = (field: keyof FacilityPatient) => {
    const src = Object.entries(map).find(([, v]) => v === field)?.[0];
    return src ? row[src] || '' : '';
  };
  const firstName = get('firstName');
  const lastName = get('lastName');
  const hospitalNumber = get('hospitalNumber') || `MIG-${Date.now().toString(36).toUpperCase()}`;
  if (!firstName && !lastName) return null;
  const sexRaw = get('sex').toLowerCase();
  const sex = sexRaw.startsWith('f') ? 'Female' : sexRaw.startsWith('m') ? 'Male' : 'Other';
  const now = new Date().toISOString();
  return {
    id: `pat-${facilityId}-${hospitalNumber}`.replace(/\s/g, ''),
    facilityId,
    facilityName: facilityId,
    hospitalNumber,
    firstName: firstName || 'Unknown',
    lastName: lastName || 'Patient',
    middleName: get('middleName') || undefined,
    sex: sex as FacilityPatient['sex'],
    dob: get('dob') || '1990-01-01',
    phone: get('phone') || '',
    nin: get('nin') || undefined,
    nhiaNumber: get('nhiaNumber') || undefined,
    address: get('address') || undefined,
    lga: get('lga') || undefined,
    state: get('state') || 'Akwa Ibom',
    status: 'active',
    registeredAt: now,
  };
}

export function validateMigration(
  facilityId: string,
  rows: MigrationRow[],
  map: FieldMap
): { ok: number; failed: number; samples: string[] } {
  let ok = 0;
  let failed = 0;
  const samples: string[] = [];
  for (const row of rows) {
    const p = rowToPatient(facilityId, row, map);
    if (p) ok++;
    else {
      failed++;
      if (samples.length < 5) samples.push(JSON.stringify(row).slice(0, 80));
    }
  }
  return { ok, failed, samples };
}

export function commitMigration(
  facilityId: string,
  rows: MigrationRow[],
  map: FieldMap
): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const p = rowToPatient(facilityId, row, map);
    if (!p) {
      skipped++;
      continue;
    }
    try {
      upsertPatient(p);
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}
