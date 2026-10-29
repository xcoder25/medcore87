'use client';

/**
 * Lazy clinical module registry — keeps page.tsx as a thin shell.
 * Each suite is a separate webpack chunk via next/dynamic.
 */
import React from 'react';
import dynamic from 'next/dynamic';
import { ModulePageLoader } from '../components/layout/ModulePageLoader';

export const CommandCentreDashboard = dynamic(() => import('../components/command-centre/CommandCentreDashboard').then(m => m.CommandCentreDashboard), { loading: () => <ModulePageLoader label="Opening Command Centre…" /> });
export const RoleDashboard = dynamic(() => import('../components/dashboards/RoleDashboard').then(m => m.RoleDashboard), { loading: () => <ModulePageLoader label="Opening Dashboard…" /> });
export const DoctorPortal = dynamic(() => import('../components/dashboards/DoctorPortal').then(m => m.DoctorPortal), { loading: () => <ModulePageLoader label="Opening Doctor Portal…" /> });
export const ReceptionWorkspace = dynamic(() => import('../components/dashboards/ReceptionWorkspace').then(m => m.ReceptionWorkspace), { loading: () => <ModulePageLoader label="Opening Reception Workspace…" /> });
export const M87AICopilotSuite = dynamic(() => import('../components/ai-insights/M87AICopilotSuite').then(m => m.M87AICopilotSuite), { loading: () => <ModulePageLoader label="Opening Celestia AI…" /> });

// Lazy-loaded Specialty & Operations Suites (Code-split into on-demand chunks for fast runtime)
export const BedManagement = dynamic(() => import('../components/beds/BedManagement').then(m => m.BedManagement), { loading: () => <ModulePageLoader label="Opening Bed Management…" /> });
export const PatientFlowVisibility = dynamic(() => import('../components/patient-flow/PatientFlowVisibility').then(m => m.PatientFlowVisibility), { loading: () => <ModulePageLoader label="Opening Patient Flow…" /> });
export const StaffingOverview = dynamic(() => import('../components/staffing/StaffingOverview').then(m => m.StaffingOverview), { loading: () => <ModulePageLoader label="Opening Staffing Overview…" /> });
export const IntegratedDataHub = dynamic(() => import('../components/data-hub/IntegratedDataHub').then(m => m.IntegratedDataHub), { loading: () => <ModulePageLoader label="Opening Data Hub…" /> });
export const StatewideEmrSuite = dynamic(() => import('../components/interop/StatewideEmrSuite').then(m => m.StatewideEmrSuite), { loading: () => <ModulePageLoader label="Opening statewide suite…" /> });
export const PerformanceAnalytics = dynamic(() => import('../components/analytics/PerformanceAnalytics').then(m => m.PerformanceAnalytics), { loading: () => <ModulePageLoader label="Opening Analytics…" /> });
export const AccessControl = dynamic(() => import('../components/rbac/AccessControl').then(m => m.AccessControl), { loading: () => <ModulePageLoader label="Opening Access Control…" /> });
export const SystemAdministration = dynamic(() => import('../components/system-admin/SystemAdministration').then(m => m.SystemAdministration), { loading: () => <ModulePageLoader label="Opening System Admin…" /> });
export const ComplianceAuditLogs = dynamic(() => import('../components/compliance/ComplianceAuditLogs').then(m => m.ComplianceAuditLogs), { loading: () => <ModulePageLoader label="Opening Compliance Audit Logs…" /> });
export const AICommandInsights = dynamic(() => import('../components/ai-insights/AICommandInsights').then(m => m.AICommandInsights), { loading: () => <ModulePageLoader label="Opening AI Insights…" /> });
export const PosPaymentDesk = dynamic(() => import('../components/cashier/PosPaymentDesk').then(m => m.PosPaymentDesk), { loading: () => <ModulePageLoader label="Opening POS Payment Desk…" /> });
export const AccountingWorkspace = dynamic(() => import('../components/dashboards/AccountingWorkspace').then(m => m.AccountingWorkspace), { loading: () => <ModulePageLoader label="Opening Accounting Workspace…" /> });
export const FrontDeskSettings = dynamic(() => import('../components/reception/FrontDeskSettings').then(m => m.FrontDeskSettings), { loading: () => <ModulePageLoader label="Opening Front Desk Settings…" /> });
export const FrontDeskWorkqueues = dynamic(() => import('../components/reception/FrontDeskWorkqueues').then(m => m.FrontDeskWorkqueues), { loading: () => <ModulePageLoader label="Opening Workqueues…" /> });

