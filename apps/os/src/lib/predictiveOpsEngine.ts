/**
 * Predictive Operations Engine (`apps/os`) — Zero-randomness telemetry forecasting:
 *  1) Pharmacy drug burn-rate & seasonal days-to-stockout forecast
 *  2) 72-hour Bed & ICU surge occupancy prediction
 *  3) NHIA / AKSHIA / HMO claim pre-submission readiness & denial scrubber
 */
import type { BedRecord } from './bedBoardStore';
import type { ClinicalOrder } from './clinicalEventBus';
import type { FormularyDrug, StockBatch } from './formularyInventory';

export interface StockoutForecastItem {
  drugId: string;
  name: string;
  category: string;
  currentStockUnits: number;
  reorderLevel: number;
  dailyBurnRate: number;
  seasonalMultiplier: number;
  adjustedDailyBurn: number;
  daysUntilStockout: number;
  urgency: 'critical' | 'warning' | 'healthy';
  recommendedReorderQty: number;
  supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot';
  status: 'Requisition Drafted' | 'Monitor Stock' | 'Healthy';
}

export interface BedSurgeForecast {
  totalBeds: number;
  occupiedNow: number;
  currentOccupancyPct: number;
  icuTotal: number;
  icuOccupiedNow: number;
  expectedDischarges72h: number;
  projectedAdmissions72h: number;
  projectedOccupied24h: number;
  projectedOccupied72h: number;
  projected24hPct: number;
  projected72hPct: number;
  surgeRisk: 'normal' | 'elevated' | 'critical';
  wardBottlenecks: Array<{ ward: string; occupied: number; total: number; occupancyPct: number }>;
  recommendedActions: string[];
}

export interface HmoClaimAuditInput {
  patientName?: string;
  insuranceProvider?: string;
  nhiaNumber?: string;
  icd11Code?: string;
  diagnosis?: string;
  authorizationCode?: string;
  totalAmountNgn: number;
  lineItems: Array<{ description: string; amountNgn: number; category?: string }>;
}

export interface HmoClaimAuditReport {
  readinessScore: number;
  status: 'ready' | 'needs_review' | 'high_denial_risk';
  denialRisks: Array<{
    code: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    fixAction: string;
  }>;
}

export function forecastFormularyStockouts(
  drugs: FormularyDrug[],
  batches: StockBatch[],
  orders: ClinicalOrder[],
  opts?: { rainySeasonMultiplier?: number; nowMs?: number }
): StockoutForecastItem[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const month = new Date(nowMs).getUTCMonth() + 1; // 1..12
  const defaultSeasonMult = month >= 4 && month <= 10 ? 1.35 : 1.1;
  const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;

  const qtyByDrug = new Map<string, number>();
  for (const b of batches) {
    if (b.qty <= 0) continue;
    qtyByDrug.set(b.drugId, (qtyByDrug.get(b.drugId) || 0) + Number(b.qty || 0));
  }

  const rxOrdersLast30d = orders.filter(
    (o) => o.type === 'rx' && Date.parse(o.createdAt || '') >= thirtyDaysAgo
  );

  const items: StockoutForecastItem[] = drugs.map((drug) => {
    const currentStockUnits = qtyByDrug.get(drug.id) || 0;
    const reorderLevel = Math.max(10, Number(drug.reorderLevel || 20));
    const lowerName = drug.name.toLowerCase();
    const lowerGeneric = (drug.genericName || '').toLowerCase();
    const catLower = (drug.category || '').toLowerCase();

    const matchedOrders = rxOrdersLast30d.filter((o) => {
      const n = o.name.toLowerCase();
      return n.includes(lowerName.split(' ')[0]) || (lowerGeneric && n.includes(lowerGeneric.split(' ')[0]));
    }).length;

    const isSeasonalDrug = /malaria|antibiotic|ors|oral rehydration|fluid|paed/i.test(
      `${drug.category} ${drug.name}`
    );
    const seasonalMultiplier = isSeasonalDrug
      ? opts?.rainySeasonMultiplier ?? defaultSeasonMult
      : 1.0;

    // Baseline daily burn rate grounded in actual 30d orders or minimum ward consumption floor for critical items
    const measuredDaily = matchedOrders / 30;
    const baselineFloor =
      currentStockUnits <= reorderLevel * 1.5
        ? Math.max(2, Math.round(reorderLevel / 10))
        : Math.max(0.5, Number((reorderLevel / 25).toFixed(1)));
    const dailyBurnRate = Number(Math.max(measuredDaily, baselineFloor).toFixed(1));
    const adjustedDailyBurn = Number((dailyBurnRate * seasonalMultiplier).toFixed(1));

    const daysUntilStockout =
      adjustedDailyBurn > 0 ? Math.max(0, Math.round(currentStockUnits / adjustedDailyBurn)) : 999;

    let urgency: StockoutForecastItem['urgency'] = 'healthy';
    if (currentStockUnits === 0 || daysUntilStockout <= 5 || currentStockUnits <= Math.round(reorderLevel * 0.5)) {
      urgency = 'critical';
    } else if (daysUntilStockout <= 14 || currentStockUnits <= reorderLevel) {
      urgency = 'warning';
    }

    const target30dUnits = Math.ceil(adjustedDailyBurn * 30 + reorderLevel);
    const recommendedReorderQty = Math.max(0, target30dUnits - currentStockUnits);

    return {
      drugId: drug.id,
      name: `${drug.name}${drug.strength ? ` (${drug.strength})` : ''}`,
      category: drug.category || 'Essential Medicine',
      currentStockUnits,
      reorderLevel,
      dailyBurnRate,
      seasonalMultiplier,
      adjustedDailyBurn,
      daysUntilStockout,
      urgency,
      recommendedReorderQty,
      supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot',
      status:
        urgency === 'critical'
          ? 'Requisition Drafted'
          : urgency === 'warning'
            ? 'Monitor Stock'
            : 'Healthy',
    };
  });

  return items.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout || a.currentStockUnits - b.currentStockUnits);
}

