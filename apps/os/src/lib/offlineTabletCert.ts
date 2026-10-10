/**
 * Offline / weak-link + tablet readiness checks for rural PHC deployment.
 */

export type CertLevel = 'pass' | 'warn' | 'fail';

export interface CertCheck {
  id: string;
  label: string;
  level: CertLevel;
  detail: string;
}

export function runOfflineTabletCertification(): CertCheck[] {
  const checks: CertCheck[] = [];
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  checks.push({
    id: 'network',
    label: 'Network',
    level: online ? 'pass' : 'warn',
    detail: online ? 'Online — background sync can flush outbox' : 'Offline — local writes must use outbox',
  });

  let ls = false;
  try {
    localStorage.setItem('__medcore_cert', '1');
    ls = localStorage.getItem('__medcore_cert') === '1';
    localStorage.removeItem('__medcore_cert');
  } catch {
    ls = false;
  }
  checks.push({
    id: 'localStorage',
    label: 'Local durable store',
    level: ls ? 'pass' : 'fail',
    detail: ls ? 'localStorage writable' : 'localStorage blocked — offline mode unsafe',
  });

  let idb = typeof indexedDB !== 'undefined';
  checks.push({
    id: 'indexeddb',
    label: 'IndexedDB',
    level: idb ? 'pass' : 'warn',
    detail: idb ? 'Available for larger offline queues' : 'Not available — rely on localStorage outbox',
  });

  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  checks.push({
    id: 'viewport',
    label: 'Viewport (tablet/ward)',
    level: w < 360 ? 'fail' : w < 768 ? 'pass' : 'pass',
    detail: w < 768 ? `Mobile/tablet width ${w}px — touch desks preferred` : `Desktop width ${w}px`,
  });

  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  checks.push({
    id: 'touch',
    label: 'Touch input',
    level: touch ? 'pass' : 'warn',
    detail: touch ? 'Touch device detected' : 'No touch — OK for desktop records/billing',
  });

  try {
    const outbox = localStorage.getItem('medcore_os_sync_outbox_v1') || localStorage.getItem('medcore_os_sync_outbox_v1');
    const n = outbox ? JSON.parse(outbox).length : 0;
    checks.push({
      id: 'outbox',
      label: 'Sync outbox',
      level: n > 500 ? 'warn' : 'pass',
      detail: `${n} queued change(s) waiting for cloud/LAN sync`,
    });
  } catch {
    checks.push({ id: 'outbox', label: 'Sync outbox', level: 'pass', detail: 'Outbox empty or not initialized' });
  }

  return checks;
}

export function certSummary(checks: CertCheck[]): { ready: boolean; fails: number; warns: number } {
  const fails = checks.filter((c) => c.level === 'fail').length;
  const warns = checks.filter((c) => c.level === 'warn').length;
  return { ready: fails === 0, fails, warns };
}
