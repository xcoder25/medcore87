/**
 * Celestia AI Superintelligence & Real-Time Hospital Tool Executor
 * Gives Celestia live awareness of facility clinical/ops/finance/pharmacy/roster state
 * and safe, RBAC-gated execution across modules.
 */
import { listPatients } from './patientRegistryStore';
import { todayVisits } from './receptionOpsStore';
import { listBeds } from './bedBoardStore';
import { formularyStats, listFormulary, stockQty } from './formularyInventory';
import { listOrders } from './clinicalEventBus';
import { listPatientsWithOpenBills, listPharmacyBillLines } from './patientBillingStore';
import { getAkwaRemitDailySummary } from './akwaRemitStore';
import { listWardMedRequests } from './wardMedRequestStore';
import { listFacilityPresence, listActiveStaff } from './staffPresenceStore';
import { analyzeStaffRosterIntelligence } from './staffPresenceIntelligence';
import { pushNotification } from './notificationEngine';
import { normalizeRoleKey, canAutomateStaff } from './celestiaRoleGuard';
import { canAutomateBeds } from './bedAutomation';
import { canAutomateReception } from './frontDeskAutomation';
import { canAutomateAccounts } from './accountsAutomation';

export type CelestiaSuperToolName =
  | 'navigate_module'
  | 'verify_patient_lookup'
  | 'check_bed_availability'
  | 'check_formulary_stock'
  | 'analyze_roster_coverage'
  | 'check_revenue_remittance'
  | 'send_role_notification';

export interface CelestiaSuperToolResult {
  ok: boolean;
  tool: CelestiaSuperToolName;
  title: string;
  summary: string;
  navigateTo?: string;
}

export function buildLiveHospitalSnapshot(facilityId: string, roleKey?: string): string {
  const fid = facilityId || 'IGH-EKT';
  const rk = normalizeRoleKey({ roleKey });
  const lines: string[] = [`### Live Facility Telemetry (${fid} · Role: ${rk})`];

  try {
    const ptCount = listPatients(fid).length;
    const visits = todayVisits(fid);
    const waitingTriage = visits.filter((v) => v.status === 'waiting' && !v.triagedAt).length;
    const waitingDoc = visits.filter((v) => (v.status === 'waiting' || v.status === 'called') && v.triagedAt).length;
    const admittedToday = visits.filter((v) => v.status === 'admitted').length;
    lines.push(
      `MPI Patients: ${ptCount} | Today's OPD Visits: ${visits.length} (Awaiting Triage: ${waitingTriage}, Waiting Doctor: ${waitingDoc}, Admitted: ${admittedToday})`
    );
  } catch { /* ignore */ }

  try {
    const beds = listBeds(fid);
    const total = beds.length;
    const occupied = beds.filter((b) => b.status === 'occupied' || b.status === 'isolation').length;
    const available = beds.filter((b) => b.status === 'available').length;
    const cleaning = beds.filter((b) => b.status === 'cleaning').length;
    const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    lines.push(
      `Beds: ${available} free / ${total} total (${occupied} occupied, ${cleaning} cleaning, ${occupancyPct}% occupancy)`
    );
  } catch { /* ignore */ }

  try {
    const f = formularyStats(fid);
    const wardReqs = listWardMedRequests(fid).filter((w) => w.status === 'pending' || w.status === 'approved').length;
    const rxPending = listOrders(fid).filter((o) => o.type === 'rx' && o.status !== 'resulted').length;
    const heldDrugs = listPharmacyBillLines(fid).filter((l) => l.status === 'deferred').length;
    lines.push(
      `Pharmacy: ${f.items} formulary drugs (${f.lowStock} low stock, ${f.expiringBatches} exp <=90d), ${rxPending} pending Rx, ${heldDrugs} held/deferred drugs, ${wardReqs} open ward med requests`
    );
  } catch { /* ignore */ }

  try {
    const online = listActiveStaff(fid);
    lines.push(`Live Staff Online Now: ${online.length}`);
  } catch { /* ignore */ }

  if (rk === 'hospital_admin' || rk === 'accountant' || rk === 'cashier' || rk === 'pharmacist') {
    try {
      const rev = getAkwaRemitDailySummary(fid);
      const openBills = listPatientsWithOpenBills(fid);
      lines.push(
        `Treasury Today: ₦${rev.totalCollectionsNgn.toLocaleString()} collected | Pending Cash Till: ₦${rev.pendingCashNgn.toLocaleString()} | Remitted TSA: ₦${rev.alreadyInAkwaRemitNgn.toLocaleString()} | Open Patient Accounts: ${openBills.length}`
      );
    } catch { /* ignore */ }
  }

  return lines.join('\n');
}

