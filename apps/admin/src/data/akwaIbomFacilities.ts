/**
 * Official Akwa Ibom State Health Facility Registry (Canonical IDs shared with MedCore OS).
 */

export type SenatorialDistrict = 'Uyo' | 'Ikot Ekpene' | 'Eket';
export type SupervisoryBoard = 'AKSHMB' | 'AKSPHCDA' | 'FMOH' | 'Mission';
export type FacilityEnrollmentStatus = 'pending' | 'credentials_issued' | 'active';

export type FacilityTierLocal =
  | 'national_referral'
  | 'regional_general'
  | 'district_hospital'
  | 'cottage_hospital'
  | 'specialized_center'
  | 'comprehensive_health_centre';

export interface OfficialAkwaIbomFacility {
  facilityId: string;
  facilityName: string;
  location: string;
  lga: string;
  district: SenatorialDistrict;
  tier: FacilityTierLocal;
  facilityType: string;
  board: SupervisoryBoard;
  domain: string;
}

export interface AkwaIbomFacility {
  facilityId: string;
  facilityName: string;
  location: string;
  region: string;
  tier: FacilityTierLocal;
  enrollmentStatus: FacilityEnrollmentStatus;
  hospiLogin?: string;
  hospiTempPassword?: string;
  credentialsIssuedAt?: string;
  activatedAt?: string;
  lastSeenAt?: string;
  totalBeds?: number;
  occupiedBeds?: number;
  icuBedsTotal?: number;
  icuBedsOccupied?: number;
  ventilatorsAvailable?: number;
  staffOnDuty?: number;
  complianceScore?: number;
  emergencyStatus?: 'normal' | 'surge_code_yellow' | 'surge_code_red' | 'critical';
  licenseNumber?: string;
  licenseExpires?: string;
  accreditationStatus?: 'accredited' | 'provisional' | 'suspended' | 'pending';
}

export const SENATORIAL_DISTRICTS: SenatorialDistrict[] = ['Uyo', 'Ikot Ekpene', 'Eket'];

export function inferSenatorialDistrict(location: string, name = ''): SenatorialDistrict {
  const t = `${location} ${name}`.toUpperCase();
  if (
    t.includes('EKET') ||
    t.includes('ORON') ||
    t.includes('OKOBO') ||
    t.includes('IBENO') ||
    t.includes('EASTERN OBOLO') ||
    t.includes('URUE-OFFONG') ||
    t.includes('ORUKO') ||
    t.includes('AWA') ||
    t.includes('IKOT ABASI') ||
    t.includes('EKPENE OBO') ||
    t.includes('IKOT EKO IBON') ||
    t.includes('IKOT EKPAW') ||
    t.includes('ASONG')
  ) {
    return 'Eket';
  }
  if (
    t.includes('IKOT EKPENE') ||
    t.includes('ABAK') ||
    t.includes('UKANA') ||
    t.includes('IKPE ANNANG') ||
    t.includes('INI') ||
    t.includes('IKONO') ||
    t.includes('IKOT OKORO') ||
    t.includes('URUK ATA') ||
    t.includes('IBESIT') ||
    t.includes('IKA') ||
    t.includes('NTO EDINO')
  ) {
    return 'Ikot Ekpene';
  }
  return 'Uyo';
}