export function forecastBedSurge72h(
  beds: BedRecord[],
  activeVisits: Array<{ triageUrgency?: string; status?: string }> = [],
  nowMs = Date.now()
): BedSurgeForecast {
  const totalBeds = beds.length;
  const occupiedNow = beds.filter((b) => b.status === 'occupied' || b.status === 'isolation').length;
  const currentOccupancyPct = totalBeds > 0 ? Math.round((occupiedNow / totalBeds) * 100) : 0;

  const icuBeds = beds.filter((b) => /icu|hdu|intensive/i.test(b.ward || ''));
  const icuTotal = icuBeds.length;
  const icuOccupiedNow = icuBeds.filter((b) => b.status === 'occupied' || b.status === 'isolation').length;

  const horizon72hMs = nowMs + 72 * 60 * 60 * 1000;
  const horizon24hMs = nowMs + 24 * 60 * 60 * 1000;
  let expectedDischarges72h = 0;
  let expectedDischarges24h = 0;

  const wardStats = new Map<string, { occupied: number; total: number }>();
  for (const bed of beds) {
    const wName = bed.ward || 'General Ward';
    const cur = wardStats.get(wName) || { occupied: 0, total: 0 };
    cur.total += 1;
    if (bed.status === 'occupied' || bed.status === 'isolation') {
      cur.occupied += 1;
      if (bed.expectedDischarge) {
        const dMs = Date.parse(bed.expectedDischarge);
        if (Number.isFinite(dMs) && dMs <= horizon72hMs) expectedDischarges72h += 1;
        if (Number.isFinite(dMs) && dMs <= horizon24hMs) expectedDischarges24h += 1;
      }
    }
    wardStats.set(wName, cur);
  }

  const waitingOrActive = activeVisits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled');
  const criticalOpd = waitingOrActive.filter((v) => v.triageUrgency === 'critical').length;
  const urgentOpd = waitingOrActive.filter((v) => v.triageUrgency === 'urgent').length;
  const projectedAdmissions24h = Math.ceil(criticalOpd * 0.5 + urgentOpd * 0.2);
  const projectedAdmissions72h = Math.max(
    projectedAdmissions24h,
    Math.ceil(projectedAdmissions24h * 1.5 + waitingOrActive.length * 0.08)
  );

  const projectedOccupied24h =
    totalBeds > 0 ? Math.min(totalBeds, Math.max(0, occupiedNow + projectedAdmissions24h - expectedDischarges24h)) : 0;
  const projectedOccupied72h =
    totalBeds > 0 ? Math.min(totalBeds, Math.max(0, occupiedNow + projectedAdmissions72h - expectedDischarges72h)) : 0;

  const projected24hPct = totalBeds > 0 ? Math.round((projectedOccupied24h / totalBeds) * 100) : 0;
  const projected72hPct = totalBeds > 0 ? Math.round((projectedOccupied72h / totalBeds) * 100) : 0;

  const wardBottlenecks = Array.from(wardStats.entries())
    .map(([ward, st]) => ({
      ward,
      occupied: st.occupied,
      total: st.total,
      occupancyPct: st.total > 0 ? Math.round((st.occupied / st.total) * 100) : 0,
    }))
    .filter((w) => w.occupancyPct >= 80)
    .sort((a, b) => b.occupancyPct - a.occupancyPct);

  let surgeRisk: BedSurgeForecast['surgeRisk'] = 'normal';
  if (projected72hPct >= 90 || currentOccupancyPct >= 90 || (icuTotal > 0 && icuOccupiedNow >= icuTotal)) {
    surgeRisk = 'critical';
  } else if (projected72hPct >= 75 || currentOccupancyPct >= 75 || wardBottlenecks.length > 0) {
    surgeRisk = 'elevated';
  }

  const recommendedActions: string[] = [];
  if (surgeRisk === 'critical') {
    recommendedActions.push('Activate early morning discharge huddle to clear stable step-down patients.');
    recommendedActions.push('Alert State MOH bed mutual-aid desk if maternity/ICU exceeds 90%.');
  } else if (surgeRisk === 'elevated') {
    recommendedActions.push('Prioritize turnover cleaning on pending discharge beds before afternoon clinic peak.');
  } else {
    recommendedActions.push('Inpatient capacity healthy; maintain routine bed turnover schedule.');
  }

  return {
    totalBeds,
    occupiedNow,
    currentOccupancyPct,
    icuTotal,
    icuOccupiedNow,
    expectedDischarges72h,
    projectedAdmissions72h,
    projectedOccupied24h,
    projectedOccupied72h,
    projected24hPct,
    projected72hPct,
    surgeRisk,
    wardBottlenecks,
    recommendedActions,
  };
}

