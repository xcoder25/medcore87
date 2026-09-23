/**
 * MedCore Differential Diagnosis Engine
 * Bayesian symptom-to-condition scoring — offline, Nigeria-specific
 */

import rules from '../data/differential-dx.json';

interface DxRule {
  id: string;
  name: string;
  icd11: string;
  triggers: string[];
  confirmatory: string[];
  excludes: string[];
  baseScore: number;
  epidemiology: string;
}

export interface DifferentialResult {
  rank: number;
  name: string;
  icd11: string;
  probability: number;   // 0-100
  matchedSymptoms: string[];
  confirmatory: string[];
  epidemiology: string;
  urgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
}

const EMERGENCY_DX = new Set(['dx-sepsis', 'dx-hypertensive-crisis', 'dx-pre-eclampsia', 'dx-stroke', 'dx-appendicitis']);
const URGENT_DX    = new Set(['dx-malaria', 'dx-typhoid', 'dx-pneumonia', 'dx-heart-failure']);

function normalise(text: string): string {
  return text.toLowerCase();
}

export function getDifferentialDiagnosis(params: {
  symptoms: string[];
  vitals?: { temperature?: number; systolicBP?: number; spO2?: number; heartRate?: number; respiratoryRate?: number };
  demographics?: { age?: number; gender?: string; pregnant?: boolean };
  contextClues?: string[];
}): DifferentialResult[] {
  const db = rules as DxRule[];
  const allTerms = [
    ...params.symptoms,
    ...(params.contextClues || []),
    // Derive from vitals
    ...(params.vitals?.temperature && params.vitals.temperature >= 38.0 ? ['fever'] : []),
    ...(params.vitals?.systolicBP && params.vitals.systolicBP >= 160 ? ['high BP', 'hypertension'] : []),
    ...(params.vitals?.spO2 && params.vitals.spO2 < 94 ? ['dyspnoea', 'hypoxia'] : []),
    ...(params.vitals?.heartRate && params.vitals.heartRate > 100 ? ['tachycardia'] : []),
    ...(params.vitals?.respiratoryRate && params.vitals.respiratoryRate > 20 ? ['high respiratory rate'] : []),
    ...(params.demographics?.pregnant ? ['pregnant'] : []),
    'nigeria', // Geographic epidemiology boost
  ].map(normalise);

  const scored: DifferentialResult[] = [];

  for (const rule of db) {
    // Check exclusions
    const excluded = rule.excludes.some(ex => allTerms.some(t => t.includes(normalise(ex))));
    if (excluded) continue;

    // Count trigger matches
    const matched: string[] = [];
    for (const trigger of rule.triggers) {
      if (allTerms.some(t => t.includes(normalise(trigger)) || normalise(trigger).includes(t))) {
        matched.push(trigger);
      }
    }

    if (matched.length === 0) continue;

    // Bayesian scoring: base + match ratio boost
    const matchRatio = matched.length / rule.triggers.length;
    const score = Math.min(98, Math.round(rule.baseScore * matchRatio * 1.3));

    // Gender filter
    if (params.demographics?.gender === 'MALE' && rule.id === 'dx-pre-eclampsia') continue;

    scored.push({
      rank: 0,
      name: rule.name,
      icd11: rule.icd11,
      probability: score,
      matchedSymptoms: matched,
      confirmatory: rule.confirmatory,
      epidemiology: rule.epidemiology,
      urgency: EMERGENCY_DX.has(rule.id) ? 'EMERGENCY' : URGENT_DX.has(rule.id) ? 'URGENT' : 'ROUTINE',
    });
  }

  // Sort by probability desc, emergency first
  scored.sort((a, b) => {
    const urgencyOrder = { EMERGENCY: 0, URGENT: 1, ROUTINE: 2 };
    if (a.urgency !== b.urgency) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return b.probability - a.probability;
  });

  // Rank and return top 6
  return scored.slice(0, 6).map((d, i) => ({ ...d, rank: i + 1 }));
}