// resolveOnboardingMode is a tiny pure function — import it statically
import { resolveOnboardingMode } from '../components/onboarding/HospitalOnboardingWizard';
export { resolveOnboardingMode };
export const HospitalOnboardingWizard = dynamic(() => import('../components/onboarding/HospitalOnboardingWizard').then(m => ({ default: m.HospitalOnboardingWizard })), { loading: () => <ModulePageLoader label="Loading onboarding…" /> });
export const RoleFirstRunGuide = dynamic(() => import('../components/onboarding/RoleFirstRunGuide').then(m => ({ default: m.RoleFirstRunGuide })), { loading: () => <ModulePageLoader label="Loading guide…" /> });
export const FacilityOnboarding = dynamic(() => import('../components/facility/FacilityOnboarding').then(m => m.FacilityOnboarding), { loading: () => <ModulePageLoader label="Opening Facility Onboarding…" /> });

export const AuthIdentity = dynamic(() => import('../components/auth/AuthIdentity').then(m => m.AuthIdentity), { loading: () => <ModulePageLoader label="Opening Auth Identity…" /> });
export const DigitalPatientCard = dynamic(() => import('../components/patient-card/DigitalPatientCard').then(m => m.DigitalPatientCard), { loading: () => <ModulePageLoader label="Opening Patient Card…" /> });
export const MyStaffIdPanel = dynamic(() => import('../components/staffing/MyStaffIdPanel').then(m => m.MyStaffIdPanel), { loading: () => <ModulePageLoader label="Opening Staff Card…" /> });
export const Patient360View = dynamic(() => import('../components/patients/Patient360View').then(m => m.Patient360View), { loading: () => <ModulePageLoader label="Opening Patient 360 Chart…" /> });
export const UniversalQueueBoard = dynamic(() => import('../components/queue/UniversalQueueBoard').then(m => m.UniversalQueueBoard), { loading: () => <ModulePageLoader label="Opening Universal Queue…" /> });
export const NotificationCentre = dynamic(() => import('../components/notifications/NotificationCentre').then(m => m.NotificationCentre), { loading: () => <ModulePageLoader label="Opening Notification Centre…" /> });
export const AdvancedHospitalSuites = dynamic(() => import('../components/advanced/AdvancedHospitalSuites').then(m => m.AdvancedHospitalSuites), { loading: () => <ModulePageLoader label="Opening Advanced Suite…" /> });
export const HospitalStaffTransfer = dynamic(() => import('../components/staffing/HospitalStaffTransfer').then(m => m.HospitalStaffTransfer), { loading: () => <ModulePageLoader label="Opening Staff Transfer…" /> });
export const StaffEnrolment = dynamic(() => import('../components/staffing/StaffEnrolment').then(m => m.StaffEnrolment), { loading: () => <ModulePageLoader label="Opening Staff Enrolment…" /> });
export const ClinicalVerificationDashboard = dynamic(() => import('../components/sync/ClinicalVerificationDashboard').then(m => m.ClinicalVerificationDashboard), { loading: () => <ModulePageLoader label="Opening Offline Sync & Verification…" /> });

export const ClinicalUxSuite = dynamic(() => import('../components/clinical-ux/ClinicalUxSuite').then(m => m.ClinicalUxSuite), { loading: () => <ModulePageLoader label="Opening Clinical UX…" /> });
export const DeviceGatewaySettings = dynamic(() => import('../components/interop/DeviceGatewaySettings').then(m => m.DeviceGatewaySettings), { loading: () => <ModulePageLoader label="Opening Device Gateway…" /> });

