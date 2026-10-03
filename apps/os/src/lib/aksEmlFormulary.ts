/**
 * Akwa Ibom State Essential Medicines List (structured extract for MedCore OS)
 * Adult: 3rd Edition 2026 (AKS-EML)
 * Children: 1st Edition 2026 (AKS-EMLc)
 * Source: Akwa Ibom State Ministry of Health
 */

export type EmlAudience = 'adult' | 'children';
export type AwareGroup = 'access' | 'watch' | 'reserve' | null;

export interface EmlMedicine {
  id: string;
  name: string;
  dosageForms: string;
  category: string;
  subcategory?: string;
  audience: EmlAudience;
  awareGroup?: AwareGroup;
  notes?: string;
  complementary?: boolean;
}

/** Therapeutic categories present in AKS EML */
export const EML_CATEGORIES = [
  'Anaesthetics & preoperative',
  'Antiallergics & anaphylaxis',
  'Anticonvulsants / antiepileptics',
  'Antidotes & poisoning',
  'Anti-infective — antiamoebic',
  'Anti-infective — anthelmintic',
  'Anti-infective — antibacterial',
  'Analgesics & antipyretics',
  'Cardiovascular',
  'Diabetes',
  'Gastrointestinal',
  'Respiratory',
  'Malaria',
  'Vitamins & minerals',
  'Other',
] as const;

function m(
  id: string,
  name: string,
  dosageForms: string,
  category: string,
  audience: EmlAudience,
  extra?: Partial<EmlMedicine>
): EmlMedicine {
  return { id, name, dosageForms, category, audience, ...extra };
}

