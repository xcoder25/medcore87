'use client';

/**
 * Role-scoped sidebar sections — extracted from page.tsx shell.
 */
import React from 'react';
import type { UserSession } from '../components/auth/AuthScreen';
import type { ModuleKey, NavSection } from './moduleRegistry';
import { inferRoleKey } from '../lib/staffCardStore';
import { getModulesForRole } from '../lib/rolePermissionsStore';
import {
  Clock, Bell,
  Activity, Shield, Lock, Unlock, LogOut, ChevronLeft, ArrowLeft, ChevronRight,
  AlertTriangle, Building2, Users, BedDouble, RefreshCw, BarChart3, Settings,
  CreditCard, FileText, Stethoscope, Calendar, Heart, HeartPulse, Database, Brain, Sparkles, Flame,
  Pill, FlaskConical, Layers, Wind, Baby, Droplet, PhoneCall,
  Package, Wrench, Server, Gauge, Trash2, Cpu, FileCode, ShieldCheck, Landmark,
  Search, X, LayoutDashboard, MapPin, Ticket, HelpCircle, ChevronDown, CalendarDays, Zap, CheckCircle2, Globe, ArrowRight,
  Command, CornerDownLeft, IdCard, Key, Radio,
} from 'lucide-react';

// Master 7-Pillar Hospital Blueprint Directory
const MASTER_PILLARS: NavSection[] = [
  {
    label: '1. Clinical tools',
    items: [
      { key: 'm87-ai', icon: Brain, label: 'Celestia', badge: 'AI' },
      { key: 'ai', icon: Sparkles, label: 'Decision support', badge: 'AI' },
      { key: 'ai-automations', icon: Zap, label: 'AI Clinical Automations', badge: 'Live' },
      { key: 'clinical-search', icon: Search, label: 'Clinical Google (Search EMR)', badge: 'GenAI' },
    ],
  },
  {
    label: '2. Hospital Core Specialty Suites',
    items: [
      { key: 'emr', icon: FileText, label: 'Intelligent EMR & Records', badge: 'AI' },
      { key: 'emergency', icon: Flame, label: 'Emergency & A&E Triage', badge: 'ESI' },
      { key: 'theatre', icon: Activity, label: 'Operating Theatre & Surgeries', badge: 'OT' },
      { key: 'icu', icon: Wind, label: 'ICU & Critical Care Telemetry', badge: 'ICU' },
      { key: 'pharmacy', icon: Pill, label: 'Pharmacy Dispensing & Stocks', badge: 'Rx' },
      { key: 'laboratory', icon: FlaskConical, label: 'Laboratory LIS & Analyzers' },
      { key: 'radiology', icon: Layers, label: 'Radiology & PACS Viewer', badge: 'DICOM' },
      { key: 'maternity', icon: Stethoscope, label: 'Maternity, O&G & Labour (CTG)' },
      { key: 'paediatrics', icon: Baby, label: 'Paediatrics & NICU Incubators' },
      { key: 'blood-bank', icon: Droplet, label: 'Blood Bank & Transfusions' },
      { key: 'nursing', icon: FileText, label: 'Inpatient Nursing & e-MAR' },
      { key: 'triage', icon: Heart, label: 'OPD Triage & Vitals Station' },
      { key: 'patient-card', icon: FileText, label: 'Digital Health Card (FHIR)', badge: 'FHIR' },
    ],
  },
  {
    label: '3. Hospital Operations & Logistics',
    items: [
      { key: 'command', icon: Activity, label: 'Hospital Operations Hub' },
      { key: 'beds', icon: BedDouble, label: 'Clinical bed placement' },
      { key: 'patient-flow', icon: RefreshCw, label: 'Patient Transit & Admissions' },
            { key: 'universal-queue', icon: Clock, label: 'Universal Queue' },
            { key: 'notifications', icon: Bell, label: 'Notifications' },
      { key: 'staffing', icon: Users, label: 'Doctor & Nurse Shift Rosters' },
      { key: 'ambulance', icon: PhoneCall, label: 'Ambulance Fleet & Transfers', badge: 'GPS' },
      { key: 'inventory', icon: Package, label: 'Central Medical Store (CMS)' },
      { key: 'biomedical', icon: Wrench, label: 'Clinical device log (not CMMS) Assets' },
      { key: 'facilities', icon: Gauge, label: 'Oxygen Plant & Utilities' },
      { key: 'environmental', icon: Trash2, label: 'Environmental Health & Safety' },
    ],
  },
  {
    label: '4. Finance, NHIA & Revenue',
    items: [
      { key: 'akwaremit', icon: Landmark, label: 'AkwaRemit State Revenue Hub', badge: 'State' },
      { key: 'billing', icon: CreditCard, label: 'Inpatient / Outpatient Billing' },
      { key: 'cashier', icon: CreditCard, label: 'Cashier Shift Tills & POS' },
      { key: 'claims', icon: ShieldCheck, label: 'Insurance, HMO & AKSHIA Claims' },
      { key: 'revenue-cycle', icon: BarChart3, label: 'Revenue Cycle & Accounting' },
      { key: 'procurement', icon: Package, label: 'Procurement & Clinical Payroll' },
    ],
  },
  {
    label: '5. Data & Interoperability',
    items: [
      { key: 'aks-state', icon: Building2, label: 'Akwa Ibom State (AKSHIA · UPI · DHIS2)', badge: 'AKS' },
      { key: 'lamis', icon: Activity, label: 'LAMIS · NDR & e-CRVS (HIV & PEPFAR)', badge: 'RADET' },
      { key: 'data-hub', icon: Database, label: 'Central Telemetry Data Hub' },
      { key: 'device-gateway', icon: Server, label: 'Device gateway', badge: 'Hub' },
            { key: 'fhir', icon: FileCode, label: 'FHIR R4 & HL7 Message Gateway', badge: 'R4' },
      { key: 'statewide-emr', icon: ShieldCheck, label: 'Statewide EMR suite', badge: 'Full' },
      { key: 'analytics', icon: BarChart3, label: 'Clinical Performance Analytics' },
      { key: 'offline-sync', icon: RefreshCw, label: 'Offline Sync & Clinical Verification', badge: 'Hybrid' },
      { key: 'satellite-mesh', icon: Radio, label: 'Satellite & Telehealth Mesh', badge: 'Mesh DTN' },
    ],
  },
  {
    label: '6. Connected IoT Ecosystem',
    items: [
      { key: 'device-gateway', icon: Server, label: 'Device gateway', badge: 'Hub' },
            { key: 'iot-devices', icon: Cpu, label: 'Medical Devices & Bedside Monitors', badge: 'IoT' },
    ],
  },
  {
    label: '7. Governance, Safety & Access',
    items: [
      { key: 'auth', icon: Shield, label: 'Staff sign-in & identity' },
      { key: 'facility', icon: Building2, label: 'Hospital Facility Setup' },
      { key: 'rbac', icon: Lock, label: 'Role-Based Access Control' },
      { key: 'compliance', icon: FileText, label: 'Clinical Audit & Quality Logs' },
      { key: 'safety', icon: ShieldCheck, label: 'Consent & Business Continuity' },
      { key: 'sysadmin', icon: Settings, label: 'System Administration' },
    ],
  },
];

