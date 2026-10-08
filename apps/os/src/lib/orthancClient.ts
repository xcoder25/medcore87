/**
 * Live Orthanc REST helpers — list studies, link to MedCore imaging orders.
 * Uses hub Orthanc URL from device gateway (LAN). CORS may require hub proxy.
 */
import { loadGatewayConfig, appendGatewayLog } from './deviceGatewayStore';
import { listOrders, updateOrderStatus, type ClinicalOrder } from './clinicalEventBus';
import { publishFacilityData } from './roleSyncBus';

export interface OrthancStudyRef {
  id: string;
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  studyDescription?: string;
  modalities?: string;
  orthancUrl: string;
  viewerUrl?: string;
}

const LINK_KEY = 'medcore_os_orthanc_links_v1';
const EVT = 'medcore-orthanc-links';

export interface OrderStudyLink {
  orderId: string;
  facilityId: string;
  studyId: string;
  orthancBase: string;
  viewerUrl: string;
  studyDescription?: string;
  linkedAt: string;
  linkedBy?: string;
}

function authHeader(user?: string, pass?: string): HeadersInit {
  if (!user) return {};
  const token = typeof btoa !== 'undefined' ? btoa(`${user}:${pass || ''}`) : '';
  return token ? { Authorization: `Basic ${token}` } : {};
}

export async function fetchOrthancStudies(facilityId: string): Promise<{
  ok: boolean;
  studies: OrthancStudyRef[];
  message: string;
}> {
  const cfg = loadGatewayConfig(facilityId);
  if (!cfg.orthancEnabled) {
    return { ok: false, studies: [], message: 'Orthanc disabled in device gateway' };
  }
  const base = cfg.orthancUrl.replace(/\/$/, '');
  try {
    // Prefer same-origin proxy (avoids CORS on hospital LAN)
    let res: Response | null = null;
    try {
      const q = new URLSearchParams({
        base,
        user: cfg.orthancUser || '',
        pass: cfg.orthancPass || '',
      });
      res = await fetch(`/api/orthanc/studies?${q.toString()}`);
    } catch {
      res = null;
    }
    if (!res || !res.ok) {
      res = await fetch(`${base}/studies`, {
        headers: authHeader(cfg.orthancUser, cfg.orthancPass),
        mode: 'cors',
      });
    }
    if (!res.ok) {
      return {
        ok: false,
        studies: [],
        message: `Orthanc HTTP ${res.status}. Check hub URL/CORS or use Link simulated study.`,
      };
    }
    const ids: string[] = await res.json();
    const studies: OrthancStudyRef[] = [];
    for (const id of ids.slice(0, 30)) {
      try {
        const metaRes = await fetch(`${base}/studies/${id}`, {
          headers: authHeader(cfg.orthancUser, cfg.orthancPass),
          mode: 'cors',
        });
        if (!metaRes.ok) continue;
        const meta = await metaRes.json();
        const tags = meta?.MainDicomTags || {};
        const pt = meta?.PatientMainDicomTags || {};
        studies.push({
          id,
          patientName: pt.PatientName || tags.PatientName,
          patientId: pt.PatientID,
          studyDate: tags.StudyDate,
          studyDescription: tags.StudyDescription || tags.StudyID,
          modalities: (meta?.RequestedTags?.ModalitiesInStudy as string) || undefined,
          orthancUrl: `${base}/studies/${id}`,
          viewerUrl: `${base}/app/explorer.html#study?uuid=${id}`,
        });
      } catch {
        /* skip */
      }
    }
    appendGatewayLog({
      id: `GW-${Date.now()}`,
      at: new Date().toISOString(),
      level: 'ok',
      source: 'dicom',
      message: `Orthanc listed ${studies.length} studies`,
      detail: base,
    });
    return { ok: true, studies, message: `${studies.length} studies from Orthanc` };
  } catch (e) {
    return {
      ok: false,
      studies: [],
      message: `Cannot reach Orthanc (${(e as Error)?.message || 'network'}). Use hub LAN or simulate link.`,
    };
  }
}

function readLinks(): OrderStudyLink[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LINK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLinks(list: OrderStudyLink[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LINK_KEY, JSON.stringify(list.slice(0, 500)));
  window.dispatchEvent(new CustomEvent(EVT));
  try {
    publishFacilityData(list[0]?.facilityId || 'IGH-EKT', LINK_KEY, list);
  } catch {
    /* */
  }
}

export function getLinkForOrder(orderId: string): OrderStudyLink | undefined {
  return readLinks().find((l) => l.orderId === orderId);
}

export function listStudyLinks(facilityId: string): OrderStudyLink[] {
  return readLinks().filter((l) => l.facilityId === facilityId);
}

export function linkStudyToOrder(input: {
  facilityId: string;
  orderId: string;
  study: OrthancStudyRef;
  actorName?: string;
}): OrderStudyLink {
  const cfg = loadGatewayConfig(input.facilityId);
  const base = cfg.orthancUrl.replace(/\/$/, '');
  const row: OrderStudyLink = {
    orderId: input.orderId,
    facilityId: input.facilityId,
    studyId: input.study.id,
    orthancBase: base,
    viewerUrl: input.study.viewerUrl || `${base}/app/explorer.html#study?uuid=${input.study.id}`,
    studyDescription: input.study.studyDescription,
    linkedAt: new Date().toISOString(),
    linkedBy: input.actorName,
  };
  writeLinks([row, ...readLinks().filter((l) => l.orderId !== input.orderId)]);
  // Annotate order notes with study link (status stays until report)
  const order = listOrders(input.facilityId).find((o) => o.id === input.orderId);
  if (order && order.status === 'ordered') {
    updateOrderStatus(input.orderId, 'in_progress');
  }
  appendGatewayLog({
    id: `GW-${Date.now()}`,
    at: new Date().toISOString(),
    level: 'ok',
    source: 'dicom',
    message: `Study ${input.study.id} linked to ${input.orderId}`,
    detail: input.study.studyDescription,
  });
  return row;
}

/** When Orthanc is unreachable — create a deterministic study id linked to order */
export function linkSimulatedStudy(input: {
  facilityId: string;
  order: ClinicalOrder;
  actorName?: string;
}): OrderStudyLink {
  const cfg = loadGatewayConfig(input.facilityId);
  const base = cfg.orthancUrl.replace(/\/$/, '');
  const studyId = `SIM-${input.order.id}`;
  return linkStudyToOrder({
    facilityId: input.facilityId,
    orderId: input.order.id,
    actorName: input.actorName,
    study: {
      id: studyId,
      patientName: input.order.patientName,
      patientId: input.order.hospitalNumber,
      studyDescription: input.order.name,
      orthancUrl: `${base}/studies/${studyId}`,
      viewerUrl: `${base}/app/explorer.html#study?uuid=${studyId}`,
    },
  });
}

export function subscribeOrthancLinks(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
  };
}
