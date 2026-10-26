/**
 * Active facility context — switches local listeners / cache scope without full reload.
 */

const ACTIVE_FACILITY_KEY = 'medcore_os_active_facility_id';
export const FACILITY_SWITCH_EVENT = 'medcore-facility-switch';

export function getActiveFacilityId(fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const fromSession = localStorage.getItem('medcore_os_session');
    if (fromSession) {
      const hid = String(JSON.parse(fromSession)?.hospitalId || '').trim();
      if (hid) return hid;
    }
  } catch {
    /* */
  }
  try {
    return localStorage.getItem(ACTIVE_FACILITY_KEY) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Switch active facility: updates session hospitalId, notifies listeners to resubscribe.
 */
export function switchActiveFacility(facilityId: string, facilityName?: string): void {
  if (typeof window === 'undefined') return;
  const fid = String(facilityId || '').trim();
  if (!fid) return;
  try {
    localStorage.setItem(ACTIVE_FACILITY_KEY, fid);
  } catch {
    /* */
  }
  try {
    const raw = localStorage.getItem('medcore_os_session');
    if (raw) {
      const session = JSON.parse(raw);
      session.hospitalId = fid;
      if (facilityName) session.facility = facilityName;
      localStorage.setItem('medcore_os_session', JSON.stringify(session));
    }
  } catch {
    /* */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(FACILITY_SWITCH_EVENT, {
        detail: { facilityId: fid, facilityName: facilityName || fid },
      })
    );
    window.dispatchEvent(new CustomEvent('medcore-facility-cloud', { detail: { facilityId: fid } }));
  } catch {
    /* */
  }
}

export function subscribeFacilitySwitch(cb: (facilityId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = (e: Event) => {
    const d = (e as CustomEvent).detail;
    cb(String(d?.facilityId || ''));
  };
  window.addEventListener(FACILITY_SWITCH_EVENT, fn);
  return () => window.removeEventListener(FACILITY_SWITCH_EVENT, fn);
}