// Dedicated RBAC Navigation Sections generator

export function getRoleNavSections(session: UserSession | null, showFullDirectory: boolean): NavSection[] {
  if (showFullDirectory || !session) {
    return [
      {
        label: 'My workspace',
        items: [
          {
            key: 'dashboard',
            icon: LayoutDashboard,
            label: session?.role ? `${session.role.split('/')[0].trim()} Dashboard` : 'My Role Dashboard',
            badge: 'Live',
          },
        ],
      },
      ...MASTER_PILLARS,
    ];
  }

  const roleKey = inferRoleKey(session.roleKey || session.role || session.title, session.badgeId);

  switch (roleKey) {
    case 'doctor':
      return [
        {
          label: 'Physician Workstation',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Clinical desk', badge: 'Live' },
            { key: 'universal-queue', icon: Clock, label: 'OPD waiting queue', badge: 'Queue' },
            { key: 'doctor-portal', icon: Stethoscope, label: 'Consultations & clinic', badge: 'OPD' },
            { key: 'patient-360', icon: Users, label: 'Patient chart (360°)', badge: 'Chart' },
            { key: 'notifications', icon: Bell, label: 'In Basket', badge: 'Inbox' },
          ],
        },
        {
          label: 'Care & Orders (CPOE)',
          items: [
            { key: 'emr', icon: FileText, label: 'EMR & clinical notes', badge: 'EMR' },
            { key: 'pharmacy', icon: Pill, label: 'e-Prescribing (CPOE)', badge: 'Rx' },
            { key: 'laboratory', icon: FlaskConical, label: 'Lab test orders', badge: 'Lab' },
            { key: 'radiology', icon: Layers, label: 'Imaging & radiology orders', badge: 'PACS' },
          ],
        },
        {
          label: 'Inpatient & Acute Care',
          items: [
            { key: 'emergency', icon: Flame, label: 'A&E emergency triage', badge: 'ESI' },
            { key: 'beds', icon: BedDouble, label: 'Bed & ward census' },
            { key: 'icu', icon: Wind, label: 'ICU telemetry', badge: 'ICU' },
            { key: 'theatre', icon: Activity, label: 'Surgical schedule', badge: 'OT' },
          ],
        },
        {
          label: 'Clinical Assist',
          items: [
            { key: 'clinical-search', icon: Search, label: 'Clinical Google (Ask File)', badge: 'GenAI' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia clinical AI', badge: 'AI' },
            { key: 'ai-automations', icon: Zap, label: 'AI Clinical Automations', badge: 'Live' },
            { key: 'appointments', icon: Calendar, label: 'Clinic schedule', badge: 'Appt' },
            { key: 'patient-card', icon: FileText, label: 'Digital health card' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'surgeon':
      return [
        {
          label: 'Surgical Workstation',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Surgeon desk', badge: 'Live' },
            { key: 'theatre', icon: Activity, label: 'OR schedule & log (OpTime)', badge: 'OT' },
            { key: 'doctor-portal', icon: Stethoscope, label: 'Surgical consults & pre-op' },
            { key: 'universal-queue', icon: Clock, label: 'Surgical waiting queue', badge: 'Queue' },
            { key: 'notifications', icon: Bell, label: 'In Basket', badge: 'Inbox' },
          ],
        },
        {
          label: 'Peri-Op & PACU Care',
          items: [
            { key: 'icu', icon: Wind, label: 'Surgical ICU / HDU', badge: 'ICU' },
            { key: 'beds', icon: BedDouble, label: 'PACU & recovery beds' },
            { key: 'blood-bank', icon: Droplet, label: 'Blood bank & cross-match' },
            { key: 'emergency', icon: Flame, label: 'Trauma & emergency bay', badge: 'ESI' },
          ],
        },
        {
          label: 'Workup & Operative Notes',
          items: [
            { key: 'pharmacy', icon: Pill, label: 'e-Prescribing (CPOE)', badge: 'Rx' },
            { key: 'laboratory', icon: FlaskConical, label: 'Pre-op lab workup', badge: 'Lab' },
            { key: 'radiology', icon: Layers, label: 'Pre-op PACS imaging', badge: 'PACS' },
            { key: 'emr', icon: FileText, label: 'Operative notes & EMR' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia surgical AI', badge: 'AI' },
            { key: 'appointments', icon: Calendar, label: 'Surgical schedule', badge: 'Appt' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'nurse':
      return [
        {
          label: 'Nursing station',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Ward station', badge: 'Live' },
            { key: 'nursing', icon: FileText, label: 'Inpatient & e-MAR', badge: 'e-MAR' },
            { key: 'triage', icon: Heart, label: 'Triage & vitals station', badge: 'NEWS2' },
            { key: 'beds', icon: BedDouble, label: 'Bed occupancy', badge: 'Beds' },
            { key: 'notifications', icon: Bell, label: 'In Basket', badge: 'Inbox' },
          ],
        },
        {
          label: 'Patient care',
          items: [
            { key: 'patient-360', icon: Users, label: 'Patient chart' },
            { key: 'patient-flow', icon: RefreshCw, label: 'Admissions & transit' },
            { key: 'emergency', icon: Flame, label: 'A&E handover queue', badge: 'ESI' },
            { key: 'pharmacy', icon: Pill, label: 'Ward med requests', badge: 'Rx' },
            { key: 'blood-bank', icon: Droplet, label: 'Transfusion requests' },
          ],
        },
        {
          label: 'Specialty units',
          items: [
            { key: 'maternity', icon: Stethoscope, label: 'Maternity / labour ward' },
            { key: 'paediatrics', icon: Baby, label: 'Paediatrics / NICU' },
            { key: 'icu', icon: Wind, label: 'ICU step-down', badge: 'ICU' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia clinical AI', badge: 'AI' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'midwife':
      return [
        {
          label: 'Labour & Delivery (L&D)',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Labour ward desk', badge: 'Live' },
            { key: 'maternity', icon: Stethoscope, label: 'Maternity EMR & CTG', badge: 'CTG' },
            { key: 'paediatrics', icon: Baby, label: 'Newborn / NICU', badge: 'NICU' },
            { key: 'notifications', icon: Bell, label: 'In Basket (L&D)', badge: 'Inbox' },
          ],
        },
        {
          label: 'Maternal Care & Inpatient',
          items: [
            { key: 'patient-360', icon: Users, label: 'Maternal chart' },
            { key: 'beds', icon: BedDouble, label: 'Labour & antenatal beds' },
            { key: 'emergency', icon: Flame, label: 'Obstetric emergency' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia midwifery AI', badge: 'AI' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'pharmacist':
      return [
        {
          label: 'Pharmacy desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Dispensary desk', badge: 'Live' },
            { key: 'pharmacy', icon: Pill, label: 'Dispense queue', badge: 'Rx' },
            { key: 'formulary', icon: Pill, label: 'Formulary & stock', badge: 'EML' },
            { key: 'notifications', icon: Bell, label: 'In Basket', badge: 'Rx' },
          ],
        },
        {
          label: 'Clinical support',
          items: [
            { key: 'patient-360', icon: Users, label: 'Patient chart (Rx view)' },
            { key: 'emr', icon: FileText, label: 'Prescription records' },
            { key: 'patient-flow', icon: RefreshCw, label: 'Clinic & OPD queue' },
            { key: 'inventory', icon: Package, label: 'Drug store & CMS' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia Rx AI', badge: 'AI' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'lab':
      return [
        {
          label: 'Laboratory Operations',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Lab desk', badge: 'Live' },
            { key: 'laboratory', icon: FlaskConical, label: 'LIS & result entry', badge: 'LIS' },
            { key: 'lis', icon: Activity, label: 'Specimen pipeline', badge: 'Track' },
            { key: 'blood-bank', icon: Droplet, label: 'Blood bank & cross-match', badge: 'ABO' },
          ],
        },
        {
          label: 'Analyzers & Safety',
          items: [
            { key: 'iot-devices', icon: Cpu, label: 'Analyzers & IoT telemetry', badge: 'Live' },
            { key: 'device-gateway', icon: Settings, label: 'HL7 / ASTM gateway', badge: 'HL7' },
            { key: 'notifications', icon: Bell, label: 'Critical alerts & panic', badge: 'Panic' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia Lab AI', badge: 'AI' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'radiologist':
      return [
        {
          label: 'Diagnostic Imaging Suite',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Radiology home', badge: 'Live' },
            { key: 'radiology', icon: Layers, label: 'RIS / PACS diagnostic viewer', badge: 'DICOM' },
            { key: 'notifications', icon: Bell, label: 'In Basket (critical imaging)', badge: 'RIS' },
          ],
        },
        {
          label: 'Clinical Context & Tools',
          items: [
            { key: 'emr', icon: FileText, label: 'Clinical records & history' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia imaging AI', badge: 'AI' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'accountant':
      return [
        {
          label: 'Patient Financial Services',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Accounts workstation', badge: 'Live' },
            { key: 'akwaremit', icon: Landmark, label: 'AkwaRemit State Revenue Hub', badge: 'AKS' },
            { key: 'cashier', icon: CreditCard, label: 'Cashier & POS till', badge: 'POS' },
            { key: 'billing', icon: CreditCard, label: 'Billing office & invoicing', badge: 'Bill' },
            { key: 'notifications', icon: Bell, label: 'In Basket (billing alerts)', badge: 'Inbox' },
          ],
        },
        {
          label: 'Claims & Revenue Cycle',
          items: [
            { key: 'claims', icon: ShieldCheck, label: 'Insurance & NHIS claims', badge: 'HMO' },
            { key: 'revenue-cycle', icon: BarChart3, label: 'AR / Revenue cycle & remittance', badge: 'AR' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'biomedical':
      return [
        {
          label: 'Clinical Engineering',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Engineering desk', badge: 'Live' },
            { key: 'biomedical', icon: Wrench, label: 'Medical equipment log (PM)', badge: 'PM' },
            { key: 'iot-devices', icon: Cpu, label: 'Connected medical IoT monitors', badge: 'IoT' },
            { key: 'notifications', icon: Bell, label: 'Work orders & PM alerts', badge: 'PM' },
          ],
        },
        {
          label: 'Plant, Supplies & Safety',
          items: [
            { key: 'facilities', icon: Gauge, label: 'Oxygen plant & utilities' },
            { key: 'environmental', icon: Trash2, label: 'Environmental health & safety' },
            { key: 'inventory', icon: Package, label: 'Central medical store spares' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'reception':
      return [
        {
          label: 'Front desk command',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Command dashboard', badge: 'Live' },
            { key: 'patient-flow', icon: Activity, label: 'Check-in & multi-queue', badge: 'Queue' },
            { key: 'patient-card', icon: FileText, label: 'Register / MPI find', badge: 'MPI' },
            { key: 'appointments', icon: Calendar, label: 'Appointments & clinics' },
            { key: 'front-desk-wq', icon: Layers, label: 'Workqueues (grid · recall · print)', badge: 'Epic' },
            { key: 'universal-queue', icon: Ticket, label: 'Hospital-wide queue board', badge: 'UUTH' },
          ],
        },
        {
          label: 'Patient records',
          items: [
            { key: 'patient-360', icon: Users, label: 'Patient folder (desk scope)' },
            { key: 'emr', icon: FileText, label: 'Chart view (read only)' },
          ],
        },
        {
          label: 'Intelligence',
          items: [
            { key: 'm87-ai', icon: Brain, label: 'Front-desk AI copilot', badge: 'AI' },
            { key: 'notifications', icon: Bell, label: 'In Basket (desk)', badge: 'Alerts' },
            { key: 'analytics', icon: BarChart3, label: 'Throughput reports' },
          ],
        },
        {
          label: 'Settings',
          items: [
            { key: 'desk-settings', icon: Settings, label: 'Front desk settings' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];
    case 'records':
      return [
        {
          label: 'Health Information Mgmt (HIM)',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'HIM command', badge: 'Live' },
            { key: 'him', icon: FileText, label: 'HIM workqueues', badge: 'Epic' },
            { key: 'patient-card', icon: FileText, label: 'MPI / Digital health card', badge: 'FHIR' },
            { key: 'emr', icon: FileText, label: 'Chart retrieval (view only)' },
            { key: 'notifications', icon: Bell, label: 'In Basket (HIM)', badge: 'Inbox' },
          ],
        },
        {
          label: 'HIM Operational Workqueues',
          items: [
            { key: 'him-deficiency', icon: AlertTriangle, label: 'Deficiency tracking' },
            { key: 'him-coding', icon: FileText, label: 'ICD-10 / CPT coding & abstracting' },
            { key: 'him-roi', icon: ShieldCheck, label: 'Release of information (ROI)' },
            { key: 'him-chart', icon: CheckCircle2, label: 'Chart complete / bill-hold' },
            { key: 'him-merge', icon: Users, label: 'MPI duplicate merge' },
            { key: 'him-docs', icon: FileText, label: 'Document index & scanning' },
          ],
        },
        {
          label: 'Census & Assist',
          items: [
            { key: 'patient-flow', icon: RefreshCw, label: 'Patient transit & admissions' },
            { key: 'beds', icon: BedDouble, label: 'Bed management board' },
            { key: 'claims', icon: ShieldCheck, label: 'NHIA eligibility verification' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia HIM copilot', badge: 'AI' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'medical_director':
      return [
        {
          label: 'Executive Oversight Hub',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Medical director home', badge: 'L5' },
            { key: 'command', icon: Activity, label: 'Hospital Operations Hub & Census' },
            { key: 'notifications', icon: Bell, label: 'Executive In Basket', badge: 'Alerts' },
            { key: 'analytics', icon: BarChart3, label: 'Clinical Performance Analytics' },
            { key: 'm87-ai', icon: Brain, label: 'Celestia Clinical Executive AI', badge: 'AI' },
          ],
        },
        {
          label: 'Hospital Specialty Suites',
          items: [
            { key: 'emergency', icon: Flame, label: 'Emergency Surge & A&E', badge: 'ESI' },
            { key: 'theatre', icon: Activity, label: 'Operating Theatre & Surgeries', badge: 'OT' },
            { key: 'icu', icon: Wind, label: 'ICU & Critical Care Telemetry', badge: 'ICU' },
            { key: 'pharmacy', icon: Pill, label: 'Pharmacy Dispensing & Stocks' },
            { key: 'laboratory', icon: FlaskConical, label: 'Laboratory LIS & Analyzers' },
            { key: 'blood-bank', icon: Droplet, label: 'Blood Bank & Transfusions' },
            { key: 'ambulance', icon: PhoneCall, label: 'Ambulance Fleet & Transfers' },
          ],
        },
        {
          label: 'Governance & Finance',
          items: [
            { key: 'akwaremit', icon: Landmark, label: 'AkwaRemit State Revenue', badge: 'AKS' },
            { key: 'revenue-cycle', icon: BarChart3, label: 'Revenue Cycle & Accounting' },
            { key: 'compliance', icon: FileText, label: 'MoH Compliance & Audit Logs' },
            { key: 'rbac', icon: Lock, label: 'Staff Access Control' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'hospital_admin':
      return [
        {
          label: 'Executive Command',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Executive Dashboard', badge: 'Admin' },
            { key: 'command', icon: Activity, label: 'Hospital overview' },
            { key: 'beds', icon: BedDouble, label: 'Clinical bed census' },
            { key: 'notifications', icon: Bell, label: 'Admin In Basket', badge: 'Alerts' },
          ],
        },
        {
          label: 'Workforce & Operations',
          items: [
            { key: 'transfer', icon: Users, label: 'Hospital Staff Transfer' },
            { key: 'staffing', icon: Users, label: 'Staffing & Rosters' },
            { key: 'facility', icon: Building2, label: 'Hospital Management' },
            { key: 'patient-flow', icon: RefreshCw, label: 'Patient Flow Visibility' },
            { key: 'ambulance', icon: PhoneCall, label: 'Ambulance & Dispatch' },
          ],
        },
        {
          label: 'Identity, Security & Finance',
          items: [
            { key: 'rbac', icon: Lock, label: 'Staff Access Control' },
            { key: 'enrolment', icon: Users, label: 'Staff Enrolment & ID' },
            { key: 'compliance', icon: FileText, label: 'Compliance & Audit' },
            { key: 'akwaremit', icon: Landmark, label: 'AkwaRemit Revenue Hub', badge: 'AKS' },
            { key: 'cashier', icon: BarChart3, label: 'Revenue & Cashier' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
      ];

    case 'sysadmin':
      return [
        {
          label: 'System settings',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Admin home', badge: 'Live' },
            { key: 'notifications', icon: Bell, label: 'System notices', badge: 'Sys' },
            { key: 'transfer', icon: Users, label: 'Hospital Staff Transfer', badge: 'Admin' },
            { key: 'sysadmin', icon: Settings, label: 'System settings', badge: 'Core' },
          ],
        },
        {
          label: 'Security & IAM Governance',
          items: [
            { key: 'rbac', icon: Lock, label: 'Role-Based Access Control', badge: 'Admin' },
            { key: 'auth', icon: Shield, label: 'Staff sign-in & identity' },
            { key: 'facility', icon: Building2, label: 'Hospital Facility Setup' },
            { key: 'my-card', icon: IdCard, label: 'My staff ID' },
          ],
        },
        {
          label: 'Interoperability & Hardware',
          items: [
            { key: 'fhir', icon: FileCode, label: 'FHIR R4 & HL7 Message Gateway', badge: 'R4' },
      { key: 'statewide-emr', icon: ShieldCheck, label: 'Statewide EMR suite', badge: 'Full' },
            { key: 'data-hub', icon: Database, label: 'Central Telemetry Data Hub' },
            { key: 'iot-devices', icon: Cpu, label: 'Medical Devices & IoT', badge: 'IoT' },
            { key: 'biomedical', icon: Wrench, label: 'Clinical device log (not CMMS) Assets' },
            { key: 'safety', icon: ShieldCheck, label: 'Disaster Recovery & BCP' },
            { key: 'compliance', icon: FileText, label: 'Security & Audit Logs' },
          ],
        },
      ];

    default: {
      // Dynamic Custom Role: Build workstation sidebar based on permissions assigned by the Admin
      const roleTitle = session?.role || session?.title || 'Custom Role';
      const permittedKeys = new Set(
        session?.permissions && session.permissions.length > 0
          ? session.permissions
          : getModulesForRole(roleKey)
      );

      // Collect items from catalog that this custom role is permitted to see
      const customItems: NavSection['items'] = [];
      // Always include dashboard, my-card, notifications
      customItems.push({ key: 'dashboard', icon: LayoutDashboard, label: `${roleTitle.split('/')[0].trim()} Desk`, badge: 'Live' });
      customItems.push({ key: 'notifications', icon: Bell, label: 'In Basket', badge: 'Inbox' });
      customItems.push({ key: 'my-card', icon: IdCard, label: 'My staff ID' });

      // Search MASTER_PILLARS for any other permitted modules
      for (const pillar of MASTER_PILLARS) {
        for (const item of pillar.items) {
          if (permittedKeys.has(item.key) && !customItems.some((c) => c.key === item.key)) {
            customItems.push({
              key: item.key,
              icon: item.icon,
              label: item.label,
              badge: item.badge,
            });
          }
        }
      }

      return [
        {
          label: `${roleTitle.split('/')[0].trim()} Workspace`,
          items: customItems,
        },
      ];
    }
  }
}

interface RoleThemeConfig {
  label: string;
  badge: string;
  accent: string;
  gradient: string;
  activeBg: string;
  icon: any;
  workspaceTitle: string;
}

const ROLE_THEMES: Record<string, RoleThemeConfig> = {
  doctor: {
    label: 'Doctor desk',
    badge: 'DOCTOR WORKSPACE',
    accent: '#0052D4',
    gradient: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 82, 212, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Stethoscope,
    workspaceTitle: 'Doctor Clinical Workspace',
  },
  surgeon: {
    label: 'Theatre & surgery',
    badge: 'SURGEON OPERATING DESK',
    accent: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #F43F5E 100%)',
    activeBg: 'linear-gradient(90deg, rgba(220, 38, 38, 0.28) 0%, rgba(244, 63, 94, 0.12) 100%)',
    icon: Activity,
    workspaceTitle: 'Operating Theatre & Surgeries',
  },
  nurse: {
    label: 'Nursing station',
    badge: 'WARD NURSING STATION',
    accent: '#00BFA5',
    gradient: 'linear-gradient(135deg, #00BFA5 0%, #00D2A0 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 191, 165, 0.28) 0%, rgba(0, 210, 160, 0.12) 100%)',
    icon: HeartPulse,
    workspaceTitle: 'Inpatient Nursing & e-MAR',
  },
  midwife: {
    label: 'Labour & Delivery Desk',
    badge: 'LABOUR WARD COMMAND',
    accent: '#D946EF',
    gradient: 'linear-gradient(135deg, #D946EF 0%, #EC4899 100%)',
    activeBg: 'linear-gradient(90deg, rgba(217, 70, 239, 0.28) 0%, rgba(236, 72, 153, 0.12) 100%)',
    icon: Baby,
    workspaceTitle: 'Maternity, Labour & CTG',
  },
  pharmacist: {
    label: 'Pharmacy desk',
    badge: 'PHARMACY DISPENSARY',
    accent: '#059669',
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    activeBg: 'linear-gradient(90deg, rgba(5, 150, 105, 0.28) 0%, rgba(16, 185, 129, 0.12) 100%)',
    icon: Pill,
    workspaceTitle: 'Prescription Dispensing & Stocks',
  },
  lab: {
    label: 'Pathology & Diagnostic Desk',
    badge: 'LABORATORY COMMAND',
    accent: '#0891B2',
    gradient: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)',
    activeBg: 'linear-gradient(90deg, rgba(8, 145, 178, 0.28) 0%, rgba(6, 182, 212, 0.12) 100%)',
    icon: FlaskConical,
    workspaceTitle: 'Lab LIS & Automated Analyzers',
  },
  radiologist: {
    label: 'Medical Imaging Desk',
    badge: 'RADIOLOGY PACS DESK',
    accent: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    activeBg: 'linear-gradient(90deg, rgba(99, 102, 241, 0.28) 0%, rgba(139, 92, 246, 0.12) 100%)',
    icon: Layers,
    workspaceTitle: 'Radiology & PACS Viewer',
  },
  reception: {
    label: 'Reception',
    badge: 'RECEPTION',
    accent: '#0284C7',
    gradient: 'linear-gradient(135deg, #0284C7 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(2, 132, 199, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Users,
    workspaceTitle: 'Reception',
  },
  accountant: {
    label: 'Revenue & Finance Desk',
    badge: 'FINANCE COMMAND DESK',
    accent: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    activeBg: 'linear-gradient(90deg, rgba(217, 119, 6, 0.28) 0%, rgba(245, 158, 11, 0.12) 100%)',
    icon: CreditCard,
    workspaceTitle: 'Accounts · Cashier & Billing',
  },
  records: {
    label: 'Health Records & Patient MPI',
    badge: 'RECORDS COMMAND DESK',
    accent: '#0D9488',
    gradient: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
    activeBg: 'linear-gradient(90deg, rgba(13, 148, 136, 0.28) 0%, rgba(20, 184, 166, 0.12) 100%)',
    icon: FileText,
    workspaceTitle: 'Digital Patient Card & Transit',
  },
  biomedical: {
    label: 'Clinical Engineering Desk',
    badge: 'ENGINEERING COMMAND',
    accent: '#EA580C',
    gradient: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
    activeBg: 'linear-gradient(90deg, rgba(234, 88, 12, 0.28) 0%, rgba(249, 115, 22, 0.12) 100%)',
    icon: Wrench,
    workspaceTitle: 'Clinical device log (not CMMS) Assets',
  },
  medical_director: {
    label: 'Executive Oversight Hub',
    badge: 'DIRECTOR COMMAND DESK',
    accent: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
    activeBg: 'linear-gradient(90deg, rgba(124, 58, 237, 0.28) 0%, rgba(147, 51, 234, 0.12) 100%)',
    icon: Shield,
    workspaceTitle: 'Medical Director Oversight',
  },
  hospital_admin: {
    label: 'Hospital Administration',
    badge: 'ADMINISTRATOR DESK',
    accent: '#0052D4',
    gradient: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 82, 212, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Building2,
    workspaceTitle: 'Hospital Staff & Operations',
  },
  sysadmin: {
    label: 'System settings',
    badge: 'SYSTEM ARCHITECT DESK',
    accent: '#38BDF8',
    gradient: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
    activeBg: 'linear-gradient(90deg, rgba(56, 189, 248, 0.28) 0%, rgba(14, 165, 233, 0.12) 100%)',
    icon: Settings,
    workspaceTitle: 'System Admin & IAM Hub',
  },
};



export type { NavSection };
