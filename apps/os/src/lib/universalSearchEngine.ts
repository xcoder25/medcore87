/**
 * Universal Role-Intelligent Federated Search Engine for MedCore OS.
 * Provides instant, fuzzy, phonetic, token-weighted, and role-prioritized search across:
 *  - Registered Patients (Name, MRN/Hospital Number, Phone, NIN, Blood Group, Allergies, Conditions)
 *  - Live Triage & Outpatient Queue (Encounter status, queue number, vitals, chief complaint)
 *  - Clinical Orders — Lab, Pharmacy Rx & Radiology (Order ID, drug/test name, priority, results)
 *  - Nigeria Essential Medicines List (AKS-EML) Formulary (Drug name, strengths, routes, AWaRe tier)
 *  - Inpatient Beds & Wards (Bed number, ward, occupant, diagnosis)
 *  - Open Hospital Bills & Cashier Queue (Unpaid balances, bill lines, invoice IDs)
 *  - Hospital Staff Directory (Badge ID, Name, Role, Department)
 *  - Natural-Language Intent Shortcuts ("unpaid", "critical", "waiting", "available beds", etc.)
 */

import { listPatients, type FacilityPatient } from './patientRegistryStore';
import { todayVisits, type ReceptionVisit } from './receptionOpsStore';
import { listOrders, type ClinicalOrder } from './clinicalEventBus';
import { listPatientsWithOpenBills, patientBalance } from './patientBillingStore';
import { listBeds, type BedRecord } from './bedBoardStore';
import { listStaffCards } from './staffCardStore';
import { AKS_EML_ITEMS } from '../data/emlFormulary';

export type SearchEntityCategory =
  | 'all'
  | 'patients'
  | 'queue'
  | 'orders'
  | 'formulary'
  | 'beds'
  | 'billing'
  | 'staff'
  | 'modules'
  | 'actions';

export interface UniversalSearchHit {
  id: string;
  category: Exclude<SearchEntityCategory, 'all'>;
  label: string;
  sublabel: string;
  group: string;
  badge?: string;
  badgeTone?: 'blue' | 'teal' | 'amber' | 'red' | 'purple' | 'green' | 'slate';
  keywords: string;
  score: number;
  iconName:
    | 'user'
    | 'activity'
    | 'pill'
    | 'flask'
    | 'bed'
    | 'wallet'
    | 'shield'
    | 'sparkles'
    | 'stethoscope'
    | 'layers'
    | 'alert'
    | 'lock';
  targetModule?: string;
  patientId?: string;
  hospitalNumber?: string;
  customAction?: () => void;
}

/** Compute bounded Levenshtein edit distance for typo-tolerant clinical search */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

/** Score a candidate item against the user's search query with fuzzy & token weighting */
export function scoreSearchCandidate(
  query: string,
  label: string,
  sublabel: string,
  keywords: string,
  badge?: string
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 10;

  const l = label.toLowerCase();
  const s = sublabel.toLowerCase();
  const k = keywords.toLowerCase();
  const b = (badge || '').toLowerCase();
  const combined = `${l} ${s} ${k} ${b}`;

  let score = 0;

  // 1) Exact / prefix match on label or ID
  if (l === q || b === q) score += 220;
  else if (l.startsWith(q)) score += 150;
  else if (l.includes(q)) score += 100;
  else if (combined.includes(q)) score += 65;

  // 2) Multi-token scoring + typo tolerance
  const tokens = q.split(/\s+/).filter(Boolean);
  const words = combined.split(/[\s·,()/-]+/).filter(Boolean);

  let matchedTokens = 0;
  for (const tok of tokens) {
    if (l.startsWith(tok)) {
      score += 55;
      matchedTokens++;
    } else if (l.includes(tok)) {
      score += 40;
      matchedTokens++;
    } else if (combined.includes(tok)) {
      score += 28;
      matchedTokens++;
    } else if (tok.length >= 4) {
      // Check typo-tolerant edit distance <= 1 against words
      const fuzzyHit = words.some(
        (w) => w.length >= 4 && Math.abs(w.length - tok.length) <= 1 && editDistance(tok, w) <= 1
      );
      if (fuzzyHit) {
        score += 20;
        matchedTokens++;
      }
    }
  }

  // Require all tokens to match either directly or fuzzily when multiple tokens are typed
  if (tokens.length > 1 && matchedTokens < tokens.length) {
    return 0;
  }

  return score;
}

