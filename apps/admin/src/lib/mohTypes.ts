import type { SenatorialDistrict, SupervisoryBoard, FacilityTierLocal } from '../data/akwaIbomFacilities';

export type MohTabKey =
  | 'overview'
  | 'facilities'
  | 'surveillance'
  | 'workforce'
  | 'finance'
  | 'directives'
  | 'audit'
  | 'intelligence';

export type MohSyncStatus = 'live_db' | 'local_registry';

export interface MohFacilityTelemetry {
  facilityId: string;
  facilityName: string;
  location: string;
  lga: string;
  district: SenatorialDistrict;
  tier: FacilityTierLocal;
  facilityType: string;
  board: SupervisoryBoard;
  enrollmentStatus: 'active' | 'pending';
  hasDbActivity: boolean;
  lastSyncedAt: string | null;
  hfrCode: string;
  supervisoryBoard: string;
  medicalDirector: string;
  boardAuthCircularRef: string;
  complianceScore: number;
  accreditationStatus: 'accredited' | 'provisional' | 'suspended' | 'pending';
  emergencyStatus: 'normal' | 'surge_code_yellow' | 'surge_code_red' | 'critical';
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  icuBedsTotal: number;
  icuBedsOccupied: number;
  activeStaffCount: number;
  totalStaffCount: number;
  registeredPatientsCount: number;
  activeOpdVisits: number;
  revenuePaidNgn: number;
  revenuePendingNgn: number;
  criticalLabsCount: number;
  criticalVitalsCount: number;
  auditEventsCount: number;
  cadreBreakdown: Record<string, number>;
  wardBreakdown: { ward: string; total: number; occupied: number; available: number }[];
  notes?: string;
}

export interface MohRegionalRollup {
  district: SenatorialDistrict;
  totalFacilities: number;
  connectedFacilities: number;
  totalBeds: number;
  occupiedBeds: number;
  icuTotal: number;
  icuOccupied: number;
  staffCount: number;
  patientsCount: number;
  revenuePaidNgn: number;
  activeOpdVisits: number;
  avgComplianceScore: number;
}

export interface MohStaffDirectoryItem {
  badgeId: string;
  facilityId: string;
  facilityName: string;
  district: SenatorialDistrict;
  fullName: string;
  role: string;
  roleKey: string;
  department: string;
  status: string;
  clearanceLevel: number;
}

export interface MohFinanceSummary {
  totalCollectedNgn: number;
  totalPendingNgn: number;
  byChannel: {
    akwaremit: number;
    paystack: number;
    cash: number;
    hmo: number;
    other: number;
  };
  openRequestsCount: number;
  paidReceiptsCount: number;
  byFacility: {
    facilityId: string;
    facilityName: string;
    district: SenatorialDistrict;
    collectedNgn: number;
    pendingNgn: number;
    receiptsCount: number;
  }[];
}

export interface MohOutbreakAlert {
  id: string;
  condition: string;
  icd10Category: string;
  detectedCases: number;
  rateOfIncrease: number;
  affectedDistricts: string[];
  severity: 'advisory' | 'warning' | 'emergency';
  reportingFacilities: number;
  containmentActive: boolean;
  notes?: string;
  firstIdentified: string;
  updatedAt: string;
}

export interface MohSurveillanceSummary {
  activeOpdVisits: number;
  waitingOpd: number;
  withProviderOpd: number;
  completedOpdToday: number;
  totalLabOrders: number;
  criticalLabAlerts: number;
  criticalVitalsAlerts: number;
  totalPrescriptions: number;
  pendingPrescriptions: number;
  clinicalSignals: {
    id: string;
    facilityId: string;
    facilityName: string;
    district: SenatorialDistrict;
    signalType: 'critical_lab' | 'critical_vitals';
    summary: string;
    severity: 'warning' | 'critical';
    observedAt: string;
  }[];
  alerts: MohOutbreakAlert[];
}

export interface MohDirective {
  id: string;
  code: string;
  title: string;
  category: string;
  severity: 'mandatory_order' | 'stat_advisory' | 'national_emergency' | 'standard_guidance';
  summary: string;
  targetDistricts: string[];
  targetTiers: string[];
  mandatoryActions: string[];
  issuedBy: string;
  issuedAt: string;
  effectiveUntil: string;
  status: 'active' | 'completed';
  acknowledgedFacilities: string[];
}

export interface MohAuditRecord {
  id: string;
  facilityId: string;
  facilityName: string;
  auditDate: string;
  auditorName: string;
  category: string;
  findingsCount: number;
  criticalViolations: number;
  resolutionDeadline: string;
  status: 'scheduled' | 'passed' | 'remediation_required';
  notes: string;
  createdAt: string;
}

export interface MohTransferRecord {
  id: string;
  staffBadge: string;
  staffName: string;
  cadre: string;
  fromFacilityId: string;
  fromFacilityName: string;
  toFacilityId: string;
  toFacilityName: string;
  transferType: 'temporary_surge' | 'emergency_mutual_aid' | 'specialist_rotation' | 'permanent_reassignment';
  urgency: 'routine' | 'urgent' | 'immediate_code_red';
  reason: string;
  status: 'pending' | 'approved' | 'declined' | 'completed';
  requestedBy: string;
  decidedBy: string;
  createdAt: string;
}

export interface MohAuditLedgerEvent {
  id: string;
  facilityId: string;
  facilityName: string;
  actor: string;
  actorBadge: string;
  category: string;
  severity: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  rowHash: string;
  createdAt: string;
}

export interface MohAuditLedgerSummary {
  totalEvents: number;
  criticalEvents: number;
  integrityVerified: boolean;
  latestHash: string;
  events: MohAuditLedgerEvent[];
}

export interface MohLiveSnapshot {
  syncMode: MohSyncStatus;
  syncedAt: string;
  districtFilter: string;
  summary: {
    totalOfficialFacilities: number;
    connectedFacilities: number;
    pendingFacilities: number;
    totalBeds: number;
    occupiedBeds: number;
    bedOccupancyPct: number;
    icuBedsTotal: number;
    icuBedsOccupied: number;
    icuOccupancyPct: number;
    activeStaffCount: number;
    totalStaffCount: number;
    registeredPatientsCount: number;
    activeOpdVisits: number;
    totalRevenuePaidNgn: number;
    totalRevenuePendingNgn: number;
    activeDirectivesCount: number;
    pendingTransfersCount: number;
    openRemediationsCount: number;
    activeAlertsCount: number;
    surgeFacilitiesCount: number;
  };
  facilities: MohFacilityTelemetry[];
  regionalRollup: MohRegionalRollup[];
  workforce: {
    totalActive: number;
    byCadre: { cadre: string; count: number }[];
    staffDirectory: MohStaffDirectoryItem[];
  };
  finance: MohFinanceSummary;
  surveillance: MohSurveillanceSummary;
  directives: MohDirective[];
  audits: MohAuditRecord[];
  transfers: MohTransferRecord[];
  auditLedger: MohAuditLedgerSummary;
}
