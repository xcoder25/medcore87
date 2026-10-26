/**
 * Browser helpers to talk to Postgres-backed API routes.
 */

export async function apiCreateStaff(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
  staff?: unknown;
}> {
  try {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok: boolean; error?: string; staff?: unknown };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'network' };
  }
}

export async function apiListStaff(facilityId: string): Promise<{
  ok: boolean;
  staff?: Array<Record<string, unknown>>;
  error?: string;
  configured?: boolean;
}> {
  try {
    const res = await fetch(`/api/staff?facilityId=${encodeURIComponent(facilityId)}`);
    return (await res.json()) as {
      ok: boolean;
      staff?: Array<Record<string, unknown>>;
      error?: string;
      configured?: boolean;
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function apiListPatients(
  facilityId: string,
  q?: string
): Promise<{ ok: boolean; patients?: unknown[]; error?: string }> {
  try {
    const qs = new URLSearchParams({ facilityId });
    if (q) qs.set('q', q);
    const res = await fetch(`/api/patients?${qs}`);
    return (await res.json()) as { ok: boolean; patients?: unknown[]; error?: string };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function apiUpsertPatient(payload: Record<string, unknown>) {
  try {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
