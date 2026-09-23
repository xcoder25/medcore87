// ─── MedCore Security & Privacy Governance Types ───────────────────────────

export interface EncryptedPayload {
  iv: string; // 12-byte hex IV for AES-GCM
  tag: string; // 16-byte hex authentication tag
  ciphertext: string; // Hex encrypted data
  keyVersion: string;
  algorithm: 'AES-256-GCM';
}

export type AuditAction =
  | 'READ_PHI'
  | 'WRITE_PHI'
  | 'EXPORT_RECORD'
  | 'DECRYPT_PAYLOAD'
  | 'BREAK_GLASS_ACCESS'
  | 'FINANCIAL_TRANSACT'
  | 'FACILITY_LOGIN'
  | 'SURVEILLANCE_EXPORT'
  | 'CONSENT_REVOKE';

export type UserRole =
  | 'PATIENT'
  | 'DOCTOR'
  | 'NURSE'
  | 'CASHIER'
  | 'PHARMACIST'
  | 'LAB_TECH'
  | 'HOSPITAL_ADMIN'
  | 'MOH_COMMISSIONER'
  | 'REGULATORY_AUDITOR'
  | 'SYSTEM_DAEMON';

export interface AuditBlock {
  blockNumber: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  facilityId: string;
  action: AuditAction;
  resourceType: 'PATIENT' | 'ENCOUNTER' | 'BILL' | 'WALLET' | 'PRESCRIPTION' | 'LAB_RESULT' | 'FACILITY';
  resourceId: string;
  reason: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
  signature: string;
}

export interface BreakGlassEvent {
  id: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientMRN: string;
  facilityId: string;
  justification: string;
  clinicalIndication: 'UNCONSCIOUS_TRAUMA' | 'CARDIAC_ARREST' | 'MASS_CASUALTY' | 'ACUTE_SURGICAL';
  timestamp: string;
  supervisorNotified: boolean;
  commissionerAlertSent: boolean;
  status: 'ACTIVE' | 'SUPERVISOR_ACKNOWLEDGED' | 'RESOLVED';
  auditBlockNumber: number;
}

export interface PatientConsentRecord {
  patientId: string;
  crossFacilityShare: boolean;
  medicalTourismShare: boolean;
  epidemiologicalSurveillanceOptIn: boolean; // De-identified
  insuranceClaimsDirectProcessing: boolean;
  emergencyBreakGlassPermitted: boolean;
  lastUpdated: string;
}

export interface CommissionerSecurityDossier {
  systemVersion: string;
  complianceCertifications: {
    hipaaCompliant: boolean;
    gdprCompliant: boolean;
    iso27001Framework: boolean;
    zeroTrustVerified: boolean;
  };
  cryptographySpecs: {
    atRest: 'AES-256-GCM Field-Level Envelope Encryption';
    inTransit: 'TLS 1.3 Strict / Perfect Forward Secrecy';
    auditLedger: 'SHA-256 Chained Hash Immutable Ledger';
    tokenSigning: 'RS256 Asymmetric JWT with Fine-Grained Scopes';
  };
  auditIntegrity: {
    totalBlocks: number;
    genesisBlockHash: string;
    headBlockHash: string;
    chainIntegrityVerified: boolean;
    lastVerificationTimestamp: string;
  };
  activeBreakGlassAlerts: number;
  dataResidency: {
    inCountryStorage: boolean;
    region: string;
    backupRegion: string;
  };
}
