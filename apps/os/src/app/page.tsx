'use client';

import React, { useState, useEffect, useMemo } from 'react';
import '../styles/os.css';

// Splash & Auth Components
import { SplashScreen } from '../components/splash/SplashScreen';
import { AuthScreen, UserSession, PRESET_STAFF } from '../components/auth/AuthScreen';

// Core & Existing Modules
import { CommandCentreDashboard } from '../components/command-centre/CommandCentreDashboard';
import { BedManagement } from '../components/beds/BedManagement';
import { PatientFlowVisibility } from '../components/patient-flow/PatientFlowVisibility';
import { StaffingOverview } from '../components/staffing/StaffingOverview';
import { IntegratedDataHub } from '../components/data-hub/IntegratedDataHub';
import { PerformanceAnalytics } from '../components/analytics/PerformanceAnalytics';
import { AccessControl } from '../components/rbac/AccessControl';
import { SystemAdministration } from '../components/system-admin/SystemAdministration';
import { ComplianceAuditLogs } from '../components/compliance/ComplianceAuditLogs';
import { AICommandInsights } from '../components/ai-insights/AICommandInsights';
import { CashierRevenue } from '../components/cashier/CashierRevenue';
import { FacilityOnboarding } from '../components/facility/FacilityOnboarding';
import { AuthIdentity } from '../components/auth/AuthIdentity';
import { DigitalPatientCard } from '../components/patient-card/DigitalPatientCard';
import { HospitalStaffTransfer } from '../components/staffing/HospitalStaffTransfer';
import { StaffEnrolment } from '../components/staffing/StaffEnrolment';

// Specialty Suites
import { AdminShell } from '../components/dashboards/AdminShell';
import { RoleDashboard } from '../components/dashboards/RoleDashboard';
import { DoctorPortal } from '../components/dashboards/DoctorPortal';
import { M87AICopilotSuite } from '../components/ai-insights/M87AICopilotSuite';
import { EmergencyTriageSuite } from '../components/clinical-core/EmergencyTriageSuite';
import { PharmacyDispensingSuite } from '../components/clinical-core/PharmacyDispensingSuite';
import { LaboratorySuite } from '../components/clinical-core/LaboratorySuite';
import { RadiologyPacsSuite } from '../components/clinical-core/RadiologyPacsSuite';
import { OperatingTheatreSuite } from '../components/clinical-core/OperatingTheatreSuite';
import { CriticalCareIcuSuite } from '../components/clinical-core/CriticalCareIcuSuite';
import { MaternityOgSuite } from '../components/clinical-core/MaternityOgSuite';
import { PaediatricsNicuSuite } from '../components/clinical-core/PaediatricsNicuSuite';
import { BloodBankSuite } from '../components/clinical-core/BloodBankSuite';
import { InpatientNursingSuite } from '../components/clinical-core/InpatientNursingSuite';
import { AmbulanceTransfersSuite } from '../components/operations/AmbulanceTransfersSuite';
import { SupplyChainInventorySuite } from '../components/operations/SupplyChainInventorySuite';
import { BiomedicalEquipmentSuite } from '../components/operations/BiomedicalEquipmentSuite';
import { FacilitiesUtilitiesSuite } from '../components/operations/FacilitiesUtilitiesSuite';
import { EnvironmentalSafetySuite } from '../components/operations/EnvironmentalSafetySuite';
import { BillingInvoicingSuite } from '../components/finance/BillingInvoicingSuite';
import { InsuranceHmoClaimsSuite } from '../components/finance/InsuranceHmoClaimsSuite';
import { RevenueCycleAccountingSuite } from '../components/finance/RevenueCycleAccountingSuite';
import { ProcurementHrSuite } from '../components/finance/ProcurementHrSuite';
import { FhirHl7GatewaySuite } from '../components/interop/FhirHl7GatewaySuite';
import { ConnectedDevicesSuite } from '../components/interop/ConnectedDevicesSuite';
import { ClinicalSafetyBcpSuite } from '../components/interop/ClinicalSafetyBcpSuite';
import { EMRManager } from '../components/gateway-modules/EMRManager';
import NotificationBell from '../components/realtime/NotificationBell';
import AlertBanner from '../components/realtime/AlertBanner';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

// Icons
import {
  Activity, Shield, Lock, Unlock, LogOut, ChevronLeft, ChevronRight,
  AlertTriangle, Building2, Users, BedDouble, RefreshCw, BarChart3, Settings,
  CreditCard, FileText, Stethoscope, HeartPulse, Database, Brain, Sparkles, Flame,
  Pill, FlaskConical, Layers, Wind, Baby, Droplet, PhoneCall,
  Package, Wrench, Gauge, Trash2, Cpu, FileCode, ShieldCheck,
  Search, X, LayoutDashboard, Zap, CheckCircle2, Globe, ArrowRight,
  Command, CornerDownLeft
} from 'lucide-react';

export type ModuleKey =
  | 'dashboard'
  // Doctor full portal
  | 'doctor-portal'
  // Pillar 1: AI
  | 'm87-ai' | 'ai'
  // Pillar 2: Core
  | 'emr' | 'emergency' | 'theatre' | 'icu' | 'pharmacy' | 'laboratory' | 'radiology'
  | 'maternity' | 'paediatrics' | 'blood-bank' | 'nursing' | 'patient-card'
  // Pillar 3: Operations
  | 'command' | 'beds' | 'patient-flow' | 'staffing' | 'ambulance'
  | 'inventory' | 'biomedical' | 'facilities' | 'environmental'
  // Pillar 4: Finance
  | 'billing' | 'cashier' | 'claims' | 'revenue-cycle' | 'procurement'
  // Pillar 5: Data & Interop
  | 'data-hub' | 'fhir' | 'analytics'
  // Pillar 6: Connected IoT
  | 'iot-devices'
  // Pillar 7: Security & Governance
  | 'auth' | 'facility' | 'rbac' | 'compliance' | 'safety' | 'sysadmin' | 'transfer' | 'enrolment' | 'my-card';

export type NavSection = {
  label: string;
  items: {
    key: ModuleKey;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    label: string;
    badge?: string;
  }[];
};

interface LiveTelemetryEvent {
  id: string;
  time: string;
  category: 'RX' | 'TRIAGE' | 'BED' | 'SURGERY' | 'LAB' | 'BILLING' | 'EMERGENCY';
  message: string;
  badgeColor: string;
}