/** Compute role-specific priority boost so each staff cadre sees their highest-value entities first */
export function getRolePriorityBoost(
  roleKey: string,
  category: Exclude<SearchEntityCategory, 'all'>,
  extra?: { orderType?: string; isCritical?: boolean; hasUnpaid?: boolean }
): number {
  const rk = (roleKey || 'doctor').toLowerCase();
  let boost = 0;

  if (extra?.isCritical) boost += 30;

  if (rk === 'doctor' || rk === 'surgeon' || rk === 'medical_director') {
    if (category === 'queue') boost += 45;
    if (category === 'patients') boost += 40;
    if (category === 'orders') boost += 35;
    if (category === 'formulary') boost += 30;
    if (category === 'beds') boost += 25;
  } else if (rk === 'nurse' || rk === 'midwife') {
    if (category === 'queue') boost += 55;
    if (category === 'beds') boost += 45;
    if (category === 'patients') boost += 40;
    if (category === 'orders') boost += 25;
  } else if (rk === 'pharmacist') {
    if (category === 'orders' && extra?.orderType === 'rx') boost += 65;
    if (category === 'formulary') boost += 55;
    if (category === 'patients') boost += 30;
  } else if (rk === 'lab') {
    if (category === 'orders' && extra?.orderType === 'lab') boost += 65;
    if (category === 'patients') boost += 35;
  } else if (rk === 'radiologist') {
    if (category === 'orders' && extra?.orderType === 'imaging') boost += 65;
    if (category === 'patients') boost += 35;
  } else if (rk === 'reception' || rk === 'records') {
    if (category === 'patients') boost += 55;
    if (category === 'queue') boost += 50;
    if (category === 'billing') boost += 30;
  } else if (rk === 'cashier' || rk === 'accountant') {
    if (category === 'billing') boost += 70;
    if (category === 'patients' && extra?.hasUnpaid) boost += 50;
    if (category === 'patients') boost += 35;
  } else if (rk === 'hospital_admin' || rk === 'sysadmin') {
    if (category === 'staff') boost += 40;
    if (category === 'modules') boost += 35;
  }

  return boost;
}

/**
 * Builds the complete federated search index for the active facility and role.
 */