export const EmergencyTriageSuite = dynamic(() => import('../components/clinical-core/EmergencyTriageSuite').then(m => m.EmergencyTriageSuite), { loading: () => <ModulePageLoader label="Opening Emergency Triage…" /> });
export const PharmacyDispensingSuite = dynamic(() => import('../components/clinical-core/PharmacyDispensingSuite').then(m => m.PharmacyDispensingSuite), { loading: () => <ModulePageLoader label="Opening Pharmacy Dispensary…" /> });
export const HimSuite = dynamic(() => import('../components/him/HimSuite').then(m => m.HimSuite), { loading: () => <ModulePageLoader label="Opening HIM Health Records…" /> });
export const PharmacyFormularyWorkspace = dynamic(() => import('../components/pharmacy/PharmacyFormularyWorkspace').then(m => m.PharmacyFormularyWorkspace), { loading: () => <ModulePageLoader label="Opening Formulary…" /> });
export const LaboratorySuite = dynamic(() => import('../components/clinical-core/LaboratorySuite').then(m => m.LaboratorySuite), { loading: () => <ModulePageLoader label="Opening Laboratory LIS…" /> });
export const RadiologyPacsSuite = dynamic(() => import('../components/clinical-core/RadiologyPacsSuite').then(m => m.RadiologyPacsSuite), { loading: () => <ModulePageLoader label="Opening Radiology PACS…" /> });
export const OperatingTheatreSuite = dynamic(() => import('../components/clinical-core/OperatingTheatreSuite').then(m => m.OperatingTheatreSuite), { loading: () => <ModulePageLoader label="Opening Operating Theatre…" /> });
export const CriticalCareIcuSuite = dynamic(() => import('../components/clinical-core/CriticalCareIcuSuite').then(m => m.CriticalCareIcuSuite), { loading: () => <ModulePageLoader label="Opening Critical Care ICU…" /> });
export const MaternityOgSuite = dynamic(() => import('../components/clinical-core/MaternityOgSuite').then(m => m.MaternityOgSuite), { loading: () => <ModulePageLoader label="Opening Maternity Suite…" /> });
export const PaediatricsNicuSuite = dynamic(() => import('../components/clinical-core/PaediatricsNicuSuite').then(m => m.PaediatricsNicuSuite), { loading: () => <ModulePageLoader label="Opening Paediatrics NICU…" /> });
export const BloodBankSuite = dynamic(() => import('../components/clinical-core/BloodBankSuite').then(m => m.BloodBankSuite), { loading: () => <ModulePageLoader label="Opening Blood Bank…" /> });
export const InpatientNursingSuite = dynamic(() => import('../components/clinical-core/InpatientNursingSuite').then(m => m.InpatientNursingSuite), { loading: () => <ModulePageLoader label="Opening Inpatient Nursing…" /> });
export const NursingTriageStation = dynamic(() => import('../components/clinical-core/NursingTriageStation').then(m => m.NursingTriageStation), { loading: () => <ModulePageLoader label="Opening Nursing Triage…" /> });
export const WorkflowIntelligenceHub = dynamic(() => import('../components/clinical-core/WorkflowIntelligenceHub').then(m => m.WorkflowIntelligenceHub), { loading: () => <ModulePageLoader label="Opening Workflow Hub…" /> });
export const AmbulanceTransfersSuite = dynamic(() => import('../components/operations/AmbulanceTransfersSuite').then(m => m.AmbulanceTransfersSuite), { loading: () => <ModulePageLoader label="Opening Ambulance Fleet…" /> });
export const SupplyChainInventorySuite = dynamic(() => import('../components/operations/SupplyChainInventorySuite').then(m => m.SupplyChainInventorySuite), { loading: () => <ModulePageLoader label="Opening Medical Inventory…" /> });
export const BiomedicalEquipmentSuite = dynamic(() => import('../components/operations/BiomedicalEquipmentSuite').then(m => m.BiomedicalEquipmentSuite), { loading: () => <ModulePageLoader label="Opening Biomedical Equipment…" /> });
export const FacilitiesUtilitiesSuite = dynamic(() => import('../components/operations/FacilitiesUtilitiesSuite').then(m => m.FacilitiesUtilitiesSuite), { loading: () => <ModulePageLoader label="Opening Facilities Utilities…" /> });
export const EnvironmentalSafetySuite = dynamic(() => import('../components/operations/EnvironmentalSafetySuite').then(m => m.EnvironmentalSafetySuite), { loading: () => <ModulePageLoader label="Opening Environmental Safety…" /> });
export const BillingInvoicingSuite = dynamic(() => import('../components/finance/BillingInvoicingSuite').then(m => m.BillingInvoicingSuite), { loading: () => <ModulePageLoader label="Opening Billing Invoicing…" /> });
export const InsuranceHmoClaimsSuite = dynamic(() => import('../components/finance/InsuranceHmoClaimsSuite').then(m => m.InsuranceHmoClaimsSuite), { loading: () => <ModulePageLoader label="Opening Claims Suite…" /> });
export const AkwaRemitRevenueSuite = dynamic(() => import('../components/finance/AkwaRemitRevenueSuite').then(m => m.AkwaRemitRevenueSuite), { loading: () => <ModulePageLoader label="Opening AkwaRemit…" /> });
export const AkwaIbomStateSuite = dynamic(() => import('../components/interop/AkwaIbomStateSuite').then(m => m.AkwaIbomStateSuite), { loading: () => <ModulePageLoader label="Opening State Readiness…" /> });
export const RevenueCycleAccountingSuite = dynamic(() => import('../components/finance/RevenueCycleAccountingSuite').then(m => m.RevenueCycleAccountingSuite), { loading: () => <ModulePageLoader label="Opening Revenue Cycle…" /> });
export const AccountingArDesk = dynamic(() => import('../components/finance/AccountingArDesk').then(m => m.AccountingArDesk), { loading: () => <ModulePageLoader label="Opening Accounting AR Desk…" /> });
export const ProcurementHrSuite = dynamic(() => import('../components/finance/ProcurementHrSuite').then(m => m.ProcurementHrSuite), { loading: () => <ModulePageLoader label="Opening Procurement & HR…" /> });
export const FhirHl7GatewaySuite = dynamic(() => import('../components/interop/FhirHl7GatewaySuite').then(m => m.FhirHl7GatewaySuite), { loading: () => <ModulePageLoader label="Opening FHIR HL7 Gateway…" /> });
export const ConnectedDevicesSuite = dynamic(() => import('../components/interop/ConnectedDevicesSuite').then(m => m.ConnectedDevicesSuite), { loading: () => <ModulePageLoader label="Opening IoT Connected Devices…" /> });
export const ClinicalSafetyBcpSuite = dynamic(() => import('../components/interop/ClinicalSafetyBcpSuite').then(m => m.ClinicalSafetyBcpSuite), { loading: () => <ModulePageLoader label="Opening Clinical Safety BCP…" /> });
export const EMRManager = dynamic(() => import('../components/gateway-modules/EMRManager').then(m => m.EMRManager), { loading: () => <ModulePageLoader label="Opening EMR Manager…" /> });
export const AppointmentsManager = dynamic(() => import('../components/gateway-modules/AppointmentsManager').then(m => m.AppointmentsManager), { loading: () => <ModulePageLoader label="Opening Appointments Manager…" /> });
export const LamisNdrSuite = dynamic(() => import('../components/interop/LamisNdrSuite').then(m => m.LamisNdrSuite), { loading: () => <ModulePageLoader label="Opening LAMIS & NDR Suite…" /> });
export const ClinicalAiAutomationsSuite = dynamic(() => import('../components/ai-insights/ClinicalAiAutomationsSuite').then(m => m.ClinicalAiAutomationsSuite), { loading: () => <ModulePageLoader label="Opening Clinical AI Automations…" /> });
export const RapidNurseTriageIntake = dynamic(() => import('../components/clinical-core/RapidNurseTriageIntake').then(m => m.RapidNurseTriageIntake), { loading: () => <ModulePageLoader label="Opening 60-Sec Rapid Triage…" /> });
export const ClinicalGoogleSearchSuite = dynamic(() => import('../components/ai-insights/ClinicalGoogleSearchSuite').then(m => m.ClinicalGoogleSearchSuite), { loading: () => <ModulePageLoader label="Opening Clinical Google Search…" /> });
export const TelehealthMeshSuite = dynamic(() => import('../components/interop/TelehealthMeshSuite').then(m => m.TelehealthMeshSuite), { loading: () => <ModulePageLoader label="Opening Satellite & Telehealth Mesh…" /> });


