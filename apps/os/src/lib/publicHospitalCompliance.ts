/**
 * Akwa Ibom State Public Hospital Facility Compliance & Civil Service / Professional
 * Staff Credential helpers for MedCore OS.
 *
 * Public secondary (General, Cottage, State Specialist) and Primary Health Centres
 * bypass commercial business documents (CAC, TIN, private operating licences) and
 * use government institutional identifiers, supervisory board authorization (AKSHMB /
 * AKSPHCDA / AKS MoH / FMOH), CMD sign-off, and statutory council credentials.
 */

export type SupervisoryBoardKey =
  | 'AKSHMB'
  | 'AKSPHCDA'
  | 'AKSMOH'
  | 'FMOH'
  | 'PRIVATE_REG';

export interface SupervisoryBoardMeta {
  key: SupervisoryBoardKey;
  shortName: string;
  fullName: string;
  scope: string;
}

export const SUPERVISORY_BOARDS: readonly SupervisoryBoardMeta[] = [
  {
    key: 'AKSHMB',
    shortName: 'HMB (AKSHMB)',
    fullName: 'Akwa Ibom State Hospitals Management Board',
    scope: 'Public Secondary Facilities (General, Cottage & State Specialist Hospitals)',
  },
  {
    key: 'AKSPHCDA',
    shortName: 'AKSPHCDA',
    fullName: 'Akwa Ibom State Primary Healthcare Development Agency',
    scope: 'Primary Health Centres (PHCs) & Comprehensive Health Centres',
  },
  {
    key: 'AKSMOH',
    shortName: 'AKS MoH',
    fullName: 'Akwa Ibom State Ministry of Health',
    scope: 'Statewide Ministerial Oversight & Tertiary Specialist (e.g. Ibom Specialist)',
  },
  {
    key: 'FMOH',
    shortName: 'FMOH (Federal)',
    fullName: 'Federal Ministry of Health',
    scope: 'Federal Tertiary Hospitals (e.g. University of Uyo Teaching Hospital - UUTH)',
  },
  {
    key: 'PRIVATE_REG',
    shortName: 'Private / Mission Registry',
    fullName: 'State MoH Private & Mission Facility Directorate',
    scope: 'Private, Mission/Faith-Based & PPP Health Facilities',
  },
] as const;

export function isPublicOwnership(ownership?: string): boolean {
  const o = String(ownership || '').trim().toLowerCase();
  return o === 'public_state' || o === 'public_federal';
}

export function defaultSupervisoryBoard(
  ownership?: string,
  hospitalTier?: string
): SupervisoryBoardKey {
  const o = String(ownership || '').trim().toLowerCase();
  const t = String(hospitalTier || '').trim().toLowerCase();
  if (o === 'public_federal') return 'FMOH';
  if (o === 'public_state') {
    if (t === 'primary_health_centre') return 'AKSPHCDA';
    return 'AKSHMB';
  }
  return 'PRIVATE_REG';
}

export function getSupervisoryBoardMeta(key?: string): SupervisoryBoardMeta {
  const norm = String(key || '').trim().toUpperCase();
  return (
    SUPERVISORY_BOARDS.find((b) => b.key === norm) ||
    SUPERVISORY_BOARDS[0]
  );
}

export function validateHfrCode(code: string): {
  ok: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    return {
      ok: false,
      normalized,
      error: 'Nigeria Health Facility Registry (HFR) Code is required for DHIS2 & NHMIS.',
    };
  }
  if (normalized.length < 6) {
    return {
      ok: false,
      normalized,
      error: 'HFR Code must be at least 6 characters (e.g. 03/06/1/2/1/0001).',
    };
  }
  if (!/^[A-Z0-9][A-Z0-9/-]{4,}[A-Z0-9]$/.test(normalized)) {
    return {
      ok: false,
      normalized,
      error: 'Enter a valid HFR Code using digits, letters, slashes (/), or hyphens (-).',
    };
  }
  return { ok: true, normalized };
}

export function validateGpsCoord(lat?: string, lng?: string): {
  ok: boolean;
  error?: string;
} {
  const latTrim = String(lat || '').trim();
  const lngTrim = String(lng || '').trim();
  if (!latTrim && !lngTrim) return { ok: true };
  if (!latTrim || !lngTrim) {
    return { ok: false, error: 'Provide both Latitude and Longitude GPS coordinates.' };
  }
  const latNum = Number(latTrim);
  const lngNum = Number(lngTrim);
  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    return { ok: false, error: 'GPS Latitude must be a valid number between -90 and 90.' };
  }
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    return { ok: false, error: 'GPS Longitude must be a valid number between -180 and 180.' };
  }
  return { ok: true };
}

