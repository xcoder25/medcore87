/**
 * Statewide Cross-LGA Syndromic Early-Warning Engine (`apps/admin`).
 * Pure, zero-PII, zero-randomness geographic clustering across Akwa Ibom State's 31 LGAs.
 * Links de-identified facility critical lab/vital escalations + DSNO IDSR filings to detect
 * cholera, Lassa fever, measles, severe malaria, and respiratory clusters early.
 */
import type { MohLiveSnapshot } from './mohTypes';

export type SyndromicKey =
  | 'cholera_awd'
  | 'lassa_vhf'
  | 'measles_rash'
  | 'severe_malaria'
  | 'respiratory_sari';

export interface MohSyndromicCluster {
  id: string;
  syndromeKey: SyndromicKey;
  syndromeLabel: string;
  severity: 'watch' | 'alert' | 'outbreak_surge';
  affectedLgas: string[];
  neighboringRiskLgas: string[];
  facilityNames: string[];
  totalSignals: number;
  suspectedCasesTotal: number;
  recommendedAction: string;
  detectedAt: string;
}

export const AKWA_IBOM_LGA_NEIGHBORS: Record<string, string[]> = {
  Uyo: ['Itu', 'Uruan', 'Ibesikpo Asutan', 'Nsit Ibom', 'Etinan'],
  Itu: ['Uyo', 'Ibiono Ibom', 'Uruan', 'Odukpani'],
  Uruan: ['Uyo', 'Itu', 'Okobo', 'Ibesikpo Asutan'],
  'Ibesikpo Asutan': ['Uyo', 'Uruan', 'Nsit Ibom', 'Nsit Atai', 'Okobo'],
  'Nsit Ibom': ['Uyo', 'Ibesikpo Asutan', 'Etinan', 'Nsit Ubium'],
  Etinan: ['Uyo', 'Nsit Ibom', 'Onna', 'Mkpat Enin', 'Abak'],
  'Ibiono Ibom': ['Itu', 'Ikono', 'Ini', 'Uyo'],
  Eket: ['Ibeno', 'Esit Eket', 'Onna', 'Nsit Ubium'],
  Ibeno: ['Eket', 'Esit Eket', 'Eastern Obolo'],
  'Esit Eket': ['Eket', 'Ibeno', 'Nsit Ubium', 'Mbo'],
  Onna: ['Eket', 'Etinan', 'Mkpat Enin', 'Nsit Ubium'],
  'Mkpat Enin': ['Onna', 'Etinan', 'Ikot Abasi', 'Eastern Obolo', 'Oruk Anam'],
  'Ikot Abasi': ['Mkpat Enin', 'Eastern Obolo', 'Oruk Anam'],
  'Eastern Obolo': ['Ikot Abasi', 'Mkpat Enin', 'Ibeno'],
  'Ikot Ekpene': ['Essien Udim', 'Obot Akara', 'Ikono', 'Abak'],
  'Essien Udim': ['Ikot Ekpene', 'Obot Akara', 'Ika', 'Abak'],
  'Obot Akara': ['Ikot Ekpene', 'Essien Udim', 'Ini', 'Ikono'],
  Ikono: ['Ini', 'Ibiono Ibom', 'Ikot Ekpene', 'Obot Akara', 'Abak'],
  Ini: ['Ikono', 'Ibiono Ibom', 'Obot Akara'],
  Abak: ['Ikot Ekpene', 'Essien Udim', 'Etim Ekpo', 'Ukanafun', 'Etinan', 'Ikono'],
  'Etim Ekpo': ['Abak', 'Ika', 'Ukanafun', 'Oruk Anam'],
  Ika: ['Etim Ekpo', 'Essien Udim'],
  Ukanafun: ['Abak', 'Etim Ekpo', 'Oruk Anam'],
  'Oruk Anam': ['Ukanafun', 'Etim Ekpo', 'Mkpat Enin', 'Ikot Abasi'],
  Oron: ['Mbo', 'Udung Uko', 'Okobo', 'Urue Offong/Oruko'],
  Mbo: ['Oron', 'Udung Uko', 'Esit Eket'],
  'Udung Uko': ['Oron', 'Mbo', 'Urue Offong/Oruko'],
  Okobo: ['Oron', 'Urue Offong/Oruko', 'Uruan', 'Ibesikpo Asutan'],
  'Urue Offong/Oruko': ['Oron', 'Okobo', 'Udung Uko', 'Nsit Atai'],
  'Nsit Atai': ['Ibesikpo Asutan', 'Nsit Ubium', 'Okobo', 'Urue Offong/Oruko'],
  'Nsit Ubium': ['Nsit Ibom', 'Etinan', 'Onna', 'Esit Eket', 'Nsit Atai'],
};

