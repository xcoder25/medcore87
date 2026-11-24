import type { SenatorialDistrict, SupervisoryBoard, FacilityTierLocal } from '../data/akwaIbomFacilities';

export type MohTabKey =
  | 'overview'
  | 'facilities'
  | 'surveillance'
  | 'workforce'
  | 'supply'
  | 'finance'
  | 'directives'
  | 'grievances'
  | 'audit'
  | 'intelligence';

export type MohSyncStatus = 'live_db' | 'local_registry';

export type MohOperationalStatus =
  | 'fully_functional'
  | 'partially_functional'
  | 'closed'
  | 'sealed';

export type MohLicenseAlertStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing';

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
  operationalStatus: MohOperationalStatus;
  ownership: string;
  licenseNo: string;
  licenseExpiry: string;
  licenseAlert: MohLicenseAlertStatus;
  unapprovedPracticeFlag: boolean;
  approvedServices: string[];
  latitude: number;
  longitude: number;
  attendanceRatePct: number;
  ruralUnderstaffed: boolean;
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
  enforcement: MohEnforcementAction[];
  hrh: {
    lgaDistribution: MohLgaWorkforceRow[];
    attendanceSummary: {
      avgAttendancePct: number;
      avgAbsenteeismPct: number;
      ruralUnderstaffedCount: number;
    };
    recruitment: MohHrhRecruitment[];
  };
  supplyChain: {
    items: MohSupplyEquipmentItem[];
    lowStockCount: number;
    stockOutCount: number;
    faultyEquipmentCount: number;
    activeRenovationsCount: number;
  };
  idsr: {
    dsnoReports: MohIdsrReport[];
    serviceMetrics: MohIdsrReport[];
    maternalDeathsTotal: number;
    under5DeathsTotal: number;
    ancVisitsTotal: number;
    skilledDeliveriesTotal: number;
    immunizationDosesTotal: number;
    emergencyReferralsTotal: number;
  };
  grievances: {
    items: MohCitizenGrievance[];
    openCount: number;
    investigatingCount: number;
    resolvedCount: number;
    avgTurnaroundHours: number;
    avgRating: number;
  };
}

export interface MohEnforcementAction {
  id: string;
  facilityId: string;
  facilityName: string;
  lga: string;
  district: SenatorialDistrict;
  actionType: 'sealed' | 'unsealed' | 'quackery_raid' | 'compliance_warning' | 'inspection';
  reason: string;
  checklist: { label: string; passed: boolean }[];
  evidencePhotoData?: string;
  officerName: string;
  status: 'active_seal' | 'follow_up' | 'resolved';
  followUpDate: string;
  resolutionNotes: string;
  createdAt: string;
}

export interface MohLgaWorkforceRow {
  lga: string;
  district: SenatorialDistrict;
  ruralPriority: boolean;
  facilitiesCount: number;
  doctors: number;
  nurses: number;
  midwives: number;
  pharmacists: number;
  chews: number;
  otherStaff: number;
  totalStaff: number;
  attendanceRatePct: number;
  understaffed: boolean;
}

export interface MohHrhRecruitment {
  id: string;
  title: string;
  cadre: string;
  facilityId: string;
  facilityName: string;
  lga: string;
  vacanciesCount: number;
  applicantsCount: number;
  shortlistedCount: number;
  deployedCount: number;
  stage: 'open' | 'shortlisting' | 'interviewing' | 'deploying' | 'closed';
  postedBy: string;
  createdAt: string;
}

export interface MohSupplyEquipmentItem {
  id: string;
  domain: 'medicine_vaccine' | 'equipment' | 'infrastructure';
  facilityId: string;
  facilityName: string;
  lga: string;
  itemName: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
  coldChainTempC: number | null;
  functionalStatus:
    | 'in_stock'
    | 'low_stock'
    | 'stock_out'
    | 'operational'
    | 'faulty'
    | 'out_of_service'
    | 'ongoing_renovation'
    | 'adequate'
    | 'intermittent'
    | 'critical';
  notes: string;
  updatedBy: string;
  updatedAt: string;
}