export type EmploymentSchemeKey =
  | 'aks_civil_service'
  | 'aksphcda'
  | 'ippis'
  | 'contract_locum';

export const EMPLOYMENT_SCHEMES: ReadonlyArray<{
  key: EmploymentSchemeKey;
  label: string;
  idLabel: string;
  placeholder: string;
}> = [
  {
    key: 'aks_civil_service',
    label: 'Akwa Ibom State Civil Service / HMB',
    idLabel: 'AKS Civil Service / HMB Staff ID',
    placeholder: 'e.g. AKS/HMB/14829',
  },
  {
    key: 'aksphcda',
    label: 'AKSPHCDA (Primary Health Care Staff)',
    idLabel: 'AKSPHCDA Staff ID',
    placeholder: 'e.g. AKSPHCDA/PHC/0942',
  },
  {
    key: 'ippis',
    label: 'Federal IPPIS (e.g. UUTH / Federal Tertiary)',
    idLabel: 'IPPIS Number',
    placeholder: 'e.g. IPPIS-4829103',
  },
  {
    key: 'contract_locum',
    label: 'Contract / NYSC / Visiting Specialist',
    idLabel: 'Deployment / NYSC / Posting ID',
    placeholder: 'e.g. AK/26A/4821',
  },
];

export type RegulatoryCouncilCode =
  | 'MDCN'
  | 'NMCN'
  | 'PCN'
  | 'MLSCN'
  | 'HRORBN'
  | 'RRBN'
  | 'MRTBN'
  | 'NONE';

export interface RegulatoryCouncilMeta {
  code: RegulatoryCouncilCode;
  shortName: string;
  fullName: string;
  placeholder: string;
}

export const REGULATORY_COUNCILS: Record<RegulatoryCouncilCode, RegulatoryCouncilMeta> = {
  MDCN: {
    code: 'MDCN',
    shortName: 'MDCN',
    fullName: 'Medical and Dental Council of Nigeria',
    placeholder: 'e.g. MDCN/R/84920',
  },
  NMCN: {
    code: 'NMCN',
    shortName: 'NMCN',
    fullName: 'Nursing and Midwifery Council of Nigeria',
    placeholder: 'e.g. NMCN/RN/214802',
  },
  PCN: {
    code: 'PCN',
    shortName: 'PCN',
    fullName: 'Pharmacists Council of Nigeria',
    placeholder: 'e.g. PCN/019482',
  },
  MLSCN: {
    code: 'MLSCN',
    shortName: 'MLSCN',
    fullName: 'Medical Laboratory Science Council of Nigeria',
    placeholder: 'e.g. MLSCN/RA/31042',
  },
  HRORBN: {
    code: 'HRORBN',
    shortName: 'HRORBN',
    fullName: 'Health Records Officers Registration Board of Nigeria',
    placeholder: 'e.g. HRORBN/HIM/04821',
  },
  RRBN: {
    code: 'RRBN',
    shortName: 'RRBN',
    fullName: 'Radiographers Registration Board of Nigeria',
    placeholder: 'e.g. RRBN/REG/19482',
  },
  MRTBN: {
    code: 'MRTBN',
    shortName: 'MRTBN',
    fullName: 'Medical Rehabilitation Therapists Board of Nigeria',
    placeholder: 'e.g. MRTBN/PT/08412',
  },
  NONE: {
    code: 'NONE',
    shortName: 'Non-Licensed / Admin',
    fullName: 'Administrative or Support Cadre (No Clinical Council License)',
    placeholder: 'Optional professional ID',
  },
};

