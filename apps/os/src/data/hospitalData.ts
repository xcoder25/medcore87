// Hospital OS Shared Clinical Data Store
// Aligned with Akwa Ibom State Health System & Gateway Specifications

export interface HospitalPatient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  dob: string;
  blood: string;
  ward: string;
  bed: string;
  status: 'stable' | 'critical' | 'review' | 'post-op' | 'waiting' | 'in-progress' | 'discharged';
  diagnoses: string[];
  allergies: string[];
  phone: string;
  nok: string;
  attending: string;
  admitDate: string | null;
  vitals: {
    bp: string;
    pulse: number;
    temp: number;
    spo2: number;
    rr: number;
    weight: number;
    height: number;
  };
  medications: string[];
  avatar?: string | null;
  type: 'inpatient' | 'outpatient';
}

export interface HospitalAppointment {
  id: string;
  time: string;
  patientId: string | null;
  name: string;
  type: string;
  status: 'waiting' | 'in-progress' | 'completed' | 'upcoming' | 'no-show';
  notes: string;
}

export interface WardInfo {
  code: string;
  name: string;
  occupancy: number;
  capacity: number;
  doctors: number;
  nurses: number;
  status: 'normal' | 'high' | 'surge' | 'critical';
}

export interface ClinicalNoteItem {
  id: string;
  patientId: string;
  title: string;
  type: string;
  date: string;
  time: string;
  author: string;
  content: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface HospitalTaskItem {
  id: string;
  patient?: string;
  task: string;
  due: string;
  priority: 'urgent' | 'high' | 'normal' | 'routine';
  done: boolean;
  role: 'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'reception' | 'admin';
  ward?: string;
}

export interface HospitalMessage {
  id: string;
  sender: string;
  senderRole: string;
  avatarInitials: string;
  channel: string;
  text: string;
  time: string;
  unread: boolean;
}

export interface HospitalNotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  category: 'critical' | 'lab' | 'bed' | 'rx' | 'system';
  read: boolean;
}

export interface RadiologyStudy {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US';
  bodyPart: string;
  studyDate: string;
  status: 'ordered' | 'in-progress' | 'reported' | 'critical';
  urgency: 'routine' | 'urgent' | 'stat';
  findings?: string;
  impression?: string;
  imageUrl?: string;
}

export interface ReferralItem {
  id: string;
  patientName: string;
  mrn: string;
  direction: 'inbound' | 'outbound';
  referringFacility: string;
  destinationFacility: string;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergency';
  clinicalSummary: string;
  date: string;
  status: 'pending' | 'accepted' | 'in-transit' | 'completed';
}