const SYNDROME_META: Record<SyndromicKey, { label: string; pattern: RegExp; action: string }> = {
  cholera_awd: {
    label: 'Acute Watery Diarrhoea / Suspected Cholera',
    pattern: /cholera|watery diarrh|awd|vibrio|dehydrat/i,
    action: 'Deploy LGA WASH chlorine disinfection, ORS/Ringer Lactate buffer stock & rapid stool culture confirmation.',
  },
  lassa_vhf: {
    label: 'Viral Haemorrhagic / Suspected Lassa Fever',
    pattern: /lassa|vhf|haemorrhag|hemorrhag|vhf|bleeding fever/i,
    action: 'Activate NCDC reference PCR courier, barrier isolation PPE & Ribavirin contingency prepositioning.',
  },
  measles_rash: {
    label: 'Febrile Rash / Suspected Measles',
    pattern: /measles|rash|mpox|rubella/i,
    action: 'Launch targeted ward ring vaccination, vitamin A supplementation & contact tracing across affected LGAs.',
  },
  severe_malaria: {
    label: 'Severe Febrile Illness / Malaria Surge',
    pattern: /malaria|trophozoite|hyperpyrexia|paroxysm/i,
    action: 'Push Central Medical Store IV Artesunate + ACT emergency replenishment to flagged LGAs.',
  },
  respiratory_sari: {
    label: 'Severe Acute Respiratory Infection (SARI)',
    pattern: /sari|respiratory|pneumonia|hypoxia|spo2/i,
    action: 'Verify oxygen plant reserves, pulse oximetry triage capacity & respiratory isolation readiness.',
  },
};

function classifyTextSyndrome(text: string): SyndromicKey | null {
  for (const [key, meta] of Object.entries(SYNDROME_META)) {
    if (meta.pattern.test(text)) return key as SyndromicKey;
  }
  return null;
}

export function detectCrossLgaSyndromicAnomalies(snapshot: MohLiveSnapshot): MohSyndromicCluster[] {
  const facilityLga = new Map<string, string>();
  const facilityNameMap = new Map<string, string>();
  for (const f of snapshot.facilities) {
    facilityLga.set(f.facilityId, f.lga);
    facilityNameMap.set(f.facilityId, f.facilityName);
  }

  type Bucket = {
    lgas: Set<string>;
    facilities: Set<string>;
    signalsCount: number;
    casesTotal: number;
  };
  const buckets = new Map<SyndromicKey, Bucket>();
  const ensureBucket = (k: SyndromicKey): Bucket => {
    let b = buckets.get(k);
    if (!b) {
      b = { lgas: new Set(), facilities: new Set(), signalsCount: 0, casesTotal: 0 };
      buckets.set(k, b);
    }
    return b;
  };

  for (const sig of snapshot.surveillance.clinicalSignals) {
    const syn = classifyTextSyndrome(sig.summary || '');
    if (!syn) continue;
    const lga = facilityLga.get(sig.facilityId) || 'Uyo';
    const b = ensureBucket(syn);
    b.lgas.add(lga);
    b.facilities.add(sig.facilityName || facilityNameMap.get(sig.facilityId) || sig.facilityId);
    b.signalsCount += 1;
    b.casesTotal += 1;
  }

  for (const rep of snapshot.idsr.dsnoReports) {
    const syn = classifyTextSyndrome(`${rep.disease || ''} ${rep.notes || ''}`);
    if (!syn) continue;
    const b = ensureBucket(syn);
    if (rep.lga) b.lgas.add(rep.lga);
    if (rep.facilityName) b.facilities.add(rep.facilityName);
    b.signalsCount += 1;
    b.casesTotal += Math.max(1, Number(rep.suspectedCases || 0));
  }

  const clusters: MohSyndromicCluster[] = [];
  for (const [synKey, b] of buckets.entries()) {
    const affected = Array.from(b.lgas);
    if (affected.length === 0) continue;

    // Check geographic adjacency between affected LGAs
    let adjacentPairFound = false;
    const riskNeighbors = new Set<string>();
    for (const lga of affected) {
      const neighbors = AKWA_IBOM_LGA_NEIGHBORS[lga] || [];
      for (const n of neighbors) {
        if (b.lgas.has(n) && n !== lga) adjacentPairFound = true;
        if (!b.lgas.has(n)) riskNeighbors.add(n);
      }
    }

    const isSurge = (adjacentPairFound && b.casesTotal >= 3) || b.casesTotal >= 5 || b.signalsCount >= 4;
    const isAlert = adjacentPairFound || b.signalsCount >= 2 || b.casesTotal >= 2;
    if (!isAlert && synKey !== 'lassa_vhf') continue;

    const severity: MohSyndromicCluster['severity'] =
      synKey === 'lassa_vhf' && (b.signalsCount >= 2 || adjacentPairFound)
        ? 'outbreak_surge'
        : isSurge
          ? 'outbreak_surge'
          : isAlert
            ? 'alert'
            : 'watch';

    const meta = SYNDROME_META[synKey];
    clusters.push({
      id: `SYN-${synKey.toUpperCase()}`,
      syndromeKey: synKey,
      syndromeLabel: meta.label,
      severity,
      affectedLgas: affected,
      neighboringRiskLgas: Array.from(riskNeighbors).slice(0, 6),
      facilityNames: Array.from(b.facilities).slice(0, 6),
      totalSignals: b.signalsCount,
      suspectedCasesTotal: b.casesTotal,
      recommendedAction: meta.action,
      detectedAt: snapshot.syncedAt,
    });
  }

  const rank = { outbreak_surge: 0, alert: 1, watch: 2 };
  return clusters.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.suspectedCasesTotal - a.suspectedCasesTotal
  );
}