export const OFFICIAL_AKWA_IBOM_FACILITIES: OfficialAkwaIbomFacility[] = [
  // General & Mission Hospitals
  { facilityId: 'IGH-EKT', facilityName: 'Immanuel General Hospital, Eket', location: 'Eket, Akwa Ibom', lga: 'Eket', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'igh-eket.medcore.ng' },
  { facilityId: 'GH-IKE', facilityName: 'General Hospital, Ikot Ekpene', location: 'Ikot Ekpene, Akwa Ibom', lga: 'Ikot Ekpene', district: 'Ikot Ekpene', tier: 'regional_general', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikotekpene.medcore.ng' },
  { facilityId: 'GH-IQU', facilityName: 'General Hospital, Iquita Oron', location: 'Oron, Akwa Ibom', lga: 'Oron', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-iquita.medcore.ng' },
  { facilityId: 'MGH-ITM', facilityName: 'Methodist General Hospital, Ituk Mbang', location: 'Ituk Mbang, Akwa Ibom', lga: 'Uruan', district: 'Uyo', tier: 'district_hospital', facilityType: 'Mission Hospital', board: 'Mission', domain: 'mgh-itukmbang.medcore.ng' },
  { facilityId: 'GH-ETN', facilityName: 'General Hospital, Etinan', location: 'Etinan, Akwa Ibom', lga: 'Etinan', district: 'Uyo', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-etinan.medcore.ng' },
  { facilityId: 'GH-UAB', facilityName: 'General Hospital, Ukpom Abak', location: 'Abak, Akwa Ibom', lga: 'Abak', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ukpomabak.medcore.ng' },
  { facilityId: 'GH-AWA', facilityName: 'General Hospital, Awa', location: 'Awa, Akwa Ibom', lga: 'Onna', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-awa.medcore.ng' },
  { facilityId: 'GH-IKO', facilityName: 'General Hospital, Ikot Okoro', location: 'Ikot Okoro, Akwa Ibom', lga: 'Oruk Anam', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikotokoro.medcore.ng' },
  { facilityId: 'GH-IKN', facilityName: 'General Hospital, Ikono', location: 'Ikono, Akwa Ibom', lga: 'Ikono', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikono.medcore.ng' },
  { facilityId: 'GH-AMM', facilityName: 'General Hospital, Amammong Okobo', location: 'Okobo, Akwa Ibom', lga: 'Okobo', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-amammong.medcore.ng' },
  { facilityId: 'MCH-AKU', facilityName: 'Mount Carmel Hospital, Akpa Utong', location: 'Akpa Utong, Akwa Ibom', lga: 'Ibesikpo Asutan', district: 'Uyo', tier: 'district_hospital', facilityType: 'Mission Hospital', board: 'Mission', domain: 'mch-akpautong.medcore.ng' },
  { facilityId: 'GH-URO', facilityName: 'General Hospital, Urue-Offong/Oruko', location: 'Urue-Offong, Akwa Ibom', lga: 'Urue-Offong/Oruko', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-urueoffong.medcore.ng' },
  { facilityId: 'GH-IPA', facilityName: 'General Hospital, Ikpe Annang', location: 'Ikpe Annang, Akwa Ibom', lga: 'Essien Udim', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikpeannang.medcore.ng' },
  { facilityId: 'GH-INI', facilityName: 'General Hospital, Ini', location: 'Ini, Akwa Ibom', lga: 'Ini', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ini.medcore.ng' },
  { facilityId: 'GH-IAB', facilityName: 'General Hospital, Ikot Abasi', location: 'Ikot Abasi, Akwa Ibom', lga: 'Ikot Abasi', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikotabasi.medcore.ng' },
  { facilityId: 'GH-MB2', facilityName: 'General Hospital, Mbioto 2', location: 'Mbioto, Akwa Ibom', lga: 'Etinan', district: 'Uyo', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-mbioto2.medcore.ng' },
  { facilityId: 'MSG-ITU', facilityName: 'Mary Slessor General Hospital, Itu', location: 'Itu, Akwa Ibom', lga: 'Itu', district: 'Uyo', tier: 'district_hospital', facilityType: 'Mission Hospital', board: 'Mission', domain: 'msg-itu.medcore.ng' },
  { facilityId: 'GH-UAI', facilityName: 'General Hospital, Uruk Ata Ikot Ekpor', location: 'Ikot Ekpor, Akwa Ibom', lga: 'Etim Ekpo', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-urukataekpor.medcore.ng' },

  // Specialist & Federal Tertiary Hospitals
  { facilityId: 'ISH-UYO', facilityName: 'Ibom Specialist Hospital, Uyo', location: 'Uyo, Akwa Ibom', lga: 'Uyo', district: 'Uyo', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'AKSHMB', domain: 'ish-uyo.medcore.ng' },
  { facilityId: 'UUTH-UYO', facilityName: 'University of Uyo Teaching Hospital (UUTH)', location: 'Uyo, Akwa Ibom', lga: 'Uyo', district: 'Uyo', tier: 'national_referral', facilityType: 'Federal Tertiary Hospital', board: 'FMOH', domain: 'uuth-uyo.medcore.ng' },
  { facilityId: 'QIC-EPO', facilityName: 'QIC Leprosy Hospital, Ekpene Obom', location: 'Ekpene Obom, Akwa Ibom', lga: 'Etinan', district: 'Uyo', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'Mission', domain: 'qic-ekpeneobom.medcore.ng' },
  { facilityId: 'IDH-IKE', facilityName: 'Infectious Disease Hospital, Ikot Ekpene', location: 'Ikot Ekpene, Akwa Ibom', lga: 'Ikot Ekpene', district: 'Ikot Ekpene', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'AKSHMB', domain: 'idh-ikotekpene.medcore.ng' },
  { facilityId: 'PSY-EKT', facilityName: 'Psychiatric Hospital, Eket', location: 'Eket, Akwa Ibom', lga: 'Eket', district: 'Eket', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'AKSHMB', domain: 'psy-eket.medcore.ng' },

  // Primary Health Centres (AKSPHCDA)
  { facilityId: 'PHC-UYO', facilityName: 'Primary Health Centre, Uyo (AKSPHCDA)', location: 'Uyo, Akwa Ibom', lga: 'Uyo', district: 'Uyo', tier: 'comprehensive_health_centre', facilityType: 'Primary Health Centre', board: 'AKSPHCDA', domain: 'phc-uyo.medcore.ng' },
  { facilityId: 'PHC-EKT', facilityName: 'Primary Health Centre, Eket (AKSPHCDA)', location: 'Eket, Akwa Ibom', lga: 'Eket', district: 'Eket', tier: 'comprehensive_health_centre', facilityType: 'Primary Health Centre', board: 'AKSPHCDA', domain: 'phc-eket.medcore.ng' },

  // Cottage Hospitals
  { facilityId: 'CH-UKA', facilityName: 'Cottage Hospital, Ukana', location: 'Ukana, Akwa Ibom', lga: 'Essien Udim', district: 'Ikot Ekpene', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ukana.medcore.ng' },
  { facilityId: 'CH-IBN', facilityName: 'Cottage Hospital, Ibeno', location: 'Ibeno, Akwa Ibom', lga: 'Ibeno', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ibeno.medcore.ng' },
  { facilityId: 'CH-IAB', facilityName: 'Cottage Hospital, Ikot Abia', location: 'Ikot Abia, Akwa Ibom', lga: 'Okobo', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotabia.medcore.ng' },
  { facilityId: 'CH-IEP', facilityName: 'Cottage Hospital, Ikot Ekpaw', location: 'Ikot Ekpaw, Akwa Ibom', lga: 'Mkpat Enin', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotekpaw.medcore.ng' },
  { facilityId: 'CH-ASO', facilityName: 'Cottage Hospital, Asong', location: 'Asong, Akwa Ibom', lga: 'Mkpat Enin', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-asong.medcore.ng' },
  { facilityId: 'CH-EPO', facilityName: 'Cottage Hospital, Ekpene Obo', location: 'Ekpene Obo, Akwa Ibom', lga: 'Esit Eket', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ekpeneobo.medcore.ng' },
  { facilityId: 'CH-IEI', facilityName: 'Cottage Hospital, Ikot Eko Ibon', location: 'Ikot Eko Ibon, Akwa Ibom', lga: 'Onna', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotekoibon.medcore.ng' },
  { facilityId: 'CH-EOB', facilityName: 'Cottage Hospital, Eastern Obolo', location: 'Eastern Obolo, Akwa Ibom', lga: 'Eastern Obolo', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-easternobolo.medcore.ng' },
  { facilityId: 'CH-IEU', facilityName: 'Cottage Hospital, Ikot Ekpene Udo', location: 'Ikot Ekpene Udo, Akwa Ibom', lga: 'Nsit Ubium', district: 'Uyo', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotekpeneudo.medcore.ng' },
  { facilityId: 'RCH-IBS', facilityName: 'Redeemer Cottage Hospital, Ibesit', location: 'Ibesit, Akwa Ibom', lga: 'Oruk Anam', district: 'Ikot Ekpene', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'Mission', domain: 'rch-ibesit.medcore.ng' },
  { facilityId: 'CH-AKU', facilityName: 'Cottage Hospital, Akai Ubium', location: 'Akai Ubium, Akwa Ibom', lga: 'Nsit Ubium', district: 'Uyo', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-akaiubium.medcore.ng' },
  { facilityId: 'CH-IKA', facilityName: 'Cottage Hospital, Ika', location: 'Ika, Akwa Ibom', lga: 'Ika', district: 'Ikot Ekpene', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ika.medcore.ng' },

  // Comprehensive Health Care Centres
  { facilityId: 'CHC-NTE', facilityName: 'Comprehensive Health Care Centre, Nto Edino', location: 'Nto Edino, Akwa Ibom', lga: 'Obot Akara', district: 'Ikot Ekpene', tier: 'comprehensive_health_centre', facilityType: 'Health Care Centre', board: 'AKSPHCDA', domain: 'chc-ntoedino.medcore.ng' },
  { facilityId: 'CHC-MBU', facilityName: 'Comprehensive Health Care Centre, Mbiaya Uruan', location: 'Mbiaya Uruan, Akwa Ibom', lga: 'Uruan', district: 'Uyo', tier: 'comprehensive_health_centre', facilityType: 'Health Care Centre', board: 'AKSPHCDA', domain: 'chc-mbiayauruan.medcore.ng' },
];

/** Backwards-compatible builder for legacy registry consumers */
export function buildOfficialFacilityRegistry(): AkwaIbomFacility[] {
  return OFFICIAL_AKWA_IBOM_FACILITIES.map((item) => ({
    facilityId: item.facilityId,
    facilityName: item.facilityName,
    location: item.location,
    region: `${item.district} District`,
    tier: item.tier,
    enrollmentStatus: 'pending' as FacilityEnrollmentStatus,
    accreditationStatus: 'pending' as const,
  }));
}

export function generateHospiCredentials(facility: AkwaIbomFacility): {
  hospiLogin: string;
  hospiTempPassword: string;
  issuedAt: string;
} {
  const slug = facility.location
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    hospiLogin: `HOSPI.${slug}.${facility.facilityId}`,
    hospiTempPassword: `AKS-${rand}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
    issuedAt: new Date().toISOString(),
  };
}

export function activateFacility(facility: AkwaIbomFacility): AkwaIbomFacility {
  return {
    ...facility,
    enrollmentStatus: 'active',
    activatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    emergencyStatus: 'normal',
    licenseNumber: facility.licenseNumber || `MOH-LIC-${facility.facilityId}`,
    accreditationStatus: 'provisional',
  };
}