export type ModuleKey =
  | 'dashboard'
  // Doctor full portal
  | 'doctor-portal'
  // Pillar 1: AI
  | 'm87-ai' | 'ai' | 'ai-automations' | 'clinical-search'
  // Pillar 2: Core
  | 'emr' | 'emergency' | 'theatre' | 'icu' | 'pharmacy' | 'laboratory' | 'radiology' | 'him' | 'him-deficiency' | 'him-coding' | 'him-roi' | 'him-chart' | 'him-merge' | 'him-docs'
  | 'maternity' | 'paediatrics' | 'blood-bank' | 'nursing' | 'triage' | 'rapid-triage' | 'workflow-intelligence' | 'intel-hub' | 'patient-card' | 'patient-360' | 'clinical-ux' | 'device-gateway'
  // Pillar 3: Operations
  | 'command' | 'beds' | 'patient-flow' | 'universal-queue' | 'appointments' | 'staffing' | 'ambulance' | 'notifications'
  | 'inventory' | 'biomedical' | 'facilities' | 'environmental'
  // Pillar 4: Finance
  | 'billing' | 'cashier' | 'claims' | 'revenue-cycle' | 'procurement' | 'akwaremit'
  // Pillar 5: Data & Interop
  | 'aks-state' | 'lamis' | 'data-hub' | 'fhir' | 'analytics' | 'offline-sync' | 'satellite-mesh' | 'ambient-soap' | 'lis' | 'formulary' | 'mfa-sso' | 'knowledge-graph' | 'predictive-staffing' | 'infection' | 'hie' | 'pacs-advanced' | 'statewide-emr'
  // Pillar 6: Connected IoT
  | 'iot-devices'
  // Pillar 7: Security & Governance
  | 'auth' | 'facility' | 'rbac' | 'compliance' | 'safety' | 'sysadmin' | 'transfer' | 'enrolment' | 'my-card' | 'desk-settings' | 'front-desk-wq';

