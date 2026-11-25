/**
 * Statewide Predictive Drug Stockout & Near-Expiry Loss-Prevention Engine (`apps/admin`).
 * Zero-PII, zero-randomness forecasting across Akwa Ibom State health facilities:
 *  1) Seasonal prescribing surge demand (Antimalarials, Antihypertensives, Antibiotics, Vaccines)
 *  2) Near-expiry / short-dated inventory & cold-chain excursion alerts
 *  3) Inter-LGA FEFO stock redistribution recommendations
 */
import type { MohLiveSnapshot } from './mohTypes';

export type TherapeuticClass = 'antimalarial' | 'antihypertensive' | 'antibiotic' | 'vaccine_coldchain' | 'essential';

export interface StatewideStockoutRisk {
  id: string;
  facilityId: string;
  facilityName: string;
  lga: string;
  itemName: string;
  therapeuticClass: TherapeuticClass;
  quantity: number;
  reorderLevel: number;
  unit: string;
  seasonalMultiplier: number;
  projectedDaysSupply: number;
  urgency: 'critical' | 'warning';
  recommendedDispatchQty: number;
}

export interface StatewideNearExpiryRisk {
  id: string;
  facilityId: string;
  facilityName: string;
  lga: string;
  itemName: string;
  quantity: number;
  unit: string;
  reason: 'short_dated_expiry' | 'cold_chain_excursion';
  daysRemaining: number | null;
  detail: string;
  recommendedAction: string;
}

export interface RedistributionSuggestion {
  therapeuticClass: TherapeuticClass;
  itemName: string;
  fromFacilityName: string;
  fromLga: string;
  toFacilityName: string;
  toLga: string;
  suggestedTransferQty: number;
  unit: string;
  rationale: string;
}

export interface StatewideDrugForecastReport {
  seasonLabel: string;
  antimalarialMultiplier: number;
  antihypertensiveMultiplier: number;
  antibioticMultiplier: number;
  stockoutRisks: StatewideStockoutRisk[];
  nearExpiryRisks: StatewideNearExpiryRisk[];
  redistributionPairs: RedistributionSuggestion[];
  classSummary: Array<{
    therapeuticClass: TherapeuticClass;
    label: string;
    totalUnits: number;
    atRiskFacilities: number;
  }>;
}

function classifyMedicine(itemName: string, category: string): TherapeuticClass {
  const haystack = `${itemName} ${category}`.toLowerCase();
  if (/artemether|lumefantrine|artesunate|malaria|amodiaquine|quinine|coartem|antimalar/i.test(haystack)) {
    return 'antimalarial';
  }
  if (/amlodipine|lisinopril|nifedipine|losartan|hydrochlorothiazide|atenolol|methyldopa|labetalol|hypertens|antihypertens/i.test(haystack)) {
    return 'antihypertensive';
  }
  if (/amoxicillin|augmentin|ceftriaxone|ciprofloxacin|azithromycin|metronidazole|gentamicin|cefuroxime|antibiotic|antimicrobial/i.test(haystack)) {
    return 'antibiotic';
  }
  if (/vaccine|penta|bcg|opv|ipv|tetanus|measles|yellow fever|oxytocin|cold/i.test(haystack)) {
    return 'vaccine_coldchain';
  }
  return 'essential';
}

function parseNearExpiryFromNotes(notes: string, nowMs: number): number | null {
  const isoMatch = notes.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    const ms = Date.parse(isoMatch[1]);
    if (Number.isFinite(ms)) {
      return Math.ceil((ms - nowMs) / 86_400_000);
    }
  }
  const daysMatch = notes.match(/expir(?:y|es|ing)?\s*(?:in\s*)?(\d{1,3})\s*(?:d|days?)/i);
  if (daysMatch) {
    return Number.parseInt(daysMatch[1], 10);
  }
  if (/near[\s-]?expir|short[\s-]?dated|expiring\s*soon/i.test(notes)) {
    return 30;
  }
  return null;
}