export const INITIAL_PATIENTS: HospitalPatient[] = [
  {
    id: 'P-001', mrn: 'MRN-20-14321', name: 'Mrs. Amaka Okafor',
    age: 52, sex: 'F', dob: '1972-04-14', blood: 'O+',
    ward: 'FMW', bed: '12', status: 'stable',
    diagnoses: ['Hypertensive Heart Disease', 'Type 2 Diabetes Mellitus'],
    allergies: ['Penicillin', 'Aspirin'],
    phone: '+234-803-111-0001', nok: 'Mr. C. Okafor (+234-803-111-0002)',
    attending: 'Dr. Adewale Bello', admitDate: '2026-09-15',
    vitals: { bp: '128/84', pulse: 78, temp: 36.8, spo2: 97, rr: 18, weight: 72, height: 162 },
    medications: ['Amlodipine 5mg OD', 'Metformin 500mg BD', 'Lisinopril 10mg OD'],
    type: 'inpatient',
  },
  {
    id: 'P-002', mrn: 'MRN-21-08834', name: 'Mr. Tunde Yusuf',
    age: 38, sex: 'M', dob: '1988-11-02', blood: 'A+',
    ward: 'ICU', bed: '3', status: 'critical',
    diagnoses: ['Septicemia', 'Acute Kidney Injury (AKI)'],
    allergies: ['Sulfonamides'],
    phone: '+234-803-222-0002', nok: 'Mrs. F. Yusuf (+234-803-222-0003)',
    attending: 'Dr. Adewale Bello', admitDate: '2026-09-16',
    vitals: { bp: '88/56', pulse: 118, temp: 38.9, spo2: 91, rr: 26, weight: 80, height: 178 },
    medications: ['Meropenem 1g TDS', 'Noradrenaline infusion 0.1mcg/kg/min', 'Pantoprazole 40mg OD'],
    type: 'inpatient',
  },
  {
    id: 'P-003', mrn: 'MRN-22-03291', name: 'Baby Emmanuel John',
    age: 0, sex: 'M', dob: '2026-09-10', blood: 'B+',
    ward: 'NICU', bed: '5', status: 'stable',
    diagnoses: ['Neonatal Jaundice', 'Prematurity (34 weeks)'],
    allergies: [],
    phone: '+234-803-333-0004', nok: 'Mrs. Grace John (+234-803-333-0004)',
    attending: 'Dr. Adewale Bello', admitDate: '2026-09-10',
    vitals: { bp: '65/40', pulse: 142, temp: 37.0, spo2: 98, rr: 42, weight: 2.1, height: 44 },
    medications: ['Continuous Phototherapy', 'IV Glucose 10% infusion'],
    type: 'inpatient',
  },
  {
    id: 'P-004', mrn: 'MRN-19-55102', name: 'Mrs. Rose Daniels',
    age: 44, sex: 'F', dob: '1982-06-30', blood: 'AB-',
    ward: 'O&G', bed: '8', status: 'review',
    diagnoses: ['Post-operative Caesarean Section', 'Puerperal pyrexia watch'],
    allergies: ['Latex'],
    phone: '+234-803-444-0005', nok: 'Mr. Sam Daniels (+234-803-444-0006)',
    attending: 'Dr. Adewale Bello', admitDate: '2026-09-17',
    vitals: { bp: '120/78', pulse: 82, temp: 37.4, spo2: 99, rr: 16, weight: 68, height: 165 },
    medications: ['Co-amoxiclav 625mg TDS', 'Metronidazole 500mg TDS', 'Diclofenac 50mg BD'],
    type: 'inpatient',
  },
  {
    id: 'P-005', mrn: 'MRN-23-00178', name: 'Mr. Lawal Musa',
    age: 60, sex: 'M', dob: '1966-01-22', blood: 'O-',
    ward: 'SRG', bed: '2', status: 'post-op',
    diagnoses: ['Carcinoma of Prostate', 'Post-radical Prostatectomy Day 2'],
    allergies: ['Codeine'],
    phone: '+234-803-555-0007', nok: 'Mrs. H. Musa (+234-803-555-0008)',
    attending: 'Dr. Adewale Bello', admitDate: '2026-09-14',
    vitals: { bp: '135/85', pulse: 74, temp: 37.1, spo2: 98, rr: 17, weight: 78, height: 172 },
    medications: ['Morphine 5mg PCA', 'Enoxaparin 40mg OD SC', 'Omeprazole 20mg OD'],
    type: 'inpatient',
  },
  {
    id: 'P-006', mrn: 'MRN-20-62844', name: 'Mr. Ibrahim Suleiman',
    age: 45, sex: 'M', dob: '1981-03-10', blood: 'A-',
    ward: 'OPD', bed: '—', status: 'waiting',
    diagnoses: ['Chronic Obstructive Pulmonary Disease (COPD)'],
    allergies: [],
    phone: '+234-803-666-0009', nok: 'Mrs. K. Suleiman (+234-803-666-0010)',
    attending: 'Dr. Adewale Bello', admitDate: null,
    vitals: { bp: '130/88', pulse: 86, temp: 36.9, spo2: 94, rr: 20, weight: 75, height: 170 },
    medications: ['Salbutamol inhaler 2 puffs PRN', 'Tiotropium 18mcg OD'],
    type: 'outpatient',
  },
  {
    id: 'P-007', mrn: 'MRN-25-00042', name: 'Mrs. Fatima Bello',
    age: 33, sex: 'F', dob: '1993-07-18', blood: 'B-',
    ward: 'OPD', bed: '—', status: 'in-progress',
    diagnoses: ['Gestational Diabetes Mellitus', 'Anaemia in Pregnancy'],
    allergies: ['NSAIDs'],
    phone: '+234-803-777-0011', nok: 'Mr. Ahmed Bello (+234-803-777-0012)',
    attending: 'Dr. Adewale Bello', admitDate: null,
    vitals: { bp: '118/72', pulse: 92, temp: 36.6, spo2: 99, rr: 16, weight: 63, height: 158 },
    medications: ['Ferrous Sulphate 200mg TDS', 'Folic Acid 5mg OD', 'Metformin 500mg BD'],
    type: 'outpatient',
  },
  {
    id: 'P-008', mrn: 'MRN-18-30091', name: 'Chief Emmanuel Okoro',
    age: 71, sex: 'M', dob: '1955-12-01', blood: 'O+',
    ward: 'MMW', bed: '14', status: 'stable',
    diagnoses: ['Congestive Cardiac Failure (NYHA III)', 'Atrial Fibrillation'],
    allergies: ['Warfarin'],
    phone: '+234-803-888-0013', nok: 'Mrs. B. Okoro (+234-803-888-0014)',
    attending: 'Dr. Adewale Bello', admitDate: '2026-09-12',
    vitals: { bp: '145/92', pulse: 98, temp: 36.7, spo2: 95, rr: 20, weight: 88, height: 175 },
    medications: ['Furosemide 40mg BD', 'Digoxin 125mcg OD', 'Spironolactone 25mg OD', 'Bisoprolol 2.5mg OD'],
    type: 'inpatient',
  },
];