export function getRequiredCouncilForRole(roleKey?: string): {
  council: RegulatoryCouncilCode;
  required: boolean;
  councilName: string;
  placeholder: string;
  governanceNote?: string;
} {
  const rk = String(roleKey || '').trim().toLowerCase();
  if (
    rk === 'doctor' ||
    rk === 'surgeon' ||
    rk === 'medical_director' ||
    rk === 'dentist' ||
    rk === 'ophthalmologist' ||
    rk === 'psychiatrist' ||
    rk === 'oncologist'
  ) {
    const m = REGULATORY_COUNCILS.MDCN;
    return {
      council: 'MDCN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
    };
  }
  if (rk === 'nurse' || rk === 'midwife' || rk === 'dialysis_nurse') {
    const m = REGULATORY_COUNCILS.NMCN;
    return {
      council: 'NMCN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
    };
  }
  if (rk === 'pharmacist') {
    const m = REGULATORY_COUNCILS.PCN;
    return {
      council: 'PCN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
    };
  }
  if (rk === 'lab') {
    const m = REGULATORY_COUNCILS.MLSCN;
    return {
      council: 'MLSCN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
    };
  }
  if (rk === 'records') {
    const m = REGULATORY_COUNCILS.HRORBN;
    return {
      council: 'HRORBN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
      governanceNote:
        'Required in public hospitals — licensed HIM officers manage patient folder numbers and EMR data governance.',
    };
  }
  if (rk === 'radiologist') {
    const m = REGULATORY_COUNCILS.RRBN;
    return {
      council: 'RRBN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
    };
  }
  if (rk === 'physiotherapist') {
    const m = REGULATORY_COUNCILS.MRTBN;
    return {
      council: 'MRTBN',
      required: true,
      councilName: m.fullName,
      placeholder: m.placeholder,
    };
  }
  const m = REGULATORY_COUNCILS.NONE;
  return {
    council: 'NONE',
    required: false,
    councilName: m.fullName,
    placeholder: m.placeholder,
  };
}

export function validateStaffCredentials(input: {
  roleKey?: string;
  civilServiceId?: string;
  requireCivilServiceId?: boolean;
  regulatoryBody?: RegulatoryCouncilCode | string;
  practicingLicenseNo?: string;
  licenseExpiry?: string;
}): { ok: boolean; error?: string } {
  const csId = String(input.civilServiceId || '').trim();
  if (input.requireCivilServiceId && csId.length < 4) {
    return {
      ok: false,
      error: 'Civil Service / IPPIS Staff ID is required (minimum 4 characters).',
    };
  }
  if (csId && csId.length < 4) {
    return {
      ok: false,
      error: 'Civil Service / IPPIS Staff ID must be at least 4 characters.',
    };
  }

  const councilInfo = getRequiredCouncilForRole(input.roleKey);
  const effectiveCouncil = String(
    input.regulatoryBody || councilInfo.council
  )
    .trim()
    .toUpperCase();
  const licenseNo = String(input.practicingLicenseNo || '').trim();

  if (councilInfo.required && effectiveCouncil === 'NONE') {
    return {
      ok: false,
      error: `${councilInfo.council} annual practicing license is mandatory for this clinical/HIM role.`,
    };
  }
  if (councilInfo.required && licenseNo.length < 4) {
    return {
      ok: false,
      error: `Valid ${councilInfo.council} (${councilInfo.councilName}) practicing license number is required (minimum 4 characters).`,
    };
  }
  if (licenseNo && licenseNo.length < 4) {
    return {
      ok: false,
      error: 'Practicing license number must be at least 4 characters.',
    };
  }

  const expiry = String(input.licenseExpiry || '').trim();
  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return {
      ok: false,
      error: 'License expiry date must use YYYY-MM-DD format.',
    };
  }
  return { ok: true };
}

export interface StaffCredentialFields {
  employmentScheme?: string;
  civilServiceId?: string;
  regulatoryBody?: string;
  practicingLicenseNo?: string;
  licenseExpiry?: string;
}

export function extractStaffCredentials(raw: unknown): StaffCredentialFields {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, any>;
  const meta =
    obj.meta && typeof obj.meta === 'object'
      ? (obj.meta as Record<string, any>)
      : {};
  const str = (v: unknown): string | undefined => {
    const s = String(v ?? '').trim();
    return s || undefined;
  };
  return {
    employmentScheme: str(
      obj.employmentScheme ?? obj.employment_scheme ?? meta.employmentScheme
    ),
    civilServiceId: str(
      obj.civilServiceId ?? obj.civil_service_id ?? meta.civilServiceId
    ),
    regulatoryBody: str(
      obj.regulatoryBody ?? obj.regulatory_body ?? meta.regulatoryBody
    ),
    practicingLicenseNo: str(
      obj.practicingLicenseNo ??
        obj.practicing_license_no ??
        meta.practicingLicenseNo
    ),
    licenseExpiry: str(
      obj.licenseExpiry ?? obj.license_expiry ?? meta.licenseExpiry
    ),
  };
}
