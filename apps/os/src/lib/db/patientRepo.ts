import { ensureSchema, isPostgresConfigured, toIsoDateOrNull, withTenantClient } from './postgres';
import { upsertFacility } from './staffRepo';

export type PatientRow = {
  id: string;
  facility_id: string;
  hospital_number: string | null;
  full_name: string;
  sex: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string | null;
  meta: unknown;
};

const PATIENT_SELECT_COLS = `id, facility_id, hospital_number, full_name, sex, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, phone, email, address, status, meta`;

export async function upsertPatient(input: {
  id: string;
  facilityId: string;
  facilityName?: string;
  hospitalNumber?: string;
  fullName: string;
  sex?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: string;
  meta?: Record<string, unknown>;
}): Promise<PatientRow> {
  if (!isPostgresConfigured()) throw new Error('Postgres not configured');
  await upsertFacility(input.facilityId, input.facilityName || input.facilityId);
  return withTenantClient(input.facilityId, async (client) => {
    const res = await client.query<PatientRow>(
      `INSERT INTO patients (
        id, facility_id, hospital_number, full_name, sex, date_of_birth,
        phone, email, address, status, meta, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW())
      ON CONFLICT (facility_id, id) DO UPDATE SET
        hospital_number = COALESCE(EXCLUDED.hospital_number, patients.hospital_number),
        full_name = EXCLUDED.full_name,
        sex = COALESCE(EXCLUDED.sex, patients.sex),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
        phone = COALESCE(EXCLUDED.phone, patients.phone),
        email = COALESCE(EXCLUDED.email, patients.email),
        address = COALESCE(EXCLUDED.address, patients.address),
        status = EXCLUDED.status,
        meta = COALESCE(EXCLUDED.meta, patients.meta),
        updated_at = NOW()
      RETURNING ${PATIENT_SELECT_COLS}`,
      [
        input.id,
        input.facilityId,
        input.hospitalNumber || null,
        input.fullName,
        input.sex || null,
        toIsoDateOrNull(input.dateOfBirth),
        input.phone || null,
        input.email || null,
        input.address || null,
        input.status || 'active',
        JSON.stringify(input.meta || {}),
      ]
    );
    return res.rows[0]!;
  });
}

export async function listPatients(
  facilityId: string,
  opts?: { q?: string; limit?: number }
): Promise<PatientRow[]> {
  await ensureSchema();
  const limit = Math.min(opts?.limit || 100, 500);
  const q = (opts?.q || '').trim();

  return withTenantClient(facilityId, async (client) => {
    if (q) {
      const res = await client.query<PatientRow>(
        `SELECT ${PATIENT_SELECT_COLS} FROM patients
         WHERE facility_id = $1
           AND (
              lower(full_name) LIKE $2
              OR hospital_number ILIKE $3
              OR phone ILIKE $3
            )
         ORDER BY updated_at DESC
         LIMIT $4`,
        [facilityId, `%${q.toLowerCase()}%`, `%${q}%`, limit]
      );
      return res.rows;
    }
    const res = await client.query<PatientRow>(
      `SELECT ${PATIENT_SELECT_COLS} FROM patients WHERE facility_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [facilityId, limit]
    );
    return res.rows;
  });
}

export async function deletePatientRow(facilityId: string, id: string): Promise<boolean> {
  if (!isPostgresConfigured()) throw new Error('Postgres not configured');
  await ensureSchema();
  return withTenantClient(facilityId, async (client) => {
    const res = await client.query(
      `DELETE FROM patients WHERE facility_id = $1 AND id = $2`,
      [facilityId, id]
    );
    return (res.rowCount || 0) > 0;
  });
}