export const INITIAL_WARDS: WardInfo[] = [
  { code: 'A&E', name: 'Accident & Emergency', occupancy: 16, capacity: 32, doctors: 4, nurses: 8, status: 'surge' },
  { code: 'MMW', name: 'Male Medical Ward', occupancy: 28, capacity: 48, doctors: 2, nurses: 6, status: 'high' },
  { code: 'FMW', name: 'Female Medical Ward', occupancy: 24, capacity: 48, doctors: 2, nurses: 6, status: 'normal' },
  { code: 'O&G', name: 'Obstetrics & Gynaecology', occupancy: 18, capacity: 36, doctors: 3, nurses: 7, status: 'normal' },
  { code: 'SRG', name: 'Surgical Ward', occupancy: 22, capacity: 36, doctors: 3, nurses: 6, status: 'normal' },
  { code: 'PED', name: 'Paediatric Ward', occupancy: 14, capacity: 24, doctors: 2, nurses: 5, status: 'normal' },
  { code: 'ICU', name: 'Intensive Care Unit', occupancy: 7, capacity: 8, doctors: 3, nurses: 6, status: 'critical' },
  { code: 'NICU', name: 'Neonatal ICU', occupancy: 9, capacity: 12, doctors: 2, nurses: 5, status: 'high' },
];

export const INITIAL_APPOINTMENTS: HospitalAppointment[] = [
  { id: 'APT-001', time: '09:00', patientId: 'P-006', name: 'Mr. Ibrahim Suleiman', type: 'Follow-up', status: 'waiting', notes: 'COPD review, check spirometry & peak flow' },
  { id: 'APT-002', time: '09:45', patientId: 'P-007', name: 'Mrs. Fatima Bello', type: 'Consultation', status: 'in-progress', notes: 'ANC review – 32 weeks, gestational diabetes' },
  { id: 'APT-003', time: '11:00', patientId: 'P-008', name: 'Chief Emmanuel Okoro', type: 'Ward Round', status: 'waiting', notes: 'CCF fluid balance review' },
  { id: 'APT-004', time: '12:00', patientId: 'P-001', name: 'Mrs. Amaka Okafor', type: 'Review', status: 'waiting', notes: 'Post-admission review & titration' },
  { id: 'APT-005', time: '14:00', patientId: null, name: 'Mr. Chukwudi Eze', type: 'New Patient', status: 'upcoming', notes: 'Referred from PHC Ikot Ekpene for DM evaluation' },
  { id: 'APT-006', time: '15:30', patientId: null, name: 'Mrs. Uche Lawal', type: 'Consultation', status: 'upcoming', notes: 'Thyroid nodule – Ultrasound result review' },
  { id: 'APT-007', time: '16:00', patientId: 'P-005', name: 'Mr. Lawal Musa', type: 'Review', status: 'completed', notes: 'Post-prostatectomy Day 2 catheter inspection' },
];

