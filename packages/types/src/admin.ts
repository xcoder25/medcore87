// MedCore Ministry of Health (MOH) & General Administration Domain Models

export type FacilityTier = 'national_referral' | 'regional_general' | 'district_hospital' | 'specialized_center' | 'primary_clinic';

export type AccreditationStatus = 'accredited' | 'provisional' | 'under_review' | 'license_suspended' | 'expired';

export interface RegionalFacilityOverview {
  facilityId: string;
  facilityName: string;
  region: string;
  tier: FacilityTier;
  licenseNumber: string;
  licenseExpires: string;
  accreditationStatus: AccreditationStatus;
  totalBeds: number;
  occupiedBeds: number;
  icuBedsTotal: number;
  icuBedsOccupied: number;
  ventilatorsAvailable: number;
  staffOnDuty: number;
  complianceScore: number; // 0 - 100
  emergencyStatus: 'normal' | 'surge_code_yellow' | 'critical_code_red' | 'diversion';
}

export type OutbreakSeverity = 'monitoring' | 'advisory' | 'warning' | 'emergency';

export interface EpidemiologicalAlert {
  alertId: string;
  condition: string;
  icd10Category: string;
  detectedCases: number;
  rateOfIncreasePercent: number;
  affectedRegions: string[];
  severity: OutbreakSeverity;
  reportingFacilitiesCount: number;
  firstIdentified: string;
  containmentProtocolActive: boolean;
}

export interface NationalHealthMetricSummary {
  totalRegisteredFacilities: number;
  nationalBedCapacity: number;
  nationalBedOccupancyRate: number; // percentage
  nationalIcuUtilizationRate: number; // percentage
  activeEpidemiologicalAlerts: number;
  totalLicensedClinicians: number;
  compliancePassRate: number; // percentage
  lastTelemetrySync: string;
}

export interface RegulatoryComplianceAudit {
  auditId: string;
  facilityId: string;
  facilityName: string;
  auditDate: string;
  auditorName: string;
  category: 'clinical_safety' | 'data_privacy_phi' | 'sanitation_infection' | 'staff_credentialing' | 'pharmacy_cold_chain';
  findingsCount: number;
  criticalViolations: number;
  resolutionDeadline: string;
  status: 'passed' | 'remediation_required' | 'formal_inquiry';
}

export interface HealthcareWorkerRegistry {
  workerId: string;
  fullName: string;
  cadre: 'Medical Doctor' | 'Specialist Physician' | 'Registered Nurse' | 'Intensivist' | 'Pharmacist' | 'Surgeon' | 'Epidemiologist';
  licenseNumber: string;
  licenseStatus: 'active' | 'renewal_pending' | 'probationary' | 'suspended';
  assignedFacilityId: string;
  assignedFacilityName: string;
  region: string;
  primarySpecialty: string;
  yearsOfPractice: number;
  lastAccreditedDate: string;
}

export interface RegionalWorkforceSummary {
  region: string;
  totalDoctors: number;
  totalNurses: number;
  intensivistsCount: number;
  doctorToPopulationRatio: string; // e.g. "1:1,850"
  specialistDeficitAreas: string[];
  staffingShortageLevel: 'optimal' | 'moderate' | 'critical';
}

export type DirectiveSeverity = 'standard_guidance' | 'stat_advisory' | 'mandatory_order' | 'national_emergency';

export interface RegulatoryDirective {
  directiveId: string;
  code: string;
  title: string;
  category: 'infection_control' | 'surge_capacity' | 'pharmaceutical_recall' | 'credentialing_audit' | 'triage_protocol';
  severity: DirectiveSeverity;
  issuedDate: string;
  effectiveUntil: string;
  targetRegions: string[];
  targetFacilityTiers: FacilityTier[];
  summary: string;
  mandatoryActions: string[];
  complianceConfirmedCount: number;
  totalTargetedFacilities: number;
  status: 'active' | 'in_progress' | 'rescinded' | 'completed';
}

