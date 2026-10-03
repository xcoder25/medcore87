/**
 * Front Desk / Reception operational settings — workflow, queue, intake, billing, hardware.
 * Persisted per browser; broadcasts for realtime UI refresh.
 */

export const RECEPTION_SETTINGS_KEY = 'medcore_os_reception_settings_v1';

export type PatientFlowStatus =
  | 'arrived'
  | 'checked_in'
  | 'in_room'
  | 'ready_vitals'
  | 'with_provider'
  | 'checked_out'
  | 'no_show'
  | 'canceled';

export interface StatusStyle {
  id: PatientFlowStatus;
  label: string;
  bg: string;
  text: string;
  enabled: boolean;
  order: number;
}

export interface ReceptionSettings {
  facilityId: string;
  /** 1. Daily workflow & patient status */
  statuses: StatusStyle[];
  waitTargetMinutes: number;
  waitAlertEnabled: boolean;
  waitAlertEscalateMinutes: number;
  /** 2. Appointment & queue */
  checkInRequiredFields: string[];
  earlyArrivalMinutes: number;
  lateArrivalMinutes: number;
  autoMarkLate: boolean;
  walkInQueueEnabled: boolean;
  walkInTriagePriorities: string[];
  /** 3. Registration & forms */
  kioskSelfCheckIn: boolean;
  tabletMode: boolean;
  qrCheckIn: boolean;
  requiredForms: string[];
  mandatoryPhoto: boolean;
  scanDriversLicense: boolean;
  scanInsuranceFront: boolean;
  scanInsuranceBack: boolean;
  /** 4. Billing */
  promptCopayOnCheckIn: boolean;
  promptPastDueBalance: boolean;
  promptDeductibleEstimate: boolean;
  posTerminalId: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptTaxId: string;
  receiptReturnPolicy: string;
  /** 5. Notifications */
  notifyNurseOnCheckIn: boolean;
  notifyMaOnCheckIn: boolean;
  smsCheckInInstructions: boolean;
  smsParkingInfo: boolean;
  smsRoomAssignment: boolean;
  recordVisitorEscort: boolean;
  /** 6. Hardware */
  labelPrinter: string;
  wristbandPrinter: string;
  chartLabelPrinter: string;
  specimenLabelPrinter: string;
  scannerProfile: string;
  /** 7. Staff desk */
  allowStationSwitch: boolean;
  allowFacilitySwitch: boolean;
  defaultStation: string;
  updatedAt: string;
}

const DEFAULT_STATUSES: StatusStyle[] = [
  { id: 'arrived', label: 'Arrived', bg: '#DBEAFE', text: '#1D4ED8', enabled: true, order: 1 },
  { id: 'checked_in', label: 'Checked In', bg: '#CCFBF1', text: '#0F766E', enabled: true, order: 2 },
  { id: 'in_room', label: 'In Room', bg: '#E0E7FF', text: '#4338CA', enabled: true, order: 3 },
  { id: 'ready_vitals', label: 'Ready for Vitals', bg: '#FEF3C7', text: '#B45309', enabled: true, order: 4 },
  { id: 'with_provider', label: 'With Provider', bg: '#F3E8FF', text: '#7C3AED', enabled: true, order: 5 },
  { id: 'checked_out', label: 'Checked Out', bg: '#F1F5F9', text: '#475569', enabled: true, order: 6 },
  { id: 'no_show', label: 'No-Show', bg: '#FEE2E2', text: '#B91C1C', enabled: true, order: 7 },
  { id: 'canceled', label: 'Canceled', bg: '#FCE7F3', text: '#BE185D', enabled: true, order: 8 },
];

