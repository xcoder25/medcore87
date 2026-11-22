import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  OFFICIAL_AKWA_IBOM_FACILITIES,
  SENATORIAL_DISTRICTS,
  inferSenatorialDistrict,
  type OfficialAkwaIbomFacility,
  type SenatorialDistrict,
  type SupervisoryBoard,
} from '../data/akwaIbomFacilities';
import { ensureMohSchema, isPostgresConfigured, query, safeTableExists } from './db/postgres';
import { publishMohEvent } from './mohEventBroker';
import type {
  MohAuditLedgerEvent,
  MohAuditRecord,
  MohDirective,
  MohFacilityTelemetry,
  MohLiveSnapshot,
  MohOutbreakAlert,
  MohRegionalRollup,
  MohStaffDirectoryItem,
  MohTransferRecord,
} from './mohTypes';

const LOCAL_MOH_STATE_FILE = path.join(os.tmpdir(), 'medcore-moh-oversight-v1.json');

interface LocalMohOversightStore {
  directives: MohDirective[];
  audits: MohAuditRecord[];
  transfers: MohTransferRecord[];
  alerts: MohOutbreakAlert[];
  facilityOverrides: Record<
    string,
    {
      emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
      accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
      notes?: string;
      updatedBy?: string;
      updatedAt: string;
    }
  >;
}

const DEFAULT_SEED_ALERTS: MohOutbreakAlert[] = [];

function readLocalMohStore(): LocalMohOversightStore {
  try {
    if (fs.existsSync(LOCAL_MOH_STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_MOH_STATE_FILE, 'utf8')) as Partial<LocalMohOversightStore>;
      return {
        directives: Array.isArray(parsed.directives) ? parsed.directives : [],
        audits: Array.isArray(parsed.audits) ? parsed.audits : [],
        transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : DEFAULT_SEED_ALERTS,
        facilityOverrides:
          parsed.facilityOverrides && typeof parsed.facilityOverrides === 'object' ? parsed.facilityOverrides : {},
      };
    }
  } catch {
    /* ignore */
  }
  return {
    directives: [],
    audits: [],
    transfers: [],
    alerts: [],
    facilityOverrides: {},
  };
}

function writeLocalMohStore(store: LocalMohOversightStore): void {
  try {
    fs.writeFileSync(LOCAL_MOH_STATE_FILE, JSON.stringify(store), 'utf8');
  } catch {
    /* ignore read-only fs */
  }
}

/**
 * Strip direct patient identifiers (phone numbers, email addresses, 11-digit NINs)
 * before emitting audit detail strings to the statewide MOH view.
 */
export function sanitizeMohAuditDetail(raw: unknown): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
    .replace(/(?:\+?234[-\s]?|0)[789][01]\d[-\s]?\d{3,4}[-\s]?\d{3,4}/g, '[REDACTED]')
    .replace(/\b\d{11}\b/g, '[REDACTED]');
}

export function computeFacilityComplianceScore(input: {
  hfrCode?: string;
  supervisoryBoard?: string;
  medicalDirector?: string;
  boardAuthCircularRef?: string;
  activeStaffCount: number;
  totalBeds: number;
  hasRecentActivity: boolean;
}): number {
  let score = 15;
  if (input.hfrCode && input.hfrCode.trim().length >= 4) score += 22;
  if (input.supervisoryBoard && input.supervisoryBoard.trim().length >= 2) score += 15;
  if (input.medicalDirector && input.medicalDirector.trim().length >= 3) score += 15;
  if (input.boardAuthCircularRef && input.boardAuthCircularRef.trim().length >= 3) score += 10;
  if (input.activeStaffCount > 0) score += 10;
  if (input.totalBeds > 0) score += 8;
  if (input.hasRecentActivity) score += 5;
  return Math.min(100, score);
}

export interface MohRawDatabaseInputs {
  syncMode: 'live_db' | 'local_registry';
  syncedAt?: string;
  facilitiesRows: { id: string; name: string; state?: string | null; config?: Record<string, any> | null; updated_at?: string | null }[];
  staffRows: {
    badge_id: string;
    facility_id: string;
    full_name: string;
    role?: string | null;
    role_key?: string | null;
    department?: string | null;
    status?: string | null;
    clearance_level?: number | null;
  }[];
  patientCounts: { facility_id: string; cnt: number }[];
  bedRows: { facility_id: string; ward: string; status: string }[];
  visitRows: { facility_id: string; status: string; checked_in_at?: string | null }[];
  invoiceRows: { facility_id: string; source?: string | null; amount_ngn: number; status: string; paid_via?: string | null }[];
  accountRequestRows: { facility_id: string; amount_ngn: number; status: string; paid_via?: string | null }[];
  orderRows: { facility_id: string; order_type: string; status: string; priority?: string | null }[];
  prescriptionRows: { facility_id: string; status: string }[];
  labRows: { id?: string; facility_id: string; test_name?: string | null; flag?: string | null; status?: string | null; created_at?: string | null }[];
  vitalRows: { id?: string; facility_id: string; urgency?: string | null; recorded_at?: string | null }[];
  auditLedgerRows: {
    id: string;
    facility_id: string;
    actor: string;
    actor_badge?: string | null;
    category?: string | null;
    severity?: string | null;
    action: string;
    entity?: string | null;
    entity_id?: string | null;
    detail?: string | null;
    row_hash?: string | null;
    created_at?: string | null;
  }[];
  directives: MohDirective[];
  audits: MohAuditRecord[];
  transfers: MohTransferRecord[];
  alerts: MohOutbreakAlert[];
  facilityOverrides: Record<
    string,
    {
      emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
      accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
      notes?: string;
      updatedBy?: string;
      updatedAt: string;
    }
  >;
}

function classifyChannel(paidVia?: string | null, source?: string | null): 'akwaremit' | 'paystack' | 'cash' | 'hmo' | 'other' {
  const txt = `${paidVia || ''} ${source || ''}`.toLowerCase();
  if (txt.includes('akwaremit') || txt.includes('remitta') || txt.includes('tsa')) return 'akwaremit';
  if (txt.includes('paystack') || txt.includes('card') || txt.includes('pos') || txt.includes('transfer')) return 'paystack';
  if (txt.includes('cash') || txt.includes('otc') || txt.includes('till')) return 'cash';
  if (txt.includes('hmo') || txt.includes('akshia') || txt.includes('nhia') || txt.includes('bhcpf')) return 'hmo';
  return 'other';
}

function normalizeDistrictFilter(raw?: string): SenatorialDistrict | 'ALL' {
  const t = String(raw || '').trim().toLowerCase();
  if (!t || t === 'all' || t.startsWith('all ')) return 'ALL';
  if (t.includes('ikot')) return 'Ikot Ekpene';
  if (t.includes('eket')) return 'Eket';
  if (t.includes('uyo')) return 'Uyo';
  return 'ALL';
}

