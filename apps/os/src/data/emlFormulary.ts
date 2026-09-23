// Akwa Ibom State Essential Medicines List (AKS-EML)
// Adults 3rd Edition & Children 1st Edition 2026

export interface EmlMedication {
  id: string;
  name: string;
  category: string;
  forms: string[];
  strengths: string[];
  routes: string[];
  population: 'adult' | 'children' | 'both';
  aware?: 'Access' | 'Watch' | 'Reserve' | null;
  notes?: string;
}

export const AKS_EML_ITEMS: EmlMedication[] = [
  // Cardiovascular
  { id: 'EML-CV-001', name: 'Amlodipine', category: 'Cardiovascular', forms: ['Tablet'], strengths: ['5 mg', '10 mg'], routes: ['Oral'], population: 'adult', notes: 'First-line CCB for hypertension' },
  { id: 'EML-CV-002', name: 'Lisinopril', category: 'Cardiovascular', forms: ['Tablet'], strengths: ['5 mg', '10 mg', '20 mg'], routes: ['Oral'], population: 'adult', notes: 'ACE-Inhibitor for hypertension / heart failure' },
  { id: 'EML-CV-003', name: 'Furosemide', category: 'Cardiovascular', forms: ['Tablet', 'Injection'], strengths: ['40 mg', '20 mg/2 mL'], routes: ['Oral', 'IV', 'IM'], population: 'both', notes: 'Loop diuretic for fluid overload' },
  { id: 'EML-CV-004', name: 'Bisoprolol', category: 'Cardiovascular', forms: ['Tablet'], strengths: ['2.5 mg', '5 mg', '10 mg'], routes: ['Oral'], population: 'adult', notes: 'Cardioselective beta blocker' },
  { id: 'EML-CV-005', name: 'Spironolactone', category: 'Cardiovascular', forms: ['Tablet'], strengths: ['25 mg', '50 mg'], routes: ['Oral'], population: 'adult', notes: 'Aldosterone antagonist' },
  { id: 'EML-CV-006', name: 'Digoxin', category: 'Cardiovascular', forms: ['Tablet', 'Injection'], strengths: ['125 mcg', '250 mcg', '500 mcg/2 mL'], routes: ['Oral', 'IV'], population: 'both' },
  { id: 'EML-CV-007', name: 'Atorvastatin', category: 'Cardiovascular', forms: ['Tablet'], strengths: ['10 mg', '20 mg', '40 mg'], routes: ['Oral'], population: 'adult', notes: 'Lipid-lowering statin' },

  // Anti-Infectives (WHO AWaRe Classification)
  { id: 'EML-AI-001', name: 'Amoxicillin + Clavulanic Acid (Co-amoxiclav)', category: 'Anti-Infectives', forms: ['Tablet', 'Suspension', 'Injection'], strengths: ['625 mg', '1 g', '156.25 mg/5 mL', '1.2 g vial'], routes: ['Oral', 'IV'], population: 'both', aware: 'Access' },
  { id: 'EML-AI-002', name: 'Meropenem', category: 'Anti-Infectives', forms: ['Powder for injection'], strengths: ['500 mg', '1 g'], routes: ['IV'], population: 'both', aware: 'Watch', notes: 'Restricted to ICU / Severe sepsis / ESBL' },
  { id: 'EML-AI-003', name: 'Ceftriaxone', category: 'Anti-Infectives', forms: ['Powder for injection'], strengths: ['1 g vial', '2 g vial'], routes: ['IV', 'IM'], population: 'both', aware: 'Watch' },
  { id: 'EML-AI-004', name: 'Metronidazole', category: 'Anti-Infectives', forms: ['Tablet', 'Infusion', 'Suspension'], strengths: ['400 mg', '500 mg/100 mL', '200 mg/5 mL'], routes: ['Oral', 'IV'], population: 'both', aware: 'Access' },
  { id: 'EML-AI-005', name: 'Ciprofloxacin', category: 'Anti-Infectives', forms: ['Tablet', 'Infusion'], strengths: ['500 mg', '200 mg/100 mL'], routes: ['Oral', 'IV'], population: 'adult', aware: 'Watch' },
  { id: 'EML-AI-006', name: 'Artemether + Lumefantrine (ACT)', category: 'Anti-Infectives', forms: ['Tablet', 'Dispersible tablet'], strengths: ['20/120 mg', '80/480 mg'], routes: ['Oral'], population: 'both', aware: 'Access', notes: 'First-line uncomplicated malaria' },
  { id: 'EML-AI-007', name: 'Artesunate (Injectable)', category: 'Anti-Infectives', forms: ['Powder for injection'], strengths: ['60 mg vial', '120 mg vial'], routes: ['IV', 'IM'], population: 'both', aware: 'Access', notes: 'Severe complicated malaria protocol' },

  // Endocrine & Metabolic
  { id: 'EML-EN-001', name: 'Metformin', category: 'Endocrine', forms: ['Tablet', 'Extended release'], strengths: ['500 mg', '850 mg', '1000 mg'], routes: ['Oral'], population: 'adult', notes: 'First line Type 2 DM' },
  { id: 'EML-EN-002', name: 'Glibenclamide', category: 'Endocrine', forms: ['Tablet'], strengths: ['5 mg'], routes: ['Oral'], population: 'adult' },
  { id: 'EML-EN-003', name: 'Insulin (Soluble / Regular Human)', category: 'Endocrine', forms: ['Injection'], strengths: ['100 IU/mL vial'], routes: ['SC', 'IV'], population: 'both', notes: 'DKA and tight glycemic control' },
  { id: 'EML-EN-004', name: 'Insulin (Glargine / Long-acting)', category: 'Endocrine', forms: ['Cartridge / Pen'], strengths: ['100 IU/mL'], routes: ['SC'], population: 'both' },

  // Analgesics & Anaesthetics
  { id: 'EML-AN-001', name: 'Paracetamol', category: 'Analgesics', forms: ['Tablet', 'Syrup', 'IV Infusion'], strengths: ['500 mg', '125 mg/5 mL', '10 mg/mL (1 g)'], routes: ['Oral', 'IV', 'PR'], population: 'both' },
  { id: 'EML-AN-002', name: 'Diclofenac', category: 'Analgesics', forms: ['Tablet', 'Injection'], strengths: ['50 mg', '75 mg/3 mL'], routes: ['Oral', 'IM'], population: 'adult' },
  { id: 'EML-AN-003', name: 'Morphine Sulfate', category: 'Analgesics', forms: ['Injection', 'Tablet'], strengths: ['10 mg/mL', '15 mg', '30 mg'], routes: ['IV', 'IM', 'SC', 'Oral'], population: 'both', notes: 'Controlled substance — Severe pain / PACU' },
  { id: 'EML-AN-004', name: 'Tramadol', category: 'Analgesics', forms: ['Capsule', 'Injection'], strengths: ['50 mg', '100 mg/2 mL'], routes: ['Oral', 'IV', 'IM'], population: 'adult' },

  // Respiratory
  { id: 'EML-RS-001', name: 'Salbutamol', category: 'Respiratory', forms: ['Inhaler', 'Nebuliser solution', 'Tablet'], strengths: ['100 mcg/puff', '5 mg/mL', '4 mg'], routes: ['Inhalation', 'Oral'], population: 'both' },
  { id: 'EML-RS-002', name: 'Budesonide', category: 'Respiratory', forms: ['Inhaler', 'Nebuliser susp'], strengths: ['100 mcg', '200 mcg', '0.5 mg/2 mL'], routes: ['Inhalation'], population: 'both' },
  { id: 'EML-RS-003', name: 'Tiotropium', category: 'Respiratory', forms: ['Inhalation capsule'], strengths: ['18 mcg'], routes: ['Inhalation'], population: 'adult' },

  // Gastrointestinal
  { id: 'EML-GI-001', name: 'Omeprazole', category: 'Gastrointestinal', forms: ['Capsule', 'Powder for injection'], strengths: ['20 mg', '40 mg vial'], routes: ['Oral', 'IV'], population: 'both' },
  { id: 'EML-GI-002', name: 'Ondansetron', category: 'Gastrointestinal', forms: ['Tablet', 'Injection'], strengths: ['4 mg', '8 mg', '2 mg/mL'], routes: ['Oral', 'IV'], population: 'both' },
  { id: 'EML-GI-003', name: 'Oral Rehydration Salts (ORS)', category: 'Gastrointestinal', forms: ['Sachet for solution'], strengths: ['WHO Low-osmolarity formulation'], routes: ['Oral'], population: 'both' },
  { id: 'EML-GI-004', name: 'Zinc Sulfate', category: 'Gastrointestinal', forms: ['Dispersible tablet'], strengths: ['20 mg'], routes: ['Oral'], population: 'children' },
];

export function searchEml(query: string): EmlMedication[] {
  if (!query || query.trim().length === 0) return AKS_EML_ITEMS.slice(0, 10);
  const q = query.toLowerCase().trim();
  return AKS_EML_ITEMS.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.forms.some(f => f.toLowerCase().includes(q))
  );
}