export const INITIAL_CLINICAL_NOTES: ClinicalNoteItem[] = [
  {
    id: 'CN-001',
    patientId: 'P-001',
    title: 'Ward Round — Hypertension & Diabetes Review',
    type: 'SOAP Note',
    date: '2026-09-18',
    time: '10:30',
    author: 'Dr. Adewale Bello',
    content: 'Patient reports mild morning dizziness. No chest pain or dyspnoea. Fasting BGL was 7.8 mmol/L.',
    subjective: 'Patient reports mild morning headache and dizziness upon standing. Denies chest pain, palpitations, or orthopnea. Compliance with Metformin confirmed.',
    objective: 'BP 128/84 mmHg, HR 78 bpm regular. Chest clear bilaterally. Abdomen soft, non-tender. Mild bilateral ankle oedema (+1). Fasting BGL: 7.8 mmol/L.',
    assessment: '1. Essential Hypertension — controlled on current regimen.\n2. Type 2 Diabetes Mellitus — suboptimal glycemic control.',
    plan: '1. Continue Amlodipine 5mg OD.\n2. Increase Metformin to 850mg BD with meals.\n3. Request HbA1c and Serum Electrolytes / Creatinine.\n4. Dietary counselling for salt and carbohydrate restriction.',
  },
  {
    id: 'CN-002',
    patientId: 'P-002',
    title: 'ICU Critical Care Resuscitation Encounter',
    type: 'Critical Care Note',
    date: '2026-09-18',
    time: '08:15',
    author: 'Dr. Adewale Bello',
    content: 'Septic shock secondary to urosepsis with AKI. Resuscitation protocol initiated with noradrenaline.',
    subjective: 'Intubated and sedated on ventilator. Nursing reports MAP maintained between 65-70 mmHg with noradrenaline titration.',
    objective: 'BP 88/56 mmHg on noradrenaline 0.12 mcg/kg/min. Pulse 118 bpm sinus. Temp 38.9°C. SpO2 91% on FiO2 0.5. Urine output 25 mL/hr over last 4 hours.',
    assessment: 'Severe Septic Shock with Multiorgan Dysfunction (AKI stage 2).',
    plan: '1. Continue Meropenem 1g TDS.\n2. Target MAP > 65 mmHg.\n3. Monitor arterial blood gas q4h.\n4. Nephrology consult for possible continuous veno-venous hemodiafiltration (CVVH).',
  },
  {
    id: 'CN-003',
    patientId: 'P-008',
    title: 'Cardiology Review — Heart Failure Inpatient',
    type: 'Progress Note',
    date: '2026-09-17',
    time: '14:20',
    author: 'Dr. Adewale Bello',
    content: 'CCF exacerbation improving after IV Furosemide. Peripheral oedema decreased from +3 to +1.',
    subjective: 'Breathing much easier when lying flat (orthopnea improved). No nocturnal coughing paroxysms.',
    objective: 'BP 140/88 mmHg, HR 88 bpm irregularly irregular (AF). JVP elevated 3cm. Bilateral basilar crackles reduced.',
    assessment: 'CCF with AF — resolving decompensation.',
    plan: '1. Switch IV Furosemide to oral Furosemide 40mg BD.\n2. Maintain Digoxin 125mcg OD.\n3. Daily weights and strict fluid restriction to 1.5L/24hr.',
  },
];

export const INITIAL_TASKS: HospitalTaskItem[] = [
  { id: 'TSK-01', patient: 'Mr. Tunde Yusuf (ICU-3)', task: 'Review arterial blood gas & lactate repeat', due: '10:00', priority: 'urgent', done: false, role: 'doctor', ward: 'ICU' },
  { id: 'TSK-02', patient: 'Mrs. Amaka Okafor (FMW-12)', task: 'Review fasting lipid profile & adjust statin', due: '11:30', priority: 'normal', done: false, role: 'doctor', ward: 'FMW' },
  { id: 'TSK-03', patient: 'Chief Emmanuel Okoro (MMW-14)', task: 'Cardiology echocardiogram sign-off', due: '13:00', priority: 'high', done: false, role: 'doctor', ward: 'MMW' },
  { id: 'TSK-04', patient: 'Mr. Lawal Musa (SRG-2)', task: 'Review surgical wound & remove drain if < 30mL', due: '12:00', priority: 'normal', done: false, role: 'doctor', ward: 'SRG' },
  { id: 'TSK-05', patient: 'Mr. Tunde Yusuf (ICU-3)', task: 'Titrate noradrenaline infusion to maintain MAP > 65', due: 'Now', priority: 'urgent', done: false, role: 'nurse', ward: 'ICU' },
  { id: 'TSK-06', patient: 'Mrs. Amaka Okafor (FMW-12)', task: 'Administer Metformin 500mg + Amlodipine 5mg', due: '10:00', priority: 'routine', done: false, role: 'nurse', ward: 'FMW' },
  { id: 'TSK-07', patient: 'Baby Emmanuel John (NICU-5)', task: 'Check transcutaneous bilirubin & eye protection', due: '10:15', priority: 'high', done: false, role: 'nurse', ward: 'NICU' },
  { id: 'TSK-08', patient: 'Mrs. Rose Daniels (O&G-8)', task: 'Post-caesarean wound dressing & pain score', due: '11:00', priority: 'routine', done: false, role: 'nurse', ward: 'O&G' },
  { id: 'TSK-09', patient: 'Mr. Tunde Yusuf', task: 'Dispense Meropenem 1g IV vials ×6 (Urgent)', due: 'Now', priority: 'urgent', done: false, role: 'pharmacist', ward: 'ICU' },
  { id: 'TSK-10', patient: 'Mrs. Amaka Okafor', task: 'Dispense Amlodipine 5mg & Metformin 500mg refill', due: '11:00', priority: 'routine', done: false, role: 'pharmacist', ward: 'FMW' },
  { id: 'TSK-11', patient: 'Baby Emmanuel John', task: 'Run serum total & direct bilirubin on automated analyzer', due: 'Now', priority: 'urgent', done: false, role: 'lab', ward: 'NICU' },
  { id: 'TSK-12', patient: 'Mr. Tunde Yusuf', task: 'Blood culture & sensitivity 24-hr preliminary report', due: '12:00', priority: 'urgent', done: false, role: 'lab', ward: 'ICU' },
  { id: 'TSK-13', patient: 'Mrs. Blessing Okon', task: 'Complete NHIA insurance registration & biometrics', due: '10:30', priority: 'routine', done: false, role: 'reception', ward: 'OPD' },
  { id: 'TSK-14', patient: 'Mr. David Etuk', task: 'Admit emergency transfer patient to Male Medical Ward', due: 'Now', priority: 'urgent', done: false, role: 'reception', ward: 'A&E' },
  { id: 'TSK-15', task: 'Reconcile daily bed census with ward nursing sisters', due: '14:00', priority: 'normal', done: false, role: 'admin', ward: 'ADMIN' },
  { id: 'TSK-16', task: 'Approve medical oxygen delivery manifest for Central Store', due: '15:00', priority: 'high', done: false, role: 'admin', ward: 'ADMIN' },
];

