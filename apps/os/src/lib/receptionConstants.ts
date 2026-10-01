/** Akwa Ibom LGAs + Nigeria insurance providers for reception */

export const AKWA_IBOM_LGAS = [
  'Abak',
  'Eastern Obolo',
  'Eket',
  'Esit Eket',
  'Essien Udim',
  'Etim Ekpo',
  'Etinan',
  'Ibeno',
  'Ibesikpo Asutan',
  'Ibiono Ibom',
  'Ika',
  'Ikono',
  'Ikot Abasi',
  'Ikot Ekpene',
  'Ini',
  'Itu',
  'Mbo',
  'Mkpat Enin',
  'Nsit Atai',
  'Nsit Ibom',
  'Nsit Ubium',
  'Obot Akara',
  'Okobo',
  'Onna',
  'Oron',
  'Oruk Anam',
  'Udung Uko',
  'Ukanafun',
  'Uruan',
  'Urue-Offong/Oruko',
  'Uyo',
] as const;

export const NIGERIA_INSURANCE = [
  { id: 'NHIA', name: 'NHIA (National Health Insurance Authority)', type: 'government' },
  { id: 'HYGEIA', name: 'Hygeia HMO', type: 'hmo' },
  { id: 'AXA', name: 'AXA Mansard Health', type: 'hmo' },
  { id: 'AVON', name: 'Avon HMO', type: 'hmo' },
  { id: 'LEADWAY', name: 'Leadway Health', type: 'hmo' },
  { id: 'THT', name: 'Total Health Trust', type: 'hmo' },
  { id: 'RELIANCE', name: 'Reliance HMO', type: 'hmo' },
  { id: 'AIICO', name: 'AIICO Multishield', type: 'hmo' },
  { id: 'CLEARLINE', name: 'Clearline HMO', type: 'hmo' },
  { id: 'DEFENCE', name: 'Defence Health', type: 'government' },
  { id: 'POLICE', name: 'Police Health Scheme', type: 'government' },
  { id: 'PRIVATE', name: 'Private / Corporate plan', type: 'other' },
  { id: 'NONE', name: 'Self-pay (no insurance)', type: 'none' },
] as const;

export const RECEPTION_DEPTS = [
  'General OPD',
  'Pediatrics',
  'Maternity',
  'Dental',
  'Eye Clinic',
  'Laboratory',
  'Pharmacy',
  'Radiology',
  'Emergency',
  'Physiotherapy',
  'ANC',
  'Family Planning',
] as const;

export const CONSULT_FEES: Record<string, number> = {
  'General OPD': 5000,
  Pediatrics: 5000,
  Maternity: 8000,
  Dental: 7000,
  'Eye Clinic': 6000,
  Laboratory: 0,
  Pharmacy: 0,
  Radiology: 0,
  Emergency: 10000,
  Physiotherapy: 4000,
  ANC: 3000,
  'Family Planning': 2000,
};

/** Mock NIN directory for quick registration (pilot) */
export const NIN_DEMO_DIRECTORY: Record<
  string,
  {
    firstName: string;
    lastName: string;
    middleName?: string;
    dob: string;
    sex: 'Male' | 'Female';
    phone: string;
    address: string;
    state: string;
    lga: string;
  }
> = {
  '12345678901': {
    firstName: 'Uduak',
    lastName: 'Essien',
    middleName: 'Bassey',
    dob: '1990-03-14',
    sex: 'Female',
    phone: '08031234567',
    address: '12 Wellington Bassey Way',
    state: 'Akwa Ibom',
    lga: 'Uyo',
  },
  '98765432109': {
    firstName: 'Emem',
    lastName: 'Okoro',
    dob: '1985-11-02',
    sex: 'Male',
    phone: '08098765432',
    address: '45 Stadium Road',
    state: 'Akwa Ibom',
    lga: 'Eket',
  },
  '11122233344': {
    firstName: 'Blessing',
    lastName: 'Akpan',
    middleName: 'Ime',
    dob: '1998-07-22',
    sex: 'Female',
    phone: '08123456789',
    address: '8 Hospital Road',
    state: 'Akwa Ibom',
    lga: 'Ikot Ekpene',
  },
};

export function lookupNin(nin: string) {
  const key = nin.replace(/\D/g, '');
  return NIN_DEMO_DIRECTORY[key] || null;
}

export function verifyInsurance(providerId: string, memberId: string): {
  ok: boolean;
  status: 'active' | 'expired' | 'unknown' | 'self_pay';
  message: string;
  plan?: string;
  expiry?: string;
} {
  if (!providerId || providerId === 'NONE') {
    return { ok: true, status: 'self_pay', message: 'Self-pay — no HMO verification needed' };
  }
  if (!memberId || memberId.trim().length < 4) {
    return { ok: false, status: 'unknown', message: 'Enter a valid membership / NHIA number' };
  }
  // Deterministic mock gateway
  const n = memberId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  if (n % 11 === 0) {
    return { ok: false, status: 'expired', message: 'Plan expired — collect payment or renew' };
  }
  return {
    ok: true,
    status: 'active',
    message: 'Eligibility confirmed with scheme gateway',
    plan: providerId === 'NHIA' ? 'NHIA Formal Sector' : 'Corporate Gold',
    expiry: '2026-12-31',
  };
}