export interface MohIdsrReport {
  id: string;
  reportKind: 'dsno_outbreak' | 'service_utilization';
  facilityId: string;
  facilityName: string;
  lga: string;
  district: SenatorialDistrict;
  periodLabel: string;
  disease: string;
  suspectedCases: number;
  confirmedCases: number;
  deaths: number;
  ancVisits: number;
  skilledDeliveries: number;
  immunizationDoses: number;
  emergencyReferrals: number;
  maternalDeaths: number;
  under5Deaths: number;
  dsnoOfficer: string;
  status: 'submitted' | 'investigating' | 'verified' | 'contained';
  notes: string;
  createdAt: string;
}

export interface MohCitizenGrievance {
  id: string;
  trackingCode: string;
  facilityId: string;
  facilityName: string;
  lga: string;
  channel: 'qr' | 'hotline' | 'whistleblower' | 'walkin';
  category: 'service_quality' | 'extortion_billing' | 'unqualified_practice' | 'drug_stockout' | 'staff_conduct' | 'commendation';
  rating: number;
  summary: string;
  anonymous: boolean;
  status: 'open' | 'under_investigation' | 'resolved';
  assignedTo: string;
  resolutionNotes: string;
  turnaroundHours: number | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MohPrivateFacilityRecord {
  facilityId: string;
  facilityName: string;
  lga: string;
  district: SenatorialDistrict;
  ownership: 'private' | 'mission' | 'ppp';
  facilityType: string;
  tier: FacilityTierLocal;
  licenseNo: string;
  licenseExpiry: string;
  operationalStatus: MohOperationalStatus;
  accreditationStatus: 'accredited' | 'provisional' | 'suspended' | 'pending';
  approvedServices: string[];
  latitude: number;
  longitude: number;
  registeredBy: string;
  createdAt: string;
}

export interface MohFacilityGovernance {
  hfrCode: string;
  supervisoryBoard: string;
  medicalDirector: string;
  boardAuthCircularRef: string;
  boardAuthDate: string;
  cmdApprovalRef: string;
  cmdApprovalDate: string;
  emrFocalPersonName: string;
  emrFocalPersonTitle: string;
  emrFocalOfficerContact: string;
  licenseNo: string;
  licenseExpiry: string;
  registrationNo: string;
  ownership: string;
  hospitalTier: string;
  facilityType: string;
  ward: string;
  streetLocation: string;
  facilityLine: string;
  emergencyLine: string;
  officialDeskContact: string;
  gpsLatitude: string;
  gpsLongitude: string;
  workingHours: string;
  operates24x7: boolean;
  emergency24x7: boolean;
  triageProtocol: string;
  requireVitalsBeforeConsult: boolean;
  requireBillingClearanceBeforeDischarge: boolean;
  requireStaffMfa: boolean;
  requireFaceIdOnStaffEnrol: boolean;
  akwaremitEnabled: boolean;
  akwaremitRevenueHead: string;
  akwaremitRevenueSubhead: string;
  acceptsAkshia: boolean;
  akshiaProviderId: string;
  participatesInBhcpf: boolean;
  bhcpfCode: string;
  acceptsNhis: boolean;
  nhiaProviderCode: string;
  acceptsHmo: boolean;
  posTerminalsTotal: number;
  posTerminalsActive: number;
}

export interface MohFacilitySecurity {
  totalStaff: number;
  activeStaff: number;
  suspendedStaff: number;
  faceIdEnrolledCount: number;
  faceIdCompliancePct: number;
  mfaEnforced: boolean;
  customRolesCount: number;
  activeFormDraftsCount: number;
}

export interface MohFacilityDemographics {
  totalRegistered: number;
  activePatients: number;
  newRegistrations30d: number;
  bySex: { label: string; count: number }[];
  byAgeBand: { band: string; count: number }[];
}

export interface MohFacilityBedItem {
  id: string;
  ward: string;
  bedNo: string;
  status: string;
  doctor: string;
  diagnosis: string;
  updatedAt: string;
}

export interface MohFacilityClinicalDetail {
  opd: {
    total: number;
    waiting: number;
    withProvider: number;
    completed: number;
    paidCount: number;
    unpaidCount: number;
    byDepartment: { department: string; count: number }[];
    byVisitType: { visitType: string; count: number }[];
    recentVisits: {
      id: string;
      queueNumber: string;
      department: string;
      doctor: string;
      status: string;
      paymentStatus: string;
      visitType: string;
      checkedInAt: string;
    }[];
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    statCount: number;
    byType: { orderType: string; count: number; pending: number }[];
  };
  pharmacy: {
    totalPrescriptions: number;
    pendingPrescriptions: number;
    dispensedPrescriptions: number;
    topDrugs: { drugName: string; count: number; pending: number }[];
    recentPrescriptions: {
      id: string;
      drugName: string;
      dose: string;
      route: string;
      status: string;
      prescribedBy: string;
      createdAt: string;
    }[];
  };
  laboratory: {
    totalResults: number;
    pendingResults: number;
    criticalFlags: number;
    abnormalFlags: number;
    recentResults: {
      id: string;
      testName: string;
      flag: string;
      status: string;
      validatedBy: string;
      createdAt: string;
    }[];
  };
  vitals: {
    totalRecorded: number;
    criticalUrgencyCount: number;
    urgentCount: number;
    recentAlerts: {
      id: string;
      urgency: string;
      bp: string;
      pulse: number | null;
      temp: number | null;
      spo2: number | null;
      recordedBy: string;
      recordedAt: string;
    }[];
  };
  specialtyOperations: {
    theatreCasesCount: number;
    ancPlansCount: number;
    icuStepDownCount: number;
    wardMedRequestsCount: number;
    himRecordsCount: number;
    syncedDomains: { key: string; label: string; updatedAt: string; itemCount: number }[];
  };
}

export interface MohFacilityStaffRosterItem {
  badgeId: string;
  fullName: string;
  role: string;
  roleKey: string;
  title: string;
  department: string;
  status: string;
  clearanceLevel: number;
  clearanceLabel: string;
  faceIdEnrolled: boolean;
  faceIdEnrolledAt: string | null;
  createdAt: string;
}

export interface MohFacilityFinanceDetail {
  totalCollectedNgn: number;
  totalPendingNgn: number;
  paidReceiptsCount: number;
  openRequestsCount: number;
  byChannel: {
    akwaremit: number;
    paystack: number;
    cash: number;
    hmo: number;
    other: number;
  };
  bySource: { source: string; collectedNgn: number; pendingNgn: number; count: number }[];
  recentInvoices: {
    id: string;
    source: string;
    description: string;
    amountNgn: number;
    status: string;
    paidVia: string;
    createdAt: string;
  }[];
  openAccountRequests: {
    id: string;
    purpose: string;
    amountNgn: number;
    status: string;
    paidVia: string;
    sentAt: string;
  }[];
}

export interface MohFacilityComplianceDetail {
  directives: (MohDirective & { acknowledged: boolean })[];
  audits: MohAuditRecord[];
  notifications: {
    id: string;
    level: string;
    title: string;
    body: string;
    roleHint: string;
    read: boolean;
    createdAt: string;
  }[];
  auditLedger: MohAuditLedgerEvent[];
}

export interface MohFacilityDossier {
  syncMode: MohSyncStatus;
  syncedAt: string;
  facility: MohFacilityTelemetry;
  governance: MohFacilityGovernance;
  security: MohFacilitySecurity;
  demographics: MohFacilityDemographics;
  beds: {
    total: number;
    occupied: number;
    available: number;
    icuTotal: number;
    icuOccupied: number;
    wards: { ward: string; total: number; occupied: number; available: number }[];
    topDiagnoses: { diagnosis: string; count: number }[];
    bedList: MohFacilityBedItem[];
  };
  clinical: MohFacilityClinicalDetail;
  workforce: {
    total: number;
    active: number;
    byCadre: { cadre: string; count: number }[];
    byDepartment: { department: string; count: number }[];
    staffRoster: MohFacilityStaffRosterItem[];
    transfers: MohTransferRecord[];
  };
  finance: MohFacilityFinanceDetail;
  compliance: MohFacilityComplianceDetail;
}
