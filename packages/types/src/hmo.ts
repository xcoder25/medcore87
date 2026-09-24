export type HmoScheme = 'AKSHIA_STATE' | 'NHIA_FORMAL' | 'NHIA_VULNERABLE' | 'PRIVATE_HMO' | 'OUT_OF_POCKET';

export type ClaimStatus = 'DRAFT' | 'PREAUTH_PENDING' | 'PREAUTH_APPROVED' | 'SUBMITTED' | 'ADJUDICATED' | 'PAID' | 'REJECTED';

export type DenialReasonCode =
  | 'INVALID_BENEFICIARY_ID'
  | 'POLICY_EXPIRED'
  | 'SERVICE_NOT_COVERED'
  | 'PREAUTH_REQUIRED_MISSING'
  | 'EXCEEDS_TARIFF_CAP'
  | 'DUPLICATE_CLAIM'
  | 'INCOMPLETE_CLINICAL_DOCUMENTATION';

export interface HmoEligibilityResult {
  eligible: boolean;
  policyId: string;
  scheme: HmoScheme;
  beneficiaryName: string;
  enrolleeTier: 'BASIC' | 'COMPREHENSIVE' | 'EXECUTIVE';
  primaryFacility: string;
  copayPercent: number; // e.g. 10%
  remainingAnnualCapNgn: number;
  coveredCategories: string[];
  denialReason?: DenialReasonCode;
  verifiedAt: string;
}

export interface HmoClaim {
  id: string;
  patientId: string;
  patientName: string;
  scheme: HmoScheme;
  policyId: string;
  facilityId: string;
  diagnosisCodes: string[];
  encounterId: string;
  items: Array<{
    itemDescription: string;
    tariffCode: string;
    grossAmountNgn: number;
    copayAmountNgn: number;
    hmoPayableNgn: number;
  }>;
  totalGrossNgn: number;
  totalCopayNgn: number;
  totalHmoPayableNgn: number;
  status: ClaimStatus;
  preauthCode?: string;
  denialReason?: DenialReasonCode;
  createdAt: string;
  adjudicatedAt?: string;
}
