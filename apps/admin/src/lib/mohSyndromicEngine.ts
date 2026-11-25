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
