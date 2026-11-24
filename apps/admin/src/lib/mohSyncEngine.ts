import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AKWA_IBOM_LGAS,
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
  MohCitizenGrievance,
  MohDirective,
  MohEnforcementAction,
  MohFacilityBedItem,
  MohFacilityDossier,
  MohFacilityGovernance,
  MohFacilitySecurity,
  MohFacilityStaffRosterItem,
  MohFacilityTelemetry,
  MohHrhRecruitment,
  MohIdsrReport,
  MohLicenseAlertStatus,
  MohLiveSnapshot,
  MohLgaWorkforceRow,
  MohOperationalStatus,
  MohOutbreakAlert,
  MohPrivateFacilityRecord,
  MohRegionalRollup,
  MohStaffDirectoryItem,
  MohSupplyEquipmentItem,
  MohSyncStatus,
  MohTransferRecord,
} from './mohTypes';

const LOCAL_MOH_STATE_FILE = path.join(os.tmpdir(), 'medcore-moh-oversight-v1.json');

interface MohFacilityOverrideEntry {
  emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
  accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
  operationalStatus?: MohOperationalStatus;
  licenseNo?: string;
  licenseExpiry?: string;
  approvedServices?: string[];
  ownership?: string;
  unapprovedPracticeFlag?: boolean;
  gpsLat?: number;
  gpsLng?: number;
  notes?: string;
  updatedBy?: string;
  updatedAt: string;
}

interface LocalMohOversightStore {
  directives: MohDirective[];
  audits: MohAuditRecord[];
  transfers: MohTransferRecord[];
  alerts: MohOutbreakAlert[];
  facilityOverrides: Record<string, MohFacilityOverrideEntry>;
  privateFacilities: MohPrivateFacilityRecord[];
  enforcementActions: MohEnforcementAction[];
  hrhRecruitment: MohHrhRecruitment[];
  supplyEquipment: MohSupplyEquipmentItem[];
  idsrReports: MohIdsrReport[];
  citizenGrievances: MohCitizenGrievance[];
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
        privateFacilities: Array.isArray(parsed.privateFacilities) ? parsed.privateFacilities : [],
        enforcementActions: Array.isArray(parsed.enforcementActions) ? parsed.enforcementActions : [],
        hrhRecruitment: Array.isArray(parsed.hrhRecruitment) ? parsed.hrhRecruitment : [],
        supplyEquipment: Array.isArray(parsed.supplyEquipment) ? parsed.supplyEquipment : [],
        idsrReports: Array.isArray(parsed.idsrReports) ? parsed.idsrReports : [],
        citizenGrievances: Array.isArray(parsed.citizenGrievances) ? parsed.citizenGrievances : [],
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
    privateFacilities: [],
    enforcementActions: [],
    hrhRecruitment: [],
    supplyEquipment: [],
    idsrReports: [],
    citizenGrievances: [],
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
  facilityOverrides: Record<string, MohFacilityOverrideEntry>;
  privateFacilities?: MohPrivateFacilityRecord[];
  enforcementActions?: MohEnforcementAction[];
  hrhRecruitment?: MohHrhRecruitment[];
  supplyEquipment?: MohSupplyEquipmentItem[];
  idsrReports?: MohIdsrReport[];
  citizenGrievances?: MohCitizenGrievance[];
}

export function computeLicenseAlert(licenseExpiry: string, nowIso: string): MohLicenseAlertStatus {
  const clean = String(licenseExpiry || '').trim();
  if (!clean) return 'missing';
  const expMs = Date.parse(clean);
  if (!Number.isFinite(expMs)) return 'missing';
  const refMs = Date.parse(nowIso);
  const nowMs = Number.isFinite(refMs) ? refMs : Date.now();
  if (expMs < nowMs) return 'expired';
  if (expMs <= nowMs + 30 * 24 * 60 * 60 * 1000) return 'expiring_soon';
  return 'valid';
}