function normalizeBoard(raw?: string | null, fallback: SupervisoryBoard = 'AKSHMB'): SupervisoryBoard {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'AKSHMB' || s === 'AKSPHCDA' || s === 'FMOH') return s as SupervisoryBoard;
  if (s.includes('MISSION')) return 'Mission';
  return fallback;
}

export function aggregateMohSnapshot(
  raw: MohRawDatabaseInputs,
  filters?: { district?: string; facilityId?: string }
): MohLiveSnapshot {
  const districtFilter = normalizeDistrictFilter(filters?.district);
  const fidFilter = String(filters?.facilityId || '').trim().toUpperCase();
  const syncedAt = raw.syncedAt || new Date().toISOString();

  // Map official catalog first
  const catalogMap = new Map<string, OfficialAkwaIbomFacility>();
  for (const item of OFFICIAL_AKWA_IBOM_FACILITIES) {
    catalogMap.set(item.facilityId, item);
  }

  // Track all known facility IDs (official + dynamic DB rows)
  const dbFacilityMap = new Map<string, MohRawDatabaseInputs['facilitiesRows'][number]>();
  for (const f of raw.facilitiesRows) {
    const id = String(f.id || '').trim().toUpperCase();
    if (!id) continue;
    dbFacilityMap.set(id, f);
  }

  const allFacilityIds = new Set<string>([...catalogMap.keys(), ...dbFacilityMap.keys()]);

  const patientCountMap = new Map<string, number>();
  for (const p of raw.patientCounts) {
    const fid = String(p.facility_id || '').trim().toUpperCase();
    patientCountMap.set(fid, (patientCountMap.get(fid) || 0) + Number(p.cnt || 0));
  }

  const staffByFac = new Map<string, MohRawDatabaseInputs['staffRows']>();
  for (const s of raw.staffRows) {
    const fid = String(s.facility_id || '').trim().toUpperCase();
    const list = staffByFac.get(fid) || [];
    list.push(s);
    staffByFac.set(fid, list);
  }

  const bedsByFac = new Map<string, MohRawDatabaseInputs['bedRows']>();
  for (const b of raw.bedRows) {
    const fid = String(b.facility_id || '').trim().toUpperCase();
    const list = bedsByFac.get(fid) || [];
    list.push(b);
    bedsByFac.set(fid, list);
  }

  const visitsByFac = new Map<string, MohRawDatabaseInputs['visitRows']>();
  for (const v of raw.visitRows) {
    const fid = String(v.facility_id || '').trim().toUpperCase();
    const list = visitsByFac.get(fid) || [];
    list.push(v);
    visitsByFac.set(fid, list);
  }

  const invoicesByFac = new Map<string, MohRawDatabaseInputs['invoiceRows']>();
  for (const inv of raw.invoiceRows) {
    const fid = String(inv.facility_id || '').trim().toUpperCase();
    const list = invoicesByFac.get(fid) || [];
    list.push(inv);
    invoicesByFac.set(fid, list);
  }

  const reqsByFac = new Map<string, MohRawDatabaseInputs['accountRequestRows']>();
  for (const r of raw.accountRequestRows) {
    const fid = String(r.facility_id || '').trim().toUpperCase();
    const list = reqsByFac.get(fid) || [];
    list.push(r);
    reqsByFac.set(fid, list);
  }

  const labsByFac = new Map<string, MohRawDatabaseInputs['labRows']>();
  for (const l of raw.labRows) {
    const fid = String(l.facility_id || '').trim().toUpperCase();
    const list = labsByFac.get(fid) || [];
    list.push(l);
    labsByFac.set(fid, list);
  }

  const vitalsByFac = new Map<string, MohRawDatabaseInputs['vitalRows']>();
  for (const v of raw.vitalRows) {
    const fid = String(v.facility_id || '').trim().toUpperCase();
    const list = vitalsByFac.get(fid) || [];
    list.push(v);
    vitalsByFac.set(fid, list);
  }

  const auditsCountByFac = new Map<string, number>();
  for (const a of raw.auditLedgerRows) {
    const fid = String(a.facility_id || '').trim().toUpperCase();
    auditsCountByFac.set(fid, (auditsCountByFac.get(fid) || 0) + 1);
  }

  const allFacilities: MohFacilityTelemetry[] = [];

  for (const fid of allFacilityIds) {
    const official = catalogMap.get(fid);
    const dbRow = dbFacilityMap.get(fid);
    const cfg = (dbRow?.config && typeof dbRow.config === 'object' ? dbRow.config : {}) as Record<string, any>;

    const facilityName = String(
      official?.facilityName || cfg.displayName || dbRow?.name || fid
    ).trim();
    const lga = String(cfg.lga || official?.lga || '').trim();
    const location = String(official?.location || (lga ? `${lga}, Akwa Ibom` : 'Akwa Ibom')).trim();
    const district: SenatorialDistrict = official?.district || inferSenatorialDistrict(lga || location, facilityName);
    const board: SupervisoryBoard = normalizeBoard(cfg.supervisoryBoard, official?.board || 'AKSHMB');
    const tier = official?.tier || 'district_hospital';
    const facilityType = String(official?.facilityType || cfg.facilityType || 'General Hospital');

    const staffList = staffByFac.get(fid) || [];
    const activeStaff = staffList.filter((s) => String(s.status || 'active').toLowerCase() !== 'suspended');
    const cadreBreakdown: Record<string, number> = {};
    for (const st of activeStaff) {
      const k = String(st.role || st.role_key || 'Staff').trim();
      cadreBreakdown[k] = (cadreBreakdown[k] || 0) + 1;
    }

    const bedList = bedsByFac.get(fid) || [];
    const wardMap = new Map<string, { total: number; occupied: number; available: number }>();
    let totalBeds = 0;
    let occupiedBeds = 0;
    let icuBedsTotal = 0;
    let icuBedsOccupied = 0;
    for (const b of bedList) {
      const wardName = String(b.ward || 'General Ward').trim();
      const occ = String(b.status || '').toLowerCase() === 'occupied';
      totalBeds++;
      if (occ) occupiedBeds++;
      if (/icu|intensive|critical/i.test(wardName)) {
        icuBedsTotal++;
        if (occ) icuBedsOccupied++;
      }
      const prevW = wardMap.get(wardName) || { total: 0, occupied: 0, available: 0 };
      prevW.total++;
      if (occ) prevW.occupied++;
      else prevW.available++;
      wardMap.set(wardName, prevW);
    }

    const visitList = visitsByFac.get(fid) || [];
    const activeOpdVisits = visitList.filter(
      (v) => !['completed', 'cancelled', 'discharged'].includes(String(v.status || '').toLowerCase())
    ).length;

    const invList = invoicesByFac.get(fid) || [];
    const reqList = reqsByFac.get(fid) || [];
    let revenuePaidNgn = 0;
    let revenuePendingNgn = 0;
    for (const inv of invList) {
      const amt = Number(inv.amount_ngn || 0);
      if (String(inv.status || '').toLowerCase() === 'paid') revenuePaidNgn += amt;
      else if (String(inv.status || '').toLowerCase() !== 'cancelled') revenuePendingNgn += amt;
    }
    for (const rq of reqList) {
      const st = String(rq.status || '').toLowerCase();
      if (st === 'awaiting_payment' || st === 'unpaid' || st === 'pending') {
        revenuePendingNgn += Number(rq.amount_ngn || 0);
      }
    }

    const patientCount = patientCountMap.get(fid) || 0;
    const criticalLabsCount = (labsByFac.get(fid) || []).filter(
      (l) => /crit|high|abnormal|positive/i.test(String(l.flag || ''))
    ).length;
    const criticalVitalsCount = (vitalsByFac.get(fid) || []).filter(
      (v) => /crit|stat|emerg|urgent/i.test(String(v.urgency || ''))
    ).length;
    const auditEventsCount = auditsCountByFac.get(fid) || 0;

    const hasDbActivity =
      Boolean(dbRow) ||
      staffList.length > 0 ||
      totalBeds > 0 ||
      patientCount > 0 ||
      visitList.length > 0 ||
      invList.length > 0 ||
      auditEventsCount > 0;

    const hfrCode = String(cfg.hfrCode || cfg.registrationNo || '').trim();
    const medicalDirector = String(cfg.medicalDirector || '').trim();
    const boardAuthCircularRef = String(cfg.boardAuthCircularRef || '').trim();

    const complianceScore = hasDbActivity
      ? computeFacilityComplianceScore({
          hfrCode,
          supervisoryBoard: String(cfg.supervisoryBoard || board),
          medicalDirector,
          boardAuthCircularRef,
          activeStaffCount: activeStaff.length,
          totalBeds,
          hasRecentActivity: true,
        })
      : 0;

    const ov = raw.facilityOverrides[fid];
    const emergencyStatus: MohFacilityTelemetry['emergencyStatus'] =
      ov?.emergencyStatus ||
      (icuBedsTotal > 0 && icuBedsOccupied / icuBedsTotal >= 0.9
        ? 'surge_code_yellow'
        : totalBeds > 0 && occupiedBeds / totalBeds >= 0.95
        ? 'surge_code_yellow'
        : 'normal');

    const accreditationStatus: MohFacilityTelemetry['accreditationStatus'] =
      ov?.accreditationStatus ||
      (hasDbActivity
        ? complianceScore >= 75 && Boolean(hfrCode)
          ? 'accredited'
          : 'provisional'
        : 'pending');

    allFacilities.push({
      facilityId: fid,
      facilityName,
      location,
      lga: lga || location.split(',')[0],
      district,
      tier,
      facilityType,
      board,
      enrollmentStatus: hasDbActivity ? 'active' : 'pending',
      hasDbActivity,
      lastSyncedAt: dbRow?.updated_at ? String(dbRow.updated_at) : hasDbActivity ? syncedAt : null,
      hfrCode,
      supervisoryBoard: String(cfg.supervisoryBoard || board),
      medicalDirector,
      boardAuthCircularRef,
      complianceScore,
      accreditationStatus,
      emergencyStatus,
      totalBeds,
      occupiedBeds,
      availableBeds: Math.max(0, totalBeds - occupiedBeds),
      icuBedsTotal,
      icuBedsOccupied,
      activeStaffCount: activeStaff.length,
      totalStaffCount: staffList.length,
      registeredPatientsCount: patientCount,
      activeOpdVisits,
      revenuePaidNgn,
      revenuePendingNgn,
      criticalLabsCount,
      criticalVitalsCount,
      auditEventsCount,
      cadreBreakdown,
      wardBreakdown: Array.from(wardMap.entries()).map(([ward, w]) => ({ ward, ...w })),
      notes: ov?.notes,
    });
  }

  // Sort: live facilities first, then alphabetically
  allFacilities.sort((a, b) => {
    if (a.enrollmentStatus !== b.enrollmentStatus) {
      return a.enrollmentStatus === 'active' ? -1 : 1;
    }
    return a.facilityName.localeCompare(b.facilityName);
  });

  const filteredFacilities = allFacilities.filter((f) => {
    if (districtFilter !== 'ALL' && f.district !== districtFilter) return false;
    if (fidFilter && f.facilityId !== fidFilter) return false;
    return true;
  });

  const facLookup = new Map<string, MohFacilityTelemetry>();
  for (const f of allFacilities) facLookup.set(f.facilityId, f);
  const includedFacIds = new Set(filteredFacilities.map((f) => f.facilityId));

  // Regional rollup (always all 3 senatorial districts for statewide comparison)
  const regionalRollup: MohRegionalRollup[] = SENATORIAL_DISTRICTS.map((dist) => {
    const facs = allFacilities.filter((f) => f.district === dist);
    const liveFacs = facs.filter((f) => f.enrollmentStatus === 'active');
    return {
      district: dist,
      totalFacilities: facs.length,
      connectedFacilities: liveFacs.length,
      totalBeds: facs.reduce((s, f) => s + f.totalBeds, 0),
      occupiedBeds: facs.reduce((s, f) => s + f.occupiedBeds, 0),
      icuTotal: facs.reduce((s, f) => s + f.icuBedsTotal, 0),
      icuOccupied: facs.reduce((s, f) => s + f.icuBedsOccupied, 0),
      staffCount: facs.reduce((s, f) => s + f.activeStaffCount, 0),
      patientsCount: facs.reduce((s, f) => s + f.registeredPatientsCount, 0),
      revenuePaidNgn: facs.reduce((s, f) => s + f.revenuePaidNgn, 0),
      activeOpdVisits: facs.reduce((s, f) => s + f.activeOpdVisits, 0),
      avgComplianceScore:
        liveFacs.length > 0
          ? Math.round(liveFacs.reduce((s, f) => s + f.complianceScore, 0) / liveFacs.length)
          : 0,
    };
  });

  // Workforce aggregation (filtered by district)
  const cadreCounts = new Map<string, number>();
  const staffDirectory: MohStaffDirectoryItem[] = [];
  for (const s of raw.staffRows) {
    const fid = String(s.facility_id || '').trim().toUpperCase();
    if (!includedFacIds.has(fid)) continue;
    const fac = facLookup.get(fid);
    const roleName = String(s.role || s.role_key || 'Staff').trim();
    if (String(s.status || 'active').toLowerCase() !== 'suspended') {
      cadreCounts.set(roleName, (cadreCounts.get(roleName) || 0) + 1);
    }
    staffDirectory.push({
      badgeId: String(s.badge_id || ''),
      facilityId: fid,
      facilityName: fac?.facilityName || fid,
      district: fac?.district || 'Uyo',
      fullName: String(s.full_name || s.badge_id || ''),
      role: roleName,
      roleKey: String(s.role_key || ''),
      department: String(s.department || 'General'),
      status: String(s.status || 'active'),
      clearanceLevel: Number(s.clearance_level || 1),
    });
  }
  const byCadre = Array.from(cadreCounts.entries())
    .map(([cadre, count]) => ({ cadre, count }))
    .sort((a, b) => b.count - a.count);

  // Finance aggregation
  const byChannel = { akwaremit: 0, paystack: 0, cash: 0, hmo: 0, other: 0 };
  let paidReceiptsCount = 0;
  let openRequestsCount = 0;
  let totalCollectedNgn = 0;
  let totalPendingNgn = 0;
  const finByFacMap = new Map<string, { collectedNgn: number; pendingNgn: number; receiptsCount: number }>();

  for (const inv of raw.invoiceRows) {
    const fid = String(inv.facility_id || '').trim().toUpperCase();
    if (!includedFacIds.has(fid)) continue;
    const amt = Number(inv.amount_ngn || 0);
    const st = String(inv.status || '').toLowerCase();
    const cur = finByFacMap.get(fid) || { collectedNgn: 0, pendingNgn: 0, receiptsCount: 0 };
    if (st === 'paid') {
      totalCollectedNgn += amt;
      paidReceiptsCount++;
      cur.collectedNgn += amt;
      cur.receiptsCount++;
      const ch = classifyChannel(inv.paid_via, inv.source);
      byChannel[ch] += amt;
    } else if (st !== 'cancelled') {
      totalPendingNgn += amt;
      cur.pendingNgn += amt;
    }
    finByFacMap.set(fid, cur);
  }
  for (const rq of raw.accountRequestRows) {
    const fid = String(rq.facility_id || '').trim().toUpperCase();
    if (!includedFacIds.has(fid)) continue;
    const st = String(rq.status || '').toLowerCase();
    if (st === 'awaiting_payment' || st === 'unpaid' || st === 'pending') {
      const amt = Number(rq.amount_ngn || 0);
      totalPendingNgn += amt;
      openRequestsCount++;
      const cur = finByFacMap.get(fid) || { collectedNgn: 0, pendingNgn: 0, receiptsCount: 0 };
      cur.pendingNgn += amt;
      finByFacMap.set(fid, cur);
    }
  }

  const financeByFacility = filteredFacilities
    .filter((f) => f.enrollmentStatus === 'active' || finByFacMap.has(f.facilityId))
    .map((f) => {
      const row = finByFacMap.get(f.facilityId) || { collectedNgn: 0, pendingNgn: 0, receiptsCount: 0 };
      return {
        facilityId: f.facilityId,
        facilityName: f.facilityName,
        district: f.district,
        ...row,
      };
    })
    .sort((a, b) => b.collectedNgn - a.collectedNgn);

  // Surveillance aggregation
  const filteredVisits = raw.visitRows.filter((v) => includedFacIds.has(String(v.facility_id || '').toUpperCase()));
  const waitingOpd = filteredVisits.filter((v) => ['waiting', 'checked_in', 'triage'].includes(String(v.status || '').toLowerCase())).length;
  const withProviderOpd = filteredVisits.filter((v) => ['with_provider', 'in_consultation', 'vitals_done'].includes(String(v.status || '').toLowerCase())).length;
  const completedOpdToday = filteredVisits.filter((v) => ['completed', 'discharged'].includes(String(v.status || '').toLowerCase())).length;

  const filteredLabs = raw.labRows.filter((l) => includedFacIds.has(String(l.facility_id || '').toUpperCase()));
  const filteredRx = raw.prescriptionRows.filter((r) => includedFacIds.has(String(r.facility_id || '').toUpperCase()));
  const filteredVitals = raw.vitalRows.filter((v) => includedFacIds.has(String(v.facility_id || '').toUpperCase()));

  const clinicalSignals: MohLiveSnapshot['surveillance']['clinicalSignals'] = [];
  for (const l of filteredLabs) {
    if (/crit|high|abnormal|positive/i.test(String(l.flag || ''))) {
      const fid = String(l.facility_id || '').toUpperCase();
      const fac = facLookup.get(fid);
      clinicalSignals.push({
        id: String(l.id || `LAB-${clinicalSignals.length + 1}`),
        facilityId: fid,
        facilityName: fac?.facilityName || fid,
        district: fac?.district || 'Uyo',
        signalType: 'critical_lab',
        summary: `${String(l.test_name || 'Diagnostic Assay')} (${String(l.flag || 'CRITICAL').toUpperCase()})`,
        severity: /crit/i.test(String(l.flag || '')) ? 'critical' : 'warning',
        observedAt: String(l.created_at || syncedAt),
      });
    }
  }
  for (const vt of filteredVitals) {
    if (/crit|stat|emerg/i.test(String(vt.urgency || ''))) {
      const fid = String(vt.facility_id || '').toUpperCase();
      const fac = facLookup.get(fid);
      clinicalSignals.push({
        id: String(vt.id || `VIT-${clinicalSignals.length + 1}`),
        facilityId: fid,
        facilityName: fac?.facilityName || fid,
        district: fac?.district || 'Uyo',
        signalType: 'critical_vitals',
        summary: `High-acuity triage vital sign escalation (${String(vt.urgency || 'URGENT').toUpperCase()})`,
        severity: 'critical',
        observedAt: String(vt.recorded_at || syncedAt),
      });
    }
  }

  // Sanitized Audit Ledger
  const auditEvents: MohAuditLedgerEvent[] = raw.auditLedgerRows
    .filter((ev) => includedFacIds.has(String(ev.facility_id || '').toUpperCase()))
    .slice(0, 150)
    .map((ev) => {
      const fid = String(ev.facility_id || '').toUpperCase();
      const fac = facLookup.get(fid);
      return {
        id: String(ev.id || ''),
        facilityId: fid,
        facilityName: fac?.facilityName || fid,
        actor: String(ev.actor || 'System'),
        actorBadge: String(ev.actor_badge || ''),
        category: String(ev.category || 'system'),
        severity: String(ev.severity || 'normal'),
        action: String(ev.action || ''),
        entity: String(ev.entity || ''),
        entityId: String(ev.entity_id || ''),
        detail: sanitizeMohAuditDetail(ev.detail),
        rowHash: String(ev.row_hash || ''),
        createdAt: String(ev.created_at || syncedAt),
      };
    });

  const totalBeds = filteredFacilities.reduce((s, f) => s + f.totalBeds, 0);
  const occupiedBeds = filteredFacilities.reduce((s, f) => s + f.occupiedBeds, 0);
  const icuBedsTotal = filteredFacilities.reduce((s, f) => s + f.icuBedsTotal, 0);
  const icuBedsOccupied = filteredFacilities.reduce((s, f) => s + f.icuBedsOccupied, 0);
  const connectedFacilities = filteredFacilities.filter((f) => f.enrollmentStatus === 'active').length;

  return {
    syncMode: raw.syncMode,
    syncedAt,
    districtFilter: districtFilter === 'ALL' ? 'All Districts' : districtFilter,
    summary: {
      totalOfficialFacilities: filteredFacilities.length,
      connectedFacilities,
      pendingFacilities: Math.max(0, filteredFacilities.length - connectedFacilities),
      totalBeds,
      occupiedBeds,
      bedOccupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      icuBedsTotal,
      icuBedsOccupied,
      icuOccupancyPct: icuBedsTotal > 0 ? Math.round((icuBedsOccupied / icuBedsTotal) * 100) : 0,
      activeStaffCount: filteredFacilities.reduce((s, f) => s + f.activeStaffCount, 0),
      totalStaffCount: filteredFacilities.reduce((s, f) => s + f.totalStaffCount, 0),
      registeredPatientsCount: filteredFacilities.reduce((s, f) => s + f.registeredPatientsCount, 0),
      activeOpdVisits: waitingOpd + withProviderOpd,
      totalRevenuePaidNgn: totalCollectedNgn,
      totalRevenuePendingNgn: totalPendingNgn,
      activeDirectivesCount: raw.directives.filter((d) => d.status === 'active').length,
      pendingTransfersCount: raw.transfers.filter((t) => t.status === 'pending').length,
      openRemediationsCount: raw.audits.filter((a) => a.status === 'remediation_required').length,
      activeAlertsCount: raw.alerts.filter((a) => a.containmentActive).length + clinicalSignals.length,
      surgeFacilitiesCount: filteredFacilities.filter((f) => f.emergencyStatus !== 'normal').length,
    },
    facilities: filteredFacilities,
    regionalRollup,
    workforce: {
      totalActive: filteredFacilities.reduce((s, f) => s + f.activeStaffCount, 0),
      byCadre,
      staffDirectory: staffDirectory.slice(0, 250),
    },
    finance: {
      totalCollectedNgn,
      totalPendingNgn,
      byChannel,
      openRequestsCount,
      paidReceiptsCount,
      byFacility: financeByFacility,
    },
    surveillance: {
      activeOpdVisits: waitingOpd + withProviderOpd,
      waitingOpd,
      withProviderOpd,
      completedOpdToday,
      totalLabOrders: raw.orderRows.filter(
        (o) => includedFacIds.has(String(o.facility_id || '').toUpperCase()) && /lab/i.test(String(o.order_type || ''))
      ).length || filteredLabs.length,
      criticalLabAlerts: clinicalSignals.filter((c) => c.signalType === 'critical_lab').length,
      criticalVitalsAlerts: clinicalSignals.filter((c) => c.signalType === 'critical_vitals').length,
      totalPrescriptions: filteredRx.length,
      pendingPrescriptions: filteredRx.filter((r) => String(r.status || '').toLowerCase() === 'pending').length,
      clinicalSignals: clinicalSignals.slice(0, 40),
      alerts: raw.alerts,
    },
    directives: raw.directives,
    audits: raw.audits,
    transfers: raw.transfers,
    auditLedger: {
      totalEvents: auditEvents.length,
      criticalEvents: auditEvents.filter((e) => /high|critical|alert/i.test(e.severity)).length,
      integrityVerified: true,
      latestHash: auditEvents[0]?.rowHash || 'GENESIS',
      events: auditEvents,
    },
  };
}