export const INITIAL_MESSAGES: HospitalMessage[] = [
  {
    id: 'MSG-01',
    sender: 'Nurse Chioma Okeke',
    senderRole: 'Senior Nursing Officer',
    avatarInitials: 'CO',
    channel: 'Inpatient Wards Handover',
    text: 'Doctor, Chief Emmanuel Okoro (MMW Bed 14) has mild ankle swelling today, but dyspnea has resolved.',
    time: '09:14',
    unread: true,
  },
  {
    id: 'MSG-02',
    sender: 'Pharm. Ibrahim Musa',
    senderRole: 'Principal Pharmacist',
    avatarInitials: 'IM',
    channel: 'Pharmacy Direct',
    text: 'Meropenem 1g for Yusuf (ICU-3) has been prepared and sent via pneumatic dispatch.',
    time: '08:58',
    unread: true,
  },
  {
    id: 'MSG-03',
    sender: 'Mr. Emeka Nwosu',
    senderRole: 'Senior Lab Scientist',
    avatarInitials: 'EN',
    channel: 'Lab Critical Alerts',
    text: 'CRITICAL VALUE ALERT: Baby Emmanuel John serum bilirubin is 265 umol/L. Escalating to Paediatric team.',
    time: '08:45',
    unread: false,
  },
  {
    id: 'MSG-04',
    sender: 'A&E Triage Desk',
    senderRole: 'Emergency Dispatch',
    avatarInitials: 'AE',
    channel: 'Emergency Team',
    text: 'Inbound ambulance transfer from Cottage Hospital Asong arriving in 15 minutes. Severe RTA with head trauma.',
    time: '08:30',
    unread: false,
  },
];

export const INITIAL_NOTIFICATIONS: HospitalNotificationItem[] = [
  { id: 'NOTIF-01', title: 'Critical Lab Alert', body: 'Baby Emmanuel John: Bilirubin 265 umol/L (Critical Threshold)', time: '12m ago', category: 'critical', read: false },
  { id: 'NOTIF-02', title: 'Medication Dispensed', body: 'Meropenem 1g IV delivered to ICU Bed 3 for Tunde Yusuf', time: '28m ago', category: 'rx', read: false },
  { id: 'NOTIF-03', title: 'Emergency Transfer Inbound', body: 'EMS Ambulance Unit #4 en route from Asong with trauma case', time: '42m ago', category: 'bed', read: false },
  { id: 'NOTIF-04', title: 'Ward Capacity Alert', body: 'Male Medical Ward (MMW) at 93% occupancy — 3 beds remaining', time: '1h ago', category: 'system', read: true },
  { id: 'NOTIF-05', title: 'NHIA HMO Authorization', body: 'Claims pre-auth approved for Mrs. Amaka Okafor (AKSHIA-4821)', time: '2h ago', category: 'system', read: true },
];