// Master 7-Pillar Hospital Blueprint Directory
const MASTER_PILLARS: NavSection[] = [
  {
    label: '1. Clinical tools',
    items: [
      { key: 'm87-ai', icon: Brain, label: 'Clinical assistant', badge: 'AI' },
      { key: 'ai', icon: Sparkles, label: 'Decision support', badge: 'AI' },
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
      { key: 'patient-card', icon: FileText, label: 'Digital Health Card (FHIR)', badge: 'FHIR' },
    ],
  },
  {
    label: '3. Hospital Operations & Logistics',
    items: [
      { key: 'command', icon: Activity, label: 'Hospital Operations Hub' },
      { key: 'beds', icon: BedDouble, label: 'Bed & Ward Management' },
      { key: 'patient-flow', icon: RefreshCw, label: 'Patient Transit & Admissions' },
      { key: 'staffing', icon: Users, label: 'Doctor & Nurse Shift Rosters' },
      { key: 'ambulance', icon: PhoneCall, label: 'Ambulance Fleet & Transfers', badge: 'GPS' },
      { key: 'inventory', icon: Package, label: 'Central Medical Store (CMS)' },
      { key: 'biomedical', icon: Wrench, label: 'Biomedical Equipment Assets' },
      { key: 'facilities', icon: Gauge, label: 'Oxygen Plant & Utilities' },
      { key: 'environmental', icon: Trash2, label: 'Environmental Health & Safety' },
    ],
  },
  {
    label: '4. Finance, NHIA & Revenue',
    items: [
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
      { key: 'data-hub', icon: Database, label: 'Central Telemetry Data Hub' },
      { key: 'fhir', icon: FileCode, label: 'FHIR R4 & HL7 Message Gateway', badge: 'R4' },
      { key: 'analytics', icon: BarChart3, label: 'Clinical Performance Analytics' },
    ],
  },
  {
    label: '6. Connected IoT Ecosystem',
    items: [
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
function getRoleNavSections(session: UserSession | null, showFullDirectory: boolean): NavSection[] {
  if (showFullDirectory || !session) {
    return [
      {
        label: 'Role Command Workspace',
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

  const roleTitle = (session.role || session.title || '').toLowerCase();
  const roleKey = session.roleKey ||
    (roleTitle.includes('surgeon') ? 'surgeon'
      : roleTitle.includes('nurse') ? 'nurse'
      : roleTitle.includes('midwife') ? 'midwife'
      : roleTitle.includes('pharmacist') ? 'pharmacist'
      : roleTitle.includes('lab') ? 'lab'
      : roleTitle.includes('radiolog') ? 'radiologist'
      : roleTitle.includes('account') || roleTitle.includes('cashier') ? 'accountant'
      : roleTitle.includes('record') ? 'records'
      : roleTitle.includes('biomedical') ? 'biomedical'
      : roleTitle.includes('director') || roleTitle.includes('superintendent') ? 'medical_director'
      : roleTitle.includes('admin') || roleTitle.includes('ict') ? 'sysadmin'
      : 'doctor');

  switch (roleKey) {
    case 'doctor':
      return [
        {
          label: 'Physician Command',
          items: [
            { key: 'doctor-portal', icon: Stethoscope, label: 'Doctor Clinical Portal', badge: 'Live' },
            { key: 'dashboard', icon: LayoutDashboard, label: 'Role Overview Dashboard' },
            { key: 'm87-ai', icon: Brain, label: 'Clinical assistant', badge: 'AI' },
            { key: 'ai', icon: Sparkles, label: 'Decision Support & SOAP', badge: 'AI' },
          ],
        },
        {
          label: 'Clinical Stations',
          items: [
            { key: 'emr', icon: FileText, label: 'Intelligent EMR & Records', badge: 'AI' },
            { key: 'emergency', icon: Flame, label: 'Accident & Emergency Triage', badge: 'ESI' },
            { key: 'nursing', icon: FileText, label: 'Inpatient Wards & e-MAR' },
            { key: 'pharmacy', icon: Pill, label: 'e-Prescription & Pharmacy', badge: 'Rx' },
            { key: 'beds', icon: BedDouble, label: 'Ward Bed Census Board' },
            { key: 'theatre', icon: Activity, label: 'Operating Theatre Schedule', badge: 'OT' },
            { key: 'icu', icon: Wind, label: 'ICU Critical Care Telemetry', badge: 'ICU' },
          ],
        },
        {
          label: 'Diagnostics & Records',
          items: [
            { key: 'radiology', icon: Layers, label: 'Radiology PACS & DICOM', badge: 'DICOM' },
            { key: 'laboratory', icon: FlaskConical, label: 'Laboratory LIS & Analyzers' },
            { key: 'patient-card', icon: FileText, label: 'Digital Health Card (FHIR)', badge: 'FHIR' },
            { key: 'staffing', icon: Users, label: 'Physician Duty Rosters' },
          ],
        },
      ];

    case 'surgeon':
      return [
        {
          label: 'Surgical Command Suite',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Surgeon Operating Desk', badge: 'Live' },
            { key: 'theatre', icon: Activity, label: 'Operating Theatre & Surgeries', badge: 'OT' },
            { key: 'm87-ai', icon: Brain, label: 'Surgical risk helper', badge: 'AI' },
          ],
        },
        {
          label: 'Critical Care & Resuscitation',
          items: [
            { key: 'icu', icon: Wind, label: 'ICU & Critical Care Telemetry', badge: 'ICU' },
            { key: 'blood-bank', icon: Droplet, label: 'Blood Bank & Cross-Match', badge: 'ABO' },
            { key: 'emergency', icon: Flame, label: 'Trauma Resuscitation & A&E', badge: 'ESI' },
            { key: 'beds', icon: BedDouble, label: 'PACU Recovery Beds' },
          ],
        },
        {
          label: 'Pre-Op Diagnostics & Records',
          items: [
            { key: 'radiology', icon: Layers, label: 'Pre-Op Radiology & PACS', badge: 'DICOM' },
            { key: 'laboratory', icon: FlaskConical, label: 'Pre-Op Laboratory Workups' },
            { key: 'patient-card', icon: FileText, label: 'Digital Patient Record', badge: 'FHIR' },
          ],
        },
      ];

    case 'nurse':
      return [
        {
          label: 'Nursing Station Command',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Ward Nursing Station', badge: 'Live' },
            { key: 'nursing', icon: FileText, label: 'Inpatient Nursing & e-MAR', badge: 'e-MAR' },
            { key: 'beds', icon: BedDouble, label: 'Bed & Ward Management', badge: 'Beds' },
          ],
        },
        {
          label: 'Clinical Units & Patient Flow',
          items: [
            { key: 'emergency', icon: Flame, label: 'A&E Triage Queue', badge: 'ESI' },
            { key: 'patient-flow', icon: RefreshCw, label: 'Patient Transit & Admissions' },
            { key: 'maternity', icon: Stethoscope, label: 'Labour Ward & CTG Telemetry' },
            { key: 'paediatrics', icon: Baby, label: 'Paediatrics & NICU Incubators' },
            { key: 'blood-bank', icon: Droplet, label: 'Blood Transfusion Requests' },
            { key: 'pharmacy', icon: Pill, label: 'Ward Pharmacy Requisitions', badge: 'Rx' },
          ],
        },
        {
          label: 'Nursing Assist & Duty',
          items: [
            { key: 'm87-ai', icon: Brain, label: 'Nursing assistant', badge: 'AI' },
            { key: 'staffing', icon: Users, label: 'Nursing Duty Rosters' },
            { key: 'iot-devices', icon: Cpu, label: 'Bedside Telemetry Monitors', badge: 'IoT' },
            { key: 'patient-card', icon: FileText, label: 'Digital Health Card', badge: 'FHIR' },
          ],
        },
      ];

    case 'midwife':
      return [
        {
          label: 'Labour & Delivery Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Labour Ward Command', badge: 'Live' },
            { key: 'maternity', icon: Stethoscope, label: 'Maternity, Labour & CTG', badge: 'CTG' },
            { key: 'paediatrics', icon: Baby, label: 'Paediatrics & NICU Incubators', badge: 'NICU' },
          ],
        },
        {
          label: 'Obstetric Care & Flow',
          items: [
            { key: 'nursing', icon: FileText, label: 'Postnatal Inpatient Nursing' },
            { key: 'blood-bank', icon: Droplet, label: 'Obstetric Blood Crossmatch' },
            { key: 'beds', icon: BedDouble, label: 'Maternity Bed Board' },
            { key: 'patient-flow', icon: RefreshCw, label: 'Mother & Neonate Admissions' },
            { key: 'm87-ai', icon: Brain, label: 'Maternity assistant', badge: 'AI' },
            { key: 'patient-card', icon: FileText, label: 'Digital Health Card', badge: 'FHIR' },
          ],
        },
      ];

    case 'pharmacist':
      return [
        {
          label: 'Dispensary Command Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Pharmacy Dispensary Desk', badge: 'Live' },
            { key: 'pharmacy', icon: Pill, label: 'Patient ID Scanner & Dispense', badge: 'Scan' },
          ],
        },
        {
          label: 'Stocks, Logistics & Safety',
          items: [
            { key: 'inventory', icon: Package, label: 'Central Medical Store (CMS)', badge: 'CMS' },
            { key: 'nursing', icon: FileText, label: 'Inpatient e-MAR Administration' },
            { key: 'facilities', icon: Gauge, label: 'Cold Chain Storage Telemetry' },
            { key: 'm87-ai', icon: Brain, label: 'Drug Interaction & Safety AI', badge: 'AI' },
            { key: 'patient-card', icon: FileText, label: 'Patient Medication History' },
          ],
        },
      ];

    case 'lab':
      return [
        {
          label: 'Pathology & Diagnostic Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Laboratory Command Desk', badge: 'Live' },
            { key: 'laboratory', icon: FlaskConical, label: 'Lab LIS & Automated Analyzers', badge: 'LIS' },
          ],
        },
        {
          label: 'Specimens & Diagnostics',
          items: [
            { key: 'blood-bank', icon: Droplet, label: 'Blood Bank & Donor Screening', badge: 'ABO' },
            { key: 'data-hub', icon: Database, label: 'Central Telemetry Data Hub' },
            { key: 'iot-devices', icon: Cpu, label: 'Analyzer IoT Telemetry', badge: 'IoT' },
            { key: 'patient-card', icon: FileText, label: 'Specimen Patient Records' },
            { key: 'compliance', icon: FileText, label: 'Quality Control & Audit Logs' },
          ],
        },
      ];

    case 'radiologist':
      return [
        {
          label: 'Medical Imaging Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Radiology Command Desk', badge: 'Live' },
            { key: 'radiology', icon: Layers, label: 'Radiology & PACS Viewer', badge: 'DICOM' },
            { key: 'm87-ai', icon: Brain, label: 'Imaging assistant', badge: 'AI' },
          ],
        },
        {
          label: 'Modalities & Infrastructure',
          items: [
            { key: 'biomedical', icon: Wrench, label: 'Imaging Equipment Maintenance' },
            { key: 'data-hub', icon: Database, label: 'DICOM Image Telemetry Hub' },
            { key: 'patient-card', icon: FileText, label: 'Patient Imaging History' },
          ],
        },
      ];

    case 'accountant':
      return [
        {
          label: 'Revenue & Finance Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Finance Command Desk', badge: 'Live' },
            { key: 'cashier', icon: CreditCard, label: 'Cashier Shift Tills & POS', badge: 'POS' },
            { key: 'billing', icon: CreditCard, label: 'Inpatient / Outpatient Billing', badge: 'Bill' },
          ],
        },
        {
          label: 'Claims & Financial Ledger',
          items: [
            { key: 'claims', icon: ShieldCheck, label: 'Insurance & AKSHIA Claims', badge: 'HMO' },
            { key: 'revenue-cycle', icon: BarChart3, label: 'Revenue Cycle & Accounting' },
            { key: 'procurement', icon: Package, label: 'Procurement & Clinical Payroll' },
            { key: 'patient-card', icon: FileText, label: 'NHIA / Insurance Eligibility' },
            { key: 'command', icon: Activity, label: 'Hospital Operations Census' },
          ],
        },
      ];

    case 'biomedical':
      return [
        {
          label: 'Clinical Engineering Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Engineering Command Desk', badge: 'Live' },
            { key: 'biomedical', icon: Wrench, label: 'Biomedical Equipment Assets', badge: 'PM' },
            { key: 'iot-devices', icon: Cpu, label: 'Connected Medical IoT Monitors', badge: 'IoT' },
          ],
        },
        {
          label: 'Plant, Supplies & Safety',
          items: [
            { key: 'facilities', icon: Gauge, label: 'Oxygen Plant & Utilities' },
            { key: 'environmental', icon: Trash2, label: 'Environmental Health & Safety' },
            { key: 'inventory', icon: Package, label: 'Central Medical Store Parts' },
          ],
        },
      ];

    case 'records':
      return [
        {
          label: 'Health Records & Triage Desk',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Records Command Desk', badge: 'Live' },
            { key: 'patient-card', icon: FileText, label: 'Digital Health Card (FHIR)', badge: 'FHIR' },
            { key: 'patient-flow', icon: RefreshCw, label: 'Patient Transit & Admissions' },
            { key: 'beds', icon: BedDouble, label: 'Bed Management Board' },
            { key: 'claims', icon: ShieldCheck, label: 'NHIA Insurance Eligibility' },
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
            { key: 'm87-ai', icon: Brain, label: 'Hospital insights', badge: 'AI' },
            { key: 'analytics', icon: BarChart3, label: 'Clinical Performance Analytics' },
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
          label: 'Finance & access',
          items: [
            { key: 'revenue-cycle', icon: BarChart3, label: 'Revenue Cycle & Accounting' },
            { key: 'compliance', icon: FileText, label: 'MoH Compliance & Audit Logs' },
            { key: 'rbac', icon: Lock, label: 'Staff access control' },
            { key: 'sysadmin', icon: Settings, label: 'System Administration' },
          ],
        },
      ];

    case 'hospital_admin':
      return [
        {
          label: '',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { key: 'transfer', icon: Users, label: 'Hospital Staff Transfer' },
            { key: 'staffing', icon: Users, label: 'Staffing & Rosters' },
            { key: 'facility', icon: Building2, label: 'Hospital Management' },
          ],
        },
        {
          label: 'Operations & Bed Management',
          items: [
            { key: 'command', icon: Activity, label: 'Hospital Command Centre' },
            { key: 'beds', icon: BedDouble, label: 'Bed & Ward Occupancy' },
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
            { key: 'cashier', icon: BarChart3, label: 'Revenue & Cashier' },
          ],
        },
      ];

    case 'sysadmin':
    default:
      return [
        {
          label: 'System settings',
          items: [
            { key: 'dashboard', icon: LayoutDashboard, label: 'Admin home', badge: 'Live' },
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
          ],
        },
        {
          label: 'Interoperability & Hardware',
          items: [
            { key: 'fhir', icon: FileCode, label: 'FHIR R4 & HL7 Message Gateway', badge: 'R4' },
            { key: 'data-hub', icon: Database, label: 'Central Telemetry Data Hub' },
            { key: 'iot-devices', icon: Cpu, label: 'Medical Devices & IoT', badge: 'IoT' },
            { key: 'biomedical', icon: Wrench, label: 'Biomedical Equipment Assets' },
            { key: 'safety', icon: ShieldCheck, label: 'Disaster Recovery & BCP' },
            { key: 'compliance', icon: FileText, label: 'Security & Audit Logs' },
          ],
        },
      ];
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
    label: 'Physician Command',
    badge: 'DOCTOR WORKSPACE',
    accent: '#0052D4',
    gradient: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 82, 212, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Stethoscope,
    workspaceTitle: 'Doctor Clinical Workspace',
  },
  surgeon: {
    label: 'Surgical Command Suite',
    badge: 'SURGEON OPERATING DESK',
    accent: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #F43F5E 100%)',
    activeBg: 'linear-gradient(90deg, rgba(220, 38, 38, 0.28) 0%, rgba(244, 63, 94, 0.12) 100%)',
    icon: Activity,
    workspaceTitle: 'Operating Theatre & Surgeries',
  },
  nurse: {
    label: 'Nursing Station Command',
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
    label: 'Dispensary Command Desk',
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
  accountant: {
    label: 'Revenue & Finance Desk',
    badge: 'FINANCE COMMAND DESK',
    accent: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    activeBg: 'linear-gradient(90deg, rgba(217, 119, 6, 0.28) 0%, rgba(245, 158, 11, 0.12) 100%)',
    icon: CreditCard,
    workspaceTitle: 'Cashier Shift Tills & Billing',
  },
  records: {
    label: 'Health Records & Triage',
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
    workspaceTitle: 'Biomedical Equipment Assets',
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

const MODULE_COMPONENTS: Record<ModuleKey, React.FC<any>> = {
  dashboard: RoleDashboard as any,
  'doctor-portal': DoctorPortal as any,
  'm87-ai': M87AICopilotSuite,
  ai: AICommandInsights,
  emr: EMRManager,
  emergency: EmergencyTriageSuite,
  theatre: OperatingTheatreSuite,
  icu: CriticalCareIcuSuite,
  pharmacy: PharmacyDispensingSuite,
  laboratory: LaboratorySuite,
  radiology: RadiologyPacsSuite,
  maternity: MaternityOgSuite,
  paediatrics: PaediatricsNicuSuite,
  'blood-bank': BloodBankSuite,
  nursing: InpatientNursingSuite,
  'patient-card': DigitalPatientCard,
  command: CommandCentreDashboard,
  beds: BedManagement,
  'patient-flow': PatientFlowVisibility,
  staffing: StaffingOverview,
  ambulance: AmbulanceTransfersSuite,
  inventory: SupplyChainInventorySuite,
  biomedical: BiomedicalEquipmentSuite,
  facilities: FacilitiesUtilitiesSuite,
  environmental: EnvironmentalSafetySuite,
  billing: BillingInvoicingSuite,
  cashier: CashierRevenue,
  claims: InsuranceHmoClaimsSuite,
  'revenue-cycle': RevenueCycleAccountingSuite,
  procurement: ProcurementHrSuite,
  'data-hub': IntegratedDataHub,
  fhir: FhirHl7GatewaySuite,
  analytics: PerformanceAnalytics,
  'iot-devices': ConnectedDevicesSuite,
  auth: AuthIdentity,
  facility: FacilityOnboarding,
  rbac: AccessControl,
  compliance: ComplianceAuditLogs,
  safety: ClinicalSafetyBcpSuite,
  sysadmin: SystemAdministration,
  transfer: HospitalStaffTransfer as any,
  enrolment: StaffEnrolment as any,
  'my-card': DigitalPatientCard as any,
};

const MODULE_CLEARANCE: Record<ModuleKey, { level: number; label: string; roleDesc: string }> = {
  dashboard: { level: 2, label: 'L2 All Roles', roleDesc: 'Dedicated Role Command Desk' },
  'doctor-portal': { level: 3, label: 'L3 Clinical', roleDesc: 'Licensed Medical Doctors & Clinical Officers' },
  emr: { level: 2, label: 'L2 Clinical & Records', roleDesc: 'Physicians, Clinical Officers & Records' },
  'm87-ai': { level: 3, label: 'L3 Clinical', roleDesc: 'Clinical Officers & Nursing Supervisors' },
  ai: { level: 3, label: 'L3 Clinical', roleDesc: 'Clinical Decision Support & Physicians' },
  emergency: { level: 3, label: 'L3 Clinical', roleDesc: 'A&E Triage Officers & Medical Doctors' },
  theatre: { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Consultant Surgeons & Anesthetists' },
  icu: { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Intensivists & Critical Care Specialists' },
  pharmacy: { level: 3, label: 'L3 Clinical / Pharmacy', roleDesc: 'Licensed Pharmacists & Pharmacy Technicians' },
  laboratory: { level: 2, label: 'L2 Support / Lab', roleDesc: 'Medical Laboratory Scientists' },
  radiology: { level: 3, label: 'L3 Clinical', roleDesc: 'Radiologists & Sonographers' },
  maternity: { level: 3, label: 'L3 Clinical', roleDesc: 'Obstetricians & Certified Midwives' },
  paediatrics: { level: 3, label: 'L3 Clinical', roleDesc: 'Paediatricians & NICU Nurses' },
  'blood-bank': { level: 2, label: 'L2 Support', roleDesc: 'Hematology Technicians & Blood Bank Officers' },
  nursing: { level: 3, label: 'L3 Clinical', roleDesc: 'Inpatient Ward Nurses & Sisters' },
  'patient-card': { level: 2, label: 'L2 Support', roleDesc: 'Records & Front Desk Officers' },
  command: { level: 2, label: 'L2 Support', roleDesc: 'General Hospital Staff & Floor Duty' },
  beds: { level: 3, label: 'L3 Clinical', roleDesc: 'Bed Managers & Ward Supervisors' },
  'patient-flow': { level: 3, label: 'L3 Clinical', roleDesc: 'Patient Flow Coordinators' },
  staffing: { level: 3, label: 'L3 Clinical', roleDesc: 'Duty Roster Officers & Matrons' },
  ambulance: { level: 2, label: 'L2 Support', roleDesc: 'EMS Dispatchers & Paramedics' },
  inventory: { level: 2, label: 'L2 Support', roleDesc: 'Procurement & Inventory Managers' },
  biomedical: { level: 2, label: 'L2 Support', roleDesc: 'Biomedical Engineers' },
  facilities: { level: 2, label: 'L2 Support', roleDesc: 'Facility Maintenance & Plant Engineers' },
  environmental: { level: 2, label: 'L2 Support', roleDesc: 'Environmental Health & Infection Control' },
  billing: { level: 2, label: 'L2 Finance', roleDesc: 'Hospital Billing Accountants' },
  cashier: { level: 2, label: 'L2 Finance', roleDesc: 'Revenue Collectors & Cashiers' },
  claims: { level: 2, label: 'L2 Finance', roleDesc: 'AKSHIA & HMO Adjudicators' },
  'revenue-cycle': { level: 2, label: 'L2 Finance', roleDesc: 'Finance Directors & Revenue Officers' },
  procurement: { level: 2, label: 'L2 Finance', roleDesc: 'Procurement & HR Officers' },
  'data-hub': { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Health Informaticians & Clinical Directors' },
  fhir: { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Interoperability Engineers & MoH Liaisons' },
  analytics: { level: 3, label: 'L3 Clinical', roleDesc: 'Clinical Audit & Quality Analysts' },
  'iot-devices': { level: 2, label: 'L2 Support', roleDesc: 'Biomedical & Telemetry Technicians' },
  auth: { level: 5, label: 'L5 Executive', roleDesc: 'Hospital IAM Administrator' },
  facility: { level: 5, label: 'L5 Executive', roleDesc: 'Medical Director & MoH Commissioners' },
  rbac: { level: 5, label: 'L5 Executive', roleDesc: 'IAM Security & Access Controllers' },
  compliance: { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Clinical Audit & Legal Compliance' },
  safety: { level: 2, label: 'L2 Support', roleDesc: 'Disaster Recovery & Downtime Officers' },
  sysadmin: { level: 5, label: 'L5 Executive', roleDesc: 'System Administrators & CIO' },
  transfer: { level: 4, label: 'L4 Operations', roleDesc: 'Hospital Administrators & Medical Directors' },,
  enrolment: { level: 4, label: 'Administrator', roleDesc: 'Hospital administrators enrol staff' },
  'my-card': { level: 2, label: 'All staff', roleDesc: 'Staff identity card' },
};

export default function OSPage() {
  const [appState, setAppState] = useState<'splash' | 'auth' | 'app'>('splash');
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const { criticalAlert, dismissCriticalAlert } = useRealtimeEvents({ app: 'MEDCORE_OS', facilityId: userSession?.facility });
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [moduleKey, setModuleKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [activeEmergencyCode, setActiveEmergencyCode] = useState<string | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showFullDirectory, setShowFullDirectory] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const [wsConnected, setWsConnected] = useState(true);
  const [wsLatency, setWsLatency] = useState(12);

  // Live real-time hospital telemetry stream
  const [realtimeEvents, setRealtimeEvents] = useState<LiveTelemetryEvent[]>([
    {
      id: 'EVT-01',
      time: '09:28:14',
      category: 'RX',
      message: 'RX-PAT-991002 routed to MedPlus Pharmacy Ikoyi — Patient notified',
      badgeColor: '#38BDF8',
    },
    {
      id: 'EVT-02',
      time: '09:26:40',
      category: 'TRIAGE',
      message: 'A&E Triage update: 14 patients waiting • ESI-2 priority allocated to Bay 4',
      badgeColor: '#F59E0B',
    },
    {
      id: 'EVT-03',
      time: '09:25:05',
      category: 'BED',
      message: 'Ward 4-West: Robert Chen (MRN-849102) vital signs recorded • SpO2 96% BP 142/88',
      badgeColor: '#10B981',
    },
    {
      id: 'EVT-04',
      time: '09:23:30',
      category: 'SURGERY',
      message: 'Theatre 2: WHO Surgical Safety Time-Out completed for Case #4892',
      badgeColor: '#A855F7',
    },
    {
      id: 'EVT-05',
      time: '09:21:12',
      category: 'BILLING',
      message: 'Cashier Till #1: ₦38,200 AKSHIA HMO co-pay settled • Transaction TX-90412',
      badgeColor: '#34D399',
    },
  ]);

  const isModulePermitted = (key: ModuleKey): boolean => {
    if (!userSession) return false;
    if (key === 'dashboard') return true;
    if (userSession.permissions?.includes('*')) return true;
    if (userSession.permissions?.includes(key)) return true;
    const req = MODULE_CLEARANCE[key];
    if (req && userSession.clearanceLevel >= req.level) return true;
    return false;
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('medcore_os_session');
      if (saved) {
        setUserSession(JSON.parse(saved));
        setActiveModule('dashboard');
      }
    } catch {
      // ignore
    }

    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    // WebSocket real-time live connection
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const initWebSocket = () => {
      try {
        ws = new WebSocket('ws://localhost:4000/ws');
        ws.onopen = () => {
          setWsConnected(true);
          setWsLatency(Math.floor(Math.random() * 8) + 8);
        };
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.topic) {
              const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              let cat: LiveTelemetryEvent['category'] = 'BED';
              let color = '#38BDF8';
              if (data.topic.includes('PRESCRIPTION') || data.topic.includes('MEDICATION')) {
                cat = 'RX';
                color = '#38BDF8';
              } else if (data.topic.includes('SURGE') || data.topic.includes('TRIAGE')) {
                cat = 'TRIAGE';
                color = '#EF4444';
              } else if (data.topic.includes('BILL') || data.topic.includes('PAYMENT')) {
                cat = 'BILLING';
                color = '#34D399';
              } else if (data.topic.includes('LAB')) {
                cat = 'LAB';
                color = '#A855F7';
              }

              const newEvt: LiveTelemetryEvent = {
                id: `WS-${Date.now()}`,
                time: nowStr,
                category: cat,
                message: data.payload?.message || `${data.topic} event logged at ${nowStr}`,
                badgeColor: color,
              };

              setRealtimeEvents(prev => [newEvt, ...prev.slice(0, 19)]);
            }
          } catch {
            // ignore non-json
          }
        };
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(initWebSocket, 5000);
        };
        ws.onerror = () => {
          setWsConnected(false);
          ws?.close();
        };
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(initWebSocket, 6000);
      }
    };

    initWebSocket();

    // Heartbeat latency jitter
    const latencyInterval = setInterval(() => {
      setWsLatency(Math.floor(Math.random() * 6) + 9);
    }, 10000);

    // Global keyboard shortcuts (Cmd+K / Ctrl+K and Escape)
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setCmdPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      clearInterval(interval);
      clearInterval(latencyInterval);
      window.removeEventListener('keydown', handleGlobalKey);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const handleSplashComplete = () => {
    if (userSession) {
      setAppState('app');
    } else {
      setAppState('auth');
    }
  };

  const handleLoginSuccess = (session: UserSession) => {
    setUserSession(session);
    setActiveModule('dashboard');
    setAppState('app');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('medcore_os_session');
    } catch {
      // ignore
    }
    setUserSession(null);
    setAppState('auth');
  };

  const handleLockScreen = () => {
    setIsLocked(true);
    setUnlockPin('');
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLocked(false);
  };

  const handleModuleChange = (key: ModuleKey) => {
    setActiveModule(key);
    setModuleKey(prev => prev + 1);
  };

  const handleSwitchCadre = (staff: typeof PRESET_STAFF[0]) => {
    const newSession: UserSession = {
      id: staff.badgeId,
      name: staff.name,
      role: staff.role,
      title: staff.title,
      roleKey: staff.roleKey,
      badgeId: staff.badgeId,
      clearanceLevel: staff.clearanceLevel,
      clearanceLabel: staff.clearanceLabel,
      facility: staff.hospitalName || userSession?.facility || 'Lagos Island General Hospital',
      hospitalId: staff.hospitalId || userSession?.hospitalId || 'LIGH',
      department: staff.department,
      avatarInitials: staff.initials,
      authMethod: 'Admin switch',
      token: `AUTH-${Date.now().toString(36).toUpperCase()}`,
      loginTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      permissions: staff.permissions,
    };
    setUserSession(newSession);
    setActiveModule('dashboard');
    setModuleKey(prev => prev + 1);
    setShowRoleModal(false);
    try {
      localStorage.setItem('medcore_os_session', JSON.stringify(newSession));
    } catch {}
  };

  // ── Command Palette data (must be before early returns — Rules of Hooks) ──
  const allPaletteCommands = useMemo(() => {
    const list: { id: string; label: string; group: string; icon: any; action: () => void; badge?: string }[] = [];
    
    // Quick Actions
    list.push(
      {
        id: 'act-switch-role',
        label: 'View as another staff (admin only)',
        group: 'Quick Actions',
        icon: ShieldCheck,
        action: () => { setShowRoleModal(true); setCmdPaletteOpen(false); },
        badge: 'Admin'
      },
      {
        id: 'act-copilot',
        label: 'Open clinical assistant',
        group: 'Quick Actions',
        icon: Brain,
        action: () => { setAiDrawerOpen(true); setCmdPaletteOpen(false); },
        badge: 'AI'
      },
      {
        id: 'act-alert',
        label: 'Send hospital alert',
        group: 'Quick Actions',
        icon: AlertTriangle,
        action: () => {
          const code = prompt('Broadcast Clinical Alert: (Type "BLUE", "RED", or "YELLOW")');
          if (code) setActiveEmergencyCode(`CODE ${code.toUpperCase()}`);
          setCmdPaletteOpen(false);
        },
        badge: 'Emergency'
      },
      {
        id: 'act-lock',
        label: 'Lock Workstation Terminal Screen',
        group: 'Quick Actions',
        icon: Lock,
        action: () => { handleLockScreen(); setCmdPaletteOpen(false); },
        badge: 'Security'
      }
    );

    // Get all navigation sections from master directory
    const allSections = getRoleNavSections(null, true);
    allSections.forEach(sec => {
      sec.items.forEach(item => {
        list.push({
          id: `mod-${item.key}`,
          label: item.label,
          group: sec.label,
          icon: item.icon,
          badge: item.badge,
          action: () => {
            handleModuleChange(item.key as ModuleKey);
            setCmdPaletteOpen(false);
          }
        });
      });
    });

    return list;
  }, []);

  const filteredCommands = useMemo(() => {
    if (!cmdSearch.trim()) return allPaletteCommands;
    const q = cmdSearch.toLowerCase();
    return allPaletteCommands.filter(c => 
      c.label.toLowerCase().includes(q) || 
      c.group.toLowerCase().includes(q) ||
      (c.badge && c.badge.toLowerCase().includes(q))
    );
  }, [cmdSearch, allPaletteCommands]);

  if (appState === 'splash') {
    return (
      <SplashScreen
        onComplete={handleSplashComplete}
        title="IBOM HEALTH OS"
        subtitle="Akwa Ibom State Hospital Operations & Clinical Information System"
      />
    );
  }

  if (appState === 'auth') {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const ActiveComponent = MODULE_COMPONENTS[activeModule] || CommandCentreDashboard;

  // Resolve active role theme
  const roleTitle = (userSession?.role || userSession?.title || '').toLowerCase();
  const activeRoleKey = userSession?.roleKey ||
    (roleTitle.includes('surgeon') ? 'surgeon'
      : roleTitle.includes('nurse') ? 'nurse'
      : roleTitle.includes('midwife') ? 'midwife'
      : roleTitle.includes('pharmacist') ? 'pharmacist'
      : roleTitle.includes('lab') ? 'lab'
      : roleTitle.includes('radiolog') ? 'radiologist'
      : roleTitle.includes('account') || roleTitle.includes('cashier') ? 'accountant'
      : roleTitle.includes('record') ? 'records'
      : roleTitle.includes('biomedical') ? 'biomedical'
      : roleTitle.includes('director') || roleTitle.includes('superintendent') ? 'medical_director'
      : roleTitle.includes('admin') || roleTitle.includes('administrator') ? 'hospital_admin'
      : roleTitle.includes('ict') ? 'sysadmin'
      : 'doctor');
  const currentRoleTheme = ROLE_THEMES[activeRoleKey] || ROLE_THEMES.doctor;
  const RoleIcon = currentRoleTheme.icon;

  // Dynamically load tailored RBAC sidebar content
  const roleNavSections = getRoleNavSections(userSession, showFullDirectory);

  // Full admin chrome replaces the clinical OS shell
  if (userSession && (activeRoleKey === 'hospital_admin' || userSession.roleKey === 'hospital_admin')) {
    return (
      <AdminShell
        session={userSession}
        onLogout={handleLogout}
      />
    );
  }


  // Filtered Nav items based on search
  const filteredSections = roleNavSections.map(sec => ({
    ...sec,
    items: sec.items.filter(item =>
      item.label.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      (item.badge && item.badge.toLowerCase().includes(sidebarSearch.toLowerCase()))
    ),
  })).filter(sec => sec.items.length > 0);


  return (
    <div className="os-workspace-shell">
      {/* ── Command Palette (⌘K / Ctrl+K Spotlight Modal) ── */}
      {cmdPaletteOpen && (
        <div className="os-cmd-palette-backdrop" onClick={() => setCmdPaletteOpen(false)}>
          <div className="os-cmd-palette-modal" onClick={e => e.stopPropagation()}>
            <div className="os-cmd-search-header">
              <Search size={18} style={{ color: '#0052D4', flexShrink: 0 }} />
              <input
                autoFocus
                className="os-cmd-input"
                placeholder="Search modules, clinical pathways, patients, or actions..."
                value={cmdSearch}
                onChange={e => setCmdSearch(e.target.value)}
              />
              <span className="os-cmd-kbd">ESC</span>
            </div>
            <div className="os-cmd-results">
              {filteredCommands.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                  No matching modules or actions found for "{cmdSearch}"
                </div>
              ) : (
                filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      className="os-cmd-item"
                      onClick={cmd.action}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: 'rgba(0, 82, 212, 0.08)',
                          color: '#0052D4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.86rem' }}>{cmd.label}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{cmd.group}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {cmd.badge && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: '#F1F5F9',
                            color: '#475569'
                          }}>
                            {cmd.badge}
                          </span>
                        )}
                        <CornerDownLeft size={13} style={{ color: '#94A3B8' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick RBAC Switcher Modal ── */}
      {showRoleModal && (
        <div className="os-lock-modal-backdrop" onClick={() => setShowRoleModal(false)}>
          <div
            className="os-lock-card"
            style={{ maxWidth: 640, textAlign: 'left', padding: '28px 32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#F8FAFC', fontFamily: 'var(--os-font-heading)' }}>
                  Switch staff account (admin)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                  Select a clinical or operational role to test its dedicated dashboard and personalized sidebar navigation.
                </p>
              </div>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: 6 }}
                onClick={() => setShowRoleModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 16 }}>
              {PRESET_STAFF.map(staff => {
                const isCurrent = userSession?.badgeId === staff.badgeId;
                return (
                  <div
                    key={staff.badgeId}
                    onClick={() => handleSwitchCadre(staff)}
                    style={{
                      background: isCurrent ? 'linear-gradient(90deg, rgba(0,82,212,0.1) 0%, rgba(0,191,165,0.08) 100%)' : '#FFFFFF',
                      border: `1.5px solid ${isCurrent ? '#0052D4' : '#E2E8F0'}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: isCurrent ? 'linear-gradient(135deg, #0052D4, #00BFA5)' : `${staff.color || '#0052D4'}18`,
                        color: isCurrent ? '#FFFFFF' : (staff.color || '#0052D4'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        flexShrink: 0,
                      }}
                    >
                      {staff.initials}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0A2540', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {staff.name}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0052D4', background: 'rgba(0,82,212,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                          L{staff.clearanceLevel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                        {staff.role.split('/')[0].trim()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Lock Screen Modal ── */}
      {isLocked && (
        <div className="os-lock-modal-backdrop">
          <div className="os-lock-card">
            <div className="os-lock-icon-wrap">
              <Lock size={30} />
            </div>
            <div style={{ marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 9999, padding: '3px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#FB923C', letterSpacing: '0.05em' }}>
              IBOM HEALTH OS · TERMINAL SECURED
            </div>
            <h3 style={{ margin: '10px 0 6px 0', color: '#0A2540', fontFamily: 'var(--os-font-heading)', fontSize: '1.3rem' }}>Workstation Locked</h3>
            <p style={{ margin: '0 0 22px 0', fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.5 }}>
              Staff on Duty: <strong style={{ color: '#FB923C' }}>{userSession?.name}</strong><br />
              <span style={{ color: '#64748B', fontSize: '0.75rem' }}>Enter your security passcode to resume session.</span>
            </p>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                className="os-form-input"
                placeholder="Enter passcode"
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.1rem', marginBottom: 14 }}
              />
              <button type="submit" className="os-login-submit-btn" style={{ margin: 0 }}>
                <Unlock size={16} />
                <span>Unlock Terminal</span>
              </button>
            </form>
            <div style={{ marginTop: 18, fontSize: '0.72rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span className="os-status-dot pulse-green" />
              <span>Session active · {userSession?.facility}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-Over M87 AI Copilot Drawer ── */}
      {aiDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          zIndex: 900,
          background: '#FFFFFF',
          backdropFilter: 'blur(30px)',
          borderLeft: '1px solid #E2E8F0',
          boxShadow: '-10px 0 40px rgba(0,82,212,0.1)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s ease-out',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(90deg, rgba(0,82,212,0.06) 0%, rgba(0,191,165,0.06) 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={18} style={{ color: '#7C3AED' }} />
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0A2540' }}>M87 AI Clinical Copilot</span>
            </div>
            <button
              type="button"
              className="os-ghost-btn"
              style={{ padding: 4 }}
              onClick={() => setAiDrawerOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <M87AICopilotSuite />
          </div>
        </div>
      )}

      {/* ── Left Navigation Sidebar (Bespoke Content per RBAC Role) ── */}
      <aside 
        className="os-sidebar" 
        style={{ width: sidebarOpen ? 275 : 64 }}
      >
        <div className="os-sidebar-header">
          <div className="os-sidebar-brand">
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#FFFFFF',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              flexShrink: 0,
            }}>
              <img
                src="/medcore-logo.png"
                alt="MedCore Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            {sidebarOpen && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="os-brand-text" style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>MedCore</span>
                <span style={{ fontSize: '0.66rem', color: currentRoleTheme.accent, fontWeight: 800, letterSpacing: '0.05em' }}>
                  {currentRoleTheme.badge}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="os-sidebar-toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Distinct Role Identity Header Card */}
        {sidebarOpen ? (
          <div style={{
            margin: '8px 10px 10px',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${currentRoleTheme.accent}33`,
            boxShadow: `0 2px 10px ${currentRoleTheme.accent}12`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: currentRoleTheme.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              flexShrink: 0,
              boxShadow: `0 2px 8px ${currentRoleTheme.accent}40`,
            }}>
              <RoleIcon size={17} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: currentRoleTheme.accent,
                textTransform: 'uppercase',
              }}>
                {currentRoleTheme.label}
              </div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {userSession?.name || 'Staff Officer'}
              </div>
              <div style={{
                fontSize: '0.66rem',
                color: '#94A3B8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {userSession?.facility || 'Hospital Network'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: currentRoleTheme.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            margin: '8px auto',
            boxShadow: `0 2px 8px ${currentRoleTheme.accent}33`,
          }} title={`${currentRoleTheme.label} - ${userSession?.name}`}>
            <RoleIcon size={18} />
          </div>
        )}

        {/* Quick Module Search Input */}
        {sidebarOpen && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #1A2F4C' }}>
            <div className="os-search-wrap" style={{ minWidth: 'unset', width: '100%', padding: '6px 10px' }}>
              <Search size={12} />
              <input
                className="os-search-input"
                style={{ fontSize: '0.75rem' }}
                placeholder="Jump to suite or ward..."
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <nav className="os-sidebar-nav">
          {filteredSections.map((sec) => (
            <div key={sec.label} style={{ marginBottom: 14 }}>
              {sidebarOpen && (
                <div className="os-nav-section-label" style={{ fontSize: '0.66rem', color: '#94A3B8' }}>{sec.label}</div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.key;
                const permitted = isModulePermitted(item.key);
                const reqClearance = MODULE_CLEARANCE[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleModuleChange(item.key)}
                    className={`os-nav-item-btn ${isActive ? 'active' : ''}`}
                    title={!sidebarOpen ? `${item.label} (${reqClearance?.label || 'General'})` : undefined}
                    style={{
                      padding: '8px 12px',
                      opacity: permitted ? 1 : 0.65,
                      color: isActive ? '#FFFFFF' : '#E2E8F0',
                      background: isActive ? currentRoleTheme.activeBg : 'transparent',
                      borderLeft: isActive ? `3.5px solid ${currentRoleTheme.accent}` : '3.5px solid transparent',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '0 8px 8px 0',
                      marginRight: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={16} style={{ color: isActive ? currentRoleTheme.accent : '#94A3B8', flexShrink: 0 }} />
                    {sidebarOpen && <span style={{ fontSize: '0.78rem' }}>{item.label}</span>}
                    {sidebarOpen && !permitted && (
                      <Lock size={12} style={{ color: '#F87171', marginLeft: 'auto', flexShrink: 0 }} />
                    )}
                    {sidebarOpen && permitted && item.badge && (
                      <span className="os-nav-badge" style={{
                        fontSize: '0.62rem',
                        padding: '1px 6px',
                        background: isActive ? currentRoleTheme.accent : undefined,
                        color: isActive ? '#FFFFFF' : undefined,
                      }}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Directory Mode Switcher (For Executives or full exploration) */}
          {sidebarOpen && (
            <div style={{ padding: '10px 8px', borderTop: '1px solid #1A2F4C', marginTop: 12 }}>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem', padding: '6px 8px' }}
                onClick={() => setShowFullDirectory(!showFullDirectory)}
              >
                <Globe size={13} />
                <span>{showFullDirectory ? 'Show my menu only' : 'Show all menus'}</span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer User Info */}
        {sidebarOpen && userSession && (
          <div className="os-sidebar-footer">
            <div className="os-user-mini-card">
              <div className="os-user-mini-avatar">
                {userSession.avatarInitials}
              </div>
              <div className="os-user-mini-info">
                <span className="os-user-mini-name">{userSession.name}</span>
                <span className="os-user-mini-role">{userSession.role.split('/')[0]}</span>
              </div>
              {/* access level chip removed — keep header simple for staff */}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Operations Column (Desktop Fit) ── */}
      <div className="os-main-column">
        {/* Real-Time Critical Alert Banner */}
        <AlertBanner alert={criticalAlert} onDismiss={dismissCriticalAlert} />

        {/* Top Operations Header */}
        <header className="os-top-hud">
          <div className="os-top-hud-left">
            <div className="os-hud-facility-pill">
              <Building2 size={13} />
              <span>{userSession?.facility || 'Ibom Specialist Hospital, Uyo'}</span>
            </div>
            <div className="os-hud-live-pill">
              <span className="os-status-dot pulse-green" />
              <span>Online</span>
            </div>
            {userSession && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                <span style={{ color: '#0A2540', fontWeight: 700 }}>{userSession.name}</span>
                <span style={{ color: '#94A3B8' }}>·</span>
                <span style={{ color: '#475569', fontWeight: 600 }}>{userSession.role.split('/')[0]}</span>
                <span style={{ background: '#F1F5F9', color: '#64748B', borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 }}>
                  {userSession.department.split('&')[0].trim()}
                </span>
              </div>
            )}
          </div>

          <div className="os-top-hud-right">
            <button
              type="button"
              className="os-hud-btn"
              onClick={() => setCmdPaletteOpen(true)}
              title="Search modules"
              style={{
                background: 'rgba(0, 82, 212, 0.05)',
                borderColor: 'rgba(0, 82, 212, 0.2)',
                color: '#0052D4',
              }}
            >
              <Search size={14} />
              <span>Search</span>
            </button>

            <NotificationBell app="MEDCORE_OS" facilityId={userSession?.facility} />

            <div className="os-hud-clock">
              <span>{currentTime || '09:00:00'}</span>
            </div>

            <button
              type="button"
              className="os-hud-btn"
              style={{
                background: 'rgba(0, 102, 255, 0.06)',
                borderColor: 'rgba(0, 102, 255, 0.2)',
                color: '#0066FF',
                fontWeight: 600,
              }}
              onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
              title="Open clinical assistant"
            >
              <Brain size={14} />
              <span>Assistant</span>
            </button>

            <button
              type="button"
              className="os-hud-btn os-hud-btn-alert"
              onClick={() => {
                const code = prompt('Send hospital alert (e.g. BLUE for cardiac arrest, RED for fire, YELLOW for surge):');
                if (code) setActiveEmergencyCode(`CODE ${code.toUpperCase()}`);
              }}
            >
              <AlertTriangle size={14} />
              <span>Alert</span>
            </button>

            <button
              type="button"
              className="os-hud-btn"
              onClick={handleLockScreen}
              title="Lock screen"
            >
              <Lock size={14} />
              <span>Lock</span>
            </button>

            <button
              type="button"
              className="os-hud-btn"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Activity strip — plain language */}
        <div className="os-realtime-ticker">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontWeight: 700, color: '#38BDF8' }}>
            <span className="os-status-dot pulse-green" />
            <span>LIVE UPDATES</span>
          </div>
          <div className="os-ticker-track">
            {realtimeEvents.map((evt) => (
              <div key={evt.id} className="os-ticker-item">
                <span className="os-ticker-badge" style={{ background: `${evt.badgeColor}25`, color: evt.badgeColor }}>
                  {evt.category}
                </span>
                <span style={{ color: '#64748B', fontSize: '0.68rem', fontFamily: 'var(--os-font-mono)' }}>{evt.time}</span>
                <span style={{ color: '#F8FAFC' }}>{evt.message}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, color: '#34D399', fontWeight: 600, fontSize: '0.7rem' }}>
            <Zap size={12} />
            <span>{wsLatency}ms · {wsConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Emergency Alert Banner */}
        {activeEmergencyCode && (
          <div className="os-emergency-active-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} />
              <span>HOSPITAL BROADCAST: {activeEmergencyCode} — Clinical Response Team deployed to Accident & Emergency</span>
            </div>
            <button
              type="button"
              className="os-clear-alert-btn"
              onClick={() => setActiveEmergencyCode(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Viewport — Perfectly fitted for Desktop Screen */}
        <main className="os-viewport-content">
          {activeModule === 'command' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontFamily: 'var(--os-font-heading)', fontWeight: 800, color: '#F8FAFC' }}>
                  Hospital Operations & Inpatient Census Overview
                </h1>
                <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.88rem' }}>
                  Live hospital status across Inpatient Wards, Emergency Triage, ICU Beds, and Clinical Duty Staff.
                </p>
              </div>

              <section className="os-metrics-ribbon">
                <div className="metric-box">
                  <span className="metric-label">Hospital Bed Occupancy</span>
                  <span className="metric-val">482 / 520</span>
                  <span className="metric-sub">92.6% Occupancy • 38 Beds Available</span>
                </div>
                <div className="metric-box alert-yellow">
                  <span className="metric-label">Accident & Emergency (A&E)</span>
                  <span className="metric-val">28 mins</span>
                  <span className="metric-sub">14 Patients Waiting in Triage</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Intensive Care Unit (ICU)</span>
                  <span className="metric-val">44 / 48</span>
                  <span className="metric-sub">4 Ventilator Beds Ready</span>
                </div>
                <div className="metric-box alert-green">
                  <span className="metric-label">Staff on Duty</span>
                  <span className="metric-val">186 Staff</span>
                  <span className="metric-sub">34 Doctors • 112 Nurses • 40 Support</span>
                </div>
              </section>
            </>
          )}

          <div key={moduleKey} className="os-active-module-wrap">
            {isModulePermitted(activeModule) ? (
              activeModule === 'dashboard' && userSession ? (
                <RoleDashboard session={userSession} onNavigate={handleModuleChange} />
              ) : (
                <ActiveComponent session={userSession} onNavigate={handleModuleChange} />
              )
            ) : (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 18,
                  padding: '44px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  maxWidth: 680,
                  margin: '40px auto',
                  boxShadow: '0 20px 50px rgba(239,68,68,0.08)',
                  animation: 'fadeUp 0.3s ease-out',
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1.5px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#EF4444',
                    marginBottom: 18,
                  }}
                >
                  <Lock size={30} />
                </div>

                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#DC2626',
                    background: 'rgba(239, 68, 68, 0.08)',
                    padding: '3px 10px',
                    borderRadius: 6,
                    marginBottom: 10,
                  }}
                >
                  Access restricted — you need permission for this area
                </div>

                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#0A2540', fontFamily: 'var(--os-font-heading)' }}>
                  Clearance Elevation Required
                </h2>

                <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '0.88rem', lineHeight: 1.6, maxWidth: 540 }}>
                  This suite requires <strong>{MODULE_CLEARANCE[activeModule]?.label || 'Higher Clearance'}</strong> ({MODULE_CLEARANCE[activeModule]?.roleDesc}).
                  Your current clearance is <strong>{userSession?.clearanceLabel}</strong> ({userSession?.name} — {userSession?.role}).
                </p>

                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '14px 18px',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 24,
                    fontSize: '0.78rem',
                    color: '#64748B',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0A2540', marginBottom: 4 }}>
                    Access note:
                  </div>
                  <div>
                    Patient records and admin settings are limited by your job role. Access attempts are recorded for security.
                  </div>
                </div>

                {/* Sign in as another role (testing) */}
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>
                    Switch to an authorized staff role to access this suite:
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {PRESET_STAFF.map(staff => {
                      const isAuth = staff.clearanceLevel >= (MODULE_CLEARANCE[activeModule]?.level || 0);
                      return (
                        <button
                          key={staff.badgeId}
                          type="button"
                          onClick={() => handleSwitchCadre(staff)}
                          className="os-ghost-btn"
                          style={{
                            fontSize: '0.74rem',
                            borderColor: isAuth ? 'rgba(5,150,105,0.4)' : undefined,
                            color: isAuth ? '#059669' : undefined,
                          }}
                        >
                          <ShieldCheck size={13} />
                          <span>{staff.shortRole}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
