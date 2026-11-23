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
  MohFacilityBedItem,
  MohFacilityDossier,
  MohFacilityGovernance,
  MohFacilitySecurity,
  MohFacilityStaffRosterItem,
  MohFacilityTelemetry,
  MohLiveSnapshot,
  MohOutbreakAlert,
  MohRegionalRollup,
  MohStaffDirectoryItem,
  MohSyncStatus,
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

export interface MohFacilityDossierInputs {
  syncMode: MohSyncStatus;
  syncedAt?: string;
  facilityRow?: {
    id: string;
    name: string;
    state?: string | null;
    config?: Record<string, any> | null;
    updated_at?: string | null;
  } | null;
  overrideRow?: {
    emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
    accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
    notes?: string;
    updatedBy?: string;
    updatedAt: string;
  } | null;
  staffRows: {
    badge_id: string;
    facility_id?: string;
    full_name: string;
    role?: string | null;
    role_key?: string | null;
    title?: string | null;
    department?: string | null;
    status?: string | null;
    clearance_level?: number | null;
    clearance_label?: string | null;
    created_at?: string | null;
  }[];
  biometricRows: { badge_id: string; enrolled_at?: string | null }[];
  patientSummary: { totalRegistered: number; activePatients: number; newRegistrations30d: number };
  patientSexRows: { label: string; cnt: number }[];
  patientAgeBandRows: { band: string; cnt: number }[];
  bedRows: {
    id?: string;
    facility_id?: string;
    ward: string;
    bed_no?: string | null;
    status: string;
    doctor?: string | null;
    diagnosis?: string | null;
    updated_at?: string | null;
  }[];
  visitRows: {
    id?: string;
    facility_id?: string;
    queue_number?: string | null;
    department?: string | null;
    doctor?: string | null;
    status: string;
    payment_status?: string | null;
    visit_type?: string | null;
    checked_in_at?: string | null;
  }[];
  orderRows: { facility_id?: string; order_type: string; status: string; priority?: string | null }[];
  prescriptionRows: {
    id?: string;
    facility_id?: string;
    drug_name?: string | null;
    dose?: string | null;
    route?: string | null;
    status: string;
    prescribed_by?: string | null;
    created_at?: string | null;
  }[];
  labRows: {
    id?: string;
    facility_id?: string;
    test_name?: string | null;
    flag?: string | null;
    status?: string | null;
    validated_by?: string | null;
    created_at?: string | null;
  }[];
  vitalRows: {
    id?: string;
    facility_id?: string;
    urgency?: string | null;
    bp?: string | null;
    pulse?: number | null;
    temp?: number | null;
    spo2?: number | null;
    recorded_by?: string | null;
    recorded_at?: string | null;
  }[];
  invoiceRows: {
    id?: string;
    facility_id?: string;
    source?: string | null;
    description?: string | null;
    amount_ngn: number;
    status: string;
    paid_via?: string | null;
    created_at?: string | null;
  }[];
  accountRequestRows: {
    id?: string;
    facility_id?: string;
    purpose?: string | null;
    amount_ngn: number;
    status: string;
    paid_via?: string | null;
    sent_at?: string | null;
  }[];
  notificationRows: {
    id: string;
    level?: string | null;
    title: string;
    body?: string | null;
    role_hint?: string | null;
    read?: boolean | null;
    created_at?: string | null;
  }[];
  auditLedgerRows: MohRawDatabaseInputs['auditLedgerRows'];
  kvRows: { key: string; value: unknown; updated_at?: string | null }[];
  activeFormDraftsCount: number;
  directives: MohDirective[];
  audits: MohAuditRecord[];
  transfers: MohTransferRecord[];
}

const KV_DOMAIN_LABELS: Record<string, string> = {
  medcore_os_admin_settings_v1: 'Admin & Facility Settings',
  medcore_os_custom_roles_v1: 'Custom RBAC Roles',
  medcore_os_role_permissions_v4: 'Role Access Matrix',
  medcore_anc_plans_v1: 'ANC / Maternity Care Plans',
  medcore_os_theatre_cases_v1: 'Surgical Theatre Schedule',
  medcore_os_icu_stepdown_v1: 'ICU Step-Down & HDU Tracking',
  medcore_os_ward_med_requests_v1: 'Ward Pharmacy Requisitions',
  medcore_os_nursing_kardex_v1: 'Nursing Kardex & E-MAR',
  medcore_os_nursing_sbar_v1: 'Nursing SBAR Handoffs',
  medcore_os_him_v1: 'Health Information & Records',
};

function countKvPayloadItems(val: unknown): number {
  if (Array.isArray(val)) return val.length;
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items.length;
    if (Array.isArray(obj.cases)) return obj.cases.length;
    if (Array.isArray(obj.plans)) return obj.plans.length;
    if (Array.isArray(obj.records)) return obj.records.length;
    return Object.keys(obj).length;
  }
  return 0;
}

