/**
 * Pharmacy clinical safety checks — assistive, not autonomous.
 */
const ALLERGY_DRUG_MAP: Record<string, string[]> = {
  penicillin: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin'],
  sulfa: ['cotrimoxazole', 'sulfadiazine', 'septrin'],
  nsaid: ['ibuprofen', 'diclofenac', 'aspirin', 'naproxen'],
};

const INTERACTIONS: { a: string; b: string; note: string }[] = [
  { a: 'warfarin', b: 'aspirin', note: 'Bleeding risk — verify indication' },
  { a: 'metformin', b: 'contrast', note: 'Hold metformin around contrast if protocol requires' },
  { a: 'amlodipine', b: 'simvastatin', note: 'Dose interaction possible' },
];

export interface SafetyFlag {
  level: 'high' | 'medium' | 'low';
  message: string;
}

export function checkPrescriptionSafety(input: {
  drugName: string;
  allergies?: string[];
  otherDrugs?: string[];
  notes?: string;
}): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const drug = input.drugName.toLowerCase();
  const allergies = (input.allergies || []).map((a) => a.toLowerCase());

  for (const [allergen, drugs] of Object.entries(ALLERGY_DRUG_MAP)) {
    if (allergies.some((a) => a.includes(allergen) || allergen.includes(a))) {
      if (drugs.some((d) => drug.includes(d))) {
        flags.push({
          level: 'high',
          message: `Possible allergy conflict: patient allergy related to ${allergen} vs ${input.drugName}`,
        });
      }
    }
  }

  for (const other of input.otherDrugs || []) {
    const o = other.toLowerCase();
    for (const pair of INTERACTIONS) {
      if ((drug.includes(pair.a) && o.includes(pair.b)) || (drug.includes(pair.b) && o.includes(pair.a))) {
        flags.push({ level: 'medium', message: `Interaction: ${pair.note}` });
      }
    }
  }

  if (/mg|mcg|ml/i.test(input.drugName) === false && !input.notes) {
    flags.push({ level: 'low', message: 'Confirm dose and frequency are documented' });
  }

  return flags;
}
