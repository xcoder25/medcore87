// Hospital OS Shared Clinical Data Store
// Aligned with Akwa Ibom State Health System & Gateway Specifications

export interface HospitalPatient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  dob: string;
  blood: string;
  ward: string;
  bed: string;
  status: 'stable' | 'critical' | 'review' | 'post-op' | 'waiting' | 'in-progress' | 'discharged';
  diagnoses: string[];
  allergies: string[];
  phone: string;
  nok: string;
  attending: string;
  admitDate: string | null;
  vitals: {
    bp: string;
    pulse: number;
    temp: number;
    spo2: number;
    rr: number;
    weight: number;
    height: number;
  };
  medications: string[];
  avatar?: string | null;
  type: 'inpatient' | 'outpatient';
}

export interface HospitalAppointment {
  id: string;
  time: string;
  patientId: string | null;
  name: string;
  type: string;
  status: 'waiting' | 'in-progress' | 'completed' | 'upcoming' | 'no-show';
  notes: string;
}

export interface WardInfo {
  code: string;
  name: string;
  occupancy: number;
  capacity: number;
  doctors: number;
  nurses: number;
  status: 'normal' | 'high' | 'surge' | 'critical';
}

export interface ClinicalNoteItem {
  id: string;
  patientId: string;
  title: string;
  type: string;
  date: string;
  time: string;
  author: string;
  content: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface HospitalTaskItem {
  id: string;
  patient?: string;
  task: string;
  due: string;
  priority: 'urgent' | 'high' | 'normal' | 'routine';
  done: boolean;
  role: 'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'reception' | 'admin';
  ward?: string;
}

export interface HospitalMessage {
  id: string;
  sender: string;
  senderRole: string;
  avatarInitials: string;
  channel: string;
  text: string;
  time: string;
  unread: boolean;
}

export interface HospitalNotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  category: 'critical' | 'lab' | 'bed' | 'rx' | 'system';
  read: boolean;
}

export interface RadiologyStudy {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US';
  bodyPart: string;
  studyDate: string;
  status: 'ordered' | 'in-progress' | 'reported' | 'critical';
  urgency: 'routine' | 'urgent' | 'stat';
  findings?: string;
  impression?: string;
  imageUrl?: string;
}

export interface ReferralItem {
  id: string;
  patientName: string;
  mrn: string;
  direction: 'inbound' | 'outbound';
  referringFacility: string;
  destinationFacility: string;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergency';
  clinicalSummary: string;
  date: string;
  status: 'pending' | 'accepted' | 'in-transit' | 'completed';
}

export const INITIAL_PATIENTS: HospitalPatient[] = [];

export const INITIAL_WARDS: WardInfo[] = [];

export const INITIAL_APPOINTMENTS: HospitalAppointment[] = [];

export const INITIAL_CLINICAL_NOTES: ClinicalNoteItem[] = [];

export const INITIAL_TASKS: HospitalTaskItem[] = [];

export const INITIAL_MESSAGES: HospitalMessage[] = [];

export const INITIAL_NOTIFICATIONS: HospitalNotificationItem[] = [];

export const INITIAL_RADIOLOGY: RadiologyStudy[] = [];

export const INITIAL_REFERRALS: ReferralItem[] = [];