export interface FacilityDeepDiveTelemetry {
  facility: RegionalFacilityOverview;
  departmentBeds: {
    department: string;
    total: number;
    occupied: number;
    available: number;
  }[];
  medicalOxygenSupplyHours: number;
  isolationRoomsAvailable: number;
  powerBackupStatus: 'generator_operational' | 'grid_stable' | 'auxiliary_low';
  lastTelemetryHeartbeat: string;
}

// ─── Commissioner Vital Statistics & Financial Surveillance Models ──────────

export interface MortalityCauseSummary {
  cause: string;
  icd10: string;
  count: number;
  percentage: number;
}

export interface VitalCensusSummary {
  totalRegisteredPatients: number;
  totalAdmittedCurrently: number;
  totalDischargedAlive: number;
  totalDeceased: number;
  mortalityRatePercent: number;
  maternalMortalityCount: number;
  neonatalMortalityCount: number;
  leadingCausesOfDeath: MortalityCauseSummary[];
  lastCensusUpdate: string;
}

export interface MortalityRecord {
  recordId: string;
  pseudonymId: string; // Salted HMAC pseudonym ensuring patient dignity & privacy
  facilityId: string;
  facilityName: string;
  ageGroup: string;
  gender: string;
  timeOfDeath: string;
  primaryCauseOfDeath: string;
  icd10Code: string;
  wardOrUnit: string;
  contributoryFactors: string[];
  autopsyRequested: boolean;
  certifyingPhysicianHash: string; // Cryptographic signature of certifying doctor
  sha256AuditBlockNumber: number;
}

export interface FacilityRevenueBreakdown {
  facilityId: string;
  facilityName: string;
  grossRevenue: number;
  paystackWalletAmount: number;
  akwaRemitAmount: number;
  cashTillAmount: number;
  hmoClaimsAmount: number;
  outstandingBalance: number;
  activeTillsCount: number;
  reconciledTillsCount: number;
}

export interface FinancialSurveillanceOverview {
  totalGrossRevenue: number;
  totalPaystackWalletRevenue: number;
  totalAkwaRemitRevenue: number;
  totalCashOTCRevenue: number;
  totalHmoClaimsRevenue: number;
  totalOutstandingDue: number;
  reconciliationStatus: {
    totalOpenTills: number;
    totalClosedTills: number;
    reconciledCleanCount: number;
    discrepancyCount: number;
  };
  facilityBreakdowns: FacilityRevenueBreakdown[];
  currency: string;
  lastSyncTimestamp: string;
}

export interface NationalCommissionerDashboardData {
  nationalMetrics: NationalHealthMetricSummary;
  vitalCensus: VitalCensusSummary;
  recentMortalityRegistry: MortalityRecord[];
  financialSurveillance: FinancialSurveillanceOverview;
  securityProof: {
    fieldLevelEncryptionStatus: string;
    auditLedgerIntegrity: boolean;
    totalChainedBlocks: number;
    genesisHash: string;
    headHash: string;
    sovereignDataResidency: string;
  };
}

// ─── Staff Transfer & Surge Redeployment Domain Models ──────────────────────

export type StaffTransferType =
  | 'temporary_surge'
  | 'permanent_reassignment'
  | 'emergency_mutual_aid'
  | 'specialist_rotation';

export type StaffTransferReason =
  | 'critical_deficit_relief'
  | 'emergency_surge'
  | 'specialist_rotation'
  | 'facility_request'
  | 'outbreak_surveillance'
  | 'maternal_child_intervention';

export type StaffTransferStatus =
  | 'pending_approval'
  | 'dispatched'
  | 'active_deployment'
  | 'completed'
  | 'cancelled';

export interface StaffTransferRecord {
  transferId: string;
  workerId: string;
  workerName: string;
  cadre: string;
  primarySpecialty: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  sourceRegion: string;
  targetFacilityId: string;
  targetFacilityName: string;
  targetRegion: string;
  transferType: StaffTransferType;
  reason: StaffTransferReason;
  urgency: 'routine' | 'urgent' | 'immediate_code_red';
  effectiveDate: string;
  durationWeeks?: number;
  authorizingOfficer: string;
  status: StaffTransferStatus;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