export function defaultReceptionSettings(facilityId = 'DEFAULT'): ReceptionSettings {
  return {
    facilityId,
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    waitTargetMinutes: 20,
    waitAlertEnabled: true,
    waitAlertEscalateMinutes: 30,
    checkInRequiredFields: ['phone', 'address', 'emergency_contact'],
    earlyArrivalMinutes: 30,
    lateArrivalMinutes: 15,
    autoMarkLate: true,
    walkInQueueEnabled: true,
    walkInTriagePriorities: ['Emergency', 'Urgent', 'Routine'],
    kioskSelfCheckIn: false,
    tabletMode: true,
    qrCheckIn: true,
    requiredForms: ['demographics', 'consent', 'privacy'],
    mandatoryPhoto: false,
    scanDriversLicense: false,
    scanInsuranceFront: true,
    scanInsuranceBack: false,
    promptCopayOnCheckIn: true,
    promptPastDueBalance: true,
    promptDeductibleEstimate: false,
    posTerminalId: '',
    receiptHeader: 'MedCore Hospital — Official Receipt',
    receiptFooter: 'Thank you. Keep this receipt for your records.',
    receiptTaxId: '',
    receiptReturnPolicy: 'Payments are non-refundable except as required by law.',
    notifyNurseOnCheckIn: true,
    notifyMaOnCheckIn: false,
    smsCheckInInstructions: true,
    smsParkingInfo: false,
    smsRoomAssignment: false,
    recordVisitorEscort: true,
    labelPrinter: 'Default Label',
    wristbandPrinter: 'Wristband-1',
    chartLabelPrinter: 'Chart Label',
    specimenLabelPrinter: 'Lab Label',
    scannerProfile: 'Document ADF',
    allowStationSwitch: true,
    allowFacilitySwitch: false,
    defaultStation: 'Front Desk 1',
    updatedAt: new Date().toISOString(),
  };
}

export function getReceptionSettings(facilityId?: string): ReceptionSettings {
  if (typeof window === 'undefined') return defaultReceptionSettings(facilityId);
  try {
    const raw = localStorage.getItem(RECEPTION_SETTINGS_KEY);
    if (!raw) return defaultReceptionSettings(facilityId);
    const parsed = JSON.parse(raw) as ReceptionSettings;
    const base = defaultReceptionSettings(facilityId || parsed.facilityId);
    return {
      ...base,
      ...parsed,
      statuses: parsed.statuses?.length ? parsed.statuses : base.statuses,
      checkInRequiredFields: parsed.checkInRequiredFields || base.checkInRequiredFields,
      walkInTriagePriorities: parsed.walkInTriagePriorities || base.walkInTriagePriorities,
      requiredForms: parsed.requiredForms || base.requiredForms,
    };
  } catch {
    return defaultReceptionSettings(facilityId);
  }
}

export function setReceptionSettings(settings: ReceptionSettings): ReceptionSettings {
  const next = { ...settings, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    localStorage.setItem(RECEPTION_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('medcore-reception-settings', { detail: next }));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: RECEPTION_SETTINGS_KEY } }));
  }
  return next;
}

export function subscribeReceptionSettings(cb: (s: ReceptionSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb(getReceptionSettings());
  window.addEventListener('medcore-reception-settings', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('medcore-reception-settings', fn);
    window.removeEventListener('storage', fn);
  };
}

export const CHECK_IN_FIELD_OPTIONS = [
  { id: 'phone', label: 'Phone number' },
  { id: 'address', label: 'Updated address' },
  { id: 'insurance', label: 'Active insurance card' },
  { id: 'emergency_contact', label: 'Emergency contact' },
  { id: 'email', label: 'Email' },
  { id: 'nin', label: 'NIN' },
];

export const FORM_OPTIONS = [
  { id: 'demographics', label: 'Demographics' },
  { id: 'consent', label: 'Treatment consent' },
  { id: 'privacy', label: 'Privacy / data notice' },
  { id: 'financial', label: 'Financial agreement' },
  { id: 'medical_history', label: 'Medical history' },
  { id: 'hipaa', label: 'HIPAA / confidentiality' },
];