function classifyHrhCadre(
  role?: string | null,
  roleKey?: string | null
): 'doctors' | 'nurses' | 'midwives' | 'pharmacists' | 'chews' | 'otherStaff' {
  const text = `${role || ''} ${roleKey || ''}`.toLowerCase();
  if (/doctor|physician|consultant|medical officer|surgeon|dentist|md\b/.test(text)) return 'doctors';
  if (/chew|community health|extension/.test(text)) return 'chews';
  if (/pharm/.test(text)) return 'pharmacists';
  if (/midwi/.test(text)) return 'midwives';
  if (/nurse|matron|\brn\b/.test(text)) return 'nurses';
  return 'otherStaff';
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

  // Map official catalog first + private clinic registry + dynamic DB rows
  const catalogMap = new Map<string, OfficialAkwaIbomFacility>();
  for (const item of OFFICIAL_AKWA_IBOM_FACILITIES) {
    catalogMap.set(item.facilityId, item);
  }

  const privateMap = new Map<string, MohPrivateFacilityRecord>();
  for (const p of raw.privateFacilities || []) {
    const pid = String(p.facilityId || '').trim().toUpperCase();
    if (!pid) continue;
    privateMap.set(pid, { ...p, facilityId: pid });
  }

  const lgaInfoMap = new Map<string, (typeof AKWA_IBOM_LGAS)[number]>();
  for (const row of AKWA_IBOM_LGAS) {
    lgaInfoMap.set(row.lga.toLowerCase(), row);
  }

  // Track all known facility IDs (official + private registry + dynamic DB rows)
  const dbFacilityMap = new Map<string, MohRawDatabaseInputs['facilitiesRows'][number]>();
  for (const f of raw.facilitiesRows) {
    const id = String(f.id || '').trim().toUpperCase();
    if (!id) continue;
    dbFacilityMap.set(id, f);
  }

  const allFacilityIds = new Set<string>([...catalogMap.keys(), ...privateMap.keys(), ...dbFacilityMap.keys()]);

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
    const priv = privateMap.get(fid);
    const dbRow = dbFacilityMap.get(fid);
    const cfg = (dbRow?.config && typeof dbRow.config === 'object' ? dbRow.config : {}) as Record<string, any>;

    const facilityName = String(
      official?.facilityName || priv?.facilityName || cfg.displayName || dbRow?.name || fid
    ).trim();
    const lga = String(cfg.lga || priv?.lga || official?.lga || '').trim();
    const location = String(official?.location || (lga ? `${lga}, Akwa Ibom` : 'Akwa Ibom')).trim();
    const district: SenatorialDistrict =
      official?.district || priv?.district || inferSenatorialDistrict(lga || location, facilityName);
    const board: SupervisoryBoard = normalizeBoard(
      cfg.supervisoryBoard,
      official?.board || (priv?.ownership === 'mission' ? 'Mission' : 'AKSHMB')
    );
    const tier = official?.tier || priv?.tier || 'district_hospital';
    const facilityType = String(official?.facilityType || priv?.facilityType || cfg.facilityType || 'General Hospital');

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
      priv?.accreditationStatus ||
      (hasDbActivity
        ? complianceScore >= 75 && Boolean(hfrCode)
          ? 'accredited'
          : 'provisional'
        : 'pending');

    const operationalStatus: MohOperationalStatus =
      ov?.operationalStatus ||
      priv?.operationalStatus ||
      (accreditationStatus === 'suspended'
        ? 'sealed'
        : hasDbActivity
        ? 'fully_functional'
        : 'partially_functional');

    const ownership = String(
      ov?.ownership ||
        priv?.ownership ||
        cfg.ownership ||
        official?.ownership ||
        (board === 'Mission' ? 'mission' : 'public_state')
    ).trim();
    const licenseNo = String(ov?.licenseNo || priv?.licenseNo || cfg.licenseNo || '').trim();
    const licenseExpiry = String(ov?.licenseExpiry || priv?.licenseExpiry || cfg.licenseExpiry || '').trim();
    const licenseAlert = computeLicenseAlert(licenseExpiry, syncedAt);
    const approvedServices =
      ov?.approvedServices?.length
        ? ov.approvedServices
        : priv?.approvedServices?.length
        ? priv.approvedServices
        : official?.approvedServices?.length
        ? official.approvedServices
        : ['General OPD'];

    const resolvedLga = lga || location.split(',')[0].trim();
    const lgaMeta = lgaInfoMap.get(resolvedLga.toLowerCase());
    const cfgLat = Number(cfg.gpsLatitude);
    const cfgLng = Number(cfg.gpsLongitude);
    const latitude =
      typeof ov?.gpsLat === 'number' && Number.isFinite(ov.gpsLat)
        ? ov.gpsLat
        : Number.isFinite(cfgLat) && cfgLat !== 0
        ? cfgLat
        : typeof priv?.latitude === 'number' && Number.isFinite(priv.latitude)
        ? priv.latitude
        : official?.latitude ?? lgaMeta?.latitude ?? 5.0377;
    const longitude =
      typeof ov?.gpsLng === 'number' && Number.isFinite(ov.gpsLng)
        ? ov.gpsLng
        : Number.isFinite(cfgLng) && cfgLng !== 0
        ? cfgLng
        : typeof priv?.longitude === 'number' && Number.isFinite(priv.longitude)
        ? priv.longitude
        : official?.longitude ?? lgaMeta?.longitude ?? 7.9128;

    const attendanceRatePct =
      staffList.length > 0 ? Math.round((activeStaff.length / staffList.length) * 100) : 0;
    const ruralUnderstaffed = Boolean(lgaMeta?.ruralPriority && activeStaff.length < 5);

    allFacilities.push({
      facilityId: fid,
      facilityName,
      location,
      lga: resolvedLga,
      district,
      tier,
      facilityType,
      board,
      enrollmentStatus: hasDbActivity || Boolean(priv) ? 'active' : 'pending',
      hasDbActivity,
      lastSyncedAt: dbRow?.updated_at ? String(dbRow.updated_at) : hasDbActivity ? syncedAt : null,
      hfrCode,
      supervisoryBoard: String(cfg.supervisoryBoard || board),
      medicalDirector,
      boardAuthCircularRef,
      complianceScore,
      accreditationStatus,
      emergencyStatus,
      operationalStatus,
      ownership,
      licenseNo,
      licenseExpiry,
      licenseAlert,
      unapprovedPracticeFlag: Boolean(ov?.unapprovedPracticeFlag),
      approvedServices,
      latitude,
      longitude,
      attendanceRatePct,
      ruralUnderstaffed,
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

  // Pillar 2: Anti-Quackery & Enforcement
  const enforcement = (raw.enforcementActions || [])
    .filter((e) => {
      const fid = String(e.facilityId || '').trim().toUpperCase();
      if (fidFilter) return fid === fidFilter;
      if (districtFilter !== 'ALL') return includedFacIds.has(fid) || e.district === districtFilter;
      return true;
    })
    .map((e) => ({
      ...e,
      reason: sanitizeMohAuditDetail(e.reason),
      resolutionNotes: sanitizeMohAuditDetail(e.resolutionNotes),
    }));

  // Pillar 3: HRH LGA Cadre Distribution, Attendance & Recruitment
  const lgaDistribution: MohLgaWorkforceRow[] = AKWA_IBOM_LGAS.filter(
    (l) => districtFilter === 'ALL' || l.district === districtFilter
  ).map((lgaInfo) => {
    const lgaFacs = filteredFacilities.filter(
      (f) => f.lga.trim().toLowerCase() === lgaInfo.lga.toLowerCase()
    );
    const facIdsInLga = new Set(lgaFacs.map((f) => f.facilityId));
    let doctors = 0;
    let nurses = 0;
    let midwives = 0;
    let pharmacists = 0;
    let chews = 0;
    let otherStaff = 0;
    let totalStaff = 0;
    let activeStaff = 0;
    for (const st of raw.staffRows) {
      const sfid = String(st.facility_id || '').trim().toUpperCase();
      if (!facIdsInLga.has(sfid)) continue;
      totalStaff++;
      if (String(st.status || 'active').toLowerCase() === 'suspended') continue;
      activeStaff++;
      const bucket = classifyHrhCadre(st.role, st.role_key);
      if (bucket === 'doctors') doctors++;
      else if (bucket === 'nurses') nurses++;
      else if (bucket === 'midwives') midwives++;
      else if (bucket === 'pharmacists') pharmacists++;
      else if (bucket === 'chews') chews++;
      else otherStaff++;
    }
    const attendanceRatePct = totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 0;
    return {
      lga: lgaInfo.lga,
      district: lgaInfo.district,
      ruralPriority: Boolean(lgaInfo.ruralPriority),
      facilitiesCount: lgaFacs.length,
      doctors,
      nurses,
      midwives,
      pharmacists,
      chews,
      otherStaff,
      totalStaff: activeStaff,
      attendanceRatePct,
      understaffed: Boolean(lgaInfo.ruralPriority && activeStaff < 5),
    };
  });

  const facsWithStaff = filteredFacilities.filter((f) => f.totalStaffCount > 0);
  const avgAttendancePct =
    facsWithStaff.length > 0
      ? Math.round(facsWithStaff.reduce((s, f) => s + f.attendanceRatePct, 0) / facsWithStaff.length)
      : 0;
  const hrhRecruitment = (raw.hrhRecruitment || []).filter((r) => {
    const fid = String(r.facilityId || '').trim().toUpperCase();
    if (fidFilter) return fid === fidFilter;
    if (districtFilter !== 'ALL') return includedFacIds.has(fid) || lgaInfoMap.get(r.lga.toLowerCase())?.district === districtFilter;
    return true;
  });

  // Pillar 4: Supply Chain, Equipment & Infrastructure
  const supplyItems = (raw.supplyEquipment || [])
    .filter((item) => {
      const fid = String(item.facilityId || '').trim().toUpperCase();
      if (fidFilter) return fid === fidFilter;
      if (districtFilter !== 'ALL') return includedFacIds.has(fid) || lgaInfoMap.get(item.lga.toLowerCase())?.district === districtFilter;
      return true;
    })
    .map((item) => ({
      ...item,
      notes: sanitizeMohAuditDetail(item.notes),
    }));

  // Pillar 5: DSNO IDSR Outbreak Reports & Weekly/Monthly RMNCH Service Utilization
  const idsrFiltered = (raw.idsrReports || [])
    .filter((r) => {
      const fid = String(r.facilityId || '').trim().toUpperCase();
      if (fidFilter) return fid === fidFilter;
      if (districtFilter !== 'ALL') return r.district === districtFilter || includedFacIds.has(fid);
      return true;
    })
    .map((r) => ({
      ...r,
      notes: sanitizeMohAuditDetail(r.notes),
    }));
  const dsnoReports = idsrFiltered.filter((r) => r.reportKind === 'dsno_outbreak');
  const serviceMetrics = idsrFiltered.filter((r) => r.reportKind === 'service_utilization');

  // Pillar 6: Public Citizen Feedback & Grievance Redressal
  const grievanceItems = (raw.citizenGrievances || [])
    .filter((g) => {
      const fid = String(g.facilityId || '').trim().toUpperCase();
      if (fidFilter) return fid === fidFilter;
      if (districtFilter !== 'ALL') return includedFacIds.has(fid) || lgaInfoMap.get(g.lga.toLowerCase())?.district === districtFilter;
      return true;
    })
    .map((g) => ({
      ...g,
      summary: sanitizeMohAuditDetail(g.summary),
      resolutionNotes: sanitizeMohAuditDetail(g.resolutionNotes),
    }));
  const resolvedWithHrs = grievanceItems.filter(
    (g) => g.status === 'resolved' && typeof g.turnaroundHours === 'number' && Number.isFinite(g.turnaroundHours)
  );
  const avgTurnaroundHours =
    resolvedWithHrs.length > 0
      ? Math.round((resolvedWithHrs.reduce((s, g) => s + Number(g.turnaroundHours || 0), 0) / resolvedWithHrs.length) * 10) / 10
      : 0;
  const avgRating =
    grievanceItems.length > 0
      ? Math.round((grievanceItems.reduce((s, g) => s + Number(g.rating || 0), 0) / grievanceItems.length) * 10) / 10
      : 0;

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
    enforcement,
    hrh: {
      lgaDistribution,
      attendanceSummary: {
        avgAttendancePct,
        avgAbsenteeismPct: avgAttendancePct > 0 ? Math.max(0, 100 - avgAttendancePct) : 0,
        ruralUnderstaffedCount: lgaDistribution.filter((r) => r.understaffed).length,
      },
      recruitment: hrhRecruitment,
    },
    supplyChain: {
      items: supplyItems,
      lowStockCount: supplyItems.filter((i) => i.functionalStatus === 'low_stock').length,
      stockOutCount: supplyItems.filter((i) => i.functionalStatus === 'stock_out').length,
      faultyEquipmentCount: supplyItems.filter(
        (i) => i.domain === 'equipment' && (i.functionalStatus === 'faulty' || i.functionalStatus === 'out_of_service')
      ).length,
      activeRenovationsCount: supplyItems.filter((i) => i.functionalStatus === 'ongoing_renovation').length,
    },
    idsr: {
      dsnoReports,
      serviceMetrics,
      maternalDeathsTotal: idsrFiltered.reduce((s, r) => s + Number(r.maternalDeaths || 0), 0),
      under5DeathsTotal: idsrFiltered.reduce((s, r) => s + Number(r.under5Deaths || 0), 0),
      ancVisitsTotal: serviceMetrics.reduce((s, r) => s + Number(r.ancVisits || 0), 0),
      skilledDeliveriesTotal: serviceMetrics.reduce((s, r) => s + Number(r.skilledDeliveries || 0), 0),
      immunizationDosesTotal: serviceMetrics.reduce((s, r) => s + Number(r.immunizationDoses || 0), 0),
      emergencyReferralsTotal: serviceMetrics.reduce((s, r) => s + Number(r.emergencyReferrals || 0), 0),
    },
    grievances: {
      items: grievanceItems,
      openCount: grievanceItems.filter((g) => g.status === 'open').length,
      investigatingCount: grievanceItems.filter((g) => g.status === 'under_investigation').length,
      resolvedCount: grievanceItems.filter((g) => g.status === 'resolved').length,
      avgTurnaroundHours,
      avgRating,
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
        privateFacilities: localStore.privateFacilities,
        enforcementActions: localStore.enforcementActions,
        hrhRecruitment: localStore.hrhRecruitment,
        supplyEquipment: localStore.supplyEquipment,
        idsrReports: localStore.idsrReports,
        citizenGrievances: localStore.citizenGrievances,
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
    privateRows,
    enforcementRows,
    recruitmentRows,
    supplyRows,
    idsrRows,
    grievanceRows,
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
    safeQueryRows(`SELECT * FROM moh_private_facilities ORDER BY created_at DESC LIMIT 200`),
    safeQueryRows(`SELECT * FROM moh_enforcement_actions ORDER BY created_at DESC LIMIT 150`),
    safeQueryRows(`SELECT * FROM moh_hrh_recruitment ORDER BY created_at DESC LIMIT 150`),
    safeQueryRows(`SELECT * FROM moh_supply_equipment ORDER BY updated_at DESC LIMIT 300`),
    safeQueryRows(`SELECT * FROM moh_idsr_reports ORDER BY created_at DESC LIMIT 200`),
    safeQueryRows(`SELECT * FROM moh_citizen_grievances ORDER BY created_at DESC LIMIT 200`),
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
      operationalStatus: ov.operational_status || undefined,
      licenseNo: ov.license_no || '',
      licenseExpiry: ov.license_expiry || '',
      approvedServices: Array.isArray(ov.approved_services) ? ov.approved_services : undefined,
      ownership: ov.ownership || undefined,
      unapprovedPracticeFlag: Boolean(ov.unapproved_practice_flag),
      gpsLat: ov.gps_lat !== null && ov.gps_lat !== undefined ? Number(ov.gps_lat) : undefined,
      gpsLng: ov.gps_lng !== null && ov.gps_lng !== undefined ? Number(ov.gps_lng) : undefined,
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

  const privateFacilities: MohPrivateFacilityRecord[] = privateRows.map((p: any) => ({
    facilityId: String(p.facility_id).toUpperCase(),
    facilityName: String(p.facility_name),
    lga: String(p.lga || 'Uyo'),
    district: (p.district || 'Uyo') as SenatorialDistrict,
    ownership: (p.ownership || 'private') as MohPrivateFacilityRecord['ownership'],
    facilityType: String(p.facility_type || 'Private Clinic'),
    tier: (p.tier || 'cottage_hospital') as MohPrivateFacilityRecord['tier'],
    licenseNo: String(p.license_no || ''),
    licenseExpiry: String(p.license_expiry || ''),
    operationalStatus: (p.operational_status || 'fully_functional') as MohOperationalStatus,
    accreditationStatus: (p.accreditation_status || 'provisional') as MohPrivateFacilityRecord['accreditationStatus'],
    approvedServices: Array.isArray(p.approved_services) ? p.approved_services : ['General OPD'],
    latitude: Number(p.latitude || 5.03),
    longitude: Number(p.longitude || 7.91),
    registeredBy: String(p.registered_by || 'MOH Registry'),
    createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
  }));

  const enforcementActions: MohEnforcementAction[] = enforcementRows.map((e: any) => ({
    id: String(e.id),
    facilityId: String(e.facility_id || '').toUpperCase(),
    facilityName: String(e.facility_name || ''),
    lga: String(e.lga || ''),
    district: (e.district || 'Uyo') as SenatorialDistrict,
    actionType: (e.action_type || 'inspection') as MohEnforcementAction['actionType'],
    reason: String(e.reason || ''),
    checklist: Array.isArray(e.checklist) ? e.checklist : [],
    evidencePhotoData: e.evidence_photo_data ? String(e.evidence_photo_data) : undefined,
    officerName: String(e.officer_name || 'MOH Taskforce'),
    status: (e.status || 'active_seal') as MohEnforcementAction['status'],
    followUpDate: String(e.follow_up_date || ''),
    resolutionNotes: String(e.resolution_notes || ''),
    createdAt: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
  }));

  const hrhRecruitment: MohHrhRecruitment[] = recruitmentRows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    cadre: String(r.cadre),
    facilityId: String(r.facility_id || '').toUpperCase(),
    facilityName: String(r.facility_name || ''),
    lga: String(r.lga || ''),
    vacanciesCount: Number(r.vacancies_count || 1),
    applicantsCount: Number(r.applicants_count || 0),
    shortlistedCount: Number(r.shortlisted_count || 0),
    deployedCount: Number(r.deployed_count || 0),
    stage: (r.stage || 'open') as MohHrhRecruitment['stage'],
    postedBy: String(r.posted_by || 'MOH HRH Desk'),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  const supplyEquipment: MohSupplyEquipmentItem[] = supplyRows.map((s: any) => ({
    id: String(s.id),
    domain: (s.domain || 'medicine_vaccine') as MohSupplyEquipmentItem['domain'],
    facilityId: String(s.facility_id || '').toUpperCase(),
    facilityName: String(s.facility_name || ''),
    lga: String(s.lga || ''),
    itemName: String(s.item_name || ''),
    category: String(s.category || ''),
    quantity: Number(s.quantity || 0),
    reorderLevel: Number(s.reorder_level || 0),
    unit: String(s.unit || 'units'),
    coldChainTempC: s.cold_chain_temp_c !== null && s.cold_chain_temp_c !== undefined ? Number(s.cold_chain_temp_c) : null,
    functionalStatus: (s.functional_status || 'operational') as MohSupplyEquipmentItem['functionalStatus'],
    notes: String(s.notes || ''),
    updatedBy: String(s.updated_by || ''),
    updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
  }));

  const idsrReports: MohIdsrReport[] = idsrRows.map((r: any) => ({
    id: String(r.id),
    reportKind: (r.report_kind || 'dsno_outbreak') as MohIdsrReport['reportKind'],
    facilityId: String(r.facility_id || '').toUpperCase(),
    facilityName: String(r.facility_name || ''),
    lga: String(r.lga || 'Uyo'),
    district: (r.district || 'Uyo') as SenatorialDistrict,
    periodLabel: String(r.period_label || ''),
    disease: String(r.disease || ''),
    suspectedCases: Number(r.suspected_cases || 0),
    confirmedCases: Number(r.confirmed_cases || 0),
    deaths: Number(r.deaths || 0),
    ancVisits: Number(r.anc_visits || 0),
    skilledDeliveries: Number(r.skilled_deliveries || 0),
    immunizationDoses: Number(r.immunization_doses || 0),
    emergencyReferrals: Number(r.emergency_referrals || 0),
    maternalDeaths: Number(r.maternal_deaths || 0),
    under5Deaths: Number(r.under5_deaths || 0),
    dsnoOfficer: String(r.dsno_officer || ''),
    status: (r.status || 'submitted') as MohIdsrReport['status'],
    notes: String(r.notes || ''),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  const citizenGrievances: MohCitizenGrievance[] = grievanceRows.map((g: any) => ({
    id: String(g.id),
    trackingCode: String(g.tracking_code || ''),
    facilityId: String(g.facility_id || '').toUpperCase(),
    facilityName: String(g.facility_name || ''),
    lga: String(g.lga || ''),
    channel: (g.channel || 'qr') as MohCitizenGrievance['channel'],
    category: (g.category || 'service_quality') as MohCitizenGrievance['category'],
    rating: Number(g.rating || 3),
    summary: String(g.summary || ''),
    anonymous: Boolean(g.anonymous),
    status: (g.status || 'open') as MohCitizenGrievance['status'],
    assignedTo: String(g.assigned_to || ''),
    resolutionNotes: String(g.resolution_notes || ''),
    turnaroundHours: g.turnaround_hours !== null && g.turnaround_hours !== undefined ? Number(g.turnaround_hours) : null,
    createdAt: g.created_at ? new Date(g.created_at).toISOString() : new Date().toISOString(),
    resolvedAt: g.resolved_at ? new Date(g.resolved_at).toISOString() : null,
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
      privateFacilities,
      enforcementActions,
      hrhRecruitment,
      supplyEquipment,
      idsrReports,
      citizenGrievances,
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
  operationalStatus?: MohOperationalStatus;
  licenseNo?: string;
  licenseExpiry?: string;
  approvedServices?: string[];
  ownership?: string;
  unapprovedPracticeFlag?: boolean;
  gpsLat?: number;
  gpsLng?: number;
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
    const operationalStatus = input.operationalStatus || prev.operational_status || 'fully_functional';
    const licenseNo = input.licenseNo !== undefined ? input.licenseNo : prev.license_no || '';
    const licenseExpiry = input.licenseExpiry !== undefined ? input.licenseExpiry : prev.license_expiry || '';
    const approvedServices =
      input.approvedServices !== undefined
        ? input.approvedServices
        : Array.isArray(prev.approved_services)
        ? prev.approved_services
        : [];
    const ownership = input.ownership !== undefined ? input.ownership : prev.ownership || '';
    const unapprovedPracticeFlag =
      input.unapprovedPracticeFlag !== undefined
        ? input.unapprovedPracticeFlag
        : Boolean(prev.unapproved_practice_flag);
    const gpsLat =
      typeof input.gpsLat === 'number' && Number.isFinite(input.gpsLat)
        ? input.gpsLat
        : prev.gps_lat !== null && prev.gps_lat !== undefined
        ? Number(prev.gps_lat)
        : null;
    const gpsLng =
      typeof input.gpsLng === 'number' && Number.isFinite(input.gpsLng)
        ? input.gpsLng
        : prev.gps_lng !== null && prev.gps_lng !== undefined
        ? Number(prev.gps_lng)
        : null;
    const notes = input.notes !== undefined ? input.notes : prev.notes || '';
    const updatedBy = input.updatedBy || 'MOH Oversight';

    await query(
      `INSERT INTO moh_facility_overrides (
         facility_id, emergency_status, accreditation_status, operational_status,
         license_no, license_expiry, approved_services, ownership, unapproved_practice_flag,
         gps_lat, gps_lng, notes, updated_by, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (facility_id) DO UPDATE SET
         emergency_status = EXCLUDED.emergency_status,
         accreditation_status = EXCLUDED.accreditation_status,
         operational_status = EXCLUDED.operational_status,
         license_no = EXCLUDED.license_no,
         license_expiry = EXCLUDED.license_expiry,
         approved_services = EXCLUDED.approved_services,
         ownership = EXCLUDED.ownership,
         unapproved_practice_flag = EXCLUDED.unapproved_practice_flag,
         gps_lat = EXCLUDED.gps_lat,
         gps_lng = EXCLUDED.gps_lng,
         notes = EXCLUDED.notes,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        fid,
        emergencyStatus,
        accreditationStatus,
        operationalStatus,
        licenseNo,
        licenseExpiry,
        JSON.stringify(approvedServices),
        ownership,
        unapprovedPracticeFlag,
        gpsLat,
        gpsLng,
        notes,
        updatedBy,
      ]
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
      operationalStatus: input.operationalStatus || prev?.operationalStatus,
      licenseNo: input.licenseNo !== undefined ? input.licenseNo : prev?.licenseNo,
      licenseExpiry: input.licenseExpiry !== undefined ? input.licenseExpiry : prev?.licenseExpiry,
      approvedServices: input.approvedServices !== undefined ? input.approvedServices : prev?.approvedServices,
      ownership: input.ownership !== undefined ? input.ownership : prev?.ownership,
      unapprovedPracticeFlag:
        input.unapprovedPracticeFlag !== undefined ? input.unapprovedPracticeFlag : prev?.unapprovedPracticeFlag,
      gpsLat: input.gpsLat !== undefined ? input.gpsLat : prev?.gpsLat,
      gpsLng: input.gpsLng !== undefined ? input.gpsLng : prev?.gpsLng,
      notes: input.notes !== undefined ? input.notes : prev?.notes,
      updatedBy: input.updatedBy || 'MOH Oversight',
      updatedAt,
    };
    writeLocalMohStore(store);
  }

  publishMohEvent('facility', {
    facilityId: fid,
    emergencyStatus: input.emergencyStatus,
    accreditationStatus: input.accreditationStatus,
    operationalStatus: input.operationalStatus,
  });
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
  overrideRow?: MohFacilityOverrideEntry | null;
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
    tier: catalogMatch?.tier || 'district_hospital',
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
    operationalStatus: raw.overrideRow?.operationalStatus || (raw.facilityRow ? 'fully_functional' : 'partially_functional'),
    ownership: raw.overrideRow?.ownership || catalogMatch?.ownership || (catalogMatch?.board === 'Mission' ? 'mission' : 'public_state'),
    licenseNo: raw.overrideRow?.licenseNo || '',
    licenseExpiry: raw.overrideRow?.licenseExpiry || '',
    licenseAlert: computeLicenseAlert(raw.overrideRow?.licenseExpiry || '', syncedAt),
    unapprovedPracticeFlag: Boolean(raw.overrideRow?.unapprovedPracticeFlag),
    approvedServices: raw.overrideRow?.approvedServices || catalogMatch?.approvedServices || ['General OPD'],
    latitude: raw.overrideRow?.gpsLat ?? catalogMatch?.latitude ?? 5.0377,
    longitude: raw.overrideRow?.gpsLng ?? catalogMatch?.longitude ?? 7.9128,
    attendanceRatePct: raw.staffRows.length > 0 ? 100 : 0,
    ruralUnderstaffed: false,
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
          operationalStatus: ov.operational_status || undefined,
          licenseNo: ov.license_no || '',
          licenseExpiry: ov.license_expiry || '',
          approvedServices: Array.isArray(ov.approved_services) ? ov.approved_services : undefined,
          ownership: ov.ownership || undefined,
          unapprovedPracticeFlag: Boolean(ov.unapproved_practice_flag),
          gpsLat: ov.gps_lat !== null && ov.gps_lat !== undefined ? Number(ov.gps_lat) : undefined,
          gpsLng: ov.gps_lng !== null && ov.gps_lng !== undefined ? Number(ov.gps_lng) : undefined,
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

function resolveFacilityMeta(facilityId: string, fallbackName?: string, fallbackLga?: string, fallbackDistrict?: SenatorialDistrict) {
  const fid = facilityId.trim().toUpperCase();
  const official = OFFICIAL_AKWA_IBOM_FACILITIES.find((f) => f.facilityId === fid);
  const lga = String(fallbackLga || official?.lga || 'Uyo').trim();
  const district = fallbackDistrict || official?.district || inferSenatorialDistrict(lga, fallbackName || official?.facilityName || '');
  const lgaMeta = AKWA_IBOM_LGAS.find((l) => l.lga.toLowerCase() === lga.toLowerCase());
  return {
    facilityId: fid,
    facilityName: String(fallbackName || official?.facilityName || fid).trim(),
    lga,
    district,
    latitude: official?.latitude ?? lgaMeta?.latitude ?? 5.0377,
    longitude: official?.longitude ?? lgaMeta?.longitude ?? 7.9128,
  };
}

// ── Pillar 2: Private Clinic Registration & Anti-Quackery Enforcement ─────
export async function registerPrivateFacilityRecord(input: {
  facilityId?: string;
  facilityName: string;
  lga: string;
  district?: SenatorialDistrict;
  ownership?: MohPrivateFacilityRecord['ownership'];
  facilityType?: string;
  licenseNo?: string;
  licenseExpiry?: string;
  approvedServices?: string[];
  latitude?: number;
  longitude?: number;
  registeredBy?: string;
}): Promise<MohPrivateFacilityRecord> {
  const cleanLga = input.lga.trim();
  const lgaMeta = AKWA_IBOM_LGAS.find((l) => l.lga.toLowerCase() === cleanLga.toLowerCase());
  const district = input.district || lgaMeta?.district || inferSenatorialDistrict(cleanLga, input.facilityName);
  const slug = crypto.randomBytes(2).toString('hex').toUpperCase();
  const rec: MohPrivateFacilityRecord = {
    facilityId: (input.facilityId || `PRV-${slug}`).trim().toUpperCase(),
    facilityName: sanitizeMohAuditDetail(input.facilityName),
    lga: cleanLga,
    district,
    ownership: input.ownership || 'private',
    facilityType: (input.facilityType || 'Private Clinic').trim(),
    tier: 'cottage_hospital',
    licenseNo: (input.licenseNo || `AKS-HFR-PRV-${slug}`).trim(),
    licenseExpiry: (input.licenseExpiry || '').trim(),
    operationalStatus: 'fully_functional',
    accreditationStatus: 'provisional',
    approvedServices: input.approvedServices?.length ? input.approvedServices : ['General OPD', 'Maternal Care'],
    latitude: typeof input.latitude === 'number' && Number.isFinite(input.latitude) ? input.latitude : lgaMeta?.latitude ?? 5.0377,
    longitude: typeof input.longitude === 'number' && Number.isFinite(input.longitude) ? input.longitude : lgaMeta?.longitude ?? 7.9128,
    registeredBy: (input.registeredBy || 'MOH Facility Registry').trim(),
    createdAt: new Date().toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_private_facilities (
         facility_id, facility_name, lga, district, ownership, facility_type, tier,
         license_no, license_expiry, operational_status, accreditation_status,
         approved_services, latitude, longitude, registered_by, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,NOW(),NOW())
       ON CONFLICT (facility_id) DO UPDATE SET
         facility_name = EXCLUDED.facility_name,
         lga = EXCLUDED.lga,
         district = EXCLUDED.district,
         ownership = EXCLUDED.ownership,
         facility_type = EXCLUDED.facility_type,
         license_no = EXCLUDED.license_no,
         license_expiry = EXCLUDED.license_expiry,
         approved_services = EXCLUDED.approved_services,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         updated_at = NOW()`,
      [
        rec.facilityId,
        rec.facilityName,
        rec.lga,
        rec.district,
        rec.ownership,
        rec.facilityType,
        rec.tier,
        rec.licenseNo,
        rec.licenseExpiry,
        rec.operationalStatus,
        rec.accreditationStatus,
        JSON.stringify(rec.approvedServices),
        rec.latitude,
        rec.longitude,
        rec.registeredBy,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.privateFacilities = [rec, ...store.privateFacilities.filter((f) => f.facilityId !== rec.facilityId)];
    writeLocalMohStore(store);
  }

  publishMohEvent('facility', { facilityId: rec.facilityId, action: 'register_private' });
  return rec;
}

export async function createEnforcementActionRecord(input: {
  facilityId: string;
  facilityName?: string;
  lga?: string;
  district?: SenatorialDistrict;
  actionType: MohEnforcementAction['actionType'];
  reason: string;
  checklist?: { label: string; passed: boolean }[];
  evidencePhotoData?: string;
  officerName: string;
  followUpDate?: string;
}): Promise<MohEnforcementAction> {
  const meta = resolveFacilityMeta(input.facilityId, input.facilityName, input.lga, input.district);
  const status: MohEnforcementAction['status'] =
    input.actionType === 'unsealed'
      ? 'resolved'
      : input.actionType === 'sealed' || input.actionType === 'quackery_raid'
      ? 'active_seal'
      : 'follow_up';

  const rec: MohEnforcementAction = {
    id: `ENF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    facilityId: meta.facilityId,
    facilityName: meta.facilityName,
    lga: meta.lga,
    district: meta.district,
    actionType: input.actionType,
    reason: sanitizeMohAuditDetail(input.reason),
    checklist: Array.isArray(input.checklist) ? input.checklist : [],
    evidencePhotoData: input.evidencePhotoData ? String(input.evidencePhotoData).slice(0, 600_000) : undefined,
    officerName: (input.officerName || 'MOH Inspectorate').trim(),
    status,
    followUpDate: (input.followUpDate || '').trim(),
    resolutionNotes: '',
    createdAt: new Date().toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_enforcement_actions (
         id, facility_id, facility_name, lga, district, action_type, reason,
         checklist, evidence_photo_data, officer_name, status, follow_up_date, resolution_notes, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,'',NOW(),NOW())`,
      [
        rec.id,
        rec.facilityId,
        rec.facilityName,
        rec.lga,
        rec.district,
        rec.actionType,
        rec.reason,
        JSON.stringify(rec.checklist),
        rec.evidencePhotoData || '',
        rec.officerName,
        rec.status,
        rec.followUpDate,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.enforcementActions = [rec, ...store.enforcementActions];
    writeLocalMohStore(store);
  }

  if (input.actionType === 'sealed' || input.actionType === 'quackery_raid') {
    await updateMohFacilityOverrideRecord({
      facilityId: rec.facilityId,
      operationalStatus: 'sealed',
      accreditationStatus: 'suspended',
      unapprovedPracticeFlag: input.actionType === 'quackery_raid',
      notes: rec.reason,
      updatedBy: rec.officerName,
    });
    await notifyFacilitiesInOs([rec.facilityId], {
      level: 'alert',
      title: `MOH Enforcement Order: Facility Sealed (${rec.facilityId})`,
      body: rec.reason,
      category: 'moh_enforcement',
    });
  } else if (input.actionType === 'unsealed') {
    await updateMohFacilityOverrideRecord({
      facilityId: rec.facilityId,
      operationalStatus: 'fully_functional',
      accreditationStatus: 'provisional',
      unapprovedPracticeFlag: false,
      notes: rec.reason,
      updatedBy: rec.officerName,
    });
  }

  publishMohEvent('enforcement', { id: rec.id, facilityId: rec.facilityId, actionType: rec.actionType });
  return rec;
}

export async function updateEnforcementActionRecord(
  id: string,
  patch: {
    status?: MohEnforcementAction['status'];
    followUpDate?: string;
    resolutionNotes?: string;
    unsealFacility?: boolean;
    updatedBy?: string;
  }
): Promise<MohEnforcementAction | null> {
  const cleanNotes = patch.resolutionNotes !== undefined ? sanitizeMohAuditDetail(patch.resolutionNotes) : undefined;
  let updated: MohEnforcementAction | null = null;

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_enforcement_actions
       SET status = COALESCE($2, status),
           follow_up_date = COALESCE($3, follow_up_date),
           resolution_notes = COALESCE($4, resolution_notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, patch.status ?? null, patch.followUpDate ?? null, cleanNotes ?? null]
    );
    const e = res.rows[0];
    if (!e) return null;
    updated = {
      id: String(e.id),
      facilityId: String(e.facility_id).toUpperCase(),
      facilityName: String(e.facility_name),
      lga: String(e.lga || ''),
      district: (e.district || 'Uyo') as SenatorialDistrict,
      actionType: e.action_type,
      reason: String(e.reason || ''),
      checklist: Array.isArray(e.checklist) ? e.checklist : [],
      evidencePhotoData: e.evidence_photo_data ? String(e.evidence_photo_data) : undefined,
      officerName: String(e.officer_name || ''),
      status: e.status,
      followUpDate: String(e.follow_up_date || ''),
      resolutionNotes: String(e.resolution_notes || ''),
      createdAt: new Date(e.created_at).toISOString(),
    };
  } else {
    const store = readLocalMohStore();
    store.enforcementActions = store.enforcementActions.map((e) => {
      if (e.id !== id) return e;
      updated = {
        ...e,
        status: patch.status || e.status,
        followUpDate: patch.followUpDate !== undefined ? patch.followUpDate : e.followUpDate,
        resolutionNotes: cleanNotes !== undefined ? cleanNotes : e.resolutionNotes,
      };
      return updated;
    });
    writeLocalMohStore(store);
  }

  if (updated && patch.unsealFacility) {
    await updateMohFacilityOverrideRecord({
      facilityId: updated.facilityId,
      operationalStatus: 'fully_functional',
      accreditationStatus: 'provisional',
      unapprovedPracticeFlag: false,
      notes: cleanNotes || 'Seal lifted after verified remediation.',
      updatedBy: patch.updatedBy || 'MOH Enforcement Desk',
    });
  }

  if (updated) publishMohEvent('enforcement', { id, status: updated.status });
  return updated;
}

// ── Pillar 3: HRH Recruitment & Deployment Pipeline ──────────────────────
export async function createHrhRecruitmentRecord(input: {
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
}): Promise<MohHrhRecruitment> {
  const meta = resolveFacilityMeta(input.facilityId, input.facilityName, input.lga);
  const rec: MohHrhRecruitment = {
    id: `REC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    title: sanitizeMohAuditDetail(input.title),
    cadre: input.cadre.trim(),
    facilityId: meta.facilityId,
    facilityName: meta.facilityName,
    lga: meta.lga,
    vacanciesCount: Math.max(1, Number(input.vacanciesCount || 1)),
    applicantsCount: Math.max(0, Number(input.applicantsCount || 0)),
    shortlistedCount: Math.max(0, Number(input.shortlistedCount || 0)),
    deployedCount: Math.max(0, Number(input.deployedCount || 0)),
    stage: input.stage || 'open',
    postedBy: (input.postedBy || 'MOH HRH Desk').trim(),
    createdAt: new Date().toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_hrh_recruitment (
         id, title, cadre, facility_id, facility_name, lga, vacancies_count,
         applicants_count, shortlisted_count, deployed_count, stage, posted_by, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
      [
        rec.id,
        rec.title,
        rec.cadre,
        rec.facilityId,
        rec.facilityName,
        rec.lga,
        rec.vacanciesCount,
        rec.applicantsCount,
        rec.shortlistedCount,
        rec.deployedCount,
        rec.stage,
        rec.postedBy,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.hrhRecruitment = [rec, ...store.hrhRecruitment];
    writeLocalMohStore(store);
  }

  publishMohEvent('hrh', { id: rec.id, stage: rec.stage });
  return rec;
}

export async function updateHrhRecruitmentRecord(
  id: string,
  patch: Partial<Pick<MohHrhRecruitment, 'stage' | 'applicantsCount' | 'shortlistedCount' | 'deployedCount'>>
): Promise<MohHrhRecruitment | null> {
  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_hrh_recruitment
       SET stage = COALESCE($2, stage),
           applicants_count = COALESCE($3, applicants_count),
           shortlisted_count = COALESCE($4, shortlisted_count),
           deployed_count = COALESCE($5, deployed_count),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.stage ?? null,
        patch.applicantsCount ?? null,
        patch.shortlistedCount ?? null,
        patch.deployedCount ?? null,
      ]
    );
    const r = res.rows[0];
    if (!r) return null;
    publishMohEvent('hrh', { id, stage: r.stage });
    return {
      id: String(r.id),
      title: String(r.title),
      cadre: String(r.cadre),
      facilityId: String(r.facility_id).toUpperCase(),
      facilityName: String(r.facility_name),
      lga: String(r.lga || ''),
      vacanciesCount: Number(r.vacancies_count || 1),
      applicantsCount: Number(r.applicants_count || 0),
      shortlistedCount: Number(r.shortlisted_count || 0),
      deployedCount: Number(r.deployed_count || 0),
      stage: r.stage,
      postedBy: String(r.posted_by || ''),
      createdAt: new Date(r.created_at).toISOString(),
    };
  }
  const store = readLocalMohStore();
  let updated: MohHrhRecruitment | null = null;
  store.hrhRecruitment = store.hrhRecruitment.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, ...patch };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('hrh', { id, stage: (updated as MohHrhRecruitment).stage });
  return updated;
}

// ── Pillar 4: Supply Chain, Equipment Audit & Facility Infrastructure ────
export async function upsertSupplyEquipmentRecord(input: {
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
}): Promise<MohSupplyEquipmentItem> {
  const meta = resolveFacilityMeta(input.facilityId, input.facilityName, input.lga);
  const qty = Number(input.quantity ?? 0);
  const reorder = Number(input.reorderLevel ?? 0);
  let status: MohSupplyEquipmentItem['functionalStatus'] =
    input.functionalStatus ||
    (input.domain === 'medicine_vaccine'
      ? qty <= 0
        ? 'stock_out'
        : qty <= reorder
        ? 'low_stock'
        : 'in_stock'
      : input.domain === 'equipment'
      ? 'operational'
      : 'adequate');

  const rec: MohSupplyEquipmentItem = {
    id: input.id || `SUP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    domain: input.domain,
    facilityId: meta.facilityId,
    facilityName: meta.facilityName,
    lga: meta.lga,
    itemName: sanitizeMohAuditDetail(input.itemName),
    category: (input.category || input.domain).trim(),
    quantity: qty,
    reorderLevel: reorder,
    unit: (input.unit || (input.domain === 'medicine_vaccine' ? 'doses/packs' : 'units')).trim(),
    coldChainTempC:
      typeof input.coldChainTempC === 'number' && Number.isFinite(input.coldChainTempC) ? input.coldChainTempC : null,
    functionalStatus: status,
    notes: sanitizeMohAuditDetail(input.notes || ''),
    updatedBy: (input.updatedBy || 'MOH Logistics').trim(),
    updatedAt: new Date().toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_supply_equipment (
         id, domain, facility_id, facility_name, lga, item_name, category,
         quantity, reorder_level, unit, cold_chain_temp_c, functional_status,
         notes, updated_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (id) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         reorder_level = EXCLUDED.reorder_level,
         cold_chain_temp_c = EXCLUDED.cold_chain_temp_c,
         functional_status = EXCLUDED.functional_status,
         notes = EXCLUDED.notes,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        rec.id,
        rec.domain,
        rec.facilityId,
        rec.facilityName,
        rec.lga,
        rec.itemName,
        rec.category,
        rec.quantity,
        rec.reorderLevel,
        rec.unit,
        rec.coldChainTempC,
        rec.functionalStatus,
        rec.notes,
        rec.updatedBy,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.supplyEquipment = [rec, ...store.supplyEquipment.filter((i) => i.id !== rec.id)];
    writeLocalMohStore(store);
  }

  publishMohEvent('supply', { id: rec.id, domain: rec.domain, status: rec.functionalStatus });
  return rec;
}

export async function updateSupplyEquipmentRecord(
  id: string,
  patch: Partial<Pick<MohSupplyEquipmentItem, 'quantity' | 'coldChainTempC' | 'functionalStatus' | 'notes' | 'updatedBy'>>
): Promise<MohSupplyEquipmentItem | null> {
  const cleanNotes = patch.notes !== undefined ? sanitizeMohAuditDetail(patch.notes) : undefined;
  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_supply_equipment
       SET quantity = COALESCE($2, quantity),
           cold_chain_temp_c = COALESCE($3, cold_chain_temp_c),
           functional_status = COALESCE($4, functional_status),
           notes = COALESCE($5, notes),
           updated_by = COALESCE($6, updated_by),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.quantity ?? null,
        patch.coldChainTempC === undefined ? null : patch.coldChainTempC,
        patch.functionalStatus ?? null,
        cleanNotes ?? null,
        patch.updatedBy ?? null,
      ]
    );
    const s = res.rows[0];
    if (!s) return null;
    publishMohEvent('supply', { id, status: s.functional_status });
    return {
      id: String(s.id),
      domain: s.domain,
      facilityId: String(s.facility_id).toUpperCase(),
      facilityName: String(s.facility_name),
      lga: String(s.lga || ''),
      itemName: String(s.item_name),
      category: String(s.category || ''),
      quantity: Number(s.quantity || 0),
      reorderLevel: Number(s.reorder_level || 0),
      unit: String(s.unit || 'units'),
      coldChainTempC: s.cold_chain_temp_c !== null && s.cold_chain_temp_c !== undefined ? Number(s.cold_chain_temp_c) : null,
      functionalStatus: s.functional_status,
      notes: String(s.notes || ''),
      updatedBy: String(s.updated_by || ''),
      updatedAt: new Date(s.updated_at).toISOString(),
    };
  }
  const store = readLocalMohStore();
  let updated: MohSupplyEquipmentItem | null = null;
  store.supplyEquipment = store.supplyEquipment.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
      notes: cleanNotes !== undefined ? cleanNotes : item.notes,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('supply', { id, status: (updated as MohSupplyEquipmentItem).functionalStatus });
  return updated;
}

// ── Pillar 5: DSNO IDSR Reports & RMNCH Service Delivery Metrics ─────────
export async function createIdsrReportRecord(input: {
  reportKind: MohIdsrReport['reportKind'];
  facilityId?: string;
  facilityName?: string;
  lga: string;
  district?: SenatorialDistrict;
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
}): Promise<MohIdsrReport> {
  const fid = (input.facilityId || '').trim().toUpperCase();
  const meta = fid
    ? resolveFacilityMeta(fid, input.facilityName, input.lga, input.district)
    : {
        facilityId: '',
        facilityName: input.facilityName || `${input.lga} LGA Surveillance`,
        lga: input.lga.trim(),
        district:
          input.district ||
          AKWA_IBOM_LGAS.find((l) => l.lga.toLowerCase() === input.lga.trim().toLowerCase())?.district ||
          inferSenatorialDistrict(input.lga, ''),
      };

  const now = new Date();
  const rec: MohIdsrReport = {
    id: `IDSR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    reportKind: input.reportKind,
    facilityId: meta.facilityId,
    facilityName: meta.facilityName,
    lga: meta.lga,
    district: meta.district,
    periodLabel: (input.periodLabel || now.toISOString().slice(0, 7)).trim(),
    disease: (input.disease || '').trim(),
    suspectedCases: Number(input.suspectedCases || 0),
    confirmedCases: Number(input.confirmedCases || 0),
    deaths: Number(input.deaths || 0),
    ancVisits: Number(input.ancVisits || 0),
    skilledDeliveries: Number(input.skilledDeliveries || 0),
    immunizationDoses: Number(input.immunizationDoses || 0),
    emergencyReferrals: Number(input.emergencyReferrals || 0),
    maternalDeaths: Number(input.maternalDeaths || 0),
    under5Deaths: Number(input.under5Deaths || 0),
    dsnoOfficer: (input.dsnoOfficer || 'LGA DSNO Desk').trim(),
    status: input.reportKind === 'service_utilization' ? 'verified' : 'submitted',
    notes: sanitizeMohAuditDetail(input.notes || ''),
    createdAt: now.toISOString(),
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_idsr_reports (
         id, report_kind, facility_id, facility_name, lga, district, period_label,
         disease, suspected_cases, confirmed_cases, deaths, anc_visits, skilled_deliveries,
         immunization_doses, emergency_referrals, maternal_deaths, under5_deaths,
         dsno_officer, status, notes, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())`,
      [
        rec.id,
        rec.reportKind,
        rec.facilityId,
        rec.facilityName,
        rec.lga,
        rec.district,
        rec.periodLabel,
        rec.disease,
        rec.suspectedCases,
        rec.confirmedCases,
        rec.deaths,
        rec.ancVisits,
        rec.skilledDeliveries,
        rec.immunizationDoses,
        rec.emergencyReferrals,
        rec.maternalDeaths,
        rec.under5Deaths,
        rec.dsnoOfficer,
        rec.status,
        rec.notes,
      ]
    );

    if (rec.reportKind === 'dsno_outbreak' && rec.facilityId) {
      await notifyFacilitiesInOs([rec.facilityId], {
        level: 'warning',
        title: `DSNO IDSR Alert (${rec.disease}) — ${rec.lga} LGA`,
        body: `${rec.suspectedCases} suspected, ${rec.confirmedCases} confirmed. Activate isolation & line listing.`,
        category: 'moh_idsr',
      });
    }
  } else {
    const store = readLocalMohStore();
    store.idsrReports = [rec, ...store.idsrReports];
    writeLocalMohStore(store);
  }

  publishMohEvent('idsr', { id: rec.id, reportKind: rec.reportKind, disease: rec.disease });
  return rec;
}

export async function updateIdsrReportRecord(
  id: string,
  patch: Partial<Pick<MohIdsrReport, 'status' | 'confirmedCases' | 'deaths' | 'notes'>>
): Promise<MohIdsrReport | null> {
  const cleanNotes = patch.notes !== undefined ? sanitizeMohAuditDetail(patch.notes) : undefined;
  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const res = await query<any>(
      `UPDATE moh_idsr_reports
       SET status = COALESCE($2, status),
           confirmed_cases = COALESCE($3, confirmed_cases),
           deaths = COALESCE($4, deaths),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, patch.status ?? null, patch.confirmedCases ?? null, patch.deaths ?? null, cleanNotes ?? null]
    );
    const r = res.rows[0];
    if (!r) return null;
    publishMohEvent('idsr', { id, status: r.status });
    return {
      id: String(r.id),
      reportKind: r.report_kind,
      facilityId: String(r.facility_id || '').toUpperCase(),
      facilityName: String(r.facility_name || ''),
      lga: String(r.lga),
      district: r.district,
      periodLabel: String(r.period_label || ''),
      disease: String(r.disease || ''),
      suspectedCases: Number(r.suspected_cases || 0),
      confirmedCases: Number(r.confirmed_cases || 0),
      deaths: Number(r.deaths || 0),
      ancVisits: Number(r.anc_visits || 0),
      skilledDeliveries: Number(r.skilled_deliveries || 0),
      immunizationDoses: Number(r.immunization_doses || 0),
      emergencyReferrals: Number(r.emergency_referrals || 0),
      maternalDeaths: Number(r.maternal_deaths || 0),
      under5Deaths: Number(r.under5_deaths || 0),
      dsnoOfficer: String(r.dsno_officer || ''),
      status: r.status,
      notes: String(r.notes || ''),
      createdAt: new Date(r.created_at).toISOString(),
    };
  }
  const store = readLocalMohStore();
  let updated: MohIdsrReport | null = null;
  store.idsrReports = store.idsrReports.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, ...patch, notes: cleanNotes !== undefined ? cleanNotes : r.notes };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('idsr', { id, status: (updated as MohIdsrReport).status });
  return updated;
}

// ── Pillar 6: Public Citizen Feedback & Grievance Redressal ──────────────
export async function createCitizenGrievanceRecord(input: {
  facilityId: string;
  facilityName?: string;
  lga?: string;
  channel?: MohCitizenGrievance['channel'];
  category?: MohCitizenGrievance['category'];
  rating?: number;
  summary: string;
  anonymous?: boolean;
}): Promise<MohCitizenGrievance> {
  const meta = resolveFacilityMeta(input.facilityId, input.facilityName, input.lga);
  const trackingCode = `AKS-FB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const rec: MohCitizenGrievance = {
    id: `GRV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    trackingCode,
    facilityId: meta.facilityId,
    facilityName: meta.facilityName,
    lga: meta.lga,
    channel: input.channel || 'qr',
    category: input.category || 'service_quality',
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating ?? 3)))),
    summary: sanitizeMohAuditDetail(input.summary),
    anonymous: input.anonymous !== false,
    status: 'open',
    assignedTo: '',
    resolutionNotes: '',
    turnaroundHours: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    await query(
      `INSERT INTO moh_citizen_grievances (
         id, tracking_code, facility_id, facility_name, lga, channel, category,
         rating, summary, anonymous, status, assigned_to, resolution_notes,
         turnaround_hours, created_at, resolved_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open','','',NULL,NOW(),NULL,NOW())`,
      [
        rec.id,
        rec.trackingCode,
        rec.facilityId,
        rec.facilityName,
        rec.lga,
        rec.channel,
        rec.category,
        rec.rating,
        rec.summary,
        rec.anonymous,
      ]
    );
  } else {
    const store = readLocalMohStore();
    store.citizenGrievances = [rec, ...store.citizenGrievances];
    writeLocalMohStore(store);
  }

  publishMohEvent('grievance', { id: rec.id, trackingCode: rec.trackingCode, facilityId: rec.facilityId });
  return rec;
}

export async function updateCitizenGrievanceRecord(
  id: string,
  patch: {
    status?: MohCitizenGrievance['status'];
    assignedTo?: string;
    resolutionNotes?: string;
  }
): Promise<MohCitizenGrievance | null> {
  const cleanNotes = patch.resolutionNotes !== undefined ? sanitizeMohAuditDetail(patch.resolutionNotes) : undefined;
  const now = new Date();

  if (isPostgresConfigured()) {
    await ensureMohSchema();
    const prevRows = await safeQueryRows<any>(`SELECT created_at FROM moh_citizen_grievances WHERE id = $1 LIMIT 1`, [id]);
    if (prevRows.length === 0) return null;
    const createdMs = Date.parse(prevRows[0].created_at) || now.getTime();
    const isResolved = patch.status === 'resolved';
    const turnaroundHours = isResolved
      ? Math.max(0.1, Math.round(((now.getTime() - createdMs) / 3_600_000) * 10) / 10)
      : null;

    const res = await query<any>(
      `UPDATE moh_citizen_grievances
       SET status = COALESCE($2, status),
           assigned_to = COALESCE($3, assigned_to),
           resolution_notes = COALESCE($4, resolution_notes),
           turnaround_hours = COALESCE($5, turnaround_hours),
           resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, patch.status ?? null, patch.assignedTo ?? null, cleanNotes ?? null, turnaroundHours]
    );
    const g = res.rows[0];
    if (!g) return null;
    publishMohEvent('grievance', { id, status: g.status });
    return {
      id: String(g.id),
      trackingCode: String(g.tracking_code),
      facilityId: String(g.facility_id).toUpperCase(),
      facilityName: String(g.facility_name),
      lga: String(g.lga || ''),
      channel: g.channel,
      category: g.category,
      rating: Number(g.rating || 3),
      summary: String(g.summary || ''),
      anonymous: Boolean(g.anonymous),
      status: g.status,
      assignedTo: String(g.assigned_to || ''),
      resolutionNotes: String(g.resolution_notes || ''),
      turnaroundHours: g.turnaround_hours !== null && g.turnaround_hours !== undefined ? Number(g.turnaround_hours) : null,
      createdAt: new Date(g.created_at).toISOString(),
      resolvedAt: g.resolved_at ? new Date(g.resolved_at).toISOString() : null,
    };
  }

  const store = readLocalMohStore();
  let updated: MohCitizenGrievance | null = null;
  store.citizenGrievances = store.citizenGrievances.map((g) => {
    if (g.id !== id) return g;
    const isResolved = patch.status === 'resolved';
    const createdMs = Date.parse(g.createdAt) || now.getTime();
    const hrs = isResolved
      ? Math.max(0.1, Math.round(((now.getTime() - createdMs) / 3_600_000) * 10) / 10)
      : g.turnaroundHours;
    updated = {
      ...g,
      status: patch.status || g.status,
      assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : g.assignedTo,
      resolutionNotes: cleanNotes !== undefined ? cleanNotes : g.resolutionNotes,
      turnaroundHours: hrs,
      resolvedAt: isResolved ? now.toISOString() : g.resolvedAt,
    };
    return updated;
  });
  writeLocalMohStore(store);
  if (updated) publishMohEvent('grievance', { id, status: (updated as MohCitizenGrievance).status });
  return updated;
}
