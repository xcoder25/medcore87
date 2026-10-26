import { ensureSchema, hashPin, isPostgresConfigured, query } from './postgres';

export type StaffRow = {
  badge_id: string;
  facility_id: string;
  full_name: string;
  role: string | null;
  role_key: string | null;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  clearance_level: number | null;
  clearance_label: string | null;
  permissions: unknown;
  photo_url: string | null;
  auth_email: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function upsertFacility(id: string, name: string): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO facilities (id, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
    [id, name || id]
  );
}

export async function upsertStaff(input: {
  badgeId: string;
  facilityId: string;
  fullName: string;
  role?: string;
  roleKey?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  status?: string;
  clearanceLevel?: number;
  clearanceLabel?: string;
  permissions?: string[];
  photoUrl?: string;
  pin?: string;
  authEmail?: string;
  facilityName?: string;
}): Promise<StaffRow> {
  if (!isPostgresConfigured()) {
    throw new Error('Postgres not configured');
  }
  await upsertFacility(input.facilityId, input.facilityName || input.facilityId);
  const pinHash = input.pin ? hashPin(input.pin) : null;
  const res = await query<StaffRow>(
    `INSERT INTO staff (
      badge_id, facility_id, full_name, role, role_key, title, department,
      email, phone, status, clearance_level, clearance_label, permissions,
      photo_url, pin_hash, auth_email, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,NOW()
    )
    ON CONFLICT (facility_id, badge_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      role_key = EXCLUDED.role_key,
      title = EXCLUDED.title,
      department = EXCLUDED.department,
      email = COALESCE(EXCLUDED.email, staff.email),
      phone = COALESCE(EXCLUDED.phone, staff.phone),
      status = EXCLUDED.status,
      clearance_level = EXCLUDED.clearance_level,
      clearance_label = EXCLUDED.clearance_label,
      permissions = EXCLUDED.permissions,
      photo_url = COALESCE(EXCLUDED.photo_url, staff.photo_url),
      pin_hash = COALESCE(EXCLUDED.pin_hash, staff.pin_hash),
      auth_email = COALESCE(EXCLUDED.auth_email, staff.auth_email),
      updated_at = NOW()
    RETURNING *`,
    [
      input.badgeId,
      input.facilityId,
      input.fullName,
      input.role || null,
      input.roleKey || null,
      input.title || null,
      input.department || null,
      input.email || null,
      input.phone || null,
      input.status || 'active',
      input.clearanceLevel ?? 1,
      input.clearanceLabel || null,
      JSON.stringify(input.permissions || []),
      input.photoUrl || null,
      pinHash,
      input.authEmail || null,
    ]
  );
  return res.rows[0]!;
}

export async function listStaff(facilityId: string): Promise<StaffRow[]> {
  await ensureSchema();
  const res = await query<StaffRow>(
    `SELECT badge_id, facility_id, full_name, role, role_key, title, department,
            email, phone, status, clearance_level, clearance_label, permissions,
            photo_url, auth_email, created_at::text, updated_at::text
     FROM staff
     WHERE facility_id = $1
     ORDER BY updated_at DESC
     LIMIT 500`,
    [facilityId]
  );
  return res.rows;
}

export async function getStaff(facilityId: string, badgeId: string): Promise<StaffRow | null> {
  await ensureSchema();
  const res = await query<StaffRow>(
    `SELECT * FROM staff WHERE facility_id = $1 AND badge_id = $2 LIMIT 1`,
    [facilityId, badgeId]
  );
  return res.rows[0] || null;
}

export async function deleteStaff(facilityId: string, badgeId: string): Promise<boolean> {
  await ensureSchema();
  const res = await query(
    `DELETE FROM staff WHERE facility_id = $1 AND badge_id = $2`,
    [facilityId, badgeId]
  );
  return (res.rowCount || 0) > 0;
}