export function forecastStatewideDrugDemandAndExpiry(
  snapshot: MohLiveSnapshot,
  nowMs = Date.now()
): StatewideDrugForecastReport {
  const month = new Date(nowMs).getUTCMonth() + 1;
  const isRainyPeak = month >= 4 && month <= 10;
  const antimalarialMultiplier = isRainyPeak ? 1.45 : 1.1;
  const antibioticMultiplier = isRainyPeak ? 1.25 : 1.15;
  const antihypertensiveMultiplier = 1.12;

  const seasonLabel = isRainyPeak
    ? 'Wet / Malaria & Vector Peak Season (Apr–Oct)'
    : 'Harmattan / Dry Season Transition (Nov–Mar)';

  const meds = snapshot.supplyChain.items.filter((i) => i.domain === 'medicine_vaccine');

  const stockoutRisks: StatewideStockoutRisk[] = [];
  const nearExpiryRisks: StatewideNearExpiryRisk[] = [];
  const classBuckets = new Map<TherapeuticClass, { totalUnits: number; riskFacs: Set<string> }>([
    ['antimalarial', { totalUnits: 0, riskFacs: new Set() }],
    ['antihypertensive', { totalUnits: 0, riskFacs: new Set() }],
    ['antibiotic', { totalUnits: 0, riskFacs: new Set() }],
    ['vaccine_coldchain', { totalUnits: 0, riskFacs: new Set() }],
    ['essential', { totalUnits: 0, riskFacs: new Set() }],
  ]);

  const surplusItems: Array<(typeof meds)[number] & { tClass: TherapeuticClass }> = [];

  for (const item of meds) {
    const tClass = classifyMedicine(item.itemName, item.category);
    const bucket = classBuckets.get(tClass)!;
    bucket.totalUnits += Math.max(0, Number(item.quantity || 0));

    const mult =
      tClass === 'antimalarial'
        ? antimalarialMultiplier
        : tClass === 'antibiotic'
          ? antibioticMultiplier
          : tClass === 'antihypertensive'
            ? antihypertensiveMultiplier
            : 1.05;

    const reorder = Math.max(10, Number(item.reorderLevel || 50));
    const estDailyUse = Math.max(1, (reorder / 15) * mult);
    const daysSupply = Math.max(0, Math.round(Number(item.quantity || 0) / estDailyUse));

    if (
      item.functionalStatus === 'stock_out' ||
      item.functionalStatus === 'low_stock' ||
      daysSupply <= 14 ||
      item.quantity <= reorder
    ) {
      bucket.riskFacs.add(item.facilityId);
      const urgency: 'critical' | 'warning' =
        item.functionalStatus === 'stock_out' || item.quantity === 0 || daysSupply <= 5
          ? 'critical'
          : 'warning';
      stockoutRisks.push({
        id: item.id,
        facilityId: item.facilityId,
        facilityName: item.facilityName,
        lga: item.lga,
        itemName: item.itemName,
        therapeuticClass: tClass,
        quantity: item.quantity,
        reorderLevel: reorder,
        unit: item.unit || 'units',
        seasonalMultiplier: mult,
        projectedDaysSupply: daysSupply,
        urgency,
        recommendedDispatchQty: Math.max(reorder, Math.ceil(estDailyUse * 30) - item.quantity),
      });
    } else if (item.quantity >= reorder * 2.5) {
      surplusItems.push({ ...item, tClass });
    }

    if (item.coldChainTempC !== null && (item.coldChainTempC < 2 || item.coldChainTempC > 8)) {
      nearExpiryRisks.push({
        id: `${item.id}-cc`,
        facilityId: item.facilityId,
        facilityName: item.facilityName,
        lga: item.lga,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit || 'doses',
        reason: 'cold_chain_excursion',
        daysRemaining: 0,
        detail: `Cold-chain excursion (${item.coldChainTempC}°C vs 2–8°C safe band) — high potency-loss risk.`,
        recommendedAction: 'Quarantine & run shake/VVM potency check before immunization outreach.',
      });
    }

    const daysToExp = parseNearExpiryFromNotes(item.notes || '', nowMs);
    if (daysToExp !== null && daysToExp <= 90) {
      nearExpiryRisks.push({
        id: `${item.id}-exp`,
        facilityId: item.facilityId,
        facilityName: item.facilityName,
        lga: item.lga,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit || 'units',
        reason: 'short_dated_expiry',
        daysRemaining: daysToExp,
        detail:
          daysToExp <= 0
            ? `Expired batch flagged (${item.quantity} ${item.unit}).`
            : `Near-expiry batch (~${daysToExp} days remaining, ${item.quantity} ${item.unit}).`,
        recommendedAction:
          daysToExp <= 0
            ? 'Quarantine and log NAFDAC reverse-logistics disposal.'
            : 'Enforce FEFO dispensing & transfer surplus to high-turnover General Hospital immediately.',
      });
    }
  }

  const redistributionPairs: RedistributionSuggestion[] = [];
  for (const risk of stockoutRisks) {
    if (redistributionPairs.length >= 6) break;
    const donor = surplusItems.find(
      (s) =>
        s.tClass === risk.therapeuticClass &&
        s.facilityId !== risk.facilityId &&
        s.quantity > s.reorderLevel * 2
    );
    if (!donor) continue;
    const transferQty = Math.min(
      Math.max(10, Math.floor((donor.quantity - donor.reorderLevel) * 0.4)),
      risk.recommendedDispatchQty
    );
    if (transferQty <= 0) continue;
    redistributionPairs.push({
      therapeuticClass: risk.therapeuticClass,
      itemName: risk.itemName,
      fromFacilityName: donor.facilityName,
      fromLga: donor.lga,
      toFacilityName: risk.facilityName,
      toLga: risk.lga,
      suggestedTransferQty: transferQty,
      unit: risk.unit,
      rationale: `Mitigates ${risk.projectedDaysSupply}d stockout runway in ${risk.lga} while utilizing surplus in ${donor.lga}.`,
    });
  }

  const labels: Record<TherapeuticClass, string> = {
    antimalarial: 'Antimalarials (ACT / IV Artesunate)',
    antihypertensive: 'Antihypertensives (Chronic CVD)',
    antibiotic: 'Essential Antibiotics',
    vaccine_coldchain: 'Vaccines & Cold-Chain',
    essential: 'Other Essential Medicines',
  };

  return {
    seasonLabel,
    antimalarialMultiplier,
    antihypertensiveMultiplier,
    antibioticMultiplier,
    stockoutRisks: stockoutRisks.sort((a, b) => a.projectedDaysSupply - b.projectedDaysSupply),
    nearExpiryRisks: nearExpiryRisks.sort(
      (a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999)
    ),
    redistributionPairs,
    classSummary: (Object.keys(labels) as TherapeuticClass[]).map((k) => ({
      therapeuticClass: k,
      label: labels[k],
      totalUnits: classBuckets.get(k)?.totalUnits || 0,
      atRiskFacilities: classBuckets.get(k)?.riskFacs.size || 0,
    })),
  };
}