/** Adult list — extracted from AKS-EML 3rd Edition 2026 tables */
export const AKS_EML_ADULT: EmlMedicine[] = [
  // 1. Anaesthetics
  m('a-hal', 'Halothane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-iso', 'Isoflurane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-n2o', 'Nitrous oxide', 'Inhalation: Medical gas', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-o2', 'Oxygen', 'Inhalation: Medical gas', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Medical gases' }),
  m('a-sev', 'Sevoflurane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-ket', 'Ketamine', 'Injection: 50 mg/mL in 10-mL vial; 100 mg/mL in 5-mL vial', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Injectable' }),
  m('a-pro', 'Propofol', 'Injection (emulsion): 10 mg/mL in 20-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Injectable' }),
  m('a-thio', 'Thiopental', 'Injection: 10 mg/mL; 20 mg/mL', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Injectable' }),
  m('a-bup', 'Bupivacaine', 'Injection: 0.25%; 0.5%. Spinal: 0.5% in 4-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Local anaesthetics' }),
  m('a-lid', 'Lidocaine', 'Injection: 1%; 2%. Spinal: 5%. Topical: 2%; 4% creams', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Local anaesthetics' }),
  m('a-lid-epi', 'Lidocaine + Epinephrine', 'Dental cartridge: 2% + epinephrine 1:80,000', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Local anaesthetics' }),
  m('a-atr', 'Atropine', 'Injection: 500 mcg in 1 mL; 600 mcg in 1-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-mid', 'Midazolam', 'Injection: 1 mg/mL. Oral liquid: 2 mg/mL. Tablet: 7.5 mg; 15 mg', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-mor', 'Morphine', 'Injection: 10 mg; 15 mg in 1-mL ampoule. 0.5 mg/mL preservative-free', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-atrac', 'Atracurium', 'Injection: 10 mg/mL', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-sux', 'Suxamethonium', 'Injection: 20 mg/mL; 50 mg/mL; 100 mg/mL in 2-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-vec', 'Vecuronium', 'Powder for injection: 10 mg; 20 mg (bromide) in vial', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-adr', 'Adrenaline', 'Injection: 30 mcg/mL as Hydrochloride in 1-mL ampoule', 'Anaesthetics & preoperative', 'adult'),

  // 2. Antiallergics
  m('a-dex', 'Dexamethasone', 'Injection: 4 mg (disodium phosphate)/mL in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'adult', { subcategory: 'Anti-anaphylactics' }),
  m('a-epi', 'Epinephrine (Adrenaline)', 'Injection: 1 mg (hydrochloride or hydrogen tartrate) in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'adult', { subcategory: 'Anti-anaphylactics' }),
  m('a-hc', 'Hydrocortisone', 'Powder for injection: 100 mg (sodium succinate) in vial', 'Antiallergics & anaphylaxis', 'adult', { subcategory: 'Anti-anaphylactics' }),
  m('a-pred', 'Prednisolone', 'Oral liquid: 5 mg/mL; 15 mg/5 mL. Tablet: 5 mg; 25 mg', 'Antiallergics & anaphylaxis', 'adult'),

  // 3. Anticonvulsants
  m('a-cbz', 'Carbamazepine', 'Tablet: 100 mg; 200 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-clon', 'Clonazepam', 'Injection: 1 mg/mL. Oral liquid: 500 mcg/5 mL. Tablet: 500 mcg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-diaz', 'Diazepam', 'Injection: 5 mg/mL in 2-mL ampoule. Tablets: 5 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-lev', 'Levetiracetam', 'Oral solution: 100 mg/mL. Tablet: 250–1000 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-lor', 'Lorazepam', 'Injection: 2 mg/mL; 4 mg/mL in 1-mL ampoule', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-mgso4', 'Magnesium sulfate', 'Injection: 50% in 2-mL; 20% in 5- or 10-mL ampoule', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-phb', 'Phenobarbital', 'Injection: 30 mg/mL; 60 mg/mL. Oral liquid: 15 mg/5 mL. Tablet: 15–60 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-pht', 'Phenytoin sodium', 'Capsule: 25–300 mg. Injection: 50 mg/mL. Oral liquid: 125 mg/5 mL. Tablet: 25–100 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-pgb', 'Pregabalin', 'Capsule: 25–300 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-vpa', 'Sodium valproate (Valproic acid)', 'Oral liquid: 200 mg/5 mL; 250 mg/5 mL. Tablet (EC): 100–500 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-tpm', 'Topiramate', 'Capsule: 25–100 mg. Tablet: 25–200 mg', 'Anticonvulsants / antiepileptics', 'adult'),

  // 4. Antidotes
  m('a-char', 'Charcoal (activated)', 'Capsule: 260 mg. Powder/granules: 5 g. Tablet: 250 mg', 'Antidotes & poisoning', 'adult', { subcategory: 'Non-specific' }),
  m('a-nac', 'Acetylcysteine', 'Injection: 200 mg/mL in 10-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-atr2', 'Atropine', 'Injection: 600 mcg; 1 mg; 2 mg in ampoules', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-caglu', 'Calcium gluconate', 'Injection: 100 mg/mL in 10-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-flu', 'Flumazenil', 'Injection: 0.1 mg/mL', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-nal', 'Naloxone', 'Injection: 400 mcg in 1-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-k1', 'Phytomenadione (vitamin K1)', 'Injection: 10 mg/mL in 1-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),

  // 5. Anti-infective
  m('a-metro', 'Metronidazole', 'Oral liquid: 200 mg/5 mL. Tablet: 200 mg; 400 mg. Injection: 500 mg in 100-mL', 'Anti-infective — antiamoebic', 'adult'),
  m('a-sec', 'Secnidazole', 'Oral granules: 2 g. Tablet: 500 mg', 'Anti-infective — antiamoebic', 'adult'),
  m('a-tin', 'Tinidazole', 'Tablet: 500 mg', 'Anti-infective — antiamoebic', 'adult'),
  m('a-alb', 'Albendazole', 'Tablet: 200 mg; 400 mg. Oral liquid: 100 mg/5 mL', 'Anti-infective — anthelmintic', 'adult'),
  m('a-ivm', 'Ivermectin', 'Tablet: 3 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-pra', 'Praziquantel', 'Tablet: 600 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-meb', 'Mebendazole', 'Oral liquid: 100 mg/5 mL. Tablet: 100 mg; 500 mg', 'Anti-infective — anthelmintic', 'adult'),

  // Antibacterials Access
  m('a-amx', 'Amoxicillin', 'Capsule: 250 mg; 500 mg. Powder for injection: 250–1000 mg. Oral liquid: 125–250 mg/5 mL. Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-amx-cla', 'Amoxicillin + Clavulanic acid', 'Oral liquid; Powder for injection; Tablet combinations', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-amp', 'Ampicillin', 'Capsule: 250–500 mg. Powder for injection: 500 mg; 1 g', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-benz', 'Benzathine benzylpenicillin', 'Powder for injection: 900 mg (=1.2 MU); 1.44 g (=2.4 MU)', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-bpen', 'Benzylpenicillin', 'Powder for injection: 600 mg (=1 MU); 3 g (=5 MU)', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-ceph', 'Cephalexin', 'Capsules: 250–500 mg. Oral suspension: 125–250 mg/5 mL', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-cli', 'Clindamycin', 'Capsule: 150 mg; 300 mg. Injection: 150 mg/mL', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-clox', 'Cloxacillin', 'Capsule: 250–500 mg. Powder for injection/oral solution', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-doxy', 'Doxycycline', 'Capsule: 100 mg', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-gent', 'Gentamicin', 'Injection: 40 mg/mL in 2-mL ampoule', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-ctx', 'Sulfamethoxazole + Trimethoprim (Co-trimoxazole)', 'Injection; Oral liquid; Tablet combinations', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  m('a-tet', 'Tetracycline', 'Capsule: 250 mg', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'access', subcategory: 'Access group' }),
  // Watch
  m('a-azith', 'Azithromycin', 'Tablet: 250–500 mg. Powder for oral liquid: 200 mg/5 mL', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'watch', subcategory: 'Watch group' }),
  m('a-cefix', 'Cefixime', 'Capsule: 200–400 mg. Oral liquid: 100 mg/5 mL. Tablet: 200–400 mg', 'Anti-infective — antibacterial', 'adult', { awareGroup: 'watch', subcategory: 'Watch group' }),

  // Common clinical essentials (aligned with NEML / WHO patterns used in AKS context)
  m('a-pcm', 'Paracetamol', 'Tablet: 500 mg. Oral liquid: 120 mg/5 mL. Injection: 10 mg/mL', 'Analgesics & antipyretics', 'adult'),
  m('a-iba', 'Ibuprofen', 'Tablet: 200 mg; 400 mg. Oral liquid: 100 mg/5 mL', 'Analgesics & antipyretics', 'adult'),
  m('a-asa', 'Acetylsalicylic acid', 'Tablet: 75 mg; 100 mg; 300 mg', 'Analgesics & antipyretics', 'adult'),
  m('a-metf', 'Metformin', 'Tablet: 500 mg; 850 mg; 1000 mg', 'Diabetes', 'adult'),
  m('a-aml', 'Amlodipine', 'Tablet: 5 mg; 10 mg', 'Cardiovascular', 'adult'),
  m('a-enal', 'Enalapril', 'Tablet: 5 mg; 10 mg; 20 mg', 'Cardiovascular', 'adult'),
  m('a-hctz', 'Hydrochlorothiazide', 'Tablet: 12.5 mg; 25 mg', 'Cardiovascular', 'adult'),
  m('a-sal', 'Salbutamol', 'Inhaler: 100 mcg/dose. Nebuliser solution: 5 mg/mL. Tablet: 2 mg; 4 mg', 'Respiratory', 'adult'),
  m('a-act', 'Artemether + Lumefantrine', 'Tablet: 20/120 mg; 40/240 mg. Dispersible tablet', 'Malaria', 'adult'),
  m('a-as', 'Artesunate', 'Injection: 60 mg; 120 mg. Rectal capsule where listed', 'Malaria', 'adult'),
  m('a-ors', 'Oral rehydration salts', 'Powder for solution: WHO standard sachet', 'Gastrointestinal', 'adult'),
  m('a-omep', 'Omeprazole', 'Capsule: 20 mg. Powder for injection: 40 mg', 'Gastrointestinal', 'adult'),
];

/** Children list — extracted from AKS-EMLc 1st Edition 2026 */
export const AKS_EML_CHILDREN: EmlMedicine[] = [
  m('c-hal', 'Halothane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'children', { subcategory: 'Inhalational' }),
  m('c-iso', 'Isoflurane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'children', { subcategory: 'Inhalational' }),
  m('c-o2', 'Oxygen', 'Inhalation: hypoxaemia. *No more than 30% O₂ for neonates ≤32 weeks gestation', 'Anaesthetics & preoperative', 'children', { subcategory: 'Medical gases', notes: 'Neonatal caution' }),
  m('c-ket', 'Ketamine', 'Injection: 50 mg/mL in 10-mL vial', 'Anaesthetics & preoperative', 'children', { subcategory: 'Injectable' }),
  m('c-pro', 'Propofol', 'Injection (emulsion): 10 mg/mL; 20 mg/mL. *Not for age < 3 years', 'Anaesthetics & preoperative', 'children', { notes: 'Not for Age < 3 years' }),
  m('c-thio', 'Thiopental', 'Injection: 10 mg/mL; 20 mg/mL', 'Anaesthetics & preoperative', 'children'),
  m('c-bup', 'Bupivacaine', 'Injection: 0.25%; 0.5%. *Not recommended for children < 12 years', 'Anaesthetics & preoperative', 'children', { notes: 'Not recommended < 12 years' }),
  m('c-lid', 'Lidocaine', 'Injection: 1%; 2%. Topical: 2%; 4%', 'Anaesthetics & preoperative', 'children'),
  m('c-mid', 'Midazolam', 'Injection: 1 mg/mL. Oral liquid: 2 mg/mL. Tablet: 7.5 mg; 15 mg', 'Anaesthetics & preoperative', 'children'),
  m('c-prom', 'Promethazine', 'Injection: 25–50 mg/2 mL. Oral liquid: 5 mg/5 mL. Suppository; Tablet', 'Anaesthetics & preoperative', 'children'),
  m('c-dex', 'Dexamethasone', 'Injection: 4 mg/mL in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'children'),
  m('c-epi', 'Epinephrine (Adrenaline)', 'Injection: 1 mg in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'children'),
  m('c-hc', 'Hydrocortisone', 'Powder for injection: 100 mg (sodium succinate) vial', 'Antiallergics & anaphylaxis', 'children'),
  m('c-cp', 'Chlorpheniramine', 'Injection: 10 mg/mL. Oral liquid: 2 mg/5 mL', 'Antiallergics & anaphylaxis', 'children', { subcategory: 'Anti-histamines' }),
  m('c-lora', 'Loratadine', 'Oral liquid: 1 mg/mL. Tablet: 10 mg', 'Antiallergics & anaphylaxis', 'children', { subcategory: 'Anti-histamines' }),
  m('c-pred', 'Prednisolone', 'Oral liquid: 5 mg/mL. Tablet: 5 mg', 'Antiallergics & anaphylaxis', 'children'),
  m('c-cbz', 'Carbamazepine', 'Oral liquid: 100 mg/5 mL. Tablet (chewable): 100–200 mg. Tablet: 100–200 mg', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-diaz', 'Diazepam', 'Injection: 5 mg/mL. Rectal gel: 2.5 mg; 10 mg', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-lev', 'Levetiracetam', 'Oral solution: 100 mg/mL', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-lor', 'Lorazepam', 'Injection: 2–4 mg/mL in 1-mL ampoule', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-mg', 'Magnesium sulfate', 'Injection: 500 mg/mL; infusion ampoules 100–500 mg/mL. Powder for injection', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-mid2', 'Midazolam', 'Oromucosal: 5–10 mg/mL. Ampoule: 1–10 mg/mL', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-phb', 'Phenobarbital', 'Injection: 30–200 mg/mL. Oral liquid: 15 mg/5 mL. Tablet: 15–30 mg', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-pht', 'Phenytoin', 'Capsule: 100–200 mg. Injection: 50 mg/mL. Oral liquid: 125 mg/5 mL. Tablet (chewable): 50 mg', 'Anticonvulsants / antiepileptics', 'children', { notes: 'Use with caution' }),
  m('c-vpa', 'Sodium valproate', 'Oral liquid: 200 mg/5 mL. Tablet (crushable/EC): 100–500 mg', 'Anticonvulsants / antiepileptics', 'children'),
  m('c-char', 'Charcoal (activated)', 'Capsule: 260 mg. Powder/granules: 5 g sachet', 'Antidotes & poisoning', 'children'),
  m('c-pcm', 'Paracetamol', 'Oral liquid: 120 mg/5 mL. Tablet: 100 mg; 500 mg. Suppository', 'Analgesics & antipyretics', 'children'),
  m('c-iba', 'Ibuprofen', 'Oral liquid: 100 mg/5 mL. Tablet: 200 mg', 'Analgesics & antipyretics', 'children'),
  m('c-amx', 'Amoxicillin', 'Oral liquid: 125–250 mg/5 mL. Capsule/Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'children', { awareGroup: 'access' }),
  m('c-amx-cla', 'Amoxicillin + Clavulanic acid', 'Oral liquid paediatric strengths', 'Anti-infective — antibacterial', 'children', { awareGroup: 'access' }),
  m('c-azith', 'Azithromycin', 'Powder for oral liquid: 200 mg/5 mL. Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'children', { awareGroup: 'watch' }),
  m('c-gent', 'Gentamicin', 'Injection: 10 mg/mL; 40 mg/mL', 'Anti-infective — antibacterial', 'children', { awareGroup: 'access' }),
  m('c-metro', 'Metronidazole', 'Oral liquid: 200 mg/5 mL. Tablet: 200–400 mg', 'Anti-infective — antiamoebic', 'children'),
  m('c-alb', 'Albendazole', 'Oral liquid: 100 mg/5 mL. Tablet: 200–400 mg', 'Anti-infective — anthelmintic', 'children'),
  m('c-act', 'Artemether + Lumefantrine', 'Dispersible tablet paediatric strengths', 'Malaria', 'children'),
  m('c-as', 'Artesunate', 'Injection; rectal (paediatric) where listed', 'Malaria', 'children'),
  m('c-ors', 'Oral rehydration salts', 'Powder for solution: WHO standard sachet', 'Gastrointestinal', 'children'),
  m('c-zn', 'Zinc sulfate', 'Tablet (dispersible): 20 mg. Oral liquid', 'Vitamins & minerals', 'children'),
  m('c-vitA', 'Retinol (Vitamin A)', 'Capsule: 100,000 IU; 200,000 IU', 'Vitamins & minerals', 'children'),
  m('c-sal', 'Salbutamol', 'Inhaler / nebuliser solution (paediatric use)', 'Respiratory', 'children'),
];

export function listEml(audience: EmlAudience): EmlMedicine[] {
  return audience === 'adult' ? AKS_EML_ADULT : AKS_EML_CHILDREN;
}

export function searchEml(audience: EmlAudience, q: string, category?: string): EmlMedicine[] {
  const rows = listEml(audience);
  const qq = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (category && category !== 'All' && r.category !== category) return false;
    if (!qq) return true;
    return (
      r.name.toLowerCase().includes(qq) ||
      r.dosageForms.toLowerCase().includes(qq) ||
      r.category.toLowerCase().includes(qq) ||
      (r.subcategory || '').toLowerCase().includes(qq)
    );
  });
}

export const EML_META = {
  adult: {
    title: 'AKS Essential Medicines List — Adults',
    edition: '3rd Edition 2026',
    authority: 'Akwa Ibom State Ministry of Health',
  },
  children: {
    title: 'AKS Essential Medicines List — Children',
    edition: '1st Edition 2026',
    authority: 'Akwa Ibom State Ministry of Health',
  },
};
