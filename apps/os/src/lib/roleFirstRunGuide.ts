/**
 * First-time role guides — shown once per staff badge after facility/staff onboarding.
 * Content is role-specific so each desk learns its real workflow, not a generic tour.
 */

export type GuideStep = {
  title: string;
  body: string;
  tip?: string;
  /** Sidebar module key to open after finish (optional) */
  module?: string;
};

export type RoleGuide = {
  roleKey: string;
  roleLabel: string;
  accent: string;
  accentSoft: string;
  tagline: string;
  steps: GuideStep[];
};

const STORAGE_PREFIX = 'medcore_role_guide_seen_v1:';

export function roleGuideStorageKey(badgeId: string, roleKey: string): string {
  return `${STORAGE_PREFIX}${(badgeId || 'anon').toUpperCase()}:${(roleKey || 'staff').toLowerCase()}`;
}

export function hasSeenRoleGuide(badgeId: string, roleKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(roleGuideStorageKey(badgeId, roleKey)) === '1';
  } catch {
    return true;
  }
}

export function markRoleGuideSeen(badgeId: string, roleKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(roleGuideStorageKey(badgeId, roleKey), '1');
  } catch {
    /* ignore */
  }
}

export function resetRoleGuideSeen(badgeId: string, roleKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(roleGuideStorageKey(badgeId, roleKey));
  } catch {
    /* ignore */
  }
}