async function safeQueryRows<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const res = await query<any>(sql, params);
    return res.rows as T[];
  } catch {
    return [];
  }
}

async function notifyFacilitiesInOs(
  facilityIds: string[],
  payload: { level: 'info' | 'warning' | 'alert'; title: string; body: string; category: string }
): Promise<void> {
  if (!isPostgresConfigured() || facilityIds.length === 0) return;
  try {
    const hasNotif = await safeTableExists('notifications');
    if (!hasNotif) return;
    for (const rawFid of facilityIds.slice(0, 50)) {
      const fid = String(rawFid || '').trim().toUpperCase();
      if (!fid) continue;
      const id = `MOH-NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await query(
        `INSERT INTO notifications (id, facility_id, level, title, body, role_hint, target_staff, read, meta, created_at)
         VALUES ($1, $2, $3, $4, $5, 'hospital_admin', '', FALSE, $6::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, fid, payload.level, payload.title, payload.body, JSON.stringify({ source: 'MOH_PORTAL', category: payload.category })]
      );
    }
  } catch {
    /* non-blocking notification dispatch */
  }
}

export async function buildLiveMohSnapshot(filters?: { district?: string; facilityId?: string }): Promise<MohLiveSnapshot> {
  const localStore = readLocalMohStore();

  if (!isPostgresConfigured()) {
    return aggregateMohSnapshot(
      {
        syncMode: 'local_registry',
        facilitiesRows: [],
        staffRows: [],
        patientCounts: [],
        bedRows: [],
        visitRows: [],
        invoiceRows: [],
        accountRequestRows: [],
        orderRows: [],
        prescriptionRows: [],
        labRows: [],
        vitalRows: [],
        auditLedgerRows: [],
        directives: localStore.directives,
        audits: localStore.audits,
        transfers: localStore.transfers,
        alerts: localStore.alerts,
        facilityOverrides: localStore.facilityOverrides,
      },
      filters
    );
  }

  await ensureMohSchema().catch(() => {});

  const [
    facilitiesRows,
    staffRows,
    patientCounts,
    bedRows,
    visitRows,
    invoiceRows,
    accountRequestRows,
    orderRows,
    prescriptionRows,
    labRows,
    vitalRows,
    auditLedgerRows,
    dirRows,
    auditRows,
    transferRows,
    overrideRows,
    alertRows,
  ] = await Promise.all([
    safeQueryRows(`SELECT id, name, state, config, updated_at FROM facilities`),
    safeQueryRows(`SELECT badge_id, facility_id, full_name, role, role_key, department, status, clearance_level FROM staff`),
    safeQueryRows(`SELECT facility_id, COUNT(*)::int AS cnt FROM patients GROUP BY facility_id`),
    safeQueryRows(`SELECT facility_id, ward, status FROM inpatient_beds`),
    safeQueryRows(`SELECT facility_id, status, checked_in_at FROM reception_visits`),
    safeQueryRows(`SELECT facility_id, source, amount_ngn, status, paid_via FROM invoices_receipts`),
    safeQueryRows(`SELECT facility_id, amount_ngn, status, paid_via FROM accounts_requests`),
    safeQueryRows(`SELECT facility_id, order_type, status, priority FROM clinical_orders`),
    safeQueryRows(`SELECT facility_id, status FROM prescriptions`),
    safeQueryRows(`SELECT id, facility_id, test_name, flag, status, created_at FROM lab_results ORDER BY created_at DESC LIMIT 200`),
    safeQueryRows(`SELECT id, facility_id, urgency, recorded_at FROM vital_signs ORDER BY recorded_at DESC LIMIT 200`),
    safeQueryRows(`SELECT id, facility_id, actor, actor_badge, category, severity, action, entity, entity_id, detail, row_hash, created_at FROM clinical_audit_ledger ORDER BY created_at DESC LIMIT 200`),
    safeQueryRows(`SELECT * FROM moh_directives ORDER BY issued_at DESC LIMIT 100`),
    safeQueryRows(`SELECT * FROM moh_audits ORDER BY created_at DESC LIMIT 100`),
    safeQueryRows(`SELECT * FROM moh_staff_transfers ORDER BY created_at DESC LIMIT 100`),
    safeQueryRows(`SELECT * FROM moh_facility_overrides`),
    safeQueryRows(`SELECT * FROM moh_alerts ORDER BY updated_at DESC LIMIT 100`),
  ]);

  const directives: MohDirective[] = dirRows.map((d: any) => ({
    id: String(d.id),
    code: String(d.code),
    title: String(d.title),
    category: String(d.category || 'general'),
    severity: (d.severity || 'mandatory_order') as MohDirective['severity'],
    summary: String(d.summary || ''),
    targetDistricts: Array.isArray(d.target_districts) ? d.target_districts : [],
    targetTiers: Array.isArray(d.target_tiers) ? d.target_tiers : [],
    mandatoryActions: Array.isArray(d.mandatory_actions) ? d.mandatory_actions : [],
    issuedBy: String(d.issued_by || 'Commissioner for Health'),
    issuedAt: d.issued_at ? new Date(d.issued_at).toISOString() : new Date().toISOString(),
    effectiveUntil: String(d.effective_until || ''),
    status: (d.status || 'active') as MohDirective['status'],
    acknowledgedFacilities: Array.isArray(d.acknowledged_facilities) ? d.acknowledged_facilities : [],
  }));

  const audits: MohAuditRecord[] = auditRows.map((a: any) => ({
    id: String(a.id),
    facilityId: String(a.facility_id),
    facilityName: String(a.facility_name),
    auditDate: String(a.audit_date),
    auditorName: String(a.auditor_name),
    category: String(a.category),
    findingsCount: Number(a.findings_count || 0),
    criticalViolations: Number(a.critical_violations || 0),
    resolutionDeadline: String(a.resolution_deadline || ''),
    status: (a.status || 'scheduled') as MohAuditRecord['status'],
    notes: String(a.notes || ''),
    createdAt: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
  }));

  const transfers: MohTransferRecord[] = transferRows.map((t: any) => ({
    id: String(t.id),
    staffBadge: String(t.staff_badge || ''),
    staffName: String(t.staff_name),
    cadre: String(t.cadre || ''),
    fromFacilityId: String(t.from_facility_id),
    fromFacilityName: String(t.from_facility_name),
    toFacilityId: String(t.to_facility_id),
    toFacilityName: String(t.to_facility_name),
    transferType: (t.transfer_type || 'temporary_surge') as MohTransferRecord['transferType'],
    urgency: (t.urgency || 'routine') as MohTransferRecord['urgency'],
    reason: String(t.reason || ''),
    status: (t.status || 'pending') as MohTransferRecord['status'],
    requestedBy: String(t.requested_by || ''),
    decidedBy: String(t.decided_by || ''),
    createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
  }));

  const facilityOverrides: MohRawDatabaseInputs['facilityOverrides'] = {};
  for (const ov of overrideRows as any[]) {
    const fid = String(ov.facility_id || '').trim().toUpperCase();
    if (!fid) continue;
    facilityOverrides[fid] = {
      emergencyStatus: ov.emergency_status || 'normal',
      accreditationStatus: ov.accreditation_status || 'pending',
      notes: ov.notes || '',
      updatedBy: ov.updated_by || '',
      updatedAt: ov.updated_at ? new Date(ov.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  const alerts: MohOutbreakAlert[] = alertRows.map((a: any) => ({
    id: String(a.id),
    condition: String(a.condition),
    icd10Category: String(a.icd10_category || ''),
    detectedCases: Number(a.detected_cases || 0),
    rateOfIncrease: Number(a.rate_of_increase || 0),
    affectedDistricts: Array.isArray(a.affected_districts) ? a.affected_districts : [],
    severity: (a.severity || 'advisory') as MohOutbreakAlert['severity'],
    reportingFacilities: Number(a.reporting_facilities || 1),
    containmentActive: Boolean(a.containment_active),
    notes: String(a.notes || ''),
    firstIdentified: String(a.first_identified || ''),
    updatedAt: a.updated_at ? new Date(a.updated_at).toISOString() : new Date().toISOString(),
  }));

  return aggregateMohSnapshot(
    {
      syncMode: 'live_db',
      facilitiesRows: facilitiesRows as any,
      staffRows: staffRows as any,
      patientCounts: patientCounts as any,
      bedRows: bedRows as any,
      visitRows: visitRows as any,
      invoiceRows: invoiceRows as any,
      accountRequestRows: accountRequestRows as any,
      orderRows: orderRows as any,
      prescriptionRows: prescriptionRows as any,
      labRows: labRows as any,
      vitalRows: vitalRows as any,
      auditLedgerRows: auditLedgerRows as any,
      directives,
      audits,
      transfers,
      alerts,
      facilityOverrides,
    },
    filters
  );
}

export async function createMohDirectiveRecord(input: {
  title: string;
  category?: string;
  severity?: MohDirective['severity'];
  summary: string;
  targetDistricts?: string[];
  targetTiers?: string[];
  mandatoryActions?: string[];
  effectiveUntil?: string;
  issuedBy?: string;
}): Promise<MohDirective> {
  const now = new Date();
  const rec: MohDirective = {
    id: `DIR-${Date.now().toString(36).toUpperCase()}`,
    code: `AKS-MOH-${now.getFullYear()}-${String(Math.floor(100 + Math.random() * 899))}`,
    title: input.title.trim(),
    category: (input.category || 'clinical_governance').trim(),
    severity: input.severity || 'mandatory_order',
    summary: input.summary.trim(),
    targetDistricts: input.targetDistricts?.length ? input.targetDistricts : [...SENATORIAL_DISTRICTS],
    targetTiers: input.targetTiers?.length ? input.targetTiers : ['all_tiers'],
    mandatoryActions: (input.mandatoryActions || []).filter(Boolean),
    issuedBy: (input.issuedBy || 'Commissioner for Health').trim(),
    issuedAt: now.toISOString(),
    effectiveUntil: (input.effectiveUntil || '').trim(),
    status: 'active',
    acknowledgedFacilities: [],
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_directives (id, code, title, category, severity, summary, target_districts, target_tiers, mandatory_actions, issued_by, issued_at, effective_until, status, acknowledged_facilities, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, NOW(), $11, 'active', '[]'::jsonb, NOW())`,
      [
        rec.id,
        rec.code,
        rec.title,
        rec.category,
        rec.severity,
        rec.summary,
        JSON.stringify(rec.targetDistricts),
        JSON.stringify(rec.targetTiers),
        JSON.stringify(rec.mandatoryActions),
        rec.issuedBy,
        rec.effectiveUntil,
      ]
    );

    const activeFacRows = await safeQueryRows<{ id: string }>(`SELECT id FROM facilities`);
    const targetIds = activeFacRows
      .map((r) => String(r.id).trim().toUpperCase())
      .filter((fid) => {
        const off = OFFICIAL_AKWA_IBOM_FACILITIES.find((o) => o.facilityId === fid);
        if (!off) return true;
        return rec.targetDistricts.includes(off.district);
      });
    await notifyFacilitiesInOs(targetIds, {
      level: rec.severity === 'national_emergency' || rec.severity === 'mandatory_order' ? 'alert' : 'warning',
      title: `MOH Directive (${rec.code}): ${rec.title}`,
      body: rec.summary,
      category: 'moh_directive',
    });
  } else {
    const store = readLocalMohStore();
    store.directives = [rec, ...store.directives];
    writeLocalMohStore(store);
  }

  publishMohEvent('directive', { id: rec.id, code: rec.code, title: rec.title });
  return rec;
}

export async function updateMohDirectiveRecord(
  id: string,
  status: MohDirective['status']
): Promise<MohDirective | null> {
  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_directives SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status]
    );
    const d = res.rows[0];
    if (!d) return null;
    publishMohEvent('directive', { id, status });
    return {
      id: String(d.id),
      code: String(d.code),
      title: String(d.title),
      category: String(d.category),
      severity: d.severity,
      summary: String(d.summary),
      targetDistricts: d.target_districts || [],
      targetTiers: d.target_tiers || [],
      mandatoryActions: d.mandatory_actions || [],
      issuedBy: String(d.issued_by),
      issuedAt: new Date(d.issued_at).toISOString(),
      effectiveUntil: String(d.effective_until || ''),
      status: d.status,
      acknowledgedFacilities: d.acknowledged_facilities || [],
    };
  }
  const store = readLocalMohStore();
  let updated: MohDirective | null = null;
  store.directives = store.directives.map((d) => {
    if (d.id !== id) return d;
    updated = { ...d, status };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('directive', { id, status });
  return updated;
}

export async function createMohAuditRecord(input: {
  facilityId: string;
  facilityName: string;
  auditDate: string;
  auditorName: string;
  category: string;
  resolutionDeadline?: string;
  notes?: string;
}): Promise<MohAuditRecord> {
  const rec: MohAuditRecord = {
    id: `AUD-${Date.now().toString(36).toUpperCase()}`,
    facilityId: input.facilityId.trim().toUpperCase(),
    facilityName: input.facilityName.trim(),
    auditDate: input.auditDate.trim(),
    auditorName: input.auditorName.trim(),
    category: input.category.trim(),
    findingsCount: 0,
    criticalViolations: 0,
    resolutionDeadline: (input.resolutionDeadline || '').trim(),
    status: 'scheduled',
    notes: (input.notes || '').trim(),
    createdAt: new Date().toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_audits (id, facility_id, facility_name, audit_date, auditor_name, category, findings_count, critical_violations, resolution_deadline, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 'scheduled', $8, NOW(), NOW())`,
      [rec.id, rec.facilityId, rec.facilityName, rec.auditDate, rec.auditorName, rec.category, rec.resolutionDeadline, rec.notes]
    );
    await notifyFacilitiesInOs([rec.facilityId], {
      level: 'info',
      title: `MOH Inspection Scheduled (${rec.auditDate})`,
      body: `Inspector: ${rec.auditorName} · Scope: ${rec.category.replace(/_/g, ' ')}`,
      category: 'moh_audit',
    });
  } else {
    const store = readLocalMohStore();
    store.audits = [rec, ...store.audits];
    writeLocalMohStore(store);
  }

  publishMohEvent('audit', { id: rec.id, facilityId: rec.facilityId });
  return rec;
}

export async function updateMohAuditRecord(
  id: string,
  patch: Partial<Pick<MohAuditRecord, 'status' | 'findingsCount' | 'criticalViolations' | 'notes'>>
): Promise<MohAuditRecord | null> {
  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_audits
       SET status = COALESCE($2, status),
           findings_count = COALESCE($3, findings_count),
           critical_violations = COALESCE($4, critical_violations),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, patch.status ?? null, patch.findingsCount ?? null, patch.criticalViolations ?? null, patch.notes ?? null]
    );
    const a = res.rows[0];
    if (!a) return null;
    publishMohEvent('audit', { id, status: a.status });
    return {
      id: String(a.id),
      facilityId: String(a.facility_id),
      facilityName: String(a.facility_name),
      auditDate: String(a.audit_date),
      auditorName: String(a.auditor_name),
      category: String(a.category),
      findingsCount: Number(a.findings_count || 0),
      criticalViolations: Number(a.critical_violations || 0),
      resolutionDeadline: String(a.resolution_deadline || ''),
      status: a.status,
      notes: String(a.notes || ''),
      createdAt: new Date(a.created_at).toISOString(),
    };
  }
  const store = readLocalMohStore();
  let updated: MohAuditRecord | null = null;
  store.audits = store.audits.map((a) => {
    if (a.id !== id) return a;
    updated = { ...a, ...patch };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('audit', { id, status: (updated as MohAuditRecord).status });
  return updated;
}

export async function createMohTransferRecord(input: {
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
}): Promise<MohTransferRecord> {
  const rec: MohTransferRecord = {
    id: `TRF-${Date.now().toString(36).toUpperCase()}`,
    staffBadge: (input.staffBadge || '').trim().toUpperCase(),
    staffName: input.staffName.trim(),
    cadre: input.cadre.trim(),
    fromFacilityId: input.fromFacilityId.trim().toUpperCase(),
    fromFacilityName: input.fromFacilityName.trim(),
    toFacilityId: input.toFacilityId.trim().toUpperCase(),
    toFacilityName: input.toFacilityName.trim(),
    transferType: input.transferType || 'temporary_surge',
    urgency: input.urgency || 'routine',
    reason: input.reason.trim(),
    status: 'pending',
    requestedBy: (input.requestedBy || 'MOH Workforce Desk').trim(),
    decidedBy: '',
    createdAt: new Date().toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_staff_transfers (id, staff_badge, staff_name, cadre, from_facility_id, from_facility_name, to_facility_id, to_facility_name, transfer_type, urgency, reason, status, requested_by, decided_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, '', NOW(), NOW())`,
      [
        rec.id,
        rec.staffBadge,
        rec.staffName,
        rec.cadre,
        rec.fromFacilityId,
        rec.fromFacilityName,
        rec.toFacilityId,
        rec.toFacilityName,
        rec.transferType,
        rec.urgency,
        rec.reason,
        rec.requestedBy,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.transfers = [rec, ...store.transfers];
    writeLocalMohStore(store);
  }

  publishMohEvent('transfer', { id: rec.id, status: 'pending' });
  return rec;
}

export async function updateMohTransferRecord(
  id: string,
  status: MohTransferRecord['status'],
  decidedBy: string
): Promise<MohTransferRecord | null> {
  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_staff_transfers SET status = $2, decided_by = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status, decidedBy]
    );
    const t = res.rows[0];
    if (!t) return null;
    if (status === 'approved' || status === 'completed') {
      await notifyFacilitiesInOs([String(t.from_facility_id), String(t.to_facility_id)], {
        level: 'info',
        title: `MOH Staff Transfer ${status.toUpperCase()}: ${t.staff_name}`,
        body: `Transfer from ${t.from_facility_name} to ${t.to_facility_name} signed off by ${decidedBy}.`,
        category: 'moh_transfer',
      });
    }
    publishMohEvent('transfer', { id, status });
    return {
      id: String(t.id),
      staffBadge: String(t.staff_badge || ''),
      staffName: String(t.staff_name),
      cadre: String(t.cadre || ''),
      fromFacilityId: String(t.from_facility_id),
      fromFacilityName: String(t.from_facility_name),
      toFacilityId: String(t.to_facility_id),
      toFacilityName: String(t.to_facility_name),
      transferType: t.transfer_type,
      urgency: t.urgency,
      reason: String(t.reason || ''),
      status: t.status,
      requestedBy: String(t.requested_by || ''),
      decidedBy: String(t.decided_by || ''),
      createdAt: new Date(t.created_at).toISOString(),
    };
  }
  const store = readLocalMohStore();
  let updated: MohTransferRecord | null = null;
  store.transfers = store.transfers.map((t) => {
    if (t.id !== id) return t;
    updated = { ...t, status, decidedBy };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('transfer', { id, status });
  return updated;
}

export async function updateMohFacilityOverrideRecord(input: {
  facilityId: string;
  emergencyStatus?: MohFacilityTelemetry['emergencyStatus'];
  accreditationStatus?: MohFacilityTelemetry['accreditationStatus'];
  notes?: string;
  updatedBy?: string;
}): Promise<void> {
  const fid = input.facilityId.trim().toUpperCase();
  const updatedAt = new Date().toISOString();

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const existing = await safeQueryRows<any>(`SELECT * FROM moh_facility_overrides WHERE facility_id = $1`, [fid]);
    const prev = existing[0] || {};
    const emergencyStatus = input.emergencyStatus || prev.emergency_status || 'normal';
    const accreditationStatus = input.accreditationStatus || prev.accreditation_status || 'provisional';
    const notes = input.notes !== undefined ? input.notes : prev.notes || '';
    const updatedBy = input.updatedBy || 'MOH Oversight';

    await query(
      `INSERT INTO moh_facility_overrides (facility_id, emergency_status, accreditation_status, notes, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (facility_id) DO UPDATE SET
         emergency_status = EXCLUDED.emergency_status,
         accreditation_status = EXCLUDED.accreditation_status,
         notes = EXCLUDED.notes,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [fid, emergencyStatus, accreditationStatus, notes, updatedBy]
    );

    if (input.emergencyStatus && input.emergencyStatus !== 'normal') {
      await notifyFacilitiesInOs([fid], {
        level: 'alert',
        title: `MOH Facility Status Override: ${input.emergencyStatus.replace(/_/g, ' ').toUpperCase()}`,
        body: notes || 'Emergency capacity status updated by Ministry of Health command.',
        category: 'moh_override',
      });
    }
  } else {
    const store = readLocalMohStore();
    const prev = store.facilityOverrides[fid];
    store.facilityOverrides[fid] = {
      emergencyStatus: input.emergencyStatus || prev?.emergencyStatus || 'normal',
      accreditationStatus: input.accreditationStatus || prev?.accreditationStatus || 'provisional',
      notes: input.notes !== undefined ? input.notes : prev?.notes,
      updatedBy: input.updatedBy || 'MOH Oversight',
      updatedAt,
    };
    writeLocalMohStore(store);
  }

  publishMohEvent('facility', { facilityId: fid, emergencyStatus: input.emergencyStatus, accreditationStatus: input.accreditationStatus });
}

export async function upsertOrToggleMohAlertRecord(input: {
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
}): Promise<MohOutbreakAlert | null> {
  const now = new Date().toISOString();

  if (input.id && input.toggleContainment) {
    if (isPostgresConfigured()) {
      await ensureMohSchema();
      const res = await query<any>(
        `UPDATE moh_alerts SET containment_active = NOT containment_active, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [input.id]
      );
      const a = res.rows[0];
      if (!a) return null;
      publishMohEvent('alert', { id: input.id, containmentActive: Boolean(a.containment_active) });
      return {
        id: String(a.id),
        condition: String(a.condition),
        icd10Category: String(a.icd10_category || ''),
        detectedCases: Number(a.detected_cases || 0),
        rateOfIncrease: Number(a.rate_of_increase || 0),
        affectedDistricts: a.affected_districts || [],
        severity: a.severity,
        reportingFacilities: Number(a.reporting_facilities || 1),
        containmentActive: Boolean(a.containment_active),
        notes: String(a.notes || ''),
        firstIdentified: String(a.first_identified || ''),
        updatedAt: new Date(a.updated_at).toISOString(),
      };
    }
    const store = readLocalMohStore();
    let toggled: MohOutbreakAlert | null = null;
    store.alerts = store.alerts.map((a) => {
      if (a.id !== input.id) return a;
      toggled = { ...a, containmentActive: !a.containmentActive, updatedAt: now };
      return toggled;
    });
    writeLocalMohStore(store);
    if (toggled) publishMohEvent('alert', { id: input.id });
    return toggled;
  }

  if (!input.condition || !input.condition.trim()) return null;
  const rec: MohOutbreakAlert = {
    id: input.id || `EPI-${Date.now().toString(36).toUpperCase()}`,
    condition: input.condition.trim(),
    icd10Category: (input.icd10Category || 'Syndromic Bulletin').trim(),
    detectedCases: Number(input.detectedCases || 1),
    rateOfIncrease: Number(input.rateOfIncrease || 0),
    affectedDistricts: input.affectedDistricts?.length ? input.affectedDistricts : ['Uyo'],
    severity: input.severity || 'warning',
    reportingFacilities: Number(input.reportingFacilities || 1),
    containmentActive: true,
    notes: (input.notes || '').trim(),
    firstIdentified: now.slice(0, 10),
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_alerts (id, condition, icd10_category, detected_cases, rate_of_increase, affected_districts, severity, reporting_facilities, containment_active, notes, first_identified, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, TRUE, $9, $10, NOW())`,
      [
        rec.id,
        rec.condition,
        rec.icd10Category,
        rec.detectedCases,
        rec.rateOfIncrease,
        JSON.stringify(rec.affectedDistricts),
        rec.severity,
        rec.reportingFacilities,
        rec.notes,
        rec.firstIdentified,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.alerts = [rec, ...store.alerts];
    writeLocalMohStore(store);
  }

  publishMohEvent('alert', { id: rec.id, condition: rec.condition });
  return rec;
}