export function buildFederatedSearchIndex(opts: {
  facilityId: string;
  roleKey: string;
  isModulePermitted: (moduleKey: string) => boolean;
}): UniversalSearchHit[] {
  const { facilityId, roleKey, isModulePermitted } = opts;
  const hits: UniversalSearchHit[] = [];

  // 1) Registered Patients
  try {
    const patients: FacilityPatient[] = listPatients(facilityId);
    for (const p of patients.slice(0, 80)) {
      const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
      const bal = patientBalance(facilityId, p.id);
      const allergies = (p.allergies || []).join(', ');
      const conditions = (p.chronicConditions || p.problems || []).join(', ');
      const subParts = [
        p.hospitalNumber,
        p.sex ? `${p.sex}` : '',
        p.bloodGroup ? `Blood: ${p.bloodGroup}` : '',
        p.phone ? `Tel: ${p.phone}` : '',
        allergies ? `Allergies: ${allergies}` : '',
        bal > 0 ? `Unpaid: ₦${bal.toLocaleString()}` : '',
      ].filter(Boolean);

      const defaultMod =
        roleKey === 'cashier' || roleKey === 'accountant'
          ? 'cashier'
          : roleKey === 'reception'
            ? 'patient-card'
            : isModulePermitted('patient-360')
              ? 'patient-360'
              : 'dashboard';

      hits.push({
        id: `pt-${p.id}`,
        category: 'patients',
        label: `${fullName} · ${p.hospitalNumber}`,
        sublabel: subParts.join(' · '),
        group: 'Registered Patients',
        badge: bal > 0 ? `₦${bal.toLocaleString()} Due` : allergies ? 'Allergy Alert' : 'Chart',
        badgeTone: bal > 0 ? 'amber' : allergies ? 'red' : 'blue',
        keywords: `${fullName} ${p.hospitalNumber} ${p.id} ${p.phone || ''} ${p.nin || ''} ${p.bloodGroup || ''} ${allergies} ${conditions} patient chart mrn`,
        score: getRolePriorityBoost(roleKey, 'patients', { hasUnpaid: bal > 0 }),
        iconName: 'user',
        targetModule: defaultMod,
        patientId: p.id,
        hospitalNumber: p.hospitalNumber,
      });
    }
  } catch {
    /* ignore */
  }

  // 2) Live Triage & Outpatient Encounter Queue
  try {
    const visits: ReceptionVisit[] = todayVisits(facilityId);
    for (const v of visits.slice(0, 50)) {
      const isCrit = v.triageUrgency === 'critical' || v.priority === 'emergency';
      const encState = (v.encounterStatus || v.status || 'waiting').toString().toUpperCase();
      const targetMod =
        encState.includes('TRIAGE') && isModulePermitted('triage')
          ? 'triage'
          : isModulePermitted('doctor-portal')
            ? 'doctor-portal'
            : 'patient-flow';

      hits.push({
        id: `visit-${v.id}`,
        category: 'queue',
        label: `[${v.queueNumber}] ${v.patientName} · ${v.department}`,
        sublabel: `Status: ${encState.replace(/_/g, ' ')}${v.vitalsBp ? ` · BP ${v.vitalsBp}` : ''}${v.presentingComplaints ? ` · "${v.presentingComplaints.slice(0, 45)}"` : ''}`,
        group: 'Live Clinic & Triage Queue',
        badge: isCrit ? 'CRITICAL TRIAGE' : encState.replace(/_/g, ' '),
        badgeTone: isCrit ? 'red' : encState.includes('READY') || encState.includes('COMPLETED') ? 'green' : 'teal',
        keywords: `${v.queueNumber} ${v.patientName} ${v.hospitalNumber} ${v.department} ${v.doctor} ${encState} ${v.presentingComplaints || ''} triage queue waiting visit`,
        score: getRolePriorityBoost(roleKey, 'queue', { isCritical: isCrit }),
        iconName: 'activity',
        targetModule: targetMod,
        patientId: v.patientId,
        hospitalNumber: v.hospitalNumber,
      });
    }
  } catch {
    /* ignore */
  }

  // 3) Clinical Orders (Lab, Pharmacy Rx, Radiology)
  try {
    const orders: ClinicalOrder[] = listOrders(facilityId);
    for (const o of orders.slice(0, 60)) {
      const isStat = o.priority === 'stat';
      const targetMod =
        o.type === 'rx'
          ? 'pharmacy'
          : o.type === 'lab'
            ? 'laboratory'
            : o.type === 'imaging'
              ? 'radiology'
              : 'doctor-portal';
      if (!isModulePermitted(targetMod) && !isModulePermitted('doctor-portal')) continue;

      hits.push({
        id: `ord-${o.id}`,
        category: 'orders',
        label: `${o.type.toUpperCase()}: ${o.name} · ${o.patientName}`,
        sublabel: `${o.id} · ${o.hospitalNumber} · Status: ${o.status.toUpperCase()}${o.resultSummary ? ` · Result: ${o.resultSummary.slice(0, 40)}` : ''}`,
        group: 'Clinical Orders (Lab / Rx / Imaging)',
        badge: isStat ? 'STAT' : o.status.toUpperCase(),
        badgeTone: isStat ? 'red' : o.status === 'resulted' ? 'green' : 'purple',
        keywords: `${o.id} ${o.name} ${o.patientName} ${o.hospitalNumber} ${o.type} ${o.status} ${o.priority} ${o.orderedBy} ${o.notes || ''} ${o.resultSummary || ''} order rx lab test result`,
        score: getRolePriorityBoost(roleKey, 'orders', { orderType: o.type, isCritical: isStat }),
        iconName: o.type === 'rx' ? 'pill' : 'flask',
        targetModule: isModulePermitted(targetMod) ? targetMod : 'doctor-portal',
        patientId: o.patientId,
        hospitalNumber: o.hospitalNumber,
      });
    }
  } catch {
    /* ignore */
  }

  // 4) Nigeria Essential Medicines List (AKS-EML) Formulary
  if (isModulePermitted('pharmacy') || isModulePermitted('formulary') || isModulePermitted('doctor-portal')) {
    for (const med of AKS_EML_ITEMS) {
      const targetMod = isModulePermitted('formulary')
        ? 'formulary'
        : isModulePermitted('pharmacy')
          ? 'pharmacy'
          : 'doctor-portal';
      hits.push({
        id: `eml-${med.id}`,
        category: 'formulary',
        label: `${med.name} (${med.strengths.join(' / ')})`,
        sublabel: `${med.category} · ${med.forms.join(', ')} · Route: ${med.routes.join(', ')}${med.notes ? ` · ${med.notes}` : ''}`,
        group: 'Nigeria EML Formulary',
        badge: med.aware ? `AWaRe: ${med.aware}` : med.category,
        badgeTone: med.aware === 'Watch' || med.aware === 'Reserve' ? 'amber' : 'teal',
        keywords: `${med.name} ${med.category} ${med.forms.join(' ')} ${med.strengths.join(' ')} ${med.routes.join(' ')} ${med.notes || ''} drug medication rx formulary eml`,
        score: getRolePriorityBoost(roleKey, 'formulary'),
        iconName: 'pill',
        targetModule: targetMod,
      });
    }
  }

  // 5) Inpatient Beds & Wards
  if (isModulePermitted('beds') || isModulePermitted('nursing') || isModulePermitted('doctor-portal')) {
    try {
      const beds: BedRecord[] = listBeds(facilityId);
      for (const b of beds.slice(0, 40)) {
        hits.push({
          id: `bed-${b.id}`,
          category: 'beds',
          label: `${b.ward} · Bed ${b.bedNo} (${b.status.toUpperCase()})`,
          sublabel: b.patient
            ? `Occupant: ${b.patient} (${b.hospitalNumber || ''})${b.diagnosis ? ` · Dx: ${b.diagnosis}` : ''}`
            : `Available for immediate inpatient admission`,
          group: 'Inpatient Bed Census',
          badge: b.status.toUpperCase(),
          badgeTone: b.status === 'available' ? 'green' : b.status === 'occupied' ? 'blue' : 'amber',
          keywords: `${b.ward} ${b.bedNo} ${b.status} ${b.patient || ''} ${b.hospitalNumber || ''} ${b.diagnosis || ''} bed ward admission available occupied`,
          score: getRolePriorityBoost(roleKey, 'beds'),
          iconName: 'bed',
          targetModule: isModulePermitted('beds') ? 'beds' : 'nursing',
          patientId: b.patientId,
          hospitalNumber: b.hospitalNumber,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // 6) Open Hospital Bills & Cashier Settlement Queue
  if (isModulePermitted('cashier') || isModulePermitted('billing') || isModulePermitted('reception')) {
    try {
      const openBills = listPatientsWithOpenBills(facilityId);
      for (const ob of openBills.slice(0, 40)) {
        hits.push({
          id: `bill-${ob.patientId}`,
          category: 'billing',
          label: `${ob.patientName} (${ob.hospitalNumber}) · ₦${ob.balanceNgn.toLocaleString()} Unpaid`,
          sublabel: `${ob.lines.length} open bill item(s): ${ob.lines
            .slice(0, 3)
            .map((l) => l.description)
            .join(', ')}`,
          group: 'Open Bills & Cashier Queue',
          badge: `₦${ob.balanceNgn.toLocaleString()} DUE`,
          badgeTone: 'amber',
          keywords: `${ob.patientName} ${ob.hospitalNumber} ${ob.balanceNgn} unpaid bill invoice owing cashier pos payment akwaremit`,
          score: getRolePriorityBoost(roleKey, 'billing', { hasUnpaid: true }),
          iconName: 'wallet',
          targetModule: isModulePermitted('cashier') ? 'cashier' : 'billing',
          patientId: ob.patientId,
          hospitalNumber: ob.hospitalNumber,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // 7) Hospital Staff Roster
  if (isModulePermitted('staffing') || isModulePermitted('rbac') || roleKey === 'hospital_admin') {
    try {
      const staff = listStaffCards(facilityId);
      for (const s of staff.slice(0, 40)) {
        hits.push({
          id: `staff-${s.badgeId}`,
          category: 'staff',
          label: `${s.fullName} (${s.badgeId})`,
          sublabel: `${s.role} · ${s.department} · Clearance L${s.clearanceLevel}`,
          group: 'Hospital Staff Roster',
          badge: s.status,
          badgeTone: s.status === 'ACTIVE' ? 'green' : 'red',
          keywords: `${s.fullName} ${s.badgeId} ${s.role} ${s.department} staff roster badge`,
          score: getRolePriorityBoost(roleKey, 'staff'),
          iconName: 'shield',
          targetModule: isModulePermitted('staffing') ? 'staffing' : 'rbac',
        });
      }
    } catch {
      /* ignore */
    }
  }

  return hits;
}