export const AKWA_IBOM_LGA_COORDS: Record<string, { lat: number; lng: number }> = {
  Uyo: { lat: 5.0377, lng: 7.9128 },
  Eket: { lat: 4.6423, lng: 7.9244 },
  'Ikot Ekpene': { lat: 5.1819, lng: 7.7148 },
  Oron: { lat: 4.8217, lng: 8.235 },
  Abak: { lat: 4.9824, lng: 7.7892 },
  Etinan: { lat: 4.8426, lng: 7.8525 },
  Itu: { lat: 5.1997, lng: 7.9837 },
  Ibeno: { lat: 4.5686, lng: 7.9764 },
  'Ikot Abasi': { lat: 4.5685, lng: 7.5518 },
  'Oruk Anam': { lat: 4.79, lng: 7.62 },
  'Essien Udim': { lat: 5.125, lng: 7.65 },
  Ikono: { lat: 5.195, lng: 7.825 },
  Ini: { lat: 5.36, lng: 7.75 },
  'Ibiono Ibom': { lat: 5.165, lng: 7.915 },
  Uruan: { lat: 5.015, lng: 8.045 },
  'Ibesikpo Asutan': { lat: 4.945, lng: 7.935 },
  'Nsit Ibom': { lat: 4.885, lng: 7.895 },
  'Nsit Ubium': { lat: 4.775, lng: 7.945 },
  'Nsit Atai': { lat: 4.835, lng: 8.035 },
  Okobo: { lat: 4.855, lng: 8.115 },
  Mbo: { lat: 4.645, lng: 8.235 },
  'Udung Uko': { lat: 4.755, lng: 8.245 },
  'Urue Offong/Oruko': { lat: 4.775, lng: 8.175 },
  'Esit Eket': { lat: 4.655, lng: 8.055 },
  Onna: { lat: 4.695, lng: 7.865 },
  'Mkpat Enin': { lat: 4.735, lng: 7.745 },
  'Eastern Obolo': { lat: 4.525, lng: 7.765 },
  Ukanafun: { lat: 4.895, lng: 7.615 },
  'Etim Ekpo': { lat: 5.015, lng: 7.625 },
  Ika: { lat: 5.015, lng: 7.535 },
  'Obot Akara': { lat: 5.255, lng: 7.645 },
};

export interface MohHeatmapHotspot {
  lga: string;
  lat: number;
  lng: number;
  dominantSyndrome: SyndromicKey;
  dominantLabel: string;
  severity: 'watch' | 'alert' | 'outbreak_surge';
  intensity: number;
  signalCount: number;
  suspectedCases: number;
  facilitiesReporting: number;
  syndromes: Array<{ key: SyndromicKey; label: string; cases: number }>;
  recommendedAction: string;
}

