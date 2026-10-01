/** NDPR-oriented admin/clinical audit trail (local + syncable) */

export type AuditEvent = {
  id: string;
  at: string;
  facilityId: string;
  actor: string;
  actorBadge?: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
};

const KEY = 'medcore_os_audit_log_v1';

function read(): AuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: AuditEvent[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 2000)));
  window.dispatchEvent(new CustomEvent('medcore-audit', { detail: list }));
}

export function appendAudit(input: Omit<AuditEvent, 'id' | 'at'>): AuditEvent {
  const ev: AuditEvent = {
    ...input,
    id: `AUD-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
  };
  write([ev, ...read()]);
  return ev;
}

export function listAudit(facilityId?: string, limit = 100): AuditEvent[] {
  const all = read();
  const filtered = facilityId ? all.filter((e) => e.facilityId === facilityId) : all;
  return filtered.slice(0, limit);
}

export function exportAuditCsv(facilityId?: string): string {
  const rows = listAudit(facilityId, 2000);
  const header = 'id,at,facilityId,actor,action,entity,entityId,detail';
  const lines = rows.map((r) =>
    [r.id, r.at, r.facilityId, r.actor, r.action, r.entity || '', r.entityId || '', JSON.stringify(r.detail || '')]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export function subscribeAudit(cb: () => void): () => void {
  const fn = () => cb();
  window.addEventListener('medcore-audit', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('medcore-audit', fn);
    window.removeEventListener('storage', fn);
  };
}