export function buildFacilityDossierFromInputs(
  facilityIdRaw: string,
  raw: MohFacilityDossierInputs
): MohFacilityDossier {
  const fid = facilityIdRaw.trim().toUpperCase();
  const syncedAt = raw.syncedAt || new Date().toISOString();

  const snapshot = aggregateMohSnapshot(
    {
      syncMode: raw.syncMode,
      syncedAt,
      facilitiesRows: raw.facilityRow ? [raw.facilityRow] : [],
      staffRows: raw.staffRows.map((s) => ({
        badge_id: s.badge_id,
        facility_id: fid,
        full_name: s.full_name,
        role: s.role,
        role_key: s.role_key,
        department: s.department,
        status: s.status,
        clearance_level: s.clearance_level,
      })),
      patientCounts: [{ facility_id: fid, cnt: raw.patientSummary.totalRegistered }],
      bedRows: raw.bedRows.map((b) => ({
        facility_id: fid,
        ward: b.ward,
        status: b.status,
      })),
      visitRows: raw.visitRows.map((v) => ({
        facility_id: fid,
        status: v.status,
        checked_in_at: v.checked_in_at,
      })),
      invoiceRows: raw.invoiceRows.map((inv) => ({
        facility_id: fid,
        source: inv.source,
        amount_ngn: inv.amount_ngn,
        status: inv.status,
        paid_via: inv.paid_via,
      })),
      accountRequestRows: raw.accountRequestRows.map((r) => ({
        facility_id: fid,
        amount_ngn: r.amount_ngn,
        status: r.status,
        paid_via: r.paid_via,
      })),
      orderRows: raw.orderRows.map((o) => ({
        facility_id: fid,
        order_type: o.order_type,
        status: o.status,
        priority: o.priority,
      })),
      prescriptionRows: raw.prescriptionRows.map((p) => ({
        facility_id: fid,
        status: p.status,
      })),
      labRows: raw.labRows.map((l) => ({
        id: l.id,
        facility_id: fid,
        test_name: l.test_name,
        flag: l.flag,
        status: l.status,
        created_at: l.created_at,
      })),
      vitalRows: raw.vitalRows.map((v) => ({
        id: v.id,
        facility_id: fid,
        urgency: v.urgency,
        recorded_at: v.recorded_at,
      })),
      auditLedgerRows: raw.auditLedgerRows.map((a) => ({ ...a, facility_id: fid })),
      directives: raw.directives,
      audits: raw.audits,
      transfers: raw.transfers,
      alerts: [],
      facilityOverrides: raw.overrideRow ? { [fid]: raw.overrideRow } : {},
    },
    { facilityId: fid }
  );

  const catalogMatch = OFFICIAL_AKWA_IBOM_FACILITIES.find((f) => f.facilityId === fid);
  const facility: MohFacilityTelemetry = snapshot.facilities[0] || {
    facilityId: fid,
    facilityName: raw.facilityRow?.name || catalogMatch?.facilityName || fid,
    location: catalogMatch?.location || 'Akwa Ibom State',
    lga: catalogMatch?.lga || 'Akwa Ibom',
    district: catalogMatch?.district || inferSenatorialDistrict(catalogMatch?.lga || ''),
    tier: catalogMatch?.tier || 'secondary',
    facilityType: catalogMatch?.facilityType || 'State Health Facility',
    board: catalogMatch?.board || 'AKSHMB',
    enrollmentStatus: raw.facilityRow ? 'active' : 'pending',
    hasDbActivity: Boolean(raw.facilityRow),
    lastSyncedAt: raw.facilityRow?.updated_at || null,
    hfrCode: '',
    supervisoryBoard: catalogMatch?.board || 'AKSHMB',
    medicalDirector: '',
    boardAuthCircularRef: '',
    complianceScore: 0,
    accreditationStatus: raw.overrideRow?.accreditationStatus || 'pending',
    emergencyStatus: raw.overrideRow?.emergencyStatus || 'normal',
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    icuBedsTotal: 0,
    icuBedsOccupied: 0,
    activeStaffCount: raw.staffRows.length,
    totalStaffCount: raw.staffRows.length,
    registeredPatientsCount: raw.patientSummary.totalRegistered,
    activeOpdVisits: 0,
    revenuePaidNgn: 0,
    revenuePendingNgn: 0,
    criticalLabsCount: 0,
    criticalVitalsCount: 0,
    auditEventsCount: raw.auditLedgerRows.length,
    cadreBreakdown: {},
    wardBreakdown: [],
    notes: raw.overrideRow?.notes,
  };

  // Merge facility.config with facility_kv admin settings if present
  const kvMap = new Map<string, { value: unknown; updated_at?: string | null }>();
  for (const row of raw.kvRows) {
    kvMap.set(String(row.key), { value: row.value, updated_at: row.updated_at });
  }
  const kvSettings =
    kvMap.get('medcore_os_admin_settings_v1')?.value &&
    typeof kvMap.get('medcore_os_admin_settings_v1')?.value === 'object'
      ? (kvMap.get('medcore_os_admin_settings_v1')?.value as Record<string, any>)
      : {};
  const cfg = { ...(raw.facilityRow?.config || {}), ...kvSettings };
  const posList = Array.isArray(cfg.posTerminals) ? cfg.posTerminals : [];

  const governance: MohFacilityGovernance = {
    hfrCode: String(cfg.hfrCode || facility.hfrCode || ''),
    supervisoryBoard: String(cfg.supervisoryBoard || facility.supervisoryBoard || facility.board),
    medicalDirector: String(cfg.medicalDirector || facility.medicalDirector || ''),
    boardAuthCircularRef: String(cfg.boardAuthCircularRef || facility.boardAuthCircularRef || ''),
    boardAuthDate: String(cfg.boardAuthDate || ''),
    cmdApprovalRef: String(cfg.cmdApprovalRef || ''),
    cmdApprovalDate: String(cfg.cmdApprovalDate || ''),
    emrFocalPersonName: String(cfg.emrFocalPersonName || ''),
    emrFocalPersonTitle: String(cfg.emrFocalPersonTitle || ''),
    emrFocalOfficerContact: sanitizeMohAuditDetail(
      cfg.emrFocalPersonEmail || cfg.emrFocalPersonPhone || ''
    ),
    licenseNo: String(cfg.licenseNo || ''),
    licenseExpiry: String(cfg.licenseExpiry || ''),
    registrationNo: String(cfg.registrationNo || ''),
    ownership: String(cfg.ownership || (facility.board === 'Mission' ? 'mission' : 'public_state')),
    hospitalTier: String(cfg.hospitalTier || facility.tier),
    facilityType: String(cfg.facilityType || facility.facilityType),
    ward: String(cfg.ward || ''),
    streetLocation: String(cfg.address || facility.location || ''),
    facilityLine: String(cfg.phone || ''),
    emergencyLine: String(cfg.emergencyPhone || ''),
    officialDeskContact: String(cfg.email || ''),
    gpsLatitude: String(cfg.gpsLatitude || ''),
    gpsLongitude: String(cfg.gpsLongitude || ''),
    workingHours:
      cfg.operates24x7 !== false
        ? '24 Hours Daily'
        : `${cfg.workingHoursStart || '08:00'} – ${cfg.workingHoursEnd || '17:00'}`,
    operates24x7: cfg.operates24x7 !== false,
    emergency24x7: cfg.emergency24x7 !== false,
    triageProtocol: String(cfg.triageProtocol || 'NEWS2'),
    requireVitalsBeforeConsult: cfg.requireVitalsBeforeConsult !== false,
    requireBillingClearanceBeforeDischarge: Boolean(cfg.requireBillingClearanceBeforeDischarge),
    requireStaffMfa: Boolean(cfg.requireStaffMfa),
    requireFaceIdOnStaffEnrol: Boolean(cfg.requireFaceIdOnStaffEnrol),
    akwaremitEnabled: Boolean(cfg.akwaremitEnabled),
    akwaremitRevenueHead: String(cfg.akwaremitRevenueHead || ''),
    akwaremitRevenueSubhead: String(cfg.akwaremitRevenueSubhead || ''),
    acceptsAkshia: Boolean(cfg.acceptsAkshia),
    akshiaProviderId: String(cfg.akshiaProviderId || ''),
    participatesInBhcpf: Boolean(cfg.participatesInBhcpf),
    bhcpfCode: String(cfg.bhcpfCode || ''),
    acceptsNhis: Boolean(cfg.acceptsNhis),
    nhiaProviderCode: String(cfg.nhiaProviderCode || ''),
    acceptsHmo: Boolean(cfg.acceptsHmo),
    posTerminalsTotal: posList.length,
    posTerminalsActive: posList.filter((p: any) => p?.active !== false).length,
  };

  // Biometrics + Workforce roster
  const bioMap = new Map<string, string | null>();
  for (const b of raw.biometricRows) {
    bioMap.set(
      String(b.badge_id || '').trim().toUpperCase(),
      b.enrolled_at ? new Date(b.enrolled_at).toISOString() : null
    );
  }

  const staffRoster: MohFacilityStaffRosterItem[] = raw.staffRows.map((s) => {
    const bid = String(s.badge_id || '').trim().toUpperCase();
    const hasBio = bioMap.has(bid);
    return {
      badgeId: bid,
      fullName: String(s.full_name || bid),
      role: String(s.role || 'Hospital Staff'),
      roleKey: String(s.role_key || 'staff'),
      title: String(s.title || s.role || ''),
      department: String(s.department || 'General Operations'),
      status: String(s.status || 'active'),
      clearanceLevel: Number(s.clearance_level || 1),
      clearanceLabel: String(s.clearance_label || `L${Number(s.clearance_level || 1)}`),
      faceIdEnrolled: hasBio,
      faceIdEnrolledAt: bioMap.get(bid) || null,
      createdAt: s.created_at ? new Date(s.created_at).toISOString() : '',
    };
  });

  const activeStaffCount = staffRoster.filter((s) => s.status.toLowerCase() === 'active').length;
  const suspendedStaffCount = staffRoster.filter((s) => s.status.toLowerCase() === 'suspended').length;
  const faceIdEnrolledCount = staffRoster.filter((s) => s.faceIdEnrolled).length;

  const customRolesVal = kvMap.get('medcore_os_custom_roles_v1')?.value;
  const customRolesCount = Array.isArray(customRolesVal) ? customRolesVal.length : 0;

  const security: MohFacilitySecurity = {
    totalStaff: staffRoster.length,
    activeStaff: activeStaffCount,
    suspendedStaff: suspendedStaffCount,
    faceIdEnrolledCount,
    faceIdCompliancePct:
      staffRoster.length > 0 ? Math.round((faceIdEnrolledCount / staffRoster.length) * 100) : 0,
    mfaEnforced: governance.requireStaffMfa,
    customRolesCount,
    activeFormDraftsCount: raw.activeFormDraftsCount,
  };

  // Beds & Diagnoses
  const diagCounts = new Map<string, number>();
  const bedList: MohFacilityBedItem[] = raw.bedRows.map((b, idx) => {
    const cleanDiag = sanitizeMohAuditDetail(b.diagnosis || '');
    if (cleanDiag && String(b.status || '').toLowerCase() === 'occupied') {
      diagCounts.set(cleanDiag, (diagCounts.get(cleanDiag) || 0) + 1);
    }
    return {
      id: String(b.id || `BED-${idx + 1}`),
      ward: String(b.ward || 'General Ward'),
      bedNo: String(b.bed_no || `B-${idx + 1}`),
      status: String(b.status || 'available'),
      doctor: String(b.doctor || 'Unassigned'),
      diagnosis: cleanDiag,
      updatedAt: b.updated_at ? new Date(b.updated_at).toISOString() : '',
    };
  });

  // OPD breakdown
  const deptCounts = new Map<string, number>();
  const visitTypeCounts = new Map<string, number>();
  let waiting = 0;
  let withProvider = 0;
  let completedOpd = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  const recentVisits = raw.visitRows.slice(0, 60).map((v, idx) => {
    const st = String(v.status || 'waiting').toLowerCase();
    const pay = String(v.payment_status || 'unpaid').toLowerCase();
    const dept = String(v.department || 'General OPD');
    const vtype = String(v.visit_type || 'walkin');
    if (st === 'waiting') waiting += 1;
    else if (st === 'with_provider') withProvider += 1;
    else if (st === 'completed' || st === 'discharged') completedOpd += 1;
    if (pay === 'paid' || pay === 'settled' || pay === 'hmo') paidCount += 1;
    else unpaidCount += 1;
    deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
    visitTypeCounts.set(vtype, (visitTypeCounts.get(vtype) || 0) + 1);
    return {
      id: String(v.id || `VIS-${idx + 1}`),
      queueNumber: String(v.queue_number || ''),
      department: dept,
      doctor: String(v.doctor || 'Triage Queue'),
      status: st,
      paymentStatus: pay,
      visitType: vtype,
      checkedInAt: v.checked_in_at ? new Date(v.checked_in_at).toISOString() : '',
    };
  });
  for (const v of raw.visitRows.slice(60)) {
    const st = String(v.status || 'waiting').toLowerCase();
    const pay = String(v.payment_status || 'unpaid').toLowerCase();
    const dept = String(v.department || 'General OPD');
    const vtype = String(v.visit_type || 'walkin');
    if (st === 'waiting') waiting += 1;
    else if (st === 'with_provider') withProvider += 1;
    else if (st === 'completed' || st === 'discharged') completedOpd += 1;
    if (pay === 'paid' || pay === 'settled' || pay === 'hmo') paidCount += 1;
    else unpaidCount += 1;
    deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
    visitTypeCounts.set(vtype, (visitTypeCounts.get(vtype) || 0) + 1);
  }

  // Orders breakdown
  const orderTypeMap = new Map<string, { count: number; pending: number }>();
  let ordersPending = 0;
  let ordersCompleted = 0;
  let ordersStat = 0;
  for (const o of raw.orderRows) {
    const t = String(o.order_type || 'general');
    const st = String(o.status || 'pending').toLowerCase();
    const cur = orderTypeMap.get(t) || { count: 0, pending: 0 };
    cur.count += 1;
    if (st === 'pending') {
      cur.pending += 1;
      ordersPending += 1;
    } else if (st === 'completed' || st === 'done') {
      ordersCompleted += 1;
    }
    if (String(o.priority || '').toLowerCase() === 'stat') ordersStat += 1;
    orderTypeMap.set(t, cur);
  }

  // Pharmacy breakdown
  const drugMap = new Map<string, { count: number; pending: number }>();
  let rxPending = 0;
  let rxDispensed = 0;
  for (const p of raw.prescriptionRows) {
    const drug = String(p.drug_name || 'Medication').trim();
    const st = String(p.status || 'pending').toLowerCase();
    const cur = drugMap.get(drug) || { count: 0, pending: 0 };
    cur.count += 1;
    if (st === 'pending') {
      cur.pending += 1;
      rxPending += 1;
    } else if (st === 'dispensed' || st === 'completed') {
      rxDispensed += 1;
    }
    drugMap.set(drug, cur);
  }

  // Labs & Vitals
  let labPending = 0;
  let labCritical = 0;
  let labAbnormal = 0;
  for (const l of raw.labRows) {
    const st = String(l.status || 'pending').toLowerCase();
    const flag = String(l.flag || 'NORMAL').toUpperCase();
    if (st === 'pending') labPending += 1;
    if (flag === 'CRITICAL') labCritical += 1;
    else if (flag === 'HIGH' || flag === 'LOW' || flag === 'ABNORMAL') labAbnormal += 1;
  }

  let vitalsCritical = 0;
  let vitalsUrgent = 0;
  for (const v of raw.vitalRows) {
    const urg = String(v.urgency || 'routine').toLowerCase();
    if (urg === 'critical' || urg === 'emergency') vitalsCritical += 1;
    else if (urg === 'urgent' || urg === 'stat') vitalsUrgent += 1;
  }

  // Finance breakdown by source
  const srcRevMap = new Map<string, { collectedNgn: number; pendingNgn: number; count: number }>();
  for (const inv of raw.invoiceRows) {
    const src = String(inv.source || 'General Billing').trim();
    const amt = Number(inv.amount_ngn || 0);
    const st = String(inv.status || '').toLowerCase();
    const cur = srcRevMap.get(src) || { collectedNgn: 0, pendingNgn: 0, count: 0 };
    cur.count += 1;
    if (st === 'paid' || st === 'settled') cur.collectedNgn += amt;
    else cur.pendingNgn += amt;
    srcRevMap.set(src, cur);
  }

  // Workforce by department + cadre
  const staffDeptMap = new Map<string, number>();
  const staffCadreMap = new Map<string, number>();
  for (const s of staffRoster) {
    staffDeptMap.set(s.department, (staffDeptMap.get(s.department) || 0) + 1);
    staffCadreMap.set(s.role, (staffCadreMap.get(s.role) || 0) + 1);
  }

  return {
    syncMode: raw.syncMode,
    syncedAt,
    facility,
    governance,
    security,
    demographics: {
      totalRegistered: raw.patientSummary.totalRegistered,
      activePatients: raw.patientSummary.activePatients,
      newRegistrations30d: raw.patientSummary.newRegistrations30d,
      bySex: raw.patientSexRows.map((r) => ({ label: r.label, count: Number(r.cnt || 0) })),
      byAgeBand: raw.patientAgeBandRows.map((r) => ({ band: r.band, count: Number(r.cnt || 0) })),
    },
    beds: {
      total: facility.totalBeds,
      occupied: facility.occupiedBeds,
      available: facility.availableBeds,
      icuTotal: facility.icuBedsTotal,
      icuOccupied: facility.icuBedsOccupied,
      wards: facility.wardBreakdown,
      topDiagnoses: Array.from(diagCounts.entries())
        .map(([diagnosis, count]) => ({ diagnosis, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      bedList,
    },
    clinical: {
      opd: {
        total: raw.visitRows.length,
        waiting,
        withProvider,
        completed: completedOpd,
        paidCount,
        unpaidCount,
        byDepartment: Array.from(deptCounts.entries())
          .map(([department, count]) => ({ department, count }))
          .sort((a, b) => b.count - a.count),
        byVisitType: Array.from(visitTypeCounts.entries())
          .map(([visitType, count]) => ({ visitType, count }))
          .sort((a, b) => b.count - a.count),
        recentVisits,
      },
      orders: {
        total: raw.orderRows.length,
        pending: ordersPending,
        completed: ordersCompleted,
        statCount: ordersStat,
        byType: Array.from(orderTypeMap.entries())
          .map(([orderType, v]) => ({ orderType, count: v.count, pending: v.pending }))
          .sort((a, b) => b.count - a.count),
      },
      pharmacy: {
        totalPrescriptions: raw.prescriptionRows.length,
        pendingPrescriptions: rxPending,
        dispensedPrescriptions: rxDispensed,
        topDrugs: Array.from(drugMap.entries())
          .map(([drugName, v]) => ({ drugName, count: v.count, pending: v.pending }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
        recentPrescriptions: raw.prescriptionRows.slice(0, 50).map((p, idx) => ({
          id: String(p.id || `RX-${idx + 1}`),
          drugName: String(p.drug_name || 'Medication'),
          dose: String(p.dose || ''),
          route: String(p.route || ''),
          status: String(p.status || 'pending'),
          prescribedBy: String(p.prescribed_by || 'Clinician'),
          createdAt: p.created_at ? new Date(p.created_at).toISOString() : '',
        })),
      },
      laboratory: {
        totalResults: raw.labRows.length,
        pendingResults: labPending,
        criticalFlags: labCritical,
        abnormalFlags: labAbnormal,
        recentResults: raw.labRows.slice(0, 50).map((l, idx) => ({
          id: String(l.id || `LAB-${idx + 1}`),
          testName: String(l.test_name || 'Lab Panel'),
          flag: String(l.flag || 'NORMAL'),
          status: String(l.status || 'pending'),
          validatedBy: String(l.validated_by || ''),
          createdAt: l.created_at ? new Date(l.created_at).toISOString() : '',
        })),
      },
      vitals: {
        totalRecorded: raw.vitalRows.length,
        criticalUrgencyCount: vitalsCritical,
        urgentCount: vitalsUrgent,
        recentAlerts: raw.vitalRows.slice(0, 40).map((v, idx) => ({
          id: String(v.id || `VIT-${idx + 1}`),
          urgency: String(v.urgency || 'routine'),
          bp: String(v.bp || ''),
          pulse: v.pulse !== undefined && v.pulse !== null ? Number(v.pulse) : null,
          temp: v.temp !== undefined && v.temp !== null ? Number(v.temp) : null,
          spo2: v.spo2 !== undefined && v.spo2 !== null ? Number(v.spo2) : null,
          recordedBy: String(v.recorded_by || 'Nursing'),
          recordedAt: v.recorded_at ? new Date(v.recorded_at).toISOString() : '',
        })),
      },
      specialtyOperations: {
        theatreCasesCount: countKvPayloadItems(kvMap.get('medcore_os_theatre_cases_v1')?.value),
        ancPlansCount: countKvPayloadItems(kvMap.get('medcore_anc_plans_v1')?.value),
        icuStepDownCount: countKvPayloadItems(kvMap.get('medcore_os_icu_stepdown_v1')?.value),
        wardMedRequestsCount: countKvPayloadItems(kvMap.get('medcore_os_ward_med_requests_v1')?.value),
        himRecordsCount: countKvPayloadItems(kvMap.get('medcore_os_him_v1')?.value),
        syncedDomains: raw.kvRows.map((row) => ({
          key: String(row.key),
          label: KV_DOMAIN_LABELS[String(row.key)] || String(row.key),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
          itemCount: countKvPayloadItems(row.value),
        })),
      },
    },
    workforce: {
      total: staffRoster.length,
      active: activeStaffCount,
      byCadre: Array.from(staffCadreMap.entries())
        .map(([cadre, count]) => ({ cadre, count }))
        .sort((a, b) => b.count - a.count),
      byDepartment: Array.from(staffDeptMap.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count),
      staffRoster,
      transfers: raw.transfers.filter(
        (t) => t.fromFacilityId === fid || t.toFacilityId === fid
      ),
    },
    finance: {
      totalCollectedNgn: snapshot.finance.totalCollectedNgn,
      totalPendingNgn: snapshot.finance.totalPendingNgn,
      paidReceiptsCount: snapshot.finance.paidReceiptsCount,
      openRequestsCount: snapshot.finance.openRequestsCount,
      byChannel: snapshot.finance.byChannel,
      bySource: Array.from(srcRevMap.entries())
        .map(([source, v]) => ({ source, ...v }))
        .sort((a, b) => b.collectedNgn + b.pendingNgn - (a.collectedNgn + a.pendingNgn)),
      recentInvoices: raw.invoiceRows.slice(0, 60).map((inv, idx) => ({
        id: String(inv.id || `INV-${idx + 1}`),
        source: String(inv.source || 'billing'),
        description: sanitizeMohAuditDetail(inv.description || 'Clinical / Facility Service'),
        amountNgn: Number(inv.amount_ngn || 0),
        status: String(inv.status || 'pending'),
        paidVia: String(inv.paid_via || 'unassigned'),
        createdAt: inv.created_at ? new Date(inv.created_at).toISOString() : '',
      })),
      openAccountRequests: raw.accountRequestRows.slice(0, 40).map((r, idx) => ({
        id: String(r.id || `REQ-${idx + 1}`),
        purpose: sanitizeMohAuditDetail(r.purpose || 'Hospital Accounts Requisition'),
        amountNgn: Number(r.amount_ngn || 0),
        status: String(r.status || 'awaiting_payment'),
        paidVia: String(r.paid_via || ''),
        sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : '',
      })),
    },
    compliance: {
      directives: raw.directives.map((d) => ({
        ...d,
        acknowledged: d.acknowledgedFacilities.includes(fid),
      })),
      audits: raw.audits.filter((a) => a.facilityId === fid),
      notifications: raw.notificationRows.slice(0, 60).map((n) => ({
        id: String(n.id),
        level: String(n.level || 'info'),
        title: sanitizeMohAuditDetail(n.title || ''),
        body: sanitizeMohAuditDetail(n.body || ''),
        roleHint: String(n.role_hint || 'hospital_admin'),
        read: Boolean(n.read),
        createdAt: n.created_at ? new Date(n.created_at).toISOString() : '',
      })),
      auditLedger: snapshot.auditLedger.events.slice(0, 100),
    },
  };
}

export async function buildLiveFacilityDossier(facilityId: string): Promise<MohFacilityDossier> {
  const fid = facilityId.trim().toUpperCase();
  const localStore = readLocalMohStore();

  if (!isPostgresConfigured()) {
    return buildFacilityDossierFromInputs(fid, {
      syncMode: 'local_registry',
      overrideRow: localStore.facilityOverrides[fid] || null,
      staffRows: [],
      biometricRows: [],
      patientSummary: { totalRegistered: 0, activePatients: 0, newRegistrations30d: 0 },
      patientSexRows: [],
      patientAgeBandRows: [],
      bedRows: [],
      visitRows: [],
      orderRows: [],
      prescriptionRows: [],
      labRows: [],
      vitalRows: [],
      invoiceRows: [],
      accountRequestRows: [],
      notificationRows: [],
      auditLedgerRows: [],
      kvRows: [],
      activeFormDraftsCount: 0,
      directives: localStore.directives,
      audits: localStore.audits,
      transfers: localStore.transfers,
    });
  }

  await ensureMohSchema().catch(() => {});

  const [
    facRows,
    ovRows,
    staffRows,
    biometricRows,
    ptSummaryRows,
    ptSexRows,
    ptAgeRows,
    bedRows,
    visitRows,
    orderRows,
    rxRows,
    labRows,
    vitalRows,
    invoiceRows,
    acctReqRows,
    notifRows,
    auditLedgerRows,
    kvRows,
    draftCountRows,
    dirRows,
    auditRows,
    transferRows,
  ] = await Promise.all([
    safeQueryRows(`SELECT id, name, state, config, updated_at FROM facilities WHERE id = $1 LIMIT 1`, [fid]),
    safeQueryRows(`SELECT * FROM moh_facility_overrides WHERE facility_id = $1 LIMIT 1`, [fid]),
    safeQueryRows(
      `SELECT badge_id, full_name, role, role_key, title, department, status, clearance_level, clearance_label, created_at
       FROM staff WHERE facility_id = $1 ORDER BY clearance_level DESC, full_name ASC`,
      [fid]
    ),
    safeQueryRows(`SELECT badge_id, enrolled_at FROM staff_biometrics WHERE facility_id = $1`, [fid]),
    safeQueryRows(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE COALESCE(status, 'active') = 'active')::int AS active,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS recent
       FROM patients WHERE facility_id = $1`,
      [fid]
    ),
    safeQueryRows(
      `SELECT COALESCE(NULLIF(TRIM(sex), ''), 'Unspecified') AS label, COUNT(*)::int AS cnt
       FROM patients WHERE facility_id = $1 GROUP BY 1 ORDER BY 2 DESC`,
      [fid]
    ),
    safeQueryRows(
      `SELECT CASE
                WHEN date_of_birth IS NULL THEN 'Unspecified'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 5 THEN '0–4 yrs (Under-5)'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN '5–17 yrs (Paediatric)'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 45 THEN '18–44 yrs (Adult)'
                WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 65 THEN '45–64 yrs (Mid-Adult)'
                ELSE '65+ yrs (Geriatric)'
              END AS band,
              COUNT(*)::int AS cnt
       FROM patients WHERE facility_id = $1 GROUP BY 1 ORDER BY 2 DESC`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, ward, bed_no, status, doctor, diagnosis, updated_at
       FROM inpatient_beds WHERE facility_id = $1 ORDER BY ward ASC, bed_no ASC LIMIT 400`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, queue_number, department, doctor, status, payment_status, visit_type, checked_in_at
       FROM reception_visits WHERE facility_id = $1 ORDER BY checked_in_at DESC LIMIT 250`,
      [fid]
    ),
    safeQueryRows(
      `SELECT facility_id, order_type, status, priority FROM clinical_orders WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 300`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, drug_name, dose, route, status, prescribed_by, created_at
       FROM prescriptions WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 250`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, test_name, flag, status, validated_by, created_at
       FROM lab_results WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 250`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, urgency, bp, pulse, temp, spo2, recorded_by, recorded_at
       FROM vital_signs WHERE facility_id = $1 ORDER BY recorded_at DESC LIMIT 200`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, source, description, amount_ngn, status, paid_via, created_at
       FROM invoices_receipts WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 250`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, purpose, amount_ngn, status, paid_via, sent_at
       FROM accounts_requests WHERE facility_id = $1 ORDER BY sent_at DESC LIMIT 200`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, level, title, body, role_hint, read, created_at
       FROM notifications WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [fid]
    ),
    safeQueryRows(
      `SELECT id, facility_id, actor, actor_badge, category, severity, action, entity, entity_id, detail, row_hash, created_at
       FROM clinical_audit_ledger WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 120`,
      [fid]
    ),
    safeQueryRows(
      `SELECT key, value, updated_at FROM facility_kv WHERE facility_id = $1 ORDER BY updated_at DESC`,
      [fid]
    ),
    safeQueryRows(
      `SELECT COUNT(*)::int AS cnt FROM form_drafts WHERE facility_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [fid]
    ),
    safeQueryRows(`SELECT * FROM moh_directives ORDER BY issued_at DESC LIMIT 100`),
    safeQueryRows(`SELECT * FROM moh_audits WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 100`, [fid]),
    safeQueryRows(
      `SELECT * FROM moh_staff_transfers WHERE from_facility_id = $1 OR to_facility_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [fid]
    ),
  ]);

  const ptSum = ptSummaryRows[0] || {};
  const ov = ovRows[0];

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

  return buildFacilityDossierFromInputs(fid, {
    syncMode: 'live_db',
    facilityRow: (facRows[0] as any) || null,
    overrideRow: ov
      ? {
          emergencyStatus: ov.emergency_status || 'normal',
          accreditationStatus: ov.accreditation_status || 'pending',
          notes: ov.notes || '',
          updatedBy: ov.updated_by || '',
          updatedAt: ov.updated_at ? new Date(ov.updated_at).toISOString() : new Date().toISOString(),
        }
      : null,
    staffRows: staffRows as any,
    biometricRows: biometricRows as any,
    patientSummary: {
      totalRegistered: Number(ptSum.total || 0),
      activePatients: Number(ptSum.active || 0),
      newRegistrations30d: Number(ptSum.recent || 0),
    },
    patientSexRows: ptSexRows as any,
    patientAgeBandRows: ptAgeRows as any,
    bedRows: bedRows as any,
    visitRows: visitRows as any,
    orderRows: orderRows as any,
    prescriptionRows: rxRows as any,
    labRows: labRows as any,
    vitalRows: vitalRows as any,
    invoiceRows: invoiceRows as any,
    accountRequestRows: acctReqRows as any,
    notificationRows: notifRows as any,
    auditLedgerRows: auditLedgerRows as any,
    kvRows: kvRows as any,
    activeFormDraftsCount: Number(draftCountRows[0]?.cnt || 0),
    directives,
    audits,
    transfers,
  });
}

export async function sendDirectFacilityNotice(input: {
  facilityId: string;
  title: string;
  body: string;
  level?: 'info' | 'warning' | 'alert';
  sentBy?: string;
}): Promise<{ ok: true; facilityId: string; sentAt: string }> {
  const fid = input.facilityId.trim().toUpperCase();
  const cleanTitle = sanitizeMohAuditDetail(input.title);
  const cleanBody = sanitizeMohAuditDetail(input.body);
  const level = input.level || 'warning';
  const sentAt = new Date().toISOString();

  await notifyFacilitiesInOs([fid], {
    level,
    title: `MOH Direct Notice: ${cleanTitle}`,
    body: `${cleanBody}${input.sentBy ? ` — Issued by ${input.sentBy}` : ''}`,
    category: 'moh_direct_notice',
  });

  publishMohEvent('facility', { facilityId: fid, action: 'direct_notice', sentAt });
  return { ok: true, facilityId: fid, sentAt };
}
