/**
 * Result review inbox — routine results can be marked reviewed;
 * critical still uses clinicalIntelligenceEngine ACK.
 */
const KEY = 'medcore_os_result_reviews_v1';
const EVT = 'medcore-result-reviews';

export type ResultReviewStatus = 'unreviewed' | 'reviewed';

export interface ResultReview {
  orderId: string;
  facilityId: string;
  patientId: string;
  status: ResultReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewedBadge?: string;
}

function read(): ResultReview[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: ResultReview[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 2000)));
  window.dispatchEvent(new CustomEvent(EVT));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
}

export function getReview(orderId: string): ResultReview | undefined {
  return read().find((r) => r.orderId === orderId);
}

export function isReviewed(orderId: string): boolean {
  return getReview(orderId)?.status === 'reviewed';
}

export function markResultReviewed(
  orderId: string,
  input: { facilityId: string; patientId: string; by: string; badge?: string }
): ResultReview {
  const list = read().filter((r) => r.orderId !== orderId);
  const row: ResultReview = {
    orderId,
    facilityId: input.facilityId,
    patientId: input.patientId,
    status: 'reviewed',
    reviewedBy: input.by,
    reviewedBadge: input.badge,
    reviewedAt: new Date().toISOString(),
  };
  write([row, ...list]);
  return row;
}

export function listReviews(facilityId: string): ResultReview[] {
  return read().filter((r) => r.facilityId === facilityId);
}

export function subscribeResultReviews(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
  };
}
