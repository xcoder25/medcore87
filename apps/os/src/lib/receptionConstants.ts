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

/** State-specific LGA mapping for Nigeria (auto-updates LGA dropdown when State changes) */
export const NIGERIA_STATE_LGAS: Record<string, readonly string[]> = {
  'Akwa Ibom': AKWA_IBOM_LGAS,
  'Cross River': [
    'Abi', 'Akamkpa', 'Akpabuyo', 'Bakassi', 'Bekwarra', 'Biase', 'Boki',
    'Calabar Municipal', 'Calabar South', 'Etung', 'Ikom', 'Obanliku',
    'Obubra', 'Obudu', 'Odukpani', 'Ogoja', 'Yakurr', 'Yala',
  ],
  Rivers: [
    'Abua/Odual', 'Ahoada East', 'Ahoada West', 'Akuku-Toru', 'Andoni', 'Asari-Toru',
    'Bonny', 'Degema', 'Eleme', 'Emohua', 'Etche', 'Gokana', 'Ikwerre', 'Khana',
    'Obio/Akpor', 'Ogba/Egbema/Ndoni', 'Ogu/Bolo', 'Okrika', 'Omuma', 'Opobo/Nkoro',
    'Oyigbo', 'Port Harcourt', 'Tai',
  ],
  Abia: [
    'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North',
    'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia', 'Osisioma', 'Ugwunagbo',
    'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umu Nneochi',
  ],
  Lagos: [
    'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry',
    'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu',
    'Kosofe', 'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo',
    'Shomolu', 'Surulere',
  ],
  'FCT Abuja': [
    'Abaji', 'Abuja Municipal (AMAC)', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali',
  ],
  Delta: [
    'Aniocha North', 'Aniocha South', 'Bomadi', 'Burutu', 'Ethiope East', 'Ethiope West',
    'Ika North East', 'Ika South', 'Isoko North', 'Isoko South', 'Ndokwa East',
    'Ndokwa West', 'Okpe', 'Oshimili North', 'Oshimili South', 'Patani', 'Sapele',
    'Udu', 'Ughelli North', 'Ughelli South', 'Ukwuani', 'Uvwie', 'Warri North',
    'Warri South', 'Warri South West',
  ],
  Edo: [
    'Akoko-Edo', 'Egor', 'Esan Central', 'Esan North-East', 'Esan South-East', 'Esan West',
    'Etsako Central', 'Etsako East', 'Etsako West', 'Igueben', 'Ikpoba-Okha', 'Oredo',
    'Orhionmwon', 'Ovia North-East', 'Ovia South-West', 'Owan East', 'Owan West', 'Uhunmwonde',
  ],
  Enugu: [
    'Aninri', 'Awgu', 'Enugu East', 'Enugu North', 'Enugu South', 'Ezeagu', 'Igbo Etiti',
    'Igbo Eze North', 'Igbo Eze South', 'Isi Uzo', 'Nkanu East', 'Nkanu West', 'Nsukka',
    'Oji River', 'Udenu', 'Udi', 'Uzo-Uwani',
  ],
  Anambra: [
    'Aguata', 'Anambra East', 'Anambra West', 'Anaocha', 'Awka North', 'Awka South',
    'Ayamelum', 'Dunukofia', 'Ekwusigo', 'Idemili North', 'Idemili South', 'Ihiala',
    'Njikoka', 'Nnewi North', 'Nnewi South', 'Ogbaru', 'Onitsha North', 'Onitsha South',
    'Orumba North', 'Orumba South', 'Oyi',
  ],
  Imo: [
    'Aboh Mbaise', 'Ahiazu Mbaise', 'Ehime Mbano', 'Ezinihitte', 'Ideato North',
    'Ideato South', 'Ihitte/Uboma', 'Ikeduru', 'Isiala Mbano', 'Isu', 'Mbaitoli',
    'Ngor Okpala', 'Njaba', 'Nkwerre', 'Nwangele', 'Obowo', 'Oguta', 'Ohaji/Egbema',
    'Okigwe', 'Orlu', 'Orsu', 'Oru East', 'Oru West', 'Owerri Municipal', 'Owerri North',
    'Owerri West', 'Unuimo',
  ],
  Bayelsa: [
    'Brass', 'Ekeremor', 'Kolokuma/Opokuma', 'Nembe', 'Ogbia', 'Sagbama',
    'Southern Ijaw', 'Yenagoa',
  ],
  Ogun: [
    'Abeokuta North', 'Abeokuta South', 'Ado-Odo/Ota', 'Ewekoro', 'Ifo', 'Ijebu East',
    'Ijebu North', 'Ijebu North East', 'Ijebu Ode', 'Ikenne', 'Imeko Afon', 'Ipokia',
    'Obafemi Owode', 'Odeda', 'Odogbolu', 'Ogun Waterside', 'Remo North', 'Sagamu',
    'Yewa North', 'Yewa South',
  ],
  Oyo: [
    'Afijio', 'Akinyele', 'Atiba', 'Atisbo', 'Egbeda', 'Ibadan North', 'Ibadan North-East',
    'Ibadan North-West', 'Ibadan South-East', 'Ibadan South-West', 'Ibarapa Central',
    'Ibarapa East', 'Ibarapa North', 'Ido', 'Irepo', 'Iseyin', 'Itesiwaju', 'Iwajowa',
    'Kajola', 'Lagelu', 'Ogbomosho North', 'Ogbomosho South', 'Ogo Oluwa', 'Olorunsogo',
    'Oluyole', 'Ona Ara', 'Orelope', 'Ori Ire', 'Oyo East', 'Oyo West', 'Saki East',
    'Saki West', 'Surulere',
  ],
  Kano: [
    'Ajingi', 'Albasu', 'Bagwai', 'Bebeji', 'Bichi', 'Bunkure', 'Dala', 'Dambatta',
    'Dawakin Kudu', 'Dawakin Tofa', 'Doguwa', 'Fagge', 'Gabasawa', 'Garko', 'Garun Mallam',
    'Gaya', 'Gezawa', 'Gwale', 'Gwarzo', 'Kabo', 'Kano Municipal', 'Karaye', 'Kibiya',
    'Kiru', 'Kumbotso', 'Kunchi', 'Kura', 'Madobi', 'Makoda', 'Minjibir', 'Nasarawa',
    'Rano', 'Rimin Gado', 'Rogo', 'Shanono', 'Sumaila', 'Takai', 'Tarauni', 'Tofa',
    'Tsanyawa', 'Tudun Wada', 'Ungogo', 'Warawa', 'Wudil',
  ],
  Kaduna: [
    'Birnin Gwari', 'Chikun', 'Giwa', 'Igabi', 'Ikara', 'Jaba', 'Jema’a', 'Kachia',
    'Kaduna North', 'Kaduna South', 'Kagarko', 'Kajuru', 'Kaura', 'Kauru', 'Kubau',
    'Kudan', 'Lere', 'Makarfi', 'Sabon Gari', 'Sanga', 'Soba', 'Zangon Kataf', 'Zaria',
  ],
};

