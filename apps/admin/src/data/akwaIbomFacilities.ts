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
  latitude: number;
  longitude: number;
  ownership?: 'public_state' | 'public_federal' | 'mission' | 'private';
  approvedServices?: string[];
}

export interface AkwaIbomLgaInfo {
  lga: string;
  district: SenatorialDistrict;
  latitude: number;
  longitude: number;
  ruralPriority?: boolean;
}

export const AKWA_IBOM_LGAS: AkwaIbomLgaInfo[] = [
  { lga: 'Uyo', district: 'Uyo', latitude: 5.0377, longitude: 7.9128 },
  { lga: 'Uruan', district: 'Uyo', latitude: 4.982, longitude: 8.046 },
  { lga: 'Itu', district: 'Uyo', latitude: 5.198, longitude: 7.982 },
  { lga: 'Ibiono Ibom', district: 'Uyo', latitude: 5.186, longitude: 7.896, ruralPriority: true },
  { lga: 'Ibesikpo Asutan', district: 'Uyo', latitude: 4.924, longitude: 7.943 },
  { lga: 'Nsit Ibom', district: 'Uyo', latitude: 4.888, longitude: 7.902, ruralPriority: true },
  { lga: 'Nsit Atai', district: 'Uyo', latitude: 4.844, longitude: 8.012, ruralPriority: true },
  { lga: 'Nsit Ubium', district: 'Uyo', latitude: 4.782, longitude: 7.956, ruralPriority: true },
  { lga: 'Etinan', district: 'Uyo', latitude: 4.842, longitude: 7.854 },
  { lga: 'Ikot Ekpene', district: 'Ikot Ekpene', latitude: 5.181, longitude: 7.714 },
  { lga: 'Abak', district: 'Ikot Ekpene', latitude: 4.982, longitude: 7.789 },
  { lga: 'Essien Udim', district: 'Ikot Ekpene', latitude: 5.146, longitude: 7.656 },
  { lga: 'Ikono', district: 'Ikot Ekpene', latitude: 5.213, longitude: 7.798, ruralPriority: true },
  { lga: 'Ini', district: 'Ikot Ekpene', latitude: 5.398, longitude: 7.742, ruralPriority: true },
  { lga: 'Obot Akara', district: 'Ikot Ekpene', latitude: 5.268, longitude: 7.594, ruralPriority: true },
  { lga: 'Etim Ekpo', district: 'Ikot Ekpene', latitude: 5.012, longitude: 7.614, ruralPriority: true },
  { lga: 'Ika', district: 'Ikot Ekpene', latitude: 5.018, longitude: 7.532, ruralPriority: true },
  { lga: 'Oruk Anam', district: 'Ikot Ekpene', latitude: 4.892, longitude: 7.652, ruralPriority: true },
  { lga: 'Ukanafun', district: 'Ikot Ekpene', latitude: 4.922, longitude: 7.598, ruralPriority: true },
  { lga: 'Eket', district: 'Eket', latitude: 4.642, longitude: 7.926 },
  { lga: 'Esit Eket', district: 'Eket', latitude: 4.651, longitude: 8.055 },
  { lga: 'Ibeno', district: 'Eket', latitude: 4.568, longitude: 8.004, ruralPriority: true },
  { lga: 'Onna', district: 'Eket', latitude: 4.654, longitude: 7.852 },
  { lga: 'Mkpat Enin', district: 'Eket', latitude: 4.714, longitude: 7.742, ruralPriority: true },
  { lga: 'Ikot Abasi', district: 'Eket', latitude: 4.572, longitude: 7.554 },
  { lga: 'Eastern Obolo', district: 'Eket', latitude: 4.534, longitude: 7.728, ruralPriority: true },
  { lga: 'Oron', district: 'Eket', latitude: 4.812, longitude: 8.234 },
  { lga: 'Okobo', district: 'Eket', latitude: 4.835, longitude: 8.132, ruralPriority: true },
  { lga: 'Mbo', district: 'Eket', latitude: 4.664, longitude: 8.248, ruralPriority: true },
  { lga: 'Udung Uko', district: 'Eket', latitude: 4.756, longitude: 8.254, ruralPriority: true },
  { lga: 'Urue-Offong/Oruko', district: 'Eket', latitude: 4.736, longitude: 8.174, ruralPriority: true },
];

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
  { facilityId: 'IGH-EKT', facilityName: 'Immanuel General Hospital, Eket', location: 'Eket, Akwa Ibom', lga: 'Eket', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'igh-eket.medcore.ng', latitude: 4.646, longitude: 7.929, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy', 'Inpatient'] },
  { facilityId: 'GH-IKE', facilityName: 'General Hospital, Ikot Ekpene', location: 'Ikot Ekpene, Akwa Ibom', lga: 'Ikot Ekpene', district: 'Ikot Ekpene', tier: 'regional_general', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikotekpene.medcore.ng', latitude: 5.182, longitude: 7.716, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy', 'ICU'] },
  { facilityId: 'GH-IQU', facilityName: 'General Hospital, Iquita Oron', location: 'Oron, Akwa Ibom', lga: 'Oron', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-iquita.medcore.ng', latitude: 4.812, longitude: 8.234, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'MGH-ITM', facilityName: 'Methodist General Hospital, Ituk Mbang', location: 'Ituk Mbang, Akwa Ibom', lga: 'Uruan', district: 'Uyo', tier: 'district_hospital', facilityType: 'Mission Hospital', board: 'Mission', domain: 'mgh-itukmbang.medcore.ng', latitude: 4.951, longitude: 8.053, ownership: 'mission', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-ETN', facilityName: 'General Hospital, Etinan', location: 'Etinan, Akwa Ibom', lga: 'Etinan', district: 'Uyo', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-etinan.medcore.ng', latitude: 4.842, longitude: 7.854, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-UAB', facilityName: 'General Hospital, Ukpom Abak', location: 'Abak, Akwa Ibom', lga: 'Abak', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ukpomabak.medcore.ng', latitude: 4.982, longitude: 7.789, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-AWA', facilityName: 'General Hospital, Awa', location: 'Awa, Akwa Ibom', lga: 'Onna', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-awa.medcore.ng', latitude: 4.664, longitude: 7.857, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab', 'Pharmacy', 'Inpatient'] },
  { facilityId: 'GH-IKO', facilityName: 'General Hospital, Ikot Okoro', location: 'Ikot Okoro, Akwa Ibom', lga: 'Oruk Anam', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikotokoro.medcore.ng', latitude: 4.908, longitude: 7.669, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-IKN', facilityName: 'General Hospital, Ikono', location: 'Ikono, Akwa Ibom', lga: 'Ikono', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikono.medcore.ng', latitude: 5.213, longitude: 7.798, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-AMM', facilityName: 'General Hospital, Amammong Okobo', location: 'Okobo, Akwa Ibom', lga: 'Okobo', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-amammong.medcore.ng', latitude: 4.835, longitude: 8.132, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab', 'Pharmacy', 'Inpatient'] },
  { facilityId: 'MCH-AKU', facilityName: 'Mount Carmel Hospital, Akpa Utong', location: 'Akpa Utong, Akwa Ibom', lga: 'Ibesikpo Asutan', district: 'Uyo', tier: 'district_hospital', facilityType: 'Mission Hospital', board: 'Mission', domain: 'mch-akpautong.medcore.ng', latitude: 4.924, longitude: 7.943, ownership: 'mission', approvedServices: ['OPD', 'Maternity', 'Paediatrics', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-URO', facilityName: 'General Hospital, Urue-Offong/Oruko', location: 'Urue-Offong, Akwa Ibom', lga: 'Urue-Offong/Oruko', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-urueoffong.medcore.ng', latitude: 4.736, longitude: 8.174, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab', 'Pharmacy', 'Inpatient'] },
  { facilityId: 'GH-IPA', facilityName: 'General Hospital, Ikpe Annang', location: 'Ikpe Annang, Akwa Ibom', lga: 'Essien Udim', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikpeannang.medcore.ng', latitude: 5.128, longitude: 7.648, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-INI', facilityName: 'General Hospital, Ini', location: 'Ini, Akwa Ibom', lga: 'Ini', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ini.medcore.ng', latitude: 5.398, longitude: 7.742, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab', 'Pharmacy', 'Inpatient'] },
  { facilityId: 'GH-IAB', facilityName: 'General Hospital, Ikot Abasi', location: 'Ikot Abasi, Akwa Ibom', lga: 'Ikot Abasi', district: 'Eket', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-ikotabasi.medcore.ng', latitude: 4.572, longitude: 7.554, ownership: 'public_state', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-MB2', facilityName: 'General Hospital, Mbioto 2', location: 'Mbioto, Akwa Ibom', lga: 'Etinan', district: 'Uyo', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-mbioto2.medcore.ng', latitude: 4.815, longitude: 7.821, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab', 'Pharmacy', 'Inpatient'] },
  { facilityId: 'MSG-ITU', facilityName: 'Mary Slessor General Hospital, Itu', location: 'Itu, Akwa Ibom', lga: 'Itu', district: 'Uyo', tier: 'district_hospital', facilityType: 'Mission Hospital', board: 'Mission', domain: 'msg-itu.medcore.ng', latitude: 5.198, longitude: 7.982, ownership: 'mission', approvedServices: ['OPD', 'Emergency', 'Maternity', 'Surgery', 'Lab', 'Pharmacy'] },
  { facilityId: 'GH-UAI', facilityName: 'General Hospital, Uruk Ata Ikot Ekpor', location: 'Ikot Ekpor, Akwa Ibom', lga: 'Etim Ekpo', district: 'Ikot Ekpene', tier: 'district_hospital', facilityType: 'General Hospital', board: 'AKSHMB', domain: 'gh-urukataekpor.medcore.ng', latitude: 5.012, longitude: 7.614, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab', 'Pharmacy', 'Inpatient'] },

  // Specialist & Federal Tertiary Hospitals
  { facilityId: 'ISH-UYO', facilityName: 'Ibom Specialist Hospital, Uyo', location: 'Uyo, Akwa Ibom', lga: 'Uyo', district: 'Uyo', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'AKSHMB', domain: 'ish-uyo.medcore.ng', latitude: 5.056, longitude: 7.902, ownership: 'public_state', approvedServices: ['Tertiary Surgery', 'Cardiology', 'Oncology', 'ICU', 'Radiology', 'Dialysis'] },
  { facilityId: 'UUTH-UYO', facilityName: 'University of Uyo Teaching Hospital (UUTH)', location: 'Uyo, Akwa Ibom', lga: 'Uyo', district: 'Uyo', tier: 'national_referral', facilityType: 'Federal Tertiary Hospital', board: 'FMOH', domain: 'uuth-uyo.medcore.ng', latitude: 5.014, longitude: 7.951, ownership: 'public_federal', approvedServices: ['Tertiary Referral', 'Trauma', 'ICU', 'Oncology', 'NICU', 'Teaching', 'Research'] },
  { facilityId: 'QIC-EPO', facilityName: 'QIC Leprosy Hospital, Ekpene Obom', location: 'Ekpene Obom, Akwa Ibom', lga: 'Etinan', district: 'Uyo', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'Mission', domain: 'qic-ekpeneobom.medcore.ng', latitude: 4.868, longitude: 7.841, ownership: 'mission', approvedServices: ['Infectious Dermatology', 'Rehabilitation', 'OPD', 'Pharmacy'] },
  { facilityId: 'IDH-IKE', facilityName: 'Infectious Disease Hospital, Ikot Ekpene', location: 'Ikot Ekpene, Akwa Ibom', lga: 'Ikot Ekpene', district: 'Ikot Ekpene', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'AKSHMB', domain: 'idh-ikotekpene.medcore.ng', latitude: 5.195, longitude: 7.731, ownership: 'public_state', approvedServices: ['Isolation', 'IDSR Outbreak Care', 'TB/MDR Clinic', 'Molecular Lab'] },
  { facilityId: 'PSY-EKT', facilityName: 'Psychiatric Hospital, Eket', location: 'Eket, Akwa Ibom', lga: 'Eket', district: 'Eket', tier: 'specialized_center', facilityType: 'Specialist Hospital', board: 'AKSHMB', domain: 'psy-eket.medcore.ng', latitude: 4.634, longitude: 7.912, ownership: 'public_state', approvedServices: ['Psychiatry', 'Behavioral Health', 'Inpatient Rehab', 'Pharmacy'] },

  // Primary Health Centres (AKSPHCDA)
  { facilityId: 'PHC-UYO', facilityName: 'Primary Health Centre, Uyo (AKSPHCDA)', location: 'Uyo, Akwa Ibom', lga: 'Uyo', district: 'Uyo', tier: 'comprehensive_health_centre', facilityType: 'Primary Health Centre', board: 'AKSPHCDA', domain: 'phc-uyo.medcore.ng', latitude: 5.037, longitude: 7.921, ownership: 'public_state', approvedServices: ['ANC', 'Immunization', 'Normal Delivery', 'OPD', 'PHC Cold-Chain'] },
  { facilityId: 'PHC-EKT', facilityName: 'Primary Health Centre, Eket (AKSPHCDA)', location: 'Eket, Akwa Ibom', lga: 'Eket', district: 'Eket', tier: 'comprehensive_health_centre', facilityType: 'Primary Health Centre', board: 'AKSPHCDA', domain: 'phc-eket.medcore.ng', latitude: 4.652, longitude: 7.941, ownership: 'public_state', approvedServices: ['ANC', 'Immunization', 'Normal Delivery', 'OPD', 'PHC Cold-Chain'] },

  // Cottage Hospitals
  { facilityId: 'CH-UKA', facilityName: 'Cottage Hospital, Ukana', location: 'Ukana, Akwa Ibom', lga: 'Essien Udim', district: 'Ikot Ekpene', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ukana.medcore.ng', latitude: 5.204, longitude: 7.668, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Emergency Triage', 'Lab'] },
  { facilityId: 'CH-IBN', facilityName: 'Cottage Hospital, Ibeno', location: 'Ibeno, Akwa Ibom', lga: 'Ibeno', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ibeno.medcore.ng', latitude: 4.568, longitude: 8.004, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Emergency Triage', 'Immunization'] },
  { facilityId: 'CH-IAB', facilityName: 'Cottage Hospital, Ikot Abia', location: 'Ikot Abia, Akwa Ibom', lga: 'Okobo', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotabia.medcore.ng', latitude: 4.808, longitude: 8.111, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab'] },
  { facilityId: 'CH-IEP', facilityName: 'Cottage Hospital, Ikot Ekpaw', location: 'Ikot Ekpaw, Akwa Ibom', lga: 'Mkpat Enin', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotekpaw.medcore.ng', latitude: 4.725, longitude: 7.752, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab'] },
  { facilityId: 'CH-ASO', facilityName: 'Cottage Hospital, Asong', location: 'Asong, Akwa Ibom', lga: 'Mkpat Enin', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-asong.medcore.ng', latitude: 4.696, longitude: 7.721, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Pharmacy'] },
  { facilityId: 'CH-EPO', facilityName: 'Cottage Hospital, Ekpene Obo', location: 'Ekpene Obo, Akwa Ibom', lga: 'Esit Eket', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ekpeneobo.medcore.ng', latitude: 4.651, longitude: 8.055, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Emergency Triage'] },
  { facilityId: 'CH-IEI', facilityName: 'Cottage Hospital, Ikot Eko Ibon', location: 'Ikot Eko Ibon, Akwa Ibom', lga: 'Onna', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotekoibon.medcore.ng', latitude: 4.642, longitude: 7.841, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab'] },
  { facilityId: 'CH-EOB', facilityName: 'Cottage Hospital, Eastern Obolo', location: 'Eastern Obolo, Akwa Ibom', lga: 'Eastern Obolo', district: 'Eket', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-easternobolo.medcore.ng', latitude: 4.534, longitude: 7.728, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Immunization'] },
  { facilityId: 'CH-IEU', facilityName: 'Cottage Hospital, Ikot Ekpene Udo', location: 'Ikot Ekpene Udo, Akwa Ibom', lga: 'Nsit Ubium', district: 'Uyo', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ikotekpeneudo.medcore.ng', latitude: 4.798, longitude: 7.946, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab'] },
  { facilityId: 'RCH-IBS', facilityName: 'Redeemer Cottage Hospital, Ibesit', location: 'Ibesit, Akwa Ibom', lga: 'Oruk Anam', district: 'Ikot Ekpene', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'Mission', domain: 'rch-ibesit.medcore.ng', latitude: 4.872, longitude: 7.624, ownership: 'mission', approvedServices: ['OPD', 'Maternity', 'Pharmacy'] },
  { facilityId: 'CH-AKU', facilityName: 'Cottage Hospital, Akai Ubium', location: 'Akai Ubium, Akwa Ibom', lga: 'Nsit Ubium', district: 'Uyo', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-akaiubium.medcore.ng', latitude: 4.765, longitude: 7.968, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Lab'] },
  { facilityId: 'CH-IKA', facilityName: 'Cottage Hospital, Ika', location: 'Ika, Akwa Ibom', lga: 'Ika', district: 'Ikot Ekpene', tier: 'cottage_hospital', facilityType: 'Cottage Hospital', board: 'AKSHMB', domain: 'ch-ika.medcore.ng', latitude: 5.018, longitude: 7.532, ownership: 'public_state', approvedServices: ['OPD', 'Maternity', 'Immunization'] },

  // Comprehensive Health Care Centres
  { facilityId: 'CHC-NTE', facilityName: 'Comprehensive Health Care Centre, Nto Edino', location: 'Nto Edino, Akwa Ibom', lga: 'Obot Akara', district: 'Ikot Ekpene', tier: 'comprehensive_health_centre', facilityType: 'Health Care Centre', board: 'AKSPHCDA', domain: 'chc-ntoedino.medcore.ng', latitude: 5.268, longitude: 7.594, ownership: 'public_state', approvedServices: ['ANC', 'Immunization', 'OPD', 'Primary Lab'] },
  { facilityId: 'CHC-MBU', facilityName: 'Comprehensive Health Care Centre, Mbiaya Uruan', location: 'Mbiaya Uruan, Akwa Ibom', lga: 'Uruan', district: 'Uyo', tier: 'comprehensive_health_centre', facilityType: 'Health Care Centre', board: 'AKSPHCDA', domain: 'chc-mbiayauruan.medcore.ng', latitude: 5.042, longitude: 8.021, ownership: 'public_state', approvedServices: ['ANC', 'Immunization', 'OPD', 'Primary Lab'] },
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