export function auditHmoClaimReadiness(input: HmoClaimAuditInput): HmoClaimAuditReport {
  const denialRisks: HmoClaimAuditReport['denialRisks'] = [];
  let penalty = 0;

  if (!input.nhiaNumber || input.nhiaNumber.trim().length < 5) {
    penalty += 30;
    denialRisks.push({
      code: 'MISSING_ENROLLEE_ID',
      severity: 'high',
      message: 'Missing or invalid NHIA / AKSHIA / HMO Enrollee ID number.',
      fixAction: 'Verify enrollee card in Patient Registry before claim batching.',
    });
  }

  if (!input.icd11Code || input.icd11Code.trim().length < 3) {
    penalty += 25;
    denialRisks.push({
      code: 'MISSING_ICD11',
      severity: 'high',
      message: 'Primary ICD-11 / diagnosis code is absent; payers reject uncoded claims.',
      fixAction: 'Attach validated ICD-11 code from clinician consultation note.',
    });
  }

  if (!input.diagnosis || input.diagnosis.trim().length < 3) {
    penalty += 15;
    denialRisks.push({
      code: 'MISSING_DIAGNOSIS',
      severity: 'medium',
      message: 'Clinical encounter diagnosis description is blank.',
      fixAction: 'Document confirmed working or final diagnosis.',
    });
  }

  const requiresPreAuth =
    input.totalAmountNgn >= 15_000 ||
    input.lineItems.some((l) => /inpatient|admission|ct\s|mri|ultrasound|surgery|theatre/i.test(`${l.category || ''} ${l.description}`));
  if (requiresPreAuth && (!input.authorizationCode || input.authorizationCode.trim().length < 4)) {
    penalty += 30;
    denialRisks.push({
      code: 'MISSING_PREAUTH',
      severity: 'high',
      message: 'Secondary/imaging/inpatient claim >= ₦15,000 requires valid HMO Authorization Code.',
      fixAction: 'Request & enter PA code from HMO / AKSHIA desk.',
    });
  }

  const seenDesc = new Set<string>();
  for (const li of input.lineItems) {
    const key = li.description.trim().toLowerCase();
    if (li.amountNgn <= 0) {
      penalty += 20;
      denialRisks.push({
        code: 'INVALID_LINE_AMOUNT',
        severity: 'high',
        message: `Line item "${li.description}" has zero or negative tariff.`,
        fixAction: 'Fix tariff schedule amount prior to submission.',
      });
    }
    if (seenDesc.has(key)) {
      penalty += 15;
      denialRisks.push({
        code: 'DUPLICATE_LINE_ITEM',
        severity: 'medium',
        message: `Duplicate charge line detected: "${li.description}".`,
        fixAction: 'Merge or remove duplicate line to avoid payer clawback.',
      });
    }
    seenDesc.add(key);
  }

  const readinessScore = Math.max(0, 100 - penalty);
  const status: HmoClaimAuditReport['status'] =
    readinessScore >= 85 ? 'ready' : readinessScore >= 55 ? 'needs_review' : 'high_denial_risk';

  return {
    readinessScore,
    status,
    denialRisks,
  };
}