export type NavSection = {
  label: string;
  items: {
    key: ModuleKey;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    label: string;
    badge?: string;
  }[];
};

export const MODULE_COMPONENTS: Record<ModuleKey, React.ComponentType<any>> = {
  dashboard: RoleDashboard as any,
  'doctor-portal': DoctorPortal as any,
  'm87-ai': M87AICopilotSuite,
  ai: AICommandInsights,
  'ai-automations': ClinicalAiAutomationsSuite,
  'clinical-search': ClinicalGoogleSearchSuite as any,
  emr: EMRManager,
  him: HimSuite,
  'him-deficiency': (props: any) => <HimSuite {...props} initialTab="deficiency" />,
  'him-coding': (props: any) => <HimSuite {...props} initialTab="coding" />,
  'him-roi': (props: any) => <HimSuite {...props} initialTab="roi" />,
  'him-chart': (props: any) => <HimSuite {...props} initialTab="chart" />,
  'him-merge': (props: any) => <HimSuite {...props} initialTab="merge" />,
  'him-docs': (props: any) => <HimSuite {...props} initialTab="docs" />,
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
  triage: (props: any) => (
    <NursingTriageStation
      session={props.session || props.userSession}
      onClose={() => props.onNavigate?.('dashboard')}
    />
  ),
  'rapid-triage': (props: any) => (
    <RapidNurseTriageIntake
      session={props.session || props.userSession}
      onClose={() => props.onNavigate?.('triage')}
    />
  ),
  'workflow-intelligence': (props: any) => (
    <WorkflowIntelligenceHub
      session={props.session || props.userSession}
      onClose={() => props.onNavigate?.('dashboard')}
    />
  ),
  'intel-hub': (props: any) => (
    <WorkflowIntelligenceHub
      session={props.session || props.userSession}
      onClose={() => props.onNavigate?.('dashboard')}
    />
  ),
  'patient-card': DigitalPatientCard,
  'clinical-ux': ClinicalUxSuite,
  'patient-360': Patient360View as any,
  command: CommandCentreDashboard,
  beds: BedManagement,
  'patient-flow': PatientFlowVisibility,
  'universal-queue': UniversalQueueBoard as any,
  notifications: NotificationCentre as any,
  appointments: AppointmentsManager as any,
  staffing: StaffingOverview,
  ambulance: AmbulanceTransfersSuite,
  inventory: SupplyChainInventorySuite,
  biomedical: BiomedicalEquipmentSuite,
  facilities: FacilitiesUtilitiesSuite,
  environmental: EnvironmentalSafetySuite,
  billing: BillingInvoicingSuite,
  cashier: PosPaymentDesk as any,
  akwaremit: AkwaRemitRevenueSuite as any,
  claims: InsuranceHmoClaimsSuite,
  'aks-state': AkwaIbomStateSuite,
  lamis: LamisNdrSuite,
  'revenue-cycle': RevenueCycleAccountingSuite,
  procurement: ProcurementHrSuite,
  'ambient-soap': (props: any) => <AdvancedHospitalSuites {...props} mode="ambient-soap" />,
  'lis': (props: any) => <AdvancedHospitalSuites {...props} mode="lis" />,
  'formulary': PharmacyFormularyWorkspace,
  'mfa-sso': (props: any) => <AdvancedHospitalSuites {...props} mode="mfa-sso" />,
  'knowledge-graph': (props: any) => <AdvancedHospitalSuites {...props} mode="knowledge-graph" />,
  'predictive-staffing': (props: any) => <AdvancedHospitalSuites {...props} mode="predictive-staffing" />,
  'infection': (props: any) => <AdvancedHospitalSuites {...props} mode="infection" />,
  'hie': (props: any) => <AdvancedHospitalSuites {...props} mode="hie" />,
  'pacs-advanced': (props: any) => <AdvancedHospitalSuites {...props} mode="pacs-advanced" />,
  'data-hub': IntegratedDataHub,
  fhir: FhirHl7GatewaySuite,
  'statewide-emr': StatewideEmrSuite as any,
  analytics: PerformanceAnalytics,
  'offline-sync': ClinicalVerificationDashboard,
  'satellite-mesh': TelehealthMeshSuite as any,
  'iot-devices': ConnectedDevicesSuite,
  'device-gateway': DeviceGatewaySettings,
  auth: AuthIdentity,
  facility: FacilityOnboarding,
  rbac: AccessControl,
  compliance: ComplianceAuditLogs,
  safety: ClinicalSafetyBcpSuite,
  sysadmin: SystemAdministration,
  'desk-settings': FrontDeskSettings as any,
  'front-desk-wq': FrontDeskWorkqueues as any,
  transfer: HospitalStaffTransfer as any,
  enrolment: StaffEnrolment as any,
  'my-card': MyStaffIdPanel,
};

