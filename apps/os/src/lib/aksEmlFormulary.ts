/**
 * Akwa Ibom State Essential Medicines List (structured extract for MedCore OS)
 * Adult: 3rd Edition 2026 — source PDF AKWA IBOM ADULT 16TH JUNE 2026
 * Children: 1st Edition 2026 — source PDF AKWA IBOM CHILDREN 16TH JUNE 2026
 * Authority: Akwa Ibom State Ministry of Health
 *
 * Extract covers primary therapeutic chapters from official tables.
 * Full paper EML remains the legal reference for edge cases / restricted lists.
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

export const EML_CATEGORIES = [
  'Anaesthetics & preoperative',
  'Antiallergics & anaphylaxis',
  'Anticonvulsants / antiepileptics',
  'Antidotes & poisoning',
  'Anti-infective — antiamoebic',
  'Anti-infective — anthelmintic',
  'Anti-infective — antibacterial',
  'Anti-infective — antifungal',
  'Anti-infective — antituberculosis',
  'Analgesics & antipyretics',
  'Cardiovascular',
  'Diuretics',
  'Gastrointestinal',
  'Respiratory',
  'Malaria',
  'Vitamins & minerals',
  'Antiseptics & disinfectants',
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

/** Adult list — AKS-EML 3rd Edition 2026 */
export const AKS_EML_ADULT: EmlMedicine[] = [
  m('a-hal', 'Halothane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-iso', 'Isoflurane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-n2o', 'Nitrous oxide', 'Inhalation: Medical gas', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-o2', 'Oxygen', 'Inhalation: Medical gas', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Medical gases' }),
  m('a-sev', 'Sevoflurane', 'Inhalation (volatile liquid): 250-mL bottle', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Inhalational' }),
  m('a-ket', 'Ketamine', 'Injection: 50 mg/mL in 10-mL vial; 100 mg/mL in 5-mL vial', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Injectable' }),
  m('a-pro', 'Propofol', 'Injection (emulsion): 10 mg/mL in 20-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Injectable' }),
  m('a-thio', 'Thiopental', 'Injection: 10 mg/mL; 20 mg/mL', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Injectable' }),
  m('a-bup', 'Bupivacaine', 'Injection: 0.25%; 0.5%. Spinal: 0.5% in 4-mL with 7.5% glucose', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Local' }),
  m('a-lid', 'Lidocaine', 'Injection: 1%; 2%. Spinal: 5% in 2-mL. Topical: 2%; 4% cream', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Local' }),
  m('a-lid-epi', 'Lidocaine + Epinephrine', 'Dental cartridge: 2% + epinephrine 1:80,000', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Local' }),
  m('a-atr', 'Atropine', 'Injection: 500 mcg–1 mg in 1-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-clon', 'Clonidine', 'Injection: 500 mcg in 1-mL ampoule. Tablet: 0.1 mg; 0.2 mg', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-diaz', 'Diazepam', 'Injection: 5 mg/mL in 2-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-mid', 'Midazolam', 'Injection: 1–2 mg/mL. Oral liquid: 2 mg/mL. Tablet: 7.5 mg; 15 mg', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-mor', 'Morphine', 'Injection: 10–15 mg in 1-mL; 0.5 mg/mL preservative-free', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-prom', 'Promethazine', 'Injection: 25 mg/mL. Suppository/oral liquid/tablet', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Preoperative' }),
  m('a-atrac', 'Atracurium', 'Injection: 10 mg/mL', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-neo', 'Neostigmine', 'Injection: 0.5–2.5 mg/mL in 1-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-panc', 'Pancuronium', 'Injection: 2 mg/mL', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-sux', 'Suxamethonium', 'Injection: 20–100 mg/mL in 2-mL ampoule', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-vec', 'Vecuronium', 'Powder for injection: 10 mg; 20 mg in vial', 'Anaesthetics & preoperative', 'adult', { subcategory: 'Muscle relaxants' }),
  m('a-adr', 'Adrenaline', 'Injection: 30 mcg/mL as Hydrochloride in 1-mL ampoule', 'Anaesthetics & preoperative', 'adult'),
  m('a-dex', 'Dexamethasone', 'Injection: 4 mg/mL in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'adult', { subcategory: 'Anti-anaphylactics' }),
  m('a-epi', 'Epinephrine (Adrenaline)', 'Injection: 1 mg in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'adult', { subcategory: 'Anti-anaphylactics' }),
  m('a-hc', 'Hydrocortisone', 'Powder for injection: 100 mg in vial', 'Antiallergics & anaphylaxis', 'adult', { subcategory: 'Anti-anaphylactics' }),
  m('a-pred', 'Prednisolone', 'Oral liquid: 5–15 mg/5 mL. Tablet: 5 mg; 25 mg', 'Antiallergics & anaphylaxis', 'adult'),
  m('a-carb', 'Carbamazepine', 'Tablet: 100 mg; 200 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-clnz', 'Clonazepam', 'Injection: 1 mg/mL. Oral liquid: 500 mcg/5 mL. Tablet: 500 mcg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-diaz2', 'Diazepam', 'Injection: 5 mg/mL in 2-mL. Tablets: 5 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-lev', 'Levetiracetam', 'Oral solution: 100 mg/mL. Tablet: 250–1000 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-lor', 'Lorazepam', 'Injection: 2–4 mg/mL in 1-mL ampoule', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-mgs', 'Magnesium sulfate', 'Injection: 50% in 2-mL; 20% in 5–10-mL ampoule', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-mid2', 'Midazolam', 'Oromucosal: 1–10 mg/mL ampoule', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-phb', 'Phenobarbital', 'Injection: 30–60 mg/mL. Oral liquid: 15–20 mg/mL. Tablet: 15–60 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-pht', 'Phenytoin sodium', 'Capsule: 25–300 mg. Injection: 50 mg/mL. Oral liquid: 125 mg/5 mL. Tablet: 25–100 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-pregab', 'Pregabalin', 'Capsule: 25–300 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-vpa', 'Sodium valproate', 'Oral liquid: 200–250 mg/5 mL. Tablet: 100–500 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-top', 'Topiramate', 'Capsule: 25–100 mg. Tablet: 25–200 mg', 'Anticonvulsants / antiepileptics', 'adult'),
  m('a-char', 'Charcoal (activated)', 'Capsule: 260 mg. Powder/granules: 5 g. Tablet: 250 mg', 'Antidotes & poisoning', 'adult', { subcategory: 'Non-specific' }),
  m('a-nac', 'Acetylcysteine', 'Injection: 200 mg/mL in 10-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-atrop', 'Atropine', 'Injection: 600 mcg–2 mg ampoules', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-caglu', 'Calcium gluconate', 'Injection: 100 mg/mL in 10-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-flu', 'Flumazenil', 'Injection: 0.1 mg/mL', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-meth', 'Methionine', 'Tablet: 250 mg', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-mb', 'Methylthioninium chloride', 'Injection: 10 mg/mL in 10-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-nal', 'Naloxone', 'Injection: 400 mcg in 1-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-k1', 'Phytomenadione (vitamin K1)', 'Injection: 10 mg/mL in 1-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-pfe', 'Potassium ferric hexacyanoferrate', 'Capsule: 500 mg. Powder for oral administration', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-prot', 'Protamine sulfate', 'Injection: 10 mg/mL in 5-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific' }),
  m('a-desf', 'Desferoxamine', 'Powder for injection: 500 mg in vial', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific', complementary: true }),
  m('a-dim', 'Dimercaprol', 'Injection: 50 mg/mL in 2-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific', complementary: true }),
  m('a-fom', 'Fomepizole', 'Injection: 5 mg/mL in 20-mL or 1 g/1.5-mL', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific', complementary: true }),
  m('a-edta', 'Sodium calcium edetate', 'Injection: 200 mg/mL in 5-mL ampoule', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific', complementary: true }),
  m('a-succ', 'Succimer', 'Capsule: 100 mg', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific', complementary: true }),
  m('a-pra', 'Pralidoxime', 'Injection solution: 300 mg/mL. Powder for injection: 1 g', 'Antidotes & poisoning', 'adult', { subcategory: 'Specific', complementary: true }),
  m('a-metro', 'Metronidazole', 'Oral liquid: 200 mg/5 mL. Tablet: 200–400 mg. Injection: 500 mg/100 mL', 'Anti-infective — antiamoebic', 'adult'),
  m('a-sec', 'Secnidazole', 'Oral granules: 2 g. Tablet: 500 mg', 'Anti-infective — antiamoebic', 'adult'),
  m('a-tin', 'Tinidazole', 'Tablet: 500 mg', 'Anti-infective — antiamoebic', 'adult'),
  m('a-alb', 'Albendazole', 'Tablet: 200–400 mg. Oral liquid: 100 mg/5 mL', 'Anti-infective — anthelmintic', 'adult'),
  m('a-dec', 'Diethylcarbamazine', 'Tablet: 50–100 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-ivm', 'Ivermectin', 'Tablet: 3 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-praz', 'Praziquantel', 'Tablet: 600 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-meb', 'Mebendazole', 'Oral liquid: 100 mg/5 mL. Tablet: 100–500 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-pyr', 'Pyrantel pamoate', 'Capsule: 180 mg. Oral suspension: 250 mg/5 mL. Chewable: 720.5 mg', 'Anti-infective — anthelmintic', 'adult'),
  m('a-oxa', 'Oxamniquine', 'Capsule: 250 mg. Oral liquid: 250 mg/5 mL', 'Anti-infective — anthelmintic', 'adult', { complementary: true, notes: 'When praziquantel fails' }),
  m('a-amx', 'Amoxicillin', 'Capsule: 250–500 mg. Powder for injection. Oral liquid: 125–250 mg/5 mL. Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-amxcla', 'Amoxicillin + Clavulanic acid', 'Oral liquid; Powder for injection; Tablet combinations', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-amp', 'Ampicillin', 'Capsule: 250–500 mg. Powder for injection: 500 mg; 1 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-benz', 'Benzathine benzylpenicillin', 'Powder for injection: 900 mg–1.44 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-bpen', 'Benzylpenicillin', 'Powder for injection: 600 mg–3 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-ceph', 'Cephalexin', 'Capsules: 250–500 mg. Oral suspension: 125–250 mg/5 mL', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-cli', 'Clindamycin', 'Capsule: 150 mg. Injection: 150 mg/mL', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-clox', 'Cloxacillin', 'Capsule: 250–500 mg. Powder for injection/oral solution', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-doxy', 'Doxycycline', 'Capsule: 100 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-flucl', 'Flucloxacillin', 'Capsule: 250–500 mg. Powder for oral liquid', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-gent', 'Gentamicin', 'Injection: 40 mg/mL in 2-mL ampoule', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-metro2', 'Metronidazole', 'Injection: 500 mg/100 mL. Tablet: 200–400 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-nitro', 'Nitrofurantoin', 'Tablet: 50–100 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-phenox', 'Phenoxymethylpenicillin', 'Powder for oral liquid: 250 mg/5 mL. Tablet: 250 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-cotri', 'Sulfamethoxazole + Trimethoprim', 'Injection; Oral liquid; Tablet combinations', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-tetra', 'Tetracycline', 'Capsule: 250 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Access group', awareGroup: 'access' }),
  m('a-azith', 'Azithromycin', 'Tablet: 250–500 mg. Powder for oral liquid: 200 mg/5 mL', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-cefix', 'Cefixime', 'Capsule: 200–400 mg. Oral liquid: 100 mg/5 mL. Tablet: 200–400 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-cefaz', 'Cefazolin', 'Powder for injection: 500 mg–2 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-cefpod', 'Cefpodoxime', 'Tablet: 200–400 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-ceftaz', 'Ceftazidime', 'Powder for injection: 250 mg–1 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-ceftri', 'Ceftriaxone', 'Powder for injection: 250 mg–1 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-cefuro', 'Cefuroxime', 'Powder for injection: 750 mg–1.5 g. Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-cipro', 'Ciprofloxacin', 'Injection infusion: 2 mg/mL. Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-clar', 'Clarithromycin', 'Suspension: 250 mg/5 mL. Tablet: 250–500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-ery', 'Erythromycin', 'Capsule: 250–500 mg. Cream; Powder for injection; Oral liquid; Tablet', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-levo', 'Levofloxacin', 'Injection: 5 mg/mL. Tablet: 250–750 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-oflox', 'Ofloxacin', 'Capsule: 200 mg. Injection: 100–200 mg. Tablet: 200 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-pip', 'Piperacillin + Tazobactam', 'Powder for injection: 2 g+250 mg to 4 g+500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Watch group', awareGroup: 'watch' }),
  m('a-ceftavi', 'Ceftazidime/Avibactam', 'Powder for injection: 2 g+500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Reserve group', awareGroup: 'reserve' }),
  m('a-col', 'Colistin', 'Powder for injection: 150 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Reserve group', awareGroup: 'reserve' }),
  m('a-imi', 'Imipenem + Cilastatin', 'Powder for injection: 250–500 mg + 250–500 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Reserve group', awareGroup: 'reserve' }),
  m('a-line', 'Linezolid', 'Solution for injection: 200–600 mg. Oral suspension; Tablet: 600 mg', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Reserve group', awareGroup: 'reserve' }),
  m('a-mero', 'Meropenem', 'Powder for injection: 500 mg–1 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Reserve group', awareGroup: 'reserve' }),
  m('a-vanc', 'Vancomycin', 'Capsule: 125–250 mg. Powder for injection: 250 mg–1 g', 'Anti-infective — antibacterial', 'adult', { subcategory: 'Reserve group', awareGroup: 'reserve' }),
  m('a-amph', 'Amphotericin B', 'Powder for injection: 50 mg in vial', 'Anti-infective — antifungal', 'adult'),
  m('a-clotri', 'Clotrimazole', 'Vaginal cream: 1–10%. Vaginal tablet: 100–500 mg', 'Anti-infective — antifungal', 'adult'),
  m('a-flucon', 'Fluconazole', 'Capsule: 50–200 mg. Injection: 2 mg/mL', 'Anti-infective — antifungal', 'adult'),
  m('a-micon', 'Miconazole', 'Cream: 2%. Pessary: 200–400 mg. Tablet: 250 mg', 'Anti-infective — antifungal', 'adult'),
  m('a-nyst', 'Nystatin', 'Lozenges; Oral liquid; Pessary; Tablet', 'Anti-infective — antifungal', 'adult'),
  m('a-vori', 'Voriconazole', 'Tablet: 50–200 mg. Powder for injection/oral liquid', 'Anti-infective — antifungal', 'adult'),
  m('a-itra', 'Itraconazole', 'Tablet: 200 mg', 'Anti-infective — antifungal', 'adult'),
  m('a-artem', 'Artemether', 'Injection: 80 mg/mL in 1-mL ampoule', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-al', 'Artemether + Lumefantrine', 'Tablet: 20+120 to 80+480 mg', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-arts', 'Artesunate', 'Powder for injection: 60 mg/mL', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-aaq', 'Artesunate + Amodiaquine', 'Tablet: 25+67.5 to 100+270 mg', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-apt', 'Artesunate + Pyronaridine', 'Tablet: 60+180 mg', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-dhap', 'Dihydroartemisinin + Piperaquine', 'Tablet: 20+160; 40+320 mg', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-quin', 'Quinine', 'Injection: 300 mg/mL. Tablet: 300 mg', 'Malaria', 'adult', { subcategory: 'Treatment' }),
  m('a-prog', 'Proguanil', 'Tablet: 100 mg', 'Malaria', 'adult', { subcategory: 'Prophylaxis' }),
  m('a-sp', 'Sulfadoxine + Pyrimethamine', 'Tablet: 500+25 mg', 'Malaria', 'adult', { subcategory: 'Prophylaxis' }),
  m('a-eth', 'Ethambutol', 'Tablet: 100–400 mg', 'Anti-infective — antituberculosis', 'adult', { subcategory: 'First line' }),
  m('a-inh', 'Isoniazid', 'Tablet: 100–300 mg', 'Anti-infective — antituberculosis', 'adult', { subcategory: 'First line' }),
  m('a-rif', 'Rifampicin', 'Capsule: 150–300 mg. Tablet: 150–300 mg', 'Anti-infective — antituberculosis', 'adult', { subcategory: 'First line' }),
  m('a-pza', 'Pyrazinamide', 'Tablet: 100–500 mg', 'Anti-infective — antituberculosis', 'adult', { subcategory: 'First line' }),
  m('a-strep', 'Streptomycin', 'Powder for injection: 1 g in vial', 'Anti-infective — antituberculosis', 'adult', { subcategory: 'First line' }),
  m('a-rhze', 'Isoniazid + Rifampicin + Ethambutol + Pyrazinamide', 'Tablet: 2-FDC combinations', 'Anti-infective — antituberculosis', 'adult', { subcategory: 'First line' }),
  m('a-para', 'Paracetamol', 'Oral liquid: 120–125 mg/5 mL. Suppository: 125–250 mg. Tablet: 500 mg', 'Analgesics & antipyretics', 'adult'),
  m('a-ibu', 'Ibuprofen', 'Tablet: 200–400 mg', 'Analgesics & antipyretics', 'adult'),
  m('a-sum', 'Sumatriptan', 'Tablet: 25–50 mg. Injection: 3 mg', 'Analgesics & antipyretics', 'adult', { subcategory: 'Migraine' }),
  m('a-ergo', 'Ergotamine', 'Tablet: 2 mg', 'Analgesics & antipyretics', 'adult', { subcategory: 'Migraine' }),
  m('a-amit', 'Amitriptyline', 'Tablet: 25 mg', 'Analgesics & antipyretics', 'adult', { subcategory: 'Migraine prophylaxis' }),
  m('a-prop', 'Propranolol', 'Tablet: 20–40 mg', 'Analgesics & antipyretics', 'adult', { subcategory: 'Migraine prophylaxis' }),
  m('a-bis', 'Bisoprolol', 'Tablet: 1.25–5 mg', 'Cardiovascular', 'adult', { subcategory: 'Anti-anginal' }),
  m('a-furo', 'Furosemide', 'Injection: 10 mg/mL. Tablet: 20–40 mg', 'Diuretics', 'adult'),
  m('a-hctz', 'Hydrochlorothiazide', 'Tablet: 25 mg', 'Diuretics', 'adult'),
  m('a-spiro', 'Spironolactone', 'Tablet: 25 mg', 'Diuretics', 'adult'),
  m('a-tors', 'Torsemide', 'Injection: 10 mg/mL. Tablet: 5–10 mg', 'Diuretics', 'adult'),
  m('a-amil', 'Amiloride + Hydrochlorothiazide', 'Tablet: 2.5+25; 5+50 mg', 'Diuretics', 'adult'),
  m('a-mann', 'Mannitol', 'Injectable solution: 10%; 20%', 'Diuretics', 'adult'),
  m('a-meto', 'Metoclopramide', 'Injection: 5 mg/mL. Oral liquid: 5 mg/5 mL. Tablet: 10 mg', 'Gastrointestinal', 'adult', { subcategory: 'Antiemetic' }),
  m('a-ond', 'Ondansetron', 'Injection: 2 mg/mL. Oral liquid: 4 mg/5 mL. Tablet: 4–8 mg', 'Gastrointestinal', 'adult', { subcategory: 'Antiemetic' }),
  m('a-ome', 'Omeprazole', 'Capsule: 10–20 mg. Powder for injection: 40 mg', 'Gastrointestinal', 'adult', { subcategory: 'Antiulcer' }),
  m('a-rabe', 'Rabeprazole', 'Tablet: 20 mg', 'Gastrointestinal', 'adult', { subcategory: 'Antiulcer' }),
  m('a-rani', 'Ranitidine', 'Injection: 25 mg/mL. Tablet: 150–300 mg', 'Gastrointestinal', 'adult', { subcategory: 'Antiulcer' }),
  m('a-ors', 'Oral rehydration salts', 'Powder for dilution WHO standard', 'Gastrointestinal', 'adult', { subcategory: 'Diarrhoea' }),
  m('a-lact', 'Lactulose', 'Oral liquid: 68%', 'Gastrointestinal', 'adult', { subcategory: 'Laxative' }),
  m('a-bisa', 'Bisacodyl', 'Suppository: 5–10 mg. Tablet: 5 mg', 'Gastrointestinal', 'adult', { subcategory: 'Laxative' }),
  m('a-senna', 'Senna', 'Oral liquid: 7.5 mg/5 mL. Tablet: 7.5 mg', 'Gastrointestinal', 'adult', { subcategory: 'Laxative' }),
  m('a-alum', 'Aluminium hydroxide + Magnesium hydroxide', 'Oral suspension', 'Gastrointestinal', 'adult', { subcategory: 'Antacid' }),
  m('a-salb', 'Salbutamol', 'Inhaler / nebuliser solution', 'Respiratory', 'adult'),
  m('a-ret', 'Retinol (Vitamin A)', 'Capsule: 100,000–200,000 IU', 'Vitamins & minerals', 'adult'),
  m('a-zn', 'Zinc sulfate', 'Tablet dispersible: 20 mg. Oral liquid', 'Vitamins & minerals', 'adult'),
  m('a-chx', 'Chlorhexidine', 'Gel: 4%. Solution: 5%', 'Antiseptics & disinfectants', 'adult'),
  m('a-povi', 'Povidone iodine', 'Solution: 10%', 'Antiseptics & disinfectants', 'adult'),
  m('a-iodo', 'Iodine', 'Weak solution of iodine: 1%', 'Antiseptics & disinfectants', 'adult'),
];

/** Children list — AKS-EMLc 1st Edition 2026 */
export const AKS_EML_CHILDREN: EmlMedicine[] = [
  m('c-hal', 'Halothane', 'Inhalation: 250-mL bottle', 'Anaesthetics & preoperative', 'children', { subcategory: 'Inhalational' }),
  m('c-iso', 'Isoflurane', 'Inhalation: 250-mL bottle', 'Anaesthetics & preoperative', 'children', { subcategory: 'Inhalational' }),
  m('c-n2o', 'Nitrous oxide', 'Inhalation: Medical gas', 'Anaesthetics & preoperative', 'children', { subcategory: 'Inhalational' }),
  m('c-o2', 'Oxygen', 'Inhalation: Medical gas — caution in neonates', 'Anaesthetics & preoperative', 'children', { subcategory: 'Medical gases' }),
  m('c-sev', 'Sevoflurane', 'Inhalation: 250-mL bottle', 'Anaesthetics & preoperative', 'children', { subcategory: 'Inhalational' }),
  m('c-ket', 'Ketamine', 'Injection: 50 mg/mL in 10-mL vial', 'Anaesthetics & preoperative', 'children', { subcategory: 'Injectable' }),
  m('c-pro', 'Propofol', 'Injection: 10–20 mg/mL — not for age < 3 years', 'Anaesthetics & preoperative', 'children', { subcategory: 'Injectable' }),
  m('c-thio', 'Thiopental', 'Injection: 10–20 mg/mL', 'Anaesthetics & preoperative', 'children', { subcategory: 'Injectable' }),
  m('c-bup', 'Bupivacaine', 'Injection: 0.25–0.5% — not recommended < 12 years', 'Anaesthetics & preoperative', 'children', { subcategory: 'Local' }),
  m('c-lid', 'Lidocaine', 'Injection: 1–2%. Topical: 2–4%', 'Anaesthetics & preoperative', 'children', { subcategory: 'Local' }),
  m('c-mid', 'Midazolam', 'Injection: 1 mg/mL. Oral liquid: 2 mg/mL. Tablet: 7.5–15 mg', 'Anaesthetics & preoperative', 'children', { subcategory: 'Preoperative' }),
  m('c-prom', 'Promethazine', 'Injection; Oral liquid; Suppository; Tablet', 'Anaesthetics & preoperative', 'children', { subcategory: 'Preoperative' }),
  m('c-dex', 'Dexamethasone', 'Injection: 4 mg/mL', 'Antiallergics & anaphylaxis', 'children'),
  m('c-epi', 'Epinephrine (Adrenaline)', 'Injection: 1 mg in 1-mL ampoule', 'Antiallergics & anaphylaxis', 'children'),
  m('c-amx', 'Amoxicillin', 'Capsule/Tablet: 250–500 mg. Dispersible; Powder for injection/oral liquid', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-amxcla', 'Amoxicillin + Clavulanic acid', 'Oral liquid paediatric; Powder for injection; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-amp', 'Ampicillin', 'Capsule; Powder for injection/oral liquid', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-benz', 'Benzathine benzylpenicillin', 'Powder for injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-bpen', 'Benzylpenicillin', 'Powder for injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-cefaz', 'Cefazolin', 'Powder for injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-ceph', 'Cephalexin', 'Capsules; Oral suspension', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-cli', 'Clindamycin', 'Capsule; Injection; Oral liquid', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-clox', 'Cloxacillin', 'Capsule; Powder for injection/oral solution', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-doxy', 'Doxycycline', 'Capsule; Oral liquid; Powder for injection — caution < 8 years', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-flucl', 'Flucloxacillin', 'Capsule; Powder for oral solution/injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-metro', 'Metronidazole', 'Injection; Oral liquid; Tablet', 'Anti-infective — antiamoebic', 'children'),
  m('c-nitro', 'Nitrofurantoin', 'Suspension; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-phenox', 'Phenoxymethylpenicillin', 'Powder for oral liquid; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-cotri', 'Sulfamethoxazole + Trimethoprim', 'Injection; Oral liquid; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
  m('c-azith', 'Azithromycin', 'Solid oral; Powder for oral liquid', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-cefix', 'Cefixime', 'Capsule; Oral liquid; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-cefot', 'Cefotaxime', 'Powder for injection — 3rd gen for hospitalized neonates', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-cefpod', 'Cefpodoxime', 'Oral suspension; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-ceftaz', 'Ceftazidime', 'Injection solution; Powder for injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-ceftri', 'Ceftriaxone', 'Powder for injection — caution hyperbilirubinaemia', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-cefuro', 'Cefuroxime', 'Oral suspension; Powder for injection; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-clar', 'Clarithromycin', 'Powder for injection/oral liquid; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'watch' }),
  m('c-line', 'Linezolid', 'Solution for injection; Oral suspension; Tablet', 'Anti-infective — antibacterial', 'children', { subcategory: 'reserve' }),
  m('c-vanc', 'Vancomycin', 'Capsule; Powder for injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'reserve' }),
  m('c-col', 'Colistin', 'Solution for injection', 'Anti-infective — antibacterial', 'children', { subcategory: 'reserve' }),
  m('c-alb', 'Albendazole', 'Oral liquid; Tablet', 'Anti-infective — anthelmintic', 'children'),
  m('c-al', 'Artemether + Lumefantrine', 'Dispersible tablet paediatric strengths', 'Malaria', 'children'),
  m('c-arts', 'Artesunate', 'Injection; rectal paediatric', 'Malaria', 'children'),
  m('c-ors', 'Oral rehydration salts', 'Powder WHO standard', 'Gastrointestinal', 'children'),
  m('c-zn', 'Zinc sulfate', 'Tablet dispersible 20 mg; Oral liquid', 'Vitamins & minerals', 'children'),
  m('c-vitA', 'Retinol (Vitamin A)', 'Capsule: 100,000–200,000 IU', 'Vitamins & minerals', 'children'),
  m('c-salb', 'Salbutamol', 'Inhaler / nebuliser (paediatric)', 'Respiratory', 'children'),
  m('c-para', 'Paracetamol', 'Oral liquid; Suppository; Tablet paediatric strengths', 'Analgesics & antipyretics', 'children'),
  m('c-gent', 'Gentamicin', 'Injection: 10–40 mg/mL', 'Anti-infective — antibacterial', 'children', { subcategory: 'access' }),
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

/** Seed facility inventory from official EML (adult primary + high-use children) */
export function emlAsSeedRows(audience: EmlAudience = 'adult'): Array<{
  name: string;
  genericName: string;
  strength: string;
  form: string;
  category: string;
  unitPriceNgn: number;
  reorderLevel: number;
  controlled: boolean;
}> {
  return listEml(audience).map((r) => {
    const forms = r.dosageForms;
    let form = 'Tablet';
    if (/Injection|Powder for injection/i.test(forms)) form = 'Injection';
    else if (/Capsule/i.test(forms)) form = 'Capsule';
    else if (/Oral liquid|Suspension|Syrup/i.test(forms)) form = 'Syrup';
    else if (/Cream|Ointment|Gel/i.test(forms)) form = 'Cream';
    else if (/Inhal/i.test(forms)) form = 'Inhaler';
    const strengthMatch = forms.match(/(\d[\d./]*\s*(?:mg|g|mcg|%|IU)[^.;,]*)/i);
    const strength = strengthMatch ? strengthMatch[1].trim().slice(0, 40) : '—';
    const controlled = /Morphine|Fentanyl|Pethidine|Tramadol|Diazepam|Midazolam|Phenobarbital/i.test(r.name);
    return {
      name: r.name,
      genericName: r.name.split('(')[0].trim(),
      strength,
      form,
      category: r.category,
      unitPriceNgn: 150,
      reorderLevel: controlled ? 20 : 50,
      controlled,
    };
  });
}

export const EML_META = {
  adult: {
    title: 'AKS Essential Medicines List — Adults',
    edition: '3rd Edition 2026',
    authority: 'Akwa Ibom State Ministry of Health',
    sourceFile: 'AKWA IBOM ADULT 16TH JUNE 2026.pdf',
  },
  children: {
    title: 'AKS Essential Medicines List — Children',
    edition: '1st Edition 2026',
    authority: 'Akwa Ibom State Ministry of Health',
    sourceFile: 'AKWA IBOM CHILDREN 16TH JUNE 2026.pdf',
  },
};