export function buildMohOutbreakHeatmap(snapshot: MohLiveSnapshot): MohHeatmapHotspot[] {
  const facilityLga = new Map<string, string>();
  const lgaCoordsAcc = new Map<string, { latSum: number; lngSum: number; count: number }>();

  for (const f of snapshot.facilities) {
    facilityLga.set(f.facilityId, f.lga);
    if (Number.isFinite(f.latitude) && Number.isFinite(f.longitude) && f.latitude !== 0 && f.longitude !== 0) {
      const cur = lgaCoordsAcc.get(f.lga) || { latSum: 0, lngSum: 0, count: 0 };
      cur.latSum += f.latitude;
      cur.lngSum += f.longitude;
      cur.count += 1;
      lgaCoordsAcc.set(f.lga, cur);
    }
  }

  type LgaBucket = {
    facilities: Set<string>;
    signalCount: number;
    suspectedCases: number;
    bySyndrome: Map<SyndromicKey, number>;
  };

  const byLga = new Map<string, LgaBucket>();
  const ensureLga = (lga: string): LgaBucket => {
    let b = byLga.get(lga);
    if (!b) {
      b = {
        facilities: new Set(),
        signalCount: 0,
        suspectedCases: 0,
        bySyndrome: new Map(),
      };
      byLga.set(lga, b);
    }
    return b;
  };

  for (const sig of snapshot.surveillance.clinicalSignals) {
    const syn = classifyTextSyndrome(sig.summary || '');
    if (!syn) continue;
    const lga = facilityLga.get(sig.facilityId) || 'Uyo';
    const b = ensureLga(lga);
    b.facilities.add(sig.facilityId);
    b.signalCount += 1;
    b.suspectedCases += 1;
    b.bySyndrome.set(syn, (b.bySyndrome.get(syn) || 0) + 1);
  }

  for (const rep of snapshot.idsr.dsnoReports) {
    const syn = classifyTextSyndrome(`${rep.disease || ''} ${rep.notes || ''}`);
    if (!syn) continue;
    const lga = rep.lga || facilityLga.get(rep.facilityId || '') || 'Uyo';
    const b = ensureLga(lga);
    if (rep.facilityId || rep.facilityName) {
      b.facilities.add(rep.facilityId || rep.facilityName || lga);
    }
    const cases = Math.max(1, Number(rep.suspectedCases || 0));
    b.signalCount += 1;
    b.suspectedCases += cases;
    b.bySyndrome.set(syn, (b.bySyndrome.get(syn) || 0) + cases);
  }

  const hotspots: MohHeatmapHotspot[] = [];
  for (const [lga, b] of byLga.entries()) {
    const syndromeEntries = Array.from(b.bySyndrome.entries())
      .map(([key, cases]) => ({
        key,
        label: SYNDROME_META[key].label,
        cases,
      }))
      .sort((a, b2) => b2.cases - a.cases);
    if (syndromeEntries.length === 0) continue;

    const dominant = syndromeEntries[0];
    const highRiskVhfOrCholera = dominant.key === 'lassa_vhf' || dominant.key === 'cholera_awd';
    const severity: MohHeatmapHotspot['severity'] =
      (highRiskVhfOrCholera && b.suspectedCases >= 2) || b.suspectedCases >= 5 || b.signalCount >= 4
        ? 'outbreak_surge'
        : b.suspectedCases >= 2 || b.signalCount >= 2 || highRiskVhfOrCholera
          ? 'alert'
          : 'watch';

    const rawIntensity =
      0.25 +
      Math.min(0.45, b.suspectedCases * 0.09) +
      (highRiskVhfOrCholera ? 0.2 : 0.05) +
      Math.min(0.1, b.facilities.size * 0.03);
    const intensity = Number(Math.min(1, rawIntensity).toFixed(2));

    const acc = lgaCoordsAcc.get(lga);
    const fallbackCoord = AKWA_IBOM_LGA_COORDS[lga] || AKWA_IBOM_LGA_COORDS.Uyo;
    const lat = acc && acc.count > 0 ? Number((acc.latSum / acc.count).toFixed(4)) : fallbackCoord.lat;
    const lng = acc && acc.count > 0 ? Number((acc.lngSum / acc.count).toFixed(4)) : fallbackCoord.lng;

    hotspots.push({
      lga,
      lat,
      lng,
      dominantSyndrome: dominant.key,
      dominantLabel: dominant.label,
      severity,
      intensity,
      signalCount: b.signalCount,
      suspectedCases: b.suspectedCases,
      facilitiesReporting: b.facilities.size,
      syndromes: syndromeEntries,
      recommendedAction: SYNDROME_META[dominant.key].action,
    });
  }

  const rank = { outbreak_surge: 0, alert: 1, watch: 2 };
  return hotspots.sort((a, b) => rank[a.severity] - rank[b.severity] || b.intensity - a.intensity);
}
