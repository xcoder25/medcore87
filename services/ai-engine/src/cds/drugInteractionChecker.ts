/**
 * MedCore Drug Interaction Checker
 * Offline-first: checks against local WHO EML / BNF interaction matrix
 */

import interactions from '../data/drug-interactions.json';

export type InteractionSeverity = 'MAJOR' | 'MODERATE' | 'MINOR';

export interface DrugInteraction {
  drug_a: string;
  drug_b: string;
  severity: InteractionSeverity;
  mechanism: string;
  effect: string;
  management: string;
}

export interface InteractionCheckResult {
  hasInteractions: boolean;
  hasMajor: boolean;
  interactions: Array<{
    pair: [string, string];
    severity: InteractionSeverity;
    mechanism: string;
    effect: string;
    management: string;
  }>;
  summary: string;
}

const db = interactions as DrugInteraction[];

function normalise(drug: string): string {
  return drug.toLowerCase().trim();
}

function drugMatches(drugName: string, entry: string): boolean {
  const n = normalise(drugName);
  const e = normalise(entry);
  return n.includes(e) || e.includes(n) ||
    // Handle generic ↔ class matching
    (e === 'nsaids' && ['ibuprofen','diclofenac','indomethacin','naproxen','celecoxib'].some(d => n.includes(d))) ||
    (e === 'ace inhibitors' && ['lisinopril','enalapril','ramipril','captopril','perindopril'].some(d => n.includes(d))) ||
    (e === 'ssris' && ['fluoxetine','sertraline','citalopram','escitalopram','paroxetine'].some(d => n.includes(d))) ||
    (e === 'statins' && ['atorvastatin','simvastatin','rosuvastatin','pravastatin','lovastatin'].some(d => n.includes(d))) ||
    (e === 'benzodiazepines' && ['diazepam','lorazepam','clonazepam','midazolam','alprazolam'].some(d => n.includes(d)));
}

export function checkDrugInteractions(drugs: string[]): InteractionCheckResult {
  if (drugs.length < 2) {
    return { hasInteractions: false, hasMajor: false, interactions: [], summary: 'No interactions to check (requires ≥ 2 drugs).' };
  }

  const found: InteractionCheckResult['interactions'] = [];

  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const a = drugs[i];
      const b = drugs[j];

      for (const entry of db) {
        const matchAB = drugMatches(a, entry.drug_a) && drugMatches(b, entry.drug_b);
        const matchBA = drugMatches(b, entry.drug_a) && drugMatches(a, entry.drug_b);
        if (matchAB || matchBA) {
          found.push({
            pair: [a, b],
            severity: entry.severity,
            mechanism: entry.mechanism,
            effect: entry.effect,
            management: entry.management,
          });
        }
      }
    }
  }

  const hasMajor = found.some(f => f.severity === 'MAJOR');
  const majorCount    = found.filter(f => f.severity === 'MAJOR').length;
  const moderateCount = found.filter(f => f.severity === 'MODERATE').length;

  let summary = 'No known interactions detected.';
  if (found.length > 0) {
    summary = `${found.length} interaction(s) found: ${majorCount} MAJOR, ${moderateCount} MODERATE. ${hasMajor ? '⚠️ Review before dispensing.' : ''}`;
  }

  return { hasInteractions: found.length > 0, hasMajor, interactions: found, summary };
}