export function executeCelestiaSuperTool(params: {
  tool: CelestiaSuperToolName;
  args?: Record<string, unknown>;
  facilityId: string;
  roleKey?: string;
  actorName?: string;
  onNavigate?: (moduleKey: string) => void;
}): CelestiaSuperToolResult {
  const { tool, args = {}, facilityId, roleKey, actorName = 'Staff', onNavigate } = params;
  const fid = facilityId || 'IGH-EKT';
  const rk = normalizeRoleKey({ roleKey });

  if (tool === 'navigate_module') {
    const mod = String(args.moduleKey || 'dashboard').trim();
    const label = String(args.label || mod);
    onNavigate?.(mod);
    return {
      ok: true,
      tool,
      title: `Opened ${label}`,
      summary: `Navigated workspace directly to ${label} (${mod}).`,
      navigateTo: mod,
    };
  }

  if (tool === 'verify_patient_lookup') {
    if (!canAutomateReception(rk) && rk !== 'doctor' && rk !== 'nurse' && rk !== 'pharmacist' && rk !== 'hospital_admin' && rk !== 'records') {
      return { ok: false, tool, title: 'Access Restricted', summary: 'Patient MPI lookup requires clinical, records, pharmacy, or reception access.' };
    }
    const q = String(args.query || '').trim().toLowerCase();
    const matches = listPatients(fid).filter(
      (p) =>
        `${p.firstName} ${p.middleName || ''} ${p.lastName}`.toLowerCase().includes(q) ||
        p.hospitalNumber.toLowerCase().includes(q) ||
        (p.shid || '').toLowerCase().includes(q) ||
        p.phone.includes(q)
    );
    if (!matches.length) {
      return {
        ok: true,
        tool,
        title: 'MPI Verification — No Match',
        summary: `No registered patient in ${fid} matched "${q || '(empty)'}".`,
      };
    }
    const preview = matches
      .slice(0, 5)
      .map((p) => `${p.firstName} ${p.lastName} · HN: ${p.hospitalNumber}${p.shid ? ` · SHID: ${p.shid}` : ''}`)
      .join(' | ');
    return {
      ok: true,
      tool,
      title: `Verified ${matches.length} Patient Match(es)`,
      summary: preview,
    };
  }

  if (tool === 'check_bed_availability') {
    if (!canAutomateBeds(rk) && rk !== 'doctor' && rk !== 'nurse' && rk !== 'midwife' && rk !== 'records') {
      return { ok: false, tool, title: 'Bed Census Restricted', summary: 'Your role does not have clinical bed visibility.' };
    }
    const beds = listBeds(fid);
    const byWard = new Map<string, { avail: number; occ: number; total: number }>();
    for (const b of beds) {
      const w = b.ward || 'General';
      const cur = byWard.get(w) || { avail: 0, occ: 0, total: 0 };
      cur.total += 1;
      if (b.status === 'available') cur.avail += 1;
      if (b.status === 'occupied' || b.status === 'isolation') cur.occ += 1;
      byWard.set(w, cur);
    }
    const wardStr = Array.from(byWard.entries())
      .map(([w, s]) => `${w}: ${s.avail} free / ${s.total}`)
      .join(' · ');
    return {
      ok: true,
      tool,
      title: 'Live Clinical Bed Census',
      summary: wardStr || 'No beds configured yet in this facility.',
    };
  }

  if (tool === 'check_formulary_stock') {
    const drugs = listFormulary(fid);
    const q = String(args.query || '').trim().toLowerCase();
    const hitList = q
      ? drugs.filter((d) => d.name.toLowerCase().includes(q) || d.genericName.toLowerCase().includes(q))
      : drugs.filter((d) => stockQty(fid, d.id) <= d.reorderLevel);
    if (!hitList.length) {
      return {
        ok: true,
        tool,
        title: q ? `Formulary Search: "${q}"` : 'Formulary Stock Status',
        summary: q ? `No medicine named "${q}" found in live formulary.` : `All ${drugs.length} formulary items are above reorder thresholds.`,
      };
    }
    const summary = hitList
      .slice(0, 6)
      .map((d) => `${d.name} (${stockQty(fid, d.id)} left · ₦${d.unitPriceNgn.toLocaleString()})`)
      .join(' | ');
    return {
      ok: true,
      tool,
      title: q ? `Formulary Matches (${hitList.length})` : `Low Stock Alerts (${hitList.length})`,
      summary,
    };
  }

  if (tool === 'analyze_roster_coverage') {
    if (!canAutomateStaff(rk) && rk !== 'hospital_admin') {
      return { ok: false, tool, title: 'Admin Coverage Intelligence', summary: 'Live roster audit is restricted to Hospital Administrators.' };
    }
    const pres = listFacilityPresence(fid);
    const active = listActiveStaff(fid);
    const activeIds = new Set(active.map((a) => a.badgeId));
    const analysis = analyzeStaffRosterIntelligence(
      pres.map((p) => ({
        id: p.badgeId,
        name: p.name,
        role: p.roleKey || p.role || 'staff',
        specialty: p.role || p.roleKey || 'General',
        ward: 'Facility',
        status: activeIds.has(p.badgeId) ? 'on-duty' : 'off-duty',
        lastSeenMs: p.lastSeen,
      })),
      pres
    );
    return {
      ok: true,
      tool,
      title: `Workforce Coverage: ${analysis.coveragePct}% (${analysis.statusSeverity.toUpperCase()})`,
      summary: `${analysis.onlineCount}/${analysis.totalRoster} online. ${analysis.recommendedActions[0] || ''}`,
    };
  }

  if (tool === 'check_revenue_remittance') {
    if (!canAutomateAccounts(rk) && rk !== 'hospital_admin' && rk !== 'pharmacist') {
      return { ok: false, tool, title: 'Treasury Access Restricted', summary: 'Revenue and AkwaRemit telemetry are restricted to Accounts, Pharmacy POS, and Admin.' };
    }
    const rev = getAkwaRemitDailySummary(fid);
    return {
      ok: true,
      tool,
      title: 'Live AkwaRemit & Cash Till Summary',
      summary: `Total Today: ₦${rev.totalCollectionsNgn.toLocaleString()} (${rev.receiptsCount} receipts) · Pending Cash at Till: ₦${rev.pendingCashNgn.toLocaleString()} (${rev.pendingCashCount} ARN) · TSA Remitted: ₦${rev.alreadyInAkwaRemitNgn.toLocaleString()} (${rev.complianceRatePercent}% compliance).`,
    };
  }

  if (tool === 'send_role_notification') {
    const targetRole = String(args.roleHint || 'all').trim();
    const title = String(args.title || 'Celestia AI Notice').trim();
    const body = String(args.body || '').trim();
    if (!body) {
      return { ok: false, tool, title: 'Notification Body Required', summary: 'Provide a clear notice message.' };
    }
    pushNotification({
      facilityId: fid,
      level: 'important',
      title: `${title} · by ${actorName}`,
      body,
      roleHint: targetRole,
      module: String(args.module || 'dashboard'),
      source: 'celestia-ai',
    });
    return {
      ok: true,
      tool,
      title: `Dispatched to ${targetRole}`,
      summary: `Alert "${title}" delivered in real time to ${targetRole}.`,
    };
  }

  return { ok: false, tool, title: 'Unsupported Tool', summary: 'Requested tool action is not available.' };
}
