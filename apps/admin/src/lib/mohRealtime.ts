'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MohAuditRecord,
  MohCitizenGrievance,
  MohDirective,
  MohEnforcementAction,
  MohFacilityDossier,
  MohFacilityTelemetry,
  MohHrhRecruitment,
  MohIdsrReport,
  MohLiveSnapshot,
  MohOperationalStatus,
  MohOutbreakAlert,
  MohPrivateFacilityRecord,
  MohSupplyEquipmentItem,
  MohSyncStatus,
  MohTransferRecord,
} from './mohTypes';

export interface UseMohSyncState {
  snapshot: MohLiveSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  syncMode: MohSyncStatus;
  refreshNow: () => Promise<void>;
}

export function useMohSync(districtFilter = 'all'): UseMohSyncState {
  const [snapshot, setSnapshot] = useState<MohLiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchSnapshot = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading((prev) => (snapshot ? prev : true));

      try {
        const params = new URLSearchParams();
        if (districtFilter && districtFilter !== 'all') {
          params.set('district', districtFilter);
        }
        const qs = params.toString();
        const res = await fetch(`/api/moh/snapshot${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          snapshot?: MohLiveSnapshot;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.snapshot) {
          throw new Error(json.error || 'Could not synchronize Ministry telemetry.');
        }
        setSnapshot(json.snapshot);
        setError(null);
        lastFetchRef.current = Date.now();
      } catch (err) {
        setError((err as Error)?.message || 'Telemetry sync unavailable.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [districtFilter] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    void fetchSnapshot(false);
  }, [fetchSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/moh/stream');
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { type?: string };
          if (
            msg.type === 'directive' ||
            msg.type === 'audit' ||
            msg.type === 'transfer' ||
            msg.type === 'facility' ||
            msg.type === 'alert' ||
            msg.type === 'enforcement' ||
            msg.type === 'hrh' ||
            msg.type === 'supply' ||
            msg.type === 'idsr' ||
            msg.type === 'grievance'
          ) {
            void fetchSnapshot(true);
          } else if (
            msg.type === 'sync_tick' &&
            typeof document !== 'undefined' &&
            document.visibilityState === 'visible' &&
            Date.now() - lastFetchRef.current >= 25_000
          ) {
            void fetchSnapshot(true);
          }
        } catch {
          /* ignore malformed SSE packet */
        }
      };
    } catch {
      /* fallback interval handles sync */
    }

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() - lastFetchRef.current >= 28_000) {
        void fetchSnapshot(true);
      }
    }, 30_000);

    return () => {
      clearInterval(timer);
      try {
        es?.close();
      } catch {
        /* ignore */
      }
    };
  }, [fetchSnapshot]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    lastSyncedAt: snapshot?.syncedAt || null,
    syncMode: snapshot?.syncMode || 'local_registry',
    refreshNow: () => fetchSnapshot(true),
  };
}

async function apiJson<T>(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || 'Request failed.' };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Network error.' };
  }
}

export async function broadcastMohDirective(input: {
  title: string;
  summary: string;
  category?: string;
  severity?: MohDirective['severity'];
  targetDistricts?: string[];
  mandatoryActions?: string[];
  effectiveUntil?: string;
  issuedBy?: string;
}) {
  return apiJson<{ directive: MohDirective }>('/api/moh/directives', 'POST', input);
}

export async function updateMohDirectiveStatus(id: string, status: MohDirective['status']) {
  return apiJson<{ directive: MohDirective }>('/api/moh/directives', 'PATCH', { id, status });
}

export async function scheduleMohAudit(input: {
  facilityId: string;
  facilityName: string;
  auditDate: string;
  auditorName: string;
  category: string;
  resolutionDeadline?: string;
  notes?: string;
}) {
  return apiJson<{ audit: MohAuditRecord }>('/api/moh/audits', 'POST', input);
}

export async function updateMohAuditStatus(
  id: string,
  patch: Partial<Pick<MohAuditRecord, 'status' | 'findingsCount' | 'criticalViolations' | 'notes'>>
) {
  return apiJson<{ audit: MohAuditRecord }>('/api/moh/audits', 'PATCH', { id, ...patch });
}

export async function createMohTransfer(input: {
  staffBadge?: string;
  staffName: string;
  cadre: string;
  fromFacilityId: string;
  fromFacilityName: string;
  toFacilityId: string;
  toFacilityName: string;
  transferType?: MohTransferRecord['transferType'];
  urgency?: MohTransferRecord['urgency'];
  reason: string;
  requestedBy?: string;
}) {
  return apiJson<{ transfer: MohTransferRecord }>('/api/moh/transfers', 'POST', input);
}

export async function updateMohTransferStatus(
  id: string,
  status: MohTransferRecord['status'],
  decidedBy: string
) {
  return apiJson<{ transfer: MohTransferRecord }>('/api/moh/transfers', 'PATCH', { id, status, decidedBy });
}

export async function updateMohFacilityOversight(input: {
  facilityId: string;
  emergencyStatus?: MohFacilityTelemetry['emergencyStatus'];
  accreditationStatus?: MohFacilityTelemetry['accreditationStatus'];
  operationalStatus?: MohOperationalStatus;
  licenseNo?: string;
  licenseExpiry?: string;
  approvedServices?: string[];
  ownership?: string;
  unapprovedPracticeFlag?: boolean;
  notes?: string;
  updatedBy?: string;
}) {
  return apiJson<{ facilityId: string }>('/api/moh/facilities', 'PATCH', input);
}

export async function registerPrivateFacility(input: {
  facilityId?: string;
  facilityName: string;
  lga: string;
  district?: MohFacilityTelemetry['district'];
  ownership?: MohPrivateFacilityRecord['ownership'];
  facilityType?: string;
  licenseNo?: string;
  licenseExpiry?: string;
  approvedServices?: string[];
  latitude?: number;
  longitude?: number;
  registeredBy?: string;
}) {
  return apiJson<{ facility: MohPrivateFacilityRecord }>('/api/moh/enforcement', 'POST', {
    action: 'register_private',
    ...input,
  });
}

export async function createEnforcementAction(input: {
  facilityId: string;
  facilityName?: string;
  lga?: string;
  district?: MohFacilityTelemetry['district'];
  actionType: MohEnforcementAction['actionType'];
  reason: string;
  checklist?: { label: string; passed: boolean }[];
  evidencePhotoData?: string;
  officerName: string;
  followUpDate?: string;
}) {
  return apiJson<{ actionRecord: MohEnforcementAction }>('/api/moh/enforcement', 'POST', input);
}

export async function updateEnforcementAction(input: {
  id: string;
  status?: MohEnforcementAction['status'];
  followUpDate?: string;
  resolutionNotes?: string;
  unsealFacility?: boolean;
  updatedBy?: string;
}) {
  return apiJson<{ actionRecord: MohEnforcementAction }>('/api/moh/enforcement', 'PATCH', input);
}

export async function createHrhRecruitment(input: {
  title: string;
  cadre: string;
  facilityId: string;
  facilityName?: string;
  lga?: string;
  vacanciesCount?: number;
  applicantsCount?: number;
  shortlistedCount?: number;
  deployedCount?: number;
  stage?: MohHrhRecruitment['stage'];
  postedBy?: string;
}) {
  return apiJson<{ recruitment: MohHrhRecruitment }>('/api/moh/hrh', 'POST', input);
}

export async function updateHrhRecruitment(input: {
  id: string;
  stage?: MohHrhRecruitment['stage'];
  applicantsCount?: number;
  shortlistedCount?: number;
  deployedCount?: number;
}) {
  return apiJson<{ recruitment: MohHrhRecruitment }>('/api/moh/hrh', 'PATCH', input);
}

export async function saveSupplyEquipment(input: {
  id?: string;
  domain: MohSupplyEquipmentItem['domain'];
  facilityId: string;
  facilityName?: string;
  lga?: string;
  itemName: string;
  category?: string;
  quantity?: number;
  reorderLevel?: number;
  unit?: string;
  coldChainTempC?: number | null;
  functionalStatus?: MohSupplyEquipmentItem['functionalStatus'];
  notes?: string;
  updatedBy?: string;
}) {
  return apiJson<{ item: MohSupplyEquipmentItem }>('/api/moh/supply-infra', 'POST', input);
}

export async function updateSupplyEquipment(input: {
  id: string;
  quantity?: number;
  coldChainTempC?: number | null;
  functionalStatus?: MohSupplyEquipmentItem['functionalStatus'];
  notes?: string;
  updatedBy?: string;
}) {
  return apiJson<{ item: MohSupplyEquipmentItem }>('/api/moh/supply-infra', 'PATCH', input);
}

export async function createIdsrReport(input: {
  reportKind: MohIdsrReport['reportKind'];
  facilityId?: string;
  facilityName?: string;
  lga: string;
  district?: MohFacilityTelemetry['district'];
  periodLabel?: string;
  disease?: string;
  suspectedCases?: number;
  confirmedCases?: number;
  deaths?: number;
  ancVisits?: number;
  skilledDeliveries?: number;
  immunizationDoses?: number;
  emergencyReferrals?: number;
  maternalDeaths?: number;
  under5Deaths?: number;
  dsnoOfficer?: string;
  notes?: string;
}) {
  return apiJson<{ report: MohIdsrReport }>('/api/moh/idsr', 'POST', input);
}

export async function updateIdsrReport(input: {
  id: string;
  status?: MohIdsrReport['status'];
  confirmedCases?: number;
  deaths?: number;
  notes?: string;
}) {
  return apiJson<{ report: MohIdsrReport }>('/api/moh/idsr', 'PATCH', input);
}

export async function submitCitizenGrievance(input: {
  facilityId: string;
  facilityName?: string;
  lga?: string;
  channel?: MohCitizenGrievance['channel'];
  category?: MohCitizenGrievance['category'];
  rating?: number;
  summary: string;
  anonymous?: boolean;
}) {
  return apiJson<{ grievance: MohCitizenGrievance }>('/api/moh/grievances', 'POST', input);
}

export async function updateCitizenGrievance(input: {
  id: string;
  status?: MohCitizenGrievance['status'];
  assignedTo?: string;
  resolutionNotes?: string;
}) {
  return apiJson<{ grievance: MohCitizenGrievance }>('/api/moh/grievances', 'PATCH', input);
}

export async function createOrToggleMohAlert(input: {
  id?: string;
  toggleContainment?: boolean;
  condition?: string;
  icd10Category?: string;
  detectedCases?: number;
  rateOfIncrease?: number;
  affectedDistricts?: string[];
  severity?: MohOutbreakAlert['severity'];
  reportingFacilities?: number;
  notes?: string;
}) {
  const method = input.toggleContainment ? 'PATCH' : 'POST';
  return apiJson<{ alert: MohOutbreakAlert }>('/api/moh/alerts', method, input);
}

export async function fetchMohFacilityDossier(
  facilityId: string
): Promise<{ ok: boolean; dossier?: MohFacilityDossier; error?: string }> {
  try {
    const res = await fetch(`/api/moh/facilities/${encodeURIComponent(facilityId)}`, {
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      dossier?: MohFacilityDossier;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.dossier) {
      return { ok: false, error: json.error || 'Could not load facility dossier.' };
    }
    return { ok: true, dossier: json.dossier };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Network error loading facility dossier.' };
  }
}

export async function sendMohFacilityNotice(input: {
  facilityId: string;
  title: string;
  body: string;
  level?: 'info' | 'warning' | 'alert';
  sentBy?: string;
}) {
  return apiJson<{ facilityId: string; sentAt: string }>(
    `/api/moh/facilities/${encodeURIComponent(input.facilityId)}`,
    'POST',
    input
  );
}