export const MODULE_CLEARANCE: Record<ModuleKey, { level: number; label: string; roleDesc: string }> = {
  dashboard: { level: 2, label: 'L2 All Roles', roleDesc: 'Your main work desk' },
  'offline-sync': { level: 2, label: 'L2 All Roles', roleDesc: 'Offline Sync & Clinical Verification Dashboard' },
  'satellite-mesh': { level: 3, label: 'L3 Operations', roleDesc: 'Decentralized Telehealth Mesh & Satellite Uplink' },
  'doctor-portal': { level: 3, label: 'L3 Clinical', roleDesc: 'Licensed Medical Doctors & Clinical Officers' },
  emr: { level: 2, label: 'L2 Clinical & Records', roleDesc: 'Physicians, Clinical Officers & Records' },
  him: { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'him-deficiency': { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'him-coding': { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'him-roi': { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'him-chart': { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'him-merge': { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'him-docs': { level: 2, label: 'L2 HIM', roleDesc: 'Health Records Officers' },
  'm87-ai': { level: 3, label: 'L3 Clinical', roleDesc: 'Clinical Officers & Nursing Supervisors' },
  ai: { level: 3, label: 'L3 Clinical', roleDesc: 'Clinical Decision Support & Physicians' },
  'ai-automations': { level: 2, label: 'L2 Clinical & Admin', roleDesc: 'AI Scribing, Discharge, Triage & Safety Automations' },
  'clinical-search': { level: 2, label: 'L2 Clinical', roleDesc: 'Clinical Google EMR Search & Patient Dossier Q&A' },
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
  triage: { level: 2, label: 'L2 Nursing & OPD', roleDesc: 'Triage Nurses & OPD Clinical Officers' },
  'rapid-triage': { level: 2, label: 'L2 Nursing', roleDesc: '60-Sec Rapid Nurse Triage Station' },
  'workflow-intelligence': { level: 2, label: 'L2 Clinical & Operations', roleDesc: 'Doctors, Nurses, Admin & Quality Officers' },
  'intel-hub': { level: 2, label: 'L2 Clinical & Operations', roleDesc: 'Doctors, Nurses, Admin & Quality Officers' },
  'patient-card': { level: 1, label: 'L2 Support', roleDesc: 'Records & Front Desk Officers' },
  'patient-360': { level: 2, label: 'L2 Clinical & Records', roleDesc: 'Longitudinal patient profile' },
  'clinical-ux': { level: 2, label: 'L2 Clinical', roleDesc: 'Schedule, meds, notes, discharge' },
  'device-gateway': { level: 4, label: 'L4 IT / Admin', roleDesc: 'Device hub HL7 Orthanc config' },
  command: { level: 2, label: 'L2 Support', roleDesc: 'General Hospital Staff & Floor Duty' },
  beds: { level: 3, label: 'L3 Clinical', roleDesc: 'Bed Managers & Ward Supervisors' },
  'patient-flow': { level: 1, label: 'L3 Clinical', roleDesc: 'Patient Flow Coordinators' },
  'universal-queue': { level: 2, label: 'L2 Operations', roleDesc: 'Queue and floor coordinators' },
  notifications: { level: 2, label: 'L2 All Roles', roleDesc: 'Hospital notification centre' },
  appointments: { level: 1, label: 'L2 Front Desk', roleDesc: 'Reception & appointment clerks' },
  staffing: { level: 3, label: 'L3 Clinical', roleDesc: 'Duty Roster Officers & Matrons' },
  ambulance: { level: 2, label: 'L2 Support', roleDesc: 'EMS Dispatchers & Paramedics' },
  inventory: { level: 2, label: 'L2 Support', roleDesc: 'Procurement & Inventory Managers' },
  biomedical: { level: 2, label: 'L2 Support', roleDesc: 'Biomedical Engineers' },
  facilities: { level: 2, label: 'L2 Support', roleDesc: 'Facility Maintenance & Plant Engineers' },
  environmental: { level: 2, label: 'L2 Support', roleDesc: 'Environmental Health & Infection Control' },
  billing: { level: 2, label: 'L2 Finance', roleDesc: 'Hospital Billing Accountants' },
  cashier: { level: 2, label: 'L2 Finance', roleDesc: 'Revenue Collectors & Cashiers' },
  akwaremit: { level: 2, label: 'L2 Finance', roleDesc: 'AkwaRemit State Revenue Officers & Accountants' },
  claims: { level: 2, label: 'L2 Finance', roleDesc: 'AKSHIA & HMO Adjudicators' },
  'aks-state': { level: 3, label: 'L3 Operations', roleDesc: 'State readiness · AKSHIA · UPI · DHIS2' },
  lamis: { level: 2, label: 'L2 Records & HIV Clinic', roleDesc: 'LAMIS · NDR · RADET Surveillance' },
  'revenue-cycle': { level: 2, label: 'L2 Finance', roleDesc: 'Finance Directors & Revenue Officers' },
  procurement: { level: 2, label: 'L2 Finance', roleDesc: 'Procurement & HR Officers' },
  'ambient-soap': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'lis': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'formulary': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'mfa-sso': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'knowledge-graph': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'predictive-staffing': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'infection': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'hie': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'pacs-advanced': { level: 3, label: 'L3 Advanced', roleDesc: 'Clinical & operations advanced module' },
  'data-hub': { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Health Informaticians & Clinical Directors' },
  fhir: { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Interoperability Engineers & MoH Liaisons' },
  'statewide-emr': { level: 5, label: 'L5 Executive', roleDesc: 'Hospital Admin · statewide completeness suite' },
  analytics: { level: 3, label: 'L3 Clinical', roleDesc: 'Clinical Audit & Quality Analysts' },
  'iot-devices': { level: 2, label: 'L2 Support', roleDesc: 'Biomedical & Telemetry Technicians' },
  auth: { level: 5, label: 'L5 Executive', roleDesc: 'Hospital IAM Administrator' },
  facility: { level: 5, label: 'L5 Executive', roleDesc: 'Medical Director & MoH Commissioners' },
  rbac: { level: 5, label: 'L5 Executive', roleDesc: 'IAM Security & Access Controllers' },
  compliance: { level: 4, label: 'L4 Senior Clinical', roleDesc: 'Clinical Audit & Legal Compliance' },
  safety: { level: 2, label: 'L2 Support', roleDesc: 'Disaster Recovery & Downtime Officers' },
  sysadmin: { level: 5, label: 'L5 Executive', roleDesc: 'System Administrators & CIO' },
  transfer: { level: 4, label: 'L4 Operations', roleDesc: 'Hospital Administrators & Medical Directors' },
  enrolment: { level: 4, label: 'Administrator', roleDesc: 'Hospital administrators enrol staff' },
  'my-card': { level: 2, label: 'All staff', roleDesc: 'Staff identity card' },
  'desk-settings': { level: 2, label: 'Front desk', roleDesc: 'Reception & front desk operations settings' },
  'front-desk-wq': { level: 1, label: 'L2 Front Desk', roleDesc: 'Epic/Cerner workqueues — grid, recall, referrals' },
};


