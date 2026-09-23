/* ============================================================
   HOSPITAL OS — MOCK DATA STORE
   All patient, appointment, lab, medication, task, message data
   ============================================================ */
window.HOS_DATA = (() => {

  const AVATARS = [
    'assets/img/doctor_profile.jpg', // 0 = doctor
  ];

  // Avatar colour palette for initials
  const AVATAR_COLORS = [
    '#1A6EB5','#00B4A6','#8B5CF6','#E53935','#F59E0B',
    '#10B981','#3B82F6','#EC4899','#0891B2','#65A30D'
  ];

  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }

  function initials(name) {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0,2);
  }

  // ── MULTI-ROLE STAFF PROFILES ────────────────────────────
  const staff = {
    doctor: {
      id: 'DOC-00421', role: 'doctor', name: 'Dr. Adewale Bello',
      firstName: 'Adewale', lastName: 'Bello', prefix: 'Dr.',
      specialty: 'General Physician', department: 'Internal Medicine',
      grade: 'Consultant', license: 'MDCN/R/83421',
      phone: '+234-803-000-0001', email: 'a.bello@ibomspecialist.gov.ng',
      avatar: 'assets/img/doctor_profile.jpg', ward: 'MMW',
      status: 'on-duty', shift: '08:00 – 16:00', color: '#1A6EB5',
    },
    nurse: {
      id: 'NRS-01842', role: 'nurse', name: 'Nurse Chioma Okeke',
      firstName: 'Chioma', lastName: 'Okeke', prefix: 'Ns.',
      specialty: 'Ward Nursing', department: 'Medical Ward',
      grade: 'Senior Nursing Officer', license: 'NMCN/NS/22910',
      phone: '+234-803-000-0011', email: 'c.okeke@ibomspecialist.gov.ng',
      avatar: null, ward: 'FMW',
      status: 'on-duty', shift: '07:00 – 19:00', color: '#00B4A6',
    },
    pharmacist: {
      id: 'PHR-00733', role: 'pharmacist', name: 'Pharm. Ibrahim Musa',
      firstName: 'Ibrahim', lastName: 'Musa', prefix: 'Pharm.',
      specialty: 'Clinical Pharmacy', department: 'Pharmacy',
      grade: 'Principal Pharmacist', license: 'PCN/R/44102',
      phone: '+234-803-000-0022', email: 'i.musa@ibomspecialist.gov.ng',
      avatar: null, ward: 'PHARM',
      status: 'on-duty', shift: '08:00 – 16:00', color: '#8B5CF6',
    },
    lab: {
      id: 'LAB-00591', role: 'lab', name: 'Mr. Emeka Nwosu',
      firstName: 'Emeka', lastName: 'Nwosu', prefix: 'Mr.',
      specialty: 'Medical Laboratory Science', department: 'Pathology',
      grade: 'Senior MLS', license: 'MLSCN/R/11834',
      phone: '+234-803-000-0033', email: 'e.nwosu@ibomspecialist.gov.ng',
      avatar: null, ward: 'LAB',
      status: 'on-duty', shift: '08:00 – 16:00', color: '#F59E0B',
    },
    reception: {
      id: 'RCP-01208', role: 'reception', name: 'Mrs. Funke Adeyemi',
      firstName: 'Funke', lastName: 'Adeyemi', prefix: 'Mrs.',
      specialty: 'Patient Registration', department: 'Front Desk',
      grade: 'Senior Records Officer', license: '—',
      phone: '+234-803-000-0044', email: 'f.adeyemi@ibomspecialist.gov.ng',
      avatar: null, ward: 'OPD',
      status: 'on-duty', shift: '07:30 – 16:30', color: '#EC4899',
    },
    admin: {
      id: 'ADM-00001', role: 'admin', name: 'Mr. Chinedu Okoro',
      firstName: 'Chinedu', lastName: 'Okoro', prefix: 'Mr.',
      specialty: 'Hospital Administration', department: 'Operations',
      grade: 'Hospital Administrator', license: '—',
      phone: '+234-803-000-0055', email: 'c.okoro@ibomspecialist.gov.ng',
      avatar: null, ward: 'ADMIN',
      status: 'on-duty', shift: '08:00 – 17:00', color: '#0D4F8B',
    },
  };

  let currentUser = staff.doctor;
  const doctor = staff.doctor; // backward-compat for existing pages

  // ── ROLE-SPECIFIC OPERATIONAL DATA ───────────────────────
  const queues = { opdWaiting: 14, triage: 6, pharmacy: 9, lab: 11, radiology: 5, billing: 7 };

  const pharmacyQueue = [
    { id:'RXQ-01', patient:'Mrs. Amaka Okafor', mrn:'MRN-20-14321', drugs:'Amlodipine 5mg ×30', status:'pending', priority:'routine', time:'08:42' },
    { id:'RXQ-02', patient:'Mr. Tunde Yusuf', mrn:'MRN-21-08834', drugs:'Meropenem 1g ×6', status:'dispensing', priority:'urgent', time:'08:55' },
    { id:'RXQ-03', patient:'Mrs. Grace John', mrn:'MRN-22-03291', drugs:'Phototherapy supplies', status:'ready', priority:'routine', time:'09:10' },
    { id:'RXQ-04', patient:'Mr. Kelechi Eze', mrn:'MRN-19-07712', drugs:'Insulin Glargine + Metformin', status:'pending', priority:'high', time:'09:22' },
    { id:'RXQ-05', patient:'Miss Adaobi Nnamdi', mrn:'MRN-23-00188', drugs:'Paracetamol syrup + Amoxil', status:'pending', priority:'routine', time:'09:35' },
  ];

  const labQueue = [
    { id:'LABQ-01', patient:'Mr. Tunde Yusuf', mrn:'MRN-21-08834', tests:'FBC, U&E, CRP, Blood Culture', status:'processing', priority:'critical', time:'08:30' },
    { id:'LABQ-02', patient:'Mrs. Amaka Okafor', mrn:'MRN-20-14321', tests:'HbA1c, Lipid Profile', status:'received', priority:'routine', time:'09:05' },
    { id:'LABQ-03', patient:'Baby Emmanuel John', mrn:'MRN-22-03291', tests:'Serum Bilirubin (TSB)', status:'processing', priority:'urgent', time:'09:15' },
    { id:'LABQ-04', patient:'Mr. Kelechi Eze', mrn:'MRN-19-07712', tests:'RBS, Ketones', status:'completed', priority:'high', time:'09:28' },
    { id:'LABQ-05', patient:'Mrs. Ngozi Uche', mrn:'MRN-18-05421', tests:'Malaria Parasite, Widal', status:'received', priority:'routine', time:'09:40' },
  ];

  const bedBoard = [
    { ward:'ICU', total:8, occupied:7, critical:3, available:1 },
    { ward:'FMW', total:24, occupied:19, critical:1, available:5 },
    { ward:'MMW', total:28, occupied:22, critical:2, available:6 },
    { ward:'NICU', total:12, occupied:9, critical:2, available:3 },
    { ward:'Maternity', total:16, occupied:11, critical:0, available:5 },
    { ward:'Surgical', total:20, occupied:15, critical:1, available:5 },
  ];

  const nursingTasks = [
    { id:'NT-01', patient:'Mr. Tunde Yusuf', task:'Vital signs q1h', due:'Now', priority:'urgent', done:false, ward:'ICU' },
    { id:'NT-02', patient:'Mrs. Amaka Okafor', task:'Administer Amlodipine 5mg', due:'10:00', priority:'routine', done:false, ward:'FMW' },
    { id:'NT-03', patient:'Baby Emmanuel John', task:'Phototherapy check', due:'10:15', priority:'high', done:false, ward:'NICU' },
    { id:'NT-04', patient:'Mr. Kelechi Eze', task:'Blood glucose monitoring', due:'10:30', priority:'high', done:false, ward:'MMW' },
    { id:'NT-05', patient:'Mrs. Ngozi Uche', task:'Wound dressing change', due:'11:00', priority:'routine', done:false, ward:'Surgical' },
    { id:'NT-06', patient:'Mr. Tunde Yusuf', task:'Turn & position', due:'10:00', priority:'routine', done:true, ward:'ICU' },
  ];

  const receptionQueue = [
    { id:'RQ-01', name:'Mr. Sani Abdullahi', type:'New Registration', time:'09:12', status:'waiting', priority:'routine' },
    { id:'RQ-02', name:'Mrs. Blessing Okon', type:'Follow-up', time:'09:18', status:'called', priority:'routine' },
    { id:'RQ-03', name:'Master Chukwuemeka', type:'Paediatric Walk-in', time:'09:25', status:'waiting', priority:'high' },
    { id:'RQ-04', name:'Ms. Aisha Bello', type:'Appointment Check-in', time:'09:31', status:'waiting', priority:'routine' },
    { id:'RQ-05', name:'Mr. David Etuk', type:'Emergency Referral', time:'09:40', status:'waiting', priority:'urgent' },
  ];

  const facilityMetrics = {
    totalBeds: 108, occupiedBeds: 83, availableBeds: 25, occupancyRate: 77,
    todayAdmissions: 12, todayDischarges: 8, todayOPD: 87, averageWaitMins: 28,
    staffOnDuty: 142, criticalPatients: 9, theatreCasesToday: 6, revenueToday: '₦4.2M',
  };

  // ── PATIENTS ──────────────────────────────────────────────
  const patients = [
    {
      id:'P-001', mrn:'MRN-20-14321', name:'Mrs. Amaka Okafor',
      age:52, sex:'F', dob:'1972-04-14', blood:'O+',
      ward:'FMW', bed:'12', status:'stable',
      diagnoses:['Hypertensive Heart Disease','Type 2 Diabetes Mellitus'],
      allergies:['Penicillin','Aspirin'],
      phone:'+234-803-111-0001', nok:'Mr. C. Okafor (+234-803-111-0002)',
      attending:'Dr. Adewale Bello', admitDate:'2026-09-15',
      vitals:{ bp:'128/84', pulse:78, temp:36.8, spo2:97, rr:18, weight:72, height:162 },
      medications:['Amlodipine 5mg OD','Metformin 500mg BD','Lisinopril 10mg OD'],
      avatar: null, type:'inpatient',
    },
    {
      id:'P-002', mrn:'MRN-21-08834', name:'Mr. Tunde Yusuf',
      age:38, sex:'M', dob:'1988-11-02', blood:'A+',
      ward:'ICU', bed:'3', status:'critical',
      diagnoses:['Septicemia','Acute Kidney Injury'],
      allergies:['Sulfonamides'],
      phone:'+234-803-222-0002', nok:'Mrs. F. Yusuf (+234-803-222-0003)',
      attending:'Dr. Adewale Bello', admitDate:'2026-09-16',
      vitals:{ bp:'88/56', pulse:118, temp:38.9, spo2:91, rr:26, weight:80, height:178 },
      medications:['Meropenem 1g TDS','Noradrenaline infusion','Pantoprazole 40mg OD'],
      avatar: null, type:'inpatient',
    },
    {
      id:'P-003', mrn:'MRN-22-03291', name:'Baby Emmanuel John',
      age:0, sex:'M', dob:'2026-09-10', blood:'B+',
      ward:'NICU', bed:'5', status:'stable',
      diagnoses:['Neonatal Jaundice','Prematurity (34 weeks)'],
      allergies:[],
      phone:'+234-803-333-0004', nok:'Mrs. Grace John (+234-803-333-0004)',
      attending:'Dr. Adewale Bello', admitDate:'2026-09-10',
      vitals:{ bp:'—', pulse:142, temp:37.0, spo2:98, rr:42, weight:2.1, height:44 },
      medications:['Phototherapy','IV Glucose 10% infusion'],
      avatar: null, type:'inpatient',
    },
    {
      id:'P-004', mrn:'MRN-19-55102', name:'Mrs. Rose Daniels',
      age:44, sex:'F', dob:'1982-06-30', blood:'AB-',
      ward:'O&G', bed:'8', status:'review',
      diagnoses:['Post-operative Caesarean Section'],
      allergies:['Latex'],
      phone:'+234-803-444-0005', nok:'Mr. Sam Daniels (+234-803-444-0006)',
      attending:'Dr. Adewale Bello', admitDate:'2026-09-17',
      vitals:{ bp:'120/78', pulse:82, temp:37.4, spo2:99, rr:16, weight:68, height:165 },
      medications:['Co-amoxiclav 625mg TDS','Metronidazole 500mg TDS','Diclofenac 50mg BD'],
      avatar: null, type:'inpatient',
    },
    {
      id:'P-005', mrn:'MRN-23-00178', name:'Mr. Lawal Musa',
      age:60, sex:'M', dob:'1966-01-22', blood:'O-',
      ward:'SRG', bed:'2', status:'post-op',
      diagnoses:['Carcinoma of Prostate','Post-radical Prostatectomy'],
      allergies:['Codeine'],
      phone:'+234-803-555-0007', nok:'Mrs. H. Musa (+234-803-555-0008)',
      attending:'Dr. Adewale Bello', admitDate:'2026-09-14',
      vitals:{ bp:'135/85', pulse:74, temp:37.1, spo2:98, rr:17, weight:78, height:172 },
      medications:['Morphine 5mg PCA','Enoxaparin 40mg OD SC','Ranitidine 150mg BD'],
      avatar: null, type:'inpatient',
    },
    {
      id:'P-006', mrn:'MRN-20-62844', name:'Mr. Ibrahim Suleiman',
      age:45, sex:'M', dob:'1981-03-10', blood:'A-',
      ward:'OPD', bed:'—', status:'waiting',
      diagnoses:['Chronic Obstructive Pulmonary Disease'],
      allergies:[],
      phone:'+234-803-666-0009', nok:'Mrs. K. Suleiman (+234-803-666-0010)',
      attending:'Dr. Adewale Bello', admitDate:null,
      vitals:{ bp:'130/88', pulse:86, temp:36.9, spo2:94, rr:20, weight:75, height:170 },
      medications:['Salbutamol inhaler PRN','Tiotropium 18mcg OD'],
      avatar: null, type:'outpatient',
    },
    {
      id:'P-007', mrn:'MRN-25-00042', name:'Mrs. Fatima Bello',
      age:33, sex:'F', dob:'1993-07-18', blood:'B-',
      ward:'OPD', bed:'—', status:'in-progress',
      diagnoses:['Gestational Diabetes','Anaemia in Pregnancy'],
      allergies:['NSAIDs'],
      phone:'+234-803-777-0011', nok:'Mr. Ahmed Bello (+234-803-777-0012)',
      attending:'Dr. Adewale Bello', admitDate:null,
      vitals:{ bp:'118/72', pulse:92, temp:36.6, spo2:99, rr:16, weight:63, height:158 },
      medications:['Ferrous Sulphate 200mg TDS','Folic Acid 5mg OD','Metformin 500mg BD'],
      avatar: null, type:'outpatient',
    },
    {
      id:'P-008', mrn:'MRN-18-30091', name:'Chief Emmanuel Okoro',
      age:71, sex:'M', dob:'1955-12-01', blood:'O+',
      ward:'MMW', bed:'14', status:'stable',
      diagnoses:['Congestive Cardiac Failure','Atrial Fibrillation'],
      allergies:['Warfarin'],
      phone:'+234-803-888-0013', nok:'Mrs. B. Okoro (+234-803-888-0014)',
      attending:'Dr. Adewale Bello', admitDate:'2026-09-12',
      vitals:{ bp:'145/92', pulse:98, temp:36.7, spo2:95, rr:20, weight:88, height:175 },
      medications:['Furosemide 40mg BD','Digoxin 125mcg OD','Spironolactone 25mg OD','Bisoprolol 2.5mg OD'],
      avatar: null, type:'inpatient',
    },
  ];

  // Assign avatar colors
  patients.forEach(p => {
    p._color = avatarColor(p.name);
    p._initials = initials(p.name);
  });

  // ── APPOINTMENTS ──────────────────────────────────────────
  const appointments = [
    { id:'APT-001', time:'09:00', patient:'P-006', name:'Mr. Ibrahim Suleiman', type:'Follow-up', status:'waiting', notes:'COPD review, check spirometry' },
    { id:'APT-002', time:'09:45', patient:'P-007', name:'Mrs. Fatima Bello', type:'Consultation', status:'in-progress', notes:'ANC review – 32 weeks' },
    { id:'APT-003', time:'11:00', patient:'P-008', name:'Chief Emmanuel Okoro', type:'Ward Round', status:'waiting', notes:'CCF management review' },
    { id:'APT-004', time:'12:00', patient:'P-001', name:'Mrs. Amaka Okafor', type:'Review', status:'waiting', notes:'Post-admission review' },
    { id:'APT-005', time:'14:00', patient:null, name:'Mr. Chukwudi Eze', type:'New Patient', status:'upcoming', notes:'Referred from PHC – DM' },
    { id:'APT-006', time:'15:30', patient:null, name:'Mrs. Uche Lawal', type:'Consultation', status:'upcoming', notes:'Thyroid nodule – USS result review' },
    { id:'APT-007', time:'16:00', patient:'P-005', name:'Mr. Lawal Musa', type:'Review', status:'completed', notes:'Post-op day 4 review' },
  ];

  // ── WARD CENSUS ───────────────────────────────────────────
  const wards = [
    { code:'A&E',  name:'Accident & Emergency', occupancy:16, capacity:32, doctors:4, nurses:8, status:'surge' },
    { code:'MMW',  name:'Male Medical Ward',     occupancy:28, capacity:48, doctors:2, nurses:6, status:'high' },
    { code:'FMW',  name:'Female Medical Ward',   occupancy:24, capacity:48, doctors:2, nurses:6, status:'normal' },
    { code:'SRG',  name:'Surgical Ward',         occupancy:30, capacity:40, doctors:3, nurses:5, status:'high' },
    { code:'ICU',  name:'Intensive Care Unit',   occupancy:13, capacity:16, doctors:4, nurses:8, status:'critical' },
    { code:'PED',  name:'Paediatric Ward',       occupancy:16, capacity:36, doctors:2, nurses:5, status:'normal' },
    { code:'O&G',  name:'Obs & Gynaecology',     occupancy:26, capacity:44, doctors:3, nurses:7, status:'normal' },
    { code:'NICU', name:'Neonatal ICU',           occupancy:14, capacity:20, doctors:2, nurses:6, status:'high' },
    { code:'ORT',  name:'Orthopaedic Ward',      occupancy:14, capacity:30, doctors:2, nurses:4, status:'normal' },
    { code:'ISO',  name:'Isolation Ward',         occupancy:5,  capacity:14, doctors:1, nurses:4, status:'normal' },
  ];

  // ── LABORATORY RESULTS ────────────────────────────────────
  const labResults = [
    {
      id:'LAB-001', patientId:'P-001', patient:'Mrs. Amaka Okafor',
      orderedDate:'2026-09-17', resultDate:'2026-09-18 06:30',
      status:'available', urgency:'routine', orderedBy:'Dr. Adewale Bello',
      lab:'Haematology Lab',
      tests:[
        { name:'Haemoglobin', result:10.2, unit:'g/dL', refMin:12.0, refMax:16.0, flag:'low' },
        { name:'WBC', result:11.8, unit:'×10⁹/L', refMin:4.0, refMax:11.0, flag:'high' },
        { name:'Platelets', result:220, unit:'×10⁹/L', refMin:150, refMax:400, flag:'normal' },
        { name:'MCV', result:74, unit:'fL', refMin:80, refMax:100, flag:'low' },
      ],
      trending: {
        'Haemoglobin': [
          { date:'09 Sep', val:12.1 },{ date:'12 Sep', val:11.4 },
          { date:'15 Sep', val:10.8 },{ date:'18 Sep', val:10.2 },
        ]
      }
    },
    {
      id:'LAB-002', patientId:'P-002', patient:'Mr. Tunde Yusuf',
      orderedDate:'2026-09-18', resultDate:'2026-09-18 04:15',
      status:'critical', urgency:'stat', orderedBy:'Dr. Adewale Bello',
      lab:'Biochemistry Lab',
      tests:[
        { name:'Sodium', result:128, unit:'mmol/L', refMin:135, refMax:145, flag:'critical' },
        { name:'Potassium', result:6.2, unit:'mmol/L', refMin:3.5, refMax:5.0, flag:'critical' },
        { name:'Creatinine', result:412, unit:'µmol/L', refMin:60, refMax:120, flag:'critical' },
        { name:'Urea', result:28.4, unit:'mmol/L', refMin:2.5, refMax:7.5, flag:'critical' },
        { name:'CRP', result:186, unit:'mg/L', refMin:0, refMax:5, flag:'high' },
      ],
      trending: {}
    },
    {
      id:'LAB-003', patientId:'P-008', patient:'Chief Emmanuel Okoro',
      orderedDate:'2026-09-17', resultDate:'2026-09-18 07:00',
      status:'available', urgency:'routine', orderedBy:'Dr. Adewale Bello',
      lab:'Biochemistry Lab',
      tests:[
        { name:'BNP', result:820, unit:'pg/mL', refMin:0, refMax:100, flag:'high' },
        { name:'Creatinine', result:145, unit:'µmol/L', refMin:60, refMax:120, flag:'high' },
        { name:'Digoxin Level', result:1.8, unit:'nmol/L', refMin:0.8, refMax:2.0, flag:'normal' },
      ],
      trending: {}
    },
    {
      id:'LAB-004', patientId:'P-004', patient:'Mrs. Rose Daniels',
      orderedDate:'2026-09-17', resultDate:'2026-09-18 05:45',
      status:'available', urgency:'routine', orderedBy:'Dr. Adewale Bello',
      lab:'Haematology Lab',
      tests:[
        { name:'Haemoglobin', result:9.8, unit:'g/dL', refMin:12.0, refMax:16.0, flag:'low' },
        { name:'WBC', result:14.2, unit:'×10⁹/L', refMin:4.0, refMax:11.0, flag:'high' },
        { name:'CRP', result:52, unit:'mg/L', refMin:0, refMax:5, flag:'high' },
      ],
      trending: {}
    },
  ];

  // ── RADIOLOGY ─────────────────────────────────────────────
  const radiologyReports = [
    {
      id:'RAD-001', patientId:'P-001', patient:'Mrs. Amaka Okafor',
      modality:'CXR', study:'Chest X-Ray PA view',
      requestDate:'2026-09-16', reportDate:'2026-09-17',
      indication:'Shortness of breath, bilateral crepitations',
      radiologist:'Dr. F. Okonkwo', status:'reported',
      report:'Cardiomegaly noted with cardiothoracic ratio of 0.58. Bilateral perihilar haziness consistent with pulmonary oedema. No pleural effusion. Lungs otherwise clear.',
      impression:'Cardiomegaly with features of pulmonary oedema. Clinical correlation advised.',
    },
    {
      id:'RAD-002', patientId:'P-005', patient:'Mr. Lawal Musa',
      modality:'CT', study:'CT Abdomen & Pelvis with contrast',
      requestDate:'2026-09-14', reportDate:'2026-09-15',
      indication:'Post-operative assessment following radical prostatectomy',
      radiologist:'Dr. F. Okonkwo', status:'reported',
      report:'Surgical clips noted in the prostatic fossa. No evidence of residual disease. Post-operative haematoma noted measuring 3.2 × 2.8cm in the pelvis, decreasing in size compared to previous imaging. Bladder Foley catheter in situ.',
      impression:'Post-prostatectomy changes with resolving haematoma.',
    },
    {
      id:'RAD-003', patientId:'P-008', patient:'Chief Emmanuel Okoro',
      modality:'ECHO', study:'Echocardiogram',
      requestDate:'2026-09-17', reportDate:null,
      indication:'CCF assessment, AF',
      radiologist:null, status:'pending',
      report: null, impression: null,
    },
  ];

  // ── PRESCRIPTIONS ─────────────────────────────────────────
  const prescriptions = [
    {
      id:'RX-001', patientId:'P-001', patient:'Mrs. Amaka Okafor',
      date:'2026-09-15', prescribedBy:'Dr. Adewale Bello', status:'active',
      drugs:[
        { name:'Amlodipine', dose:'5mg', route:'Oral', freq:'Once daily', duration:'30 days', qty:30, instructions:'Take in the morning' },
        { name:'Metformin', dose:'500mg', route:'Oral', freq:'Twice daily', duration:'30 days', qty:60, instructions:'Take with meals' },
        { name:'Lisinopril', dose:'10mg', route:'Oral', freq:'Once daily', duration:'30 days', qty:30, instructions:'Monitor renal function' },
      ]
    },
    {
      id:'RX-002', patientId:'P-002', patient:'Mr. Tunde Yusuf',
      date:'2026-09-16', prescribedBy:'Dr. Adewale Bello', status:'active',
      drugs:[
        { name:'Meropenem', dose:'1g', route:'IV', freq:'8 hourly', duration:'7 days', qty:21, instructions:'Infuse over 30 min' },
        { name:'Pantoprazole', dose:'40mg', route:'IV', freq:'Once daily', duration:'5 days', qty:5, instructions:'' },
      ]
    },
  ];

  // ── TASKS ─────────────────────────────────────────────────
  const tasks = [
    { id:'T-001', priority:'urgent', title:'Review ICU patient — Bed 3 (Mr. Tunde Yusuf)', patient:'P-002', patientName:'Mr. Tunde Yusuf', due:'Now', category:'review', done:false },
    { id:'T-002', priority:'urgent', title:'Review critical potassium result — Mr. Tunde Yusuf (K⁺ 6.2)', patient:'P-002', patientName:'Mr. Tunde Yusuf', due:'Urgent', category:'lab', done:false },
    { id:'T-003', priority:'pending', title:'Sign discharge summary — Mrs. Amaka Okafor', patient:'P-001', patientName:'Mrs. Amaka Okafor', due:'Today', category:'document', done:false },
    { id:'T-004', priority:'pending', title:'Review CT report — Mr. Lawal Musa', patient:'P-005', patientName:'Mr. Lawal Musa', due:'Today', category:'radiology', done:false },
    { id:'T-005', priority:'pending', title:'Order repeat FBC — Mrs. Rose Daniels', patient:'P-004', patientName:'Mrs. Rose Daniels', due:'14:00', category:'lab', done:false },
    { id:'T-006', priority:'pending', title:'Review ECHO result — Chief Okoro (when available)', patient:'P-008', patientName:'Chief Emmanuel Okoro', due:'Today', category:'radiology', done:false },
    { id:'T-007', priority:'done', title:'Ward round — Female Medical Ward', patient:null, patientName:'', due:'08:00', category:'ward', done:true },
    { id:'T-008', priority:'done', title:'Prescribe metronidazole — Mrs. Rose Daniels', patient:'P-004', patientName:'Mrs. Rose Daniels', due:'07:30', category:'prescription', done:true },
  ];

  // ── MESSAGES ──────────────────────────────────────────────
  const messages = [
    { id:'MSG-001', from:'Nurse Chidinma (FMW)', role:'Nursing', dept:'FMW Ward', time:'07:45', unread:true, thread:[
      { sender:'them', text:'Good morning Doctor. Mrs. Okafor in Bed 12 is complaining of swollen ankles this morning.', time:'07:45' },
    ]},
    { id:'MSG-002', from:'Dr. Emeka Nwosu', role:'Cardiology', dept:'Cardiology', time:'06:30', unread:true, thread:[
      { sender:'them', text:'Please can you see Chief Okoro for cardiology input? CCF is proving difficult to control.', time:'06:30' },
    ]},
    { id:'MSG-003', from:'Pharmacy Dept', role:'Pharmacy', dept:'Pharmacy', time:'Yesterday', unread:false, thread:[
      { sender:'them', text:'Meropenem for Mr. Yusuf is now dispensed and sent to ICU.', time:'Yesterday' },
    ]},
    { id:'MSG-004', from:'Lab (Biochemistry)', role:'Laboratory', dept:'Laboratory', time:'04:15', unread:true, thread:[
      { sender:'them', text:'CRITICAL: Mr. Tunde Yusuf — Potassium 6.2 mmol/L, Creatinine 412 µmol/L. Please review urgently.', time:'04:15' },
    ]},
    { id:'MSG-005', from:'Dr. A. Bello (You)', role:'Self', dept:'Internal Medicine', time:'Yesterday', unread:false, thread:[
      { sender:'me', text:'Please repeat BP and SpO₂ for Bed 14 (Chief Okoro) and notify me if SpO₂ falls below 93%.', time:'Yesterday' },
    ]},
  ];

  // ── REFERRALS ─────────────────────────────────────────────
  const referrals = [
    {
      id:'REF-001', type:'outgoing', fromDoctor:'Dr. Adewale Bello', toSpec:'Cardiology',
      patient:'P-008', patientName:'Chief Emmanuel Okoro',
      date:'2026-09-17', urgency:'urgent', status:'accepted',
      reason:'Difficult-to-control CCF with new AF. Requesting cardiology input for rate control and optimisation of heart failure therapy.',
      consultant:'Dr. Emeka Nwosu',
    },
    {
      id:'REF-002', type:'outgoing', fromDoctor:'Dr. Adewale Bello', toSpec:'Nephrology',
      patient:'P-002', patientName:'Mr. Tunde Yusuf',
      date:'2026-09-17', urgency:'emergency', status:'accepted',
      reason:'Sepsis-related AKI with creatinine 412µmol/L. Requesting nephrology input re: dialysis.',
      consultant:'Dr. S. Adekunle',
    },
    {
      id:'REF-003', type:'incoming', fromDoctor:'Dr. Y. Obi (O&G)', toSpec:'Internal Medicine',
      patient:'P-004', patientName:'Mrs. Rose Daniels',
      date:'2026-09-17', urgency:'routine', status:'pending',
      reason:'Post-C/S patient with rising WBC. Rule out SSI vs endometritis. Request medical review.',
      consultant:'Dr. Adewale Bello',
    },
  ];

  // ── ALERTS ────────────────────────────────────────────────
  const alerts = [
    { id:'ALT-001', level:'critical', icon:'🔴', title:'ICU deterioration — Mr. Tunde Yusuf', desc:'SpO₂ dropped to 89%. Immediate review required.', time:'08:42 AM', patient:'P-002' },
    { id:'ALT-002', level:'critical', icon:'🔴', title:'Critical lab result — K⁺ 6.2 mmol/L', desc:'Mr. Tunde Yusuf — critical hyperkalaemia.', time:'04:15 AM', patient:'P-002' },
    { id:'ALT-003', level:'warning', icon:'🟠', title:'Pending investigation — Mrs. Rose Daniels', desc:'Wound swab culture result overdue by 6 hours.', time:'08:00 AM', patient:'P-004' },
    { id:'ALT-004', level:'warning', icon:'🟠', title:'Echocardiogram pending — Chief Okoro', desc:'Echo not yet performed. Requested 24h ago.', time:'Yesterday', patient:'P-008' },
    { id:'ALT-005', level:'info', icon:'🔵', title:'New lab result available — Mrs. Amaka Okafor', desc:'FBC result ready. Hb 10.2 g/dL (Low).', time:'06:30 AM', patient:'P-001' },
    { id:'ALT-006', level:'info', icon:'🔵', title:'New clinical message from Dr. Nwosu', desc:'Cardiology input requested for Chief Okoro.', time:'06:30 AM', patient:'P-008' },
  ];

  // ── CLINICAL NOTES ────────────────────────────────────────
  const clinicalNotes = [
    {
      id:'CN-001', patientId:'P-001', type:'Progress Note', author:'Dr. Adewale Bello',
      date:'2026-09-18 08:30', title:'Morning Progress Note',
      content:'Patient stable overnight. Swollen ankles noted this morning — possible fluid retention. BP 128/84mmHg, SpO₂ 97% on room air. Increase Furosemide dose and repeat U&E today. Continue current medications.',
    },
    {
      id:'CN-002', patientId:'P-002', type:'Admission Note', author:'Dr. Adewale Bello',
      date:'2026-09-16 14:15', title:'ICU Admission Note',
      content:'38-year-old male admitted with 3/7 history of fever, rigors, decreased urine output. Examination: febrile 38.9°C, tachycardic 118bpm, BP 88/56mmHg. Impression: Septic shock with AKI. Started on Meropenem, IVF resuscitation, vasopressor support.',
    },
    {
      id:'CN-003', patientId:'P-008', type:'Ward Round Note', author:'Dr. Adewale Bello',
      date:'2026-09-18 07:45', title:'Ward Round',
      content:'Chief Okoro reviewed on morning ward round. Persistent bilateral ankle oedema. AF rate 98bpm. BP 145/92mmHg. SpO₂ 95% on 2L oxygen. BNP 820. Increasing Furosemide and commencing Digoxin. Referred to cardiology. Repeat ECHO requested.',
    },
  ];

  // ── NOTIFICATIONS ─────────────────────────────────────────
  const notifications = [
    { id:'N-001', type:'critical', icon:'🔴', title:'Critical Lab Result', desc:'K⁺ 6.2 — Mr. Tunde Yusuf (ICU)', time:'08:42 AM', read:false },
    { id:'N-002', type:'critical', icon:'🔴', title:'Patient Deterioration', desc:'SpO₂ 89% — ICU Bed 3', time:'08:40 AM', read:false },
    { id:'N-003', type:'warning', icon:'🟠', title:'Pending Lab Result', desc:'FBC result — Mrs. Rose Daniels', time:'08:00 AM', read:false },
    { id:'N-004', type:'info', icon:'🔵', title:'New Referral Received', desc:'Mrs. Rose Daniels — from O&G', time:'Yesterday', read:true },
    { id:'N-005', type:'info', icon:'🔵', title:'Lab Result Available', desc:'Hb 10.2 — Mrs. Amaka Okafor', time:'06:30 AM', read:true },
    { id:'N-006', type:'info', icon:'🔵', title:'New Clinical Message', desc:'Dr. Nwosu — Cardiology input', time:'06:30 AM', read:true },
  ];

  // ── DRUG SEARCH DATA ──────────────────────────────────────
  // AKS-EML formulary (loaded from eml-formulary.js). Fallback if script missing.
  const drugs = (typeof window !== 'undefined' && window.AKS_EML)
    ? window.AKS_EML.toLegacyDrugs()
    : [
        { name:'Amoxicillin', class:'Antibiotic', commonDoses:['250mg','500mg'], routes:['Oral','IV'], eml:true },
        { name:'Paracetamol', class:'Analgesic/Antipyretic', commonDoses:['500mg','1g'], routes:['Oral','IV','PR'], eml:true },
      ];

  function searchEML(q, opts) {
    if (typeof window !== 'undefined' && window.AKS_EML) return window.AKS_EML.search(q, opts || {});
    return drugs.filter(d => !q || d.name.toLowerCase().includes(String(q).toLowerCase()));
  }
  function isOnEML(name, population) {
    if (typeof window !== 'undefined' && window.AKS_EML) return window.AKS_EML.isOnEML(name, population);
    return drugs.some(d => d.name.toLowerCase() === String(name||'').toLowerCase());
  }

  // ── LAB TEST CATALOG ──────────────────────────────────────
  const labTests = {
    'Haematology': ['Full Blood Count (FBC)', 'ESR', 'Reticulocyte Count', 'Malaria Parasite', 'Blood Film', 'G6PD', 'Sickling Test'],
    'Biochemistry': ['Urea & Electrolytes (U&E)', 'Liver Function Test (LFT)', 'Fasting Blood Glucose', 'Random Blood Glucose', 'HbA1c', 'Lipid Profile', 'Cardiac Enzymes (Troponin)', 'BNP', 'CRP', 'Thyroid Function (TFT)', 'PSA', 'Uric Acid', 'Calcium', 'Magnesium'],
    'Microbiology': ['Blood Culture', 'Urine C&S', 'Wound Swab C&S', 'Sputum C&S', 'HVS'],
    'Serology': ['HIV', 'Hepatitis B (HBsAg)', 'Hepatitis C (Anti-HCV)', 'VDRL', 'Widal Test'],
    'Urinalysis': ['Urinalysis', 'Urine MCS', 'Urine Pregnancy Test'],
    'Histology': ['Biopsy', 'FNAC', 'Pap Smear'],
  };

  // ── RADIOLOGY CATALOG ─────────────────────────────────────
  const radiologyTests = {
    'Plain X-Ray': ['Chest X-Ray (CXR)', 'X-Ray Abdomen', 'X-Ray Pelvis', 'X-Ray LS Spine', 'X-Ray Extremity'],
    'Ultrasound': ['USS Abdomen', 'USS Pelvis', 'USS Obstetric', 'USS Thyroid', 'USS Breast', 'USS Scrotal', 'Echocardiogram'],
    'CT Scan': ['CT Brain', 'CT Chest', 'CT Abdomen & Pelvis', 'CT Spine', 'CT Pulmonary Angiography (CTPA)'],
    'MRI': ['MRI Brain', 'MRI Spine', 'MRI Knee', 'MRI Abdomen'],
    'Mammography': ['Mammogram Bilateral'],
  };

  // ── ANALYTICS ─────────────────────────────────────────────
  const analytics = {
    today: {
      patientsSeen: 12,
      admissions: 3,
      discharges: 2,
      consultations: 8,
      pendingInvestigations: 7,
    },
    weeklyPatients: [32, 28, 41, 36, 29, 44, 38],
    weekLabels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    diagnosisDistribution: [
      { dx:'Hypertension', n:18 },
      { dx:'Diabetes', n:14 },
      { dx:'CCF', n:9 },
      { dx:'Sepsis', n:6 },
      { dx:'Others', n:21 },
    ],
  };

  // ── HELPER FUNCTIONS ──────────────────────────────────────
  function getPatient(id) { return patients.find(p => p.id === id); }
  function getPatientLabs(pid) { return labResults.filter(l => l.patientId === pid); }
  function getPatientRadiology(pid) { return radiologyReports.filter(r => r.patientId === pid); }
  function getPatientPrescriptions(pid) { return prescriptions.filter(rx => rx.patientId === pid); }
  function getPatientNotes(pid) { return clinicalNotes.filter(n => n.patientId === pid); }
  function getPatientReferrals(pid) { return referrals.filter(r => r.patient === pid); }

  function searchPatients(q) {
    if (!q) return patients;
    q = q.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.ward.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  }

  function unreadCount(msgs) { return msgs.filter(m => m.unread).length; }
  function unreadNotifs() { return notifications.filter(n => !n.read).length; }
  function criticalAlerts() { return alerts.filter(a => a.level === 'critical'); }
  function pendingTasks() { return tasks.filter(t => !t.done); }
  function urgentTasks() { return tasks.filter(t => t.priority === 'urgent' && !t.done); }

  function setCurrentUser(roleKey) {
    if (staff[roleKey]) currentUser = staff[roleKey];
    return currentUser;
  }
  function getCurrentUser() { return currentUser; }

  return {
    doctor, staff, currentUser, setCurrentUser, getCurrentUser,
    patients, appointments, wards,
    labResults, radiologyReports, prescriptions,
    tasks, messages, referrals, alerts, clinicalNotes,
    notifications, drugs, labTests, radiologyTests, analytics,
    searchEML, isOnEML,
    queues, pharmacyQueue, labQueue, bedBoard, nursingTasks,
    receptionQueue, facilityMetrics,
    // helpers
    getPatient, getPatientLabs, getPatientRadiology,
    getPatientPrescriptions, getPatientNotes, getPatientReferrals,
    searchPatients, unreadCount, unreadNotifs, criticalAlerts,
    pendingTasks, urgentTasks,
    // utils
    avatarColor, initials,
  };
})();