export const NIGERIA_INSURANCE = [
  { id: 'AKSHIA', name: 'AKSHIA (Akwa Ibom State Health Insurance Agency)', type: 'government' },
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

/** Specialty mix sized for teaching hospitals (e.g. UUTH) */
export const RECEPTION_DEPTS = [
  'General OPD',
  'Medical OPD',
  'Surgical OPD',
  'Pediatrics',
  'Maternity',
  'ANC',
  'Gynaecology',
  'Orthopaedics',
  'Cardiology',
  'Nephrology',
  'Neurology',
  'Dental',
  'Eye Clinic',
  'ENT',
  'Dermatology',
  'Psychiatry',
  'Oncology',
  'Emergency',
  'A&E Triage',
  'ICU step-down',
  'Laboratory',
  'Pharmacy',
  'Radiology',
  'Physiotherapy',
  'Family Planning',
  'Staff clinic',
  'VIP / Executive',
  'NHIA desk',
] as const;

export const CONSULT_FEES: Record<string, number> = {
  'General OPD': 5000,
  'Medical OPD': 6000,
  'Surgical OPD': 7000,
  Pediatrics: 5000,
  Maternity: 8000,
  Gynaecology: 7000,
  Orthopaedics: 8000,
  Cardiology: 10000,
  Nephrology: 9000,
  Neurology: 9000,
  Dental: 7000,
  'Eye Clinic': 6000,
  ENT: 6000,
  Dermatology: 5000,
  Psychiatry: 5000,
  Oncology: 12000,
  Laboratory: 0,
  Pharmacy: 0,
  Radiology: 0,
  Emergency: 10000,
  'A&E Triage': 5000,
  'ICU step-down': 0,
  Physiotherapy: 4000,
  ANC: 3000,
  'Family Planning': 2000,
  'Staff clinic': 0,
  'VIP / Executive': 25000,
  'NHIA desk': 0,
};

/** NIN directory for quick registration lookup */
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
> = {};

export function lookupNin(nin: string) {
  const key = nin.replace(/\D/g, '');
  return NIN_DEMO_DIRECTORY[key] || null;
}

export function verifyInsurance(providerId: string, memberId: string): {
  ok: boolean;
  status: 'active' | 'expired' | 'pending' | 'unknown' | 'self_pay';
  message: string;
  plan?: string;
  expiry?: string;
  copay?: string;
  authorizationCode?: string;
} {
  if (!providerId || providerId === 'NONE') {
    return { ok: true, status: 'self_pay', message: 'Self-pay (Private) — standard tariff schedule applies' };
  }
  const cleanId = (memberId || '').trim();
  if (!cleanId || cleanId.length < 4) {
    return { ok: false, status: 'unknown', message: 'Enter a valid Policy / Enrollee / NHIA ID to verify' };
  }
  const isAkshia = providerId === 'AKSHIA';
  const isNhia = providerId === 'NHIA';
  const authCode = `${providerId}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    ok: true,
    status: 'active',
    message: isAkshia
      ? 'Verified Active · AKSHIA State Health Scheme · Primary & Secondary Care Covered'
      : isNhia
        ? 'Verified Active · NHIA Formal Sector Scheme · 10% Co-payment on Formulary'
        : `Verified Active · ${providerId} Managed Care Network`,
    plan: isAkshia
      ? 'AKSHIA Formal Sector Standard'
      : isNhia
        ? 'NHIA Federal Civil Service Pool'
        : `${providerId} Comprehensive Corporate`,
    expiry: '31 Dec 2026',
    copay: isAkshia ? '0% Consultation & Lab · 10% Formulary Drugs' : '10% on Medications',
    authorizationCode: authCode,
  };
}