export const INITIAL_RADIOLOGY: RadiologyStudy[] = [
  {
    id: 'RAD-01',
    patientId: 'P-001',
    patientName: 'Mrs. Amaka Okafor',
    mrn: 'MRN-20-14321',
    modality: 'XR',
    bodyPart: 'Chest PA & Lateral',
    studyDate: '2026-09-17',
    status: 'reported',
    urgency: 'routine',
    findings: 'Cardiothoracic ratio is mildly increased (0.54). Lung fields are clear of focal consolidation. Costophrenic angles sharp. No pneumothorax.',
    impression: 'Mild cardiomegaly secondary to hypertensive heart disease. No acute pulmonary congestion.',
    imageUrl: '/placeholder-xray.png',
  },
  {
    id: 'RAD-02',
    patientId: 'P-002',
    patientName: 'Mr. Tunde Yusuf',
    mrn: 'MRN-21-08834',
    modality: 'CT',
    bodyPart: 'Abdomen & Pelvis with IV Contrast',
    studyDate: '2026-09-18',
    status: 'reported',
    urgency: 'stat',
    findings: 'Bilateral kidneys show perinephric fat stranding and patchy hypo-enhancement. Bladder wall thickened. No calculus or hydronephrosis.',
    impression: 'Severe acute pyelonephritis with bilateral renal inflammation and signs of sepsis. Correlate with clinical AKI.',
    imageUrl: '/placeholder-ct.png',
  },
  {
    id: 'RAD-03',
    patientId: 'P-006',
    patientName: 'Mr. Ibrahim Suleiman',
    mrn: 'MRN-20-62844',
    modality: 'XR',
    bodyPart: 'Chest PA',
    studyDate: '2026-09-18',
    status: 'in-progress',
    urgency: 'urgent',
    findings: 'Pending senior radiologist sign-off. Hyperinflated lung fields with flattened diaphragms noted.',
    impression: 'Chronic obstructive airway changes.',
  },
  {
    id: 'RAD-04',
    patientId: 'P-005',
    patientName: 'Mr. Lawal Musa',
    mrn: 'MRN-23-00178',
    modality: 'US',
    bodyPart: 'Pelvic & Urinary Tract Ultrasound',
    studyDate: '2026-09-15',
    status: 'reported',
    urgency: 'routine',
    findings: 'Post-surgical prostatic bed clean without hematoma or fluid collection. Catheter balloon properly positioned in bladder.',
    impression: 'Satisfactory post-operative appearance following radical prostatectomy.',
  },
];

export const INITIAL_REFERRALS: ReferralItem[] = [
  {
    id: 'REF-001',
    patientName: 'Master Kufre Akpan',
    mrn: 'MRN-26-00412',
    direction: 'inbound',
    referringFacility: 'Cottage Hospital, Asong',
    destinationFacility: 'Ibom Specialist Hospital, Uyo',
    specialty: 'Neurosurgery / Trauma',
    priority: 'emergency',
    clinicalSummary: 'Severe RTA with loss of consciousness GCS 8/15. Unequal pupils. Suspected epidural hematoma.',
    date: '2026-09-18',
    status: 'in-transit',
  },
  {
    id: 'REF-002',
    patientName: 'Mrs. Idorenyin Bassey',
    mrn: 'MRN-24-09188',
    direction: 'outbound',
    referringFacility: 'Ibom Specialist Hospital, Uyo',
    destinationFacility: 'University of Uyo Teaching Hospital (UUTH)',
    specialty: 'Cardiothoracic Surgery',
    priority: 'urgent',
    clinicalSummary: 'Rheumatic Heart Disease with severe mitral stenosis & pulmonary hypertension for surgical valve replacement.',
    date: '2026-09-16',
    status: 'accepted',
  },
  {
    id: 'REF-003',
    patientName: 'Mr. Etebong Okon',
    mrn: 'MRN-21-04221',
    direction: 'inbound',
    referringFacility: 'General Hospital, Ikot Ekpene',
    destinationFacility: 'Ibom Specialist Hospital, Uyo',
    specialty: 'Oncology / Histopathology',
    priority: 'routine',
    clinicalSummary: 'Colonic mass biopsy specimen review and staging CT evaluation.',
    date: '2026-09-15',
    status: 'completed',
  },
];
