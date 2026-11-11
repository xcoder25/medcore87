import { ensureSchema, isPostgresConfigured, query, withTenantClient } from './postgres';
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
      RETURNING *`,
      [
        input.id,
        input.facilityId,
        input.hospitalNumber || null,
        input.fullName,
        input.sex || null,
        input.dateOfBirth || null,
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
        `SELECT * FROM patients
         WHERE (
              lower(full_name) LIKE $1
              OR hospital_number ILIKE $2
              OR phone ILIKE $2
            )
         ORDER BY updated_at DESC
         LIMIT $3`,
        [`%${q.toLowerCase()}%`, `%${q}%`, limit]
      );
      return res.rows;
    }
    const res = await client.query<PatientRow>(
      `SELECT * FROM patients ORDER BY updated_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  });
}