const GUIDES: Record<string, RoleGuide> = {
  midwife: {
    roleKey: 'midwife',
    roleLabel: 'Midwife',
    accent: '#BE185D',
    accentSoft: '#FDF2F8',
    tagline: 'Maternity desk — ANC, labour, newborn & scoped charts',
    steps: [
      {
        title: 'Your maternity workspace',
        body: 'This desk is scoped to maternity only. Sidebar modules that are not relevant to midwifery are hidden. The pink theme marks you are on the maternity path.',
        tip: 'Always confirm facility and patient identity before documenting.',
      },
      {
        title: 'Dashboard — live beds & labour',
        body: 'The home board shows maternity bed occupancy and active labour signals. Use it for a 10-second situational view when you start a shift.',
        module: 'dashboard',
      },
      {
        title: 'Maternity EMR',
        body: 'Register ANC, triage, admit labour, record partograph-related fields, delivery, and postnatal notes. Link the same phone/folder so Patient Chart and ANC SMS stay connected.',
        module: 'maternity',
        tip: 'EDD and G/P drive ANC intelligence and SMS due lists.',
      },
      {
        title: 'Newborn / NICU',
        body: 'Admit newborns, assign bays, log observations, and use the paediatric dose helper. Keep mother and baby linked when both charts exist.',
        module: 'paediatrics',
      },
      {
        title: 'Patient chart (scoped)',
        body: 'Open a maternity-scoped chart: identity, allergies, ANC plan, OB encounter, labour board fields, and delivery outcomes. Billing is hidden for this role.',
        module: 'patient-360',
      },
      {
        title: 'Notifications & SMS',
        body: 'Watch the notification centre for obstetric alerts. Use the ANC due-list tools to send appointment SMS when configured. Patients on the Care app can see “My ANC” when their phone matches the plan.',
        module: 'notifications',
      },
    ],
  },
  nurse: {
    roleKey: 'nurse',
    roleLabel: 'Nurse',
    accent: '#0D9488',
    accentSoft: '#F0FDFA',
    tagline: 'Ward nursing — beds, vitals, meds & patient flow',
    steps: [
      {
        title: 'Nursing desk',
        body: 'Your sidebar centres on nursing, beds, emergency response, pharmacy hand-offs, and clinical notes. Work from the dashboard board for today’s admitted and waiting patients.',
        module: 'dashboard',
      },
      {
        title: 'Beds & wards',
        body: 'Open the bed board to see occupancy, assign or release beds, and track ward status in real time across workstations.',
        module: 'beds',
      },
      {
        title: 'Patient care',
        body: 'Document vitals, allergies, problems, and notes on the patient chart. Give and record medications according to pharmacy-dispensed orders.',
        module: 'patient-360',
        tip: 'Never invent chart data — only record what you observed or received as orders.',
      },
      {
        title: 'Emergency & notifications',
        body: 'Escalate via emergency workflows when acuity rises. Keep notifications open for critical lab results and transfer alerts.',
        module: 'notifications',
      },
    ],
  },
  doctor: {
    roleKey: 'doctor',
    roleLabel: 'Doctor',
    accent: '#1D4ED8',
    accentSoft: '#EFF6FF',
    tagline: 'Clinical desk — orders, EMR, consults & decision support',
    steps: [
      {
        title: 'Clinical home',
        body: 'Start on your desk dashboard for today’s visits, open orders, and in-basket style work. Use quick actions to jump into EMR, labs, imaging, or pharmacy.',
        module: 'dashboard',
      },
      {
        title: 'Orders & results',
        body: 'Place lab, imaging, and prescription orders from the clinical modules. Review results and acknowledge critical values when prompted.',
        tip: 'Orders flow to lab, radiology, and pharmacy desks in real time when online.',
      },
      {
        title: 'Patient 360',
        body: 'Open the full clinical chart for history, problems, meds, allergies, and timeline. Document assessments and plans in notes.',
        module: 'patient-360',
      },
      {
        title: 'AI assist (when enabled)',
        body: 'M87 / AI tools can draft notes or suggest structure — you remain the author and must verify every clinical statement before signing.',
        module: 'm87-ai',
      },
    ],
  },
  surgeon: {
    roleKey: 'surgeon',
    roleLabel: 'Surgeon',
    accent: '#7C3AED',
    accentSoft: '#F5F3FF',
    tagline: 'Theatre & surgical pathway',
    steps: [
      {
        title: 'Surgical desk',
        body: 'Your modules prioritise theatre cases, pre-op/post-op documentation, imaging, and emergency escalation.',
        module: 'dashboard',
      },
      {
        title: 'Theatre board',
        body: 'Review scheduled and active cases, confirm consent and readiness, and update case status as the list moves.',
        module: 'theatre',
      },
      {
        title: 'Chart & imaging',
        body: 'Use Patient 360 and radiology modules for operative planning and post-op review. Document procedures accurately.',
        module: 'patient-360',
      },
    ],
  },
  pharmacist: {
    roleKey: 'pharmacist',
    roleLabel: 'Pharmacist',
    accent: '#059669',
    accentSoft: '#ECFDF5',
    tagline: 'Pharmacy — formulary, FEFO stock, dispense & controlled drugs',
    steps: [
      {
        title: 'Pharmacy home',
        body: 'Dashboard shows dispense queue pressure, stock alerts, and controlled-drug attention items for your facility.',
        module: 'dashboard',
      },
      {
        title: 'Formulary & stock',
        body: 'Maintain the formulary, receive stock (FEFO), and watch low-stock alerts. AKS essential medicines lists seed the catalogue where configured.',
        module: 'formulary',
      },
      {
        title: 'Dispense',
        body: 'Verify prescription, check allergies, dispense, and log controlled drugs. Stock depletes with the dispense path so wards see live availability.',
        module: 'pharmacy',
        tip: 'Always confirm patient identity and allergy status before handing out meds.',
      },
    ],
  },
  lab: {
    roleKey: 'lab',
    roleLabel: 'Lab scientist',
    accent: '#CA8A04',
    accentSoft: '#FEFCE8',
    tagline: 'LIS — specimens, analyzers, results & blood bank links',
    steps: [
      {
        title: 'Lab desk',
        body: 'The LIS home tracks specimen intake, pending analyses, critical results, and analyzer gateway status.',
        module: 'dashboard',
      },
      {
        title: 'Orders in → results out',
        body: 'Receive lab orders from clinicians, process specimens, enter or import results, and release with appropriate flags.',
        module: 'laboratory',
        tip: 'Critical values need acknowledgment on the clinical side — release promptly and correctly.',
      },
      {
        title: 'Patient lookup',
        body: 'Use lab-scoped patient search to confirm identity and prior results without opening unrelated finance data.',
      },
    ],
  },
  radiologist: {
    roleKey: 'radiologist',
    roleLabel: 'Radiologist',
    accent: '#0284C7',
    accentSoft: '#F0F9FF',
    tagline: 'Imaging — worklist, PACS, reports',
    steps: [
      {
        title: 'Imaging desk',
        body: 'Work from the radiology worklist: pending studies, drafts, and signed reports for your facility.',
        module: 'dashboard',
      },
      {
        title: 'PACS & reporting',
        body: 'Open studies, draft structured reports, and sign. Clinicians see completed imaging on the patient chart.',
        module: 'radiology',
      },
    ],
  },
  reception: {
    roleKey: 'reception',
    roleLabel: 'Reception',
    accent: '#EA580C',
    accentSoft: '#FFF7ED',
    tagline: 'Front desk — register, queue, appointments & payments routing',
    steps: [
      {
        title: 'Reception cockpit',
        body: 'Your home is the front-desk workspace: check-in, queue, appointments, and patient cards for this hospital only.',
        module: 'dashboard',
      },
      {
        title: 'Register & folder numbers',
        body: 'Create or retrieve patient records with correct hospital number, phone, and demographics. Accurate phone numbers power ANC SMS and Care app links later.',
        module: 'patient-card',
      },
      {
        title: 'Queues & referrals',
        body: 'Move patients through OPD queues, convert referrals to visits, and route to the right department without clinical chart noise.',
        module: 'patient-flow',
      },
    ],
  },
  records: {
    roleKey: 'records',
    roleLabel: 'Health records',
    accent: '#4F46E5',
    accentSoft: '#EEF2FF',
    tagline: 'HIM — charts, coding, ROI & deficiency tracking',
    steps: [
      {
        title: 'Records desk',
        body: 'Manage chart completeness, coding, release of information, and merge/duplicate resolution for the facility.',
        module: 'dashboard',
      },
      {
        title: 'HIM modules',
        body: 'Use deficiency lists, coding, ROI, and document workflows. Clinical content remains owned by clinical roles; you govern the record lifecycle.',
        module: 'him',
      },
    ],
  },
  accountant: {
    roleKey: 'accountant',
    roleLabel: 'Finance',
    accent: '#0F766E',
    accentSoft: '#F0FDFA',
    tagline: 'Billing, cashier, receipts & accounts',
    steps: [
      {
        title: 'Finance home',
        body: 'Track bills, payments, and outstanding balances for your facility. Clinical modules stay limited to what finance needs for identity and eligibility.',
        module: 'dashboard',
      },
      {
        title: 'Cashier & billing',
        body: 'Post payments, issue receipts, and reconcile day totals. Link every receipt to the correct patient folder.',
        module: 'cashier',
      },
    ],
  },
  cashier: {
    roleKey: 'cashier',
    roleLabel: 'Cashier',
    accent: '#0F766E',
    accentSoft: '#F0FDFA',
    tagline: 'Take payment, print receipt, close the day',
    steps: [
      {
        title: 'Cashier desk',
        body: 'Find the patient, confirm the bill, collect payment, and issue a receipt. Keep the drawer session consistent with hospital policy.',
        module: 'cashier',
      },
      {
        title: 'Day close',
        body: 'Review receipts and hand over totals to accounts. Do not alter clinical records from this desk.',
        module: 'dashboard',
      },
    ],
  },
  hospital_admin: {
    roleKey: 'hospital_admin',
    roleLabel: 'Hospital administrator',
    accent: '#1E3A8A',
    accentSoft: '#EFF6FF',
    tagline: 'Facility command — staff, RBAC, settings & operations',
    steps: [
      {
        title: 'Admin shell',
        body: 'You land in the hospital administration workspace: staff enrolment, role permissions, facility settings, and operational oversight.',
      },
      {
        title: 'Staff & ID cards',
        body: 'Enrol staff, issue ACTIVE cards for this facility only, and manage transfers. The card counter shows active cards in your hospital — not other facilities.',
      },
      {
        title: 'Role visibility',
        body: 'Tune which modules each role can open. Changes apply live to sidebars after staff refresh or re-login.',
      },
      {
        title: 'Onboarding & safety',
        body: 'Complete facility onboarding once, keep integrations (SMS, devices) configured, and audit sensitive actions regularly.',
      },
    ],
  },
  sysadmin: {
    roleKey: 'sysadmin',
    roleLabel: 'ICT / SysAdmin',
    accent: '#334155',
    accentSoft: '#F8FAFC',
    tagline: 'Platform health, integrations & access',
    steps: [
      {
        title: 'ICT desk',
        body: 'Monitor integrations, device gateways, and system configuration. Coordinate with hospital admin on staff access.',
        module: 'dashboard',
      },
      {
        title: 'Gateways & settings',
        body: 'Configure analyzers, SMS, and interop endpoints carefully — test in low-traffic windows when possible.',
      },
    ],
  },
  biomedical: {
    roleKey: 'biomedical',
    roleLabel: 'Biomedical',
    accent: '#B45309',
    accentSoft: '#FFFBEB',
    tagline: 'Equipment, devices & engineering support',
    steps: [
      {
        title: 'Engineering desk',
        body: 'Track device status and support clinical units with equipment readiness. Use notifications for offline gateways when configured.',
        module: 'dashboard',
      },
    ],
  },
  medical_director: {
    roleKey: 'medical_director',
    roleLabel: 'Medical director',
    accent: '#9F1239',
    accentSoft: '#FFF1F2',
    tagline: 'Clinical governance overview',
    steps: [
      {
        title: 'Director view',
        body: 'Use dashboards and clinical modules for oversight of quality, acuity, and departmental performance across the facility.',
        module: 'dashboard',
      },
      {
        title: 'Charts & escalation',
        body: 'You may open broad clinical views for governance. Document interventions through normal clinical pathways when acting as a clinician.',
        module: 'patient-360',
      },
    ],
  },
};

const FALLBACK: RoleGuide = {
  roleKey: 'staff',
  roleLabel: 'Staff',
  accent: '#2563EB',
  accentSoft: '#EFF6FF',
  tagline: 'Hospital OS — role-scoped workspace',
  steps: [
    {
      title: 'Welcome to MedCore OS',
      body: 'Your sidebar shows only modules allowed for your role at this facility. Start from Dashboard, then open the modules you use daily.',
      module: 'dashboard',
    },
    {
      title: 'My staff ID',
      body: 'Open My Card anytime to view your badge, facility, and role. Keep your PIN private.',
      module: 'my-card',
    },
    {
      title: 'Notifications',
      body: 'Check Notifications for alerts that target your role. Acknowledge critical clinical items promptly.',
      module: 'notifications',
    },
  ],
};

export function getRoleGuide(roleKey: string): RoleGuide {
  const key = (roleKey || '').toLowerCase();
  return GUIDES[key] || FALLBACK;
}

export function shouldShowRoleGuide(badgeId: string, roleKey: string): boolean {
  return !hasSeenRoleGuide(badgeId, roleKey);
}
