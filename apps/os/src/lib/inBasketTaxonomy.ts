/**
 * Role-Specific In Basket Taxonomy & Classification
 * Mirrors Epic In Basket folder routing for acute hospital roles:
 * - Reception / Front Desk: Appointments, Queue & Overtime, Payment Clearances, Registration/MPI, Handoffs, Notices.
 * - Nurse: Triage & NEWS2, Med Pass & Orders, Admissions & Beds, Handoffs, Notices.
 * - Doctor / Surgeon: Critical Results & Panic Values, Orders & Consults, NEWS2 Warnings, Handoffs, Notices.
 * - Pharmacy: Prescriptions to Dispense, Stock & Shortages, Consults, Notices.
 * - Records / HIM: Chart Deficiencies, Coding & Abstracting, MPI Merges & ROI, Notices.
 */
import React from 'react';
import type { HospitalNotification } from './notificationEngine';
import {
  AlertCircle,
  HeartPulse,
  ClipboardList,
  MessageSquare,
  Megaphone,
  Calendar,
  Clock,
  CreditCard,
  UserCheck,
  Pill,
  FileText,
  Activity,
  BedDouble,
} from 'lucide-react';

export interface InBasketFolderDef {
  id: string;
  label: string;
  epicLabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  borderColor: string;
  matcher: (n: HospitalNotification) => boolean;
}

/** Front Desk Reception Folders */
const RECEPTION_FOLDERS: InBasketFolderDef[] = [
  {
    id: 'appointments',
    label: 'Appointments & Arrival Check-in',
    epicLabel: 'Appointments',
    icon: Calendar,
    color: '#0284C7',
    bg: '#F0F9FF',
    borderColor: '#BAE6FD',
    matcher: (n) =>
      ['appointment', 'appt', 'schedule', 'clinic', 'booking', 'arrival', 'arriving'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'appointments',
  },
  {
    id: 'queue',
    label: 'Queue Overtime & Wait Alerts (>20m)',
    epicLabel: 'Queue & Overtime',
    icon: Clock,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
    matcher: (n) =>
      ['queue', 'wait', 'overdue', 'delay', 'overtime', 'called', 'triage queue'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'patient-flow',
  },
  {
    id: 'accounts',
    label: 'Accounts Clearances & Handoffs',
    epicLabel: 'Payment Cleared',
    icon: CreditCard,
    color: '#16A34A',
    bg: '#F0FDF4',
    borderColor: '#BBF7D0',
    matcher: (n) =>
      ['payment', 'accounts', 'cleared', 'paid', 'invoice', 'receipt', 'pos', 'cashier', 'fee', 'bill'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'cashier' || n.module === 'billing',
  },
  {
    id: 'registration',
    label: 'Registration, NIN & State Health Card',
    epicLabel: 'Registration / MPI',
    icon: UserCheck,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
    matcher: (n) =>
      ['register', 'registration', 'nin', 'nhia', 'card', 'shid', 'mpi', 'duplicate', 'identity'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'patient-card',
  },
  {
    id: 'messages',
    label: 'Intercom & Staff Handoffs',
    epicLabel: 'Msg / Handoff',
    icon: MessageSquare,
    color: '#6366F1',
    bg: '#EEF2FF',
    borderColor: '#C7D2FE',
    matcher: (n) =>
      ['message', 'sbar', 'handoff', 'handover', 'intercom', 'shift'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'system',
    label: 'Facility Notices & Rosters',
    epicLabel: 'Notices',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    borderColor: '#A5F3FC',
    matcher: () => true,
  },
];

/** Nursing Station Folders */
const NURSE_FOLDERS: InBasketFolderDef[] = [
  {
    id: 'triage',
    label: 'Triage & Early Warnings (NEWS2)',
    epicLabel: 'EWS / Triage',
    icon: HeartPulse,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
    matcher: (n) =>
      ['triage', 'vitals', 'news2', 'early warning', 'deteriorat', 'sepsis', 'ews', 'score'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'triage',
  },
  {
    id: 'orders',
    label: 'Inpatient Orders & Med Pass',
    epicLabel: 'Med Pass / Orders',
    icon: ClipboardList,
    color: '#2563EB',
    bg: '#EFF6FF',
    borderColor: '#BFDBFE',
    matcher: (n) =>
      ['order', 'prescri', 'dispens', 'mar', 'medication', 'vital', 'doctor_order'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'nursing',
  },
  {
    id: 'beds',
    label: 'Bed Census & Admissions',
    epicLabel: 'Admissions & Beds',
    icon: BedDouble,
    color: '#0D9488',
    bg: '#F0FDFA',
    borderColor: '#99F6E4',
    matcher: (n) =>
      ['bed', 'ward', 'admit', 'admission', 'discharge', 'transfer', 'census'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'beds',
  },
  {
    id: 'messages',
    label: 'Staff Handoffs & SBAR',
    epicLabel: 'Msg / Handoff',
    icon: MessageSquare,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
    matcher: (n) =>
      ['message', 'sbar', 'handoff', 'handover', 'assign', 'refer', 'transfer'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'system',
    label: 'Facility Notices & Bulletins',
    epicLabel: 'Notices',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    borderColor: '#A5F3FC',
    matcher: () => true,
  },
];

/** Physician / Clinician Folders */
const DOCTOR_FOLDERS: InBasketFolderDef[] = [
  {
    id: 'critical',
    label: 'Critical Results & Panic Values',
    epicLabel: 'Crit Results',
    icon: AlertCircle,
    color: '#DC2626',
    bg: '#FEF2F2',
    borderColor: '#FCA5A5',
    matcher: (n) => n.level === 'critical',
  },
  {
    id: 'orders',
    label: 'Orders, Sign-off & Consults',
    epicLabel: 'Orders',
    icon: ClipboardList,
    color: '#2563EB',
    bg: '#EFF6FF',
    borderColor: '#BFDBFE',
    matcher: (n) =>
      ['order', 'prescri', 'consult', 'lab result', 'radiology', 'dispens', 'cpoe', 'sign', 'result ready'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'doctor-portal',
  },
  {
    id: 'triage',
    label: 'Triage & Early Warnings (NEWS2)',
    epicLabel: 'EWS / Triage',
    icon: HeartPulse,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
    matcher: (n) =>
      n.level !== 'critical' &&
      ['triage', 'vitals', 'news2', 'early warning', 'deteriorat', 'sepsis', 'ews', 'score'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'messages',
    label: 'Messages & Staff Handoffs',
    epicLabel: 'Msg / Handoff',
    icon: MessageSquare,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
    matcher: (n) =>
      ['message', 'sbar', 'handoff', 'handover', 'assign', 'refer', 'transfer'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'system',
    label: 'System & Facility Notices',
    epicLabel: 'Notices',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    borderColor: '#A5F3FC',
    matcher: () => true,
  },
];

/** Pharmacy Folders */
const PHARMACY_FOLDERS: InBasketFolderDef[] = [
  {
    id: 'orders',
    label: 'Prescriptions to Dispense',
    epicLabel: 'Prescriptions',
    icon: Pill,
    color: '#2563EB',
    bg: '#EFF6FF',
    borderColor: '#BFDBFE',
    matcher: (n) =>
      ['rx', 'prescri', 'dispens', 'drug', 'cpoe', 'medication'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'pharmacy',
  },
  {
    id: 'stock',
    label: 'Formulary & Stock Alerts',
    epicLabel: 'Stock & Formulary',
    icon: ClipboardList,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
    matcher: (n) =>
      ['stock', 'shortage', 'formulary', 'reorder', 'contraindication', 'interaction'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'messages',
    label: 'Physician Inquiries & Consults',
    epicLabel: 'Consults',
    icon: MessageSquare,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
    matcher: (n) =>
      ['message', 'consult', 'inquiry', 'clarification'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'system',
    label: 'Facility Notices & Bulletins',
    epicLabel: 'Notices',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    borderColor: '#A5F3FC',
    matcher: () => true,
  },
];

/** HIM / Health Records Folders */
const RECORDS_FOLDERS: InBasketFolderDef[] = [
  {
    id: 'deficiency',
    label: 'Chart Deficiencies & Missing Docs',
    epicLabel: 'Deficiencies',
    icon: AlertCircle,
    color: '#DC2626',
    bg: '#FEF2F2',
    borderColor: '#FCA5A5',
    matcher: (n) =>
      ['deficiency', 'chart', 'incomplete', 'missing', 'signature', 'discharge summary'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'him-deficiency',
  },
  {
    id: 'coding',
    label: 'ICD-10 Coding & Abstracting Tasks',
    epicLabel: 'Coding Tasks',
    icon: FileText,
    color: '#2563EB',
    bg: '#EFF6FF',
    borderColor: '#BFDBFE',
    matcher: (n) =>
      ['coding', 'icd', 'cpt', 'abstract', 'bill-hold'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'him-coding',
  },
  {
    id: 'merge',
    label: 'Duplicate MPI Merges & ROI',
    epicLabel: 'MPI & ROI',
    icon: UserCheck,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
    matcher: (n) =>
      ['merge', 'duplicate', 'roi', 'release of information', 'mpi', 'identity'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ) || n.module === 'him-merge' || n.module === 'him-roi',
  },
  {
    id: 'system',
    label: 'Facility Notices & Bulletins',
    epicLabel: 'Notices',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    borderColor: '#A5F3FC',
    matcher: () => true,
  },
];

/** General / Admin Default Folders */
const DEFAULT_FOLDERS: InBasketFolderDef[] = [
  {
    id: 'critical',
    label: 'Critical Results & Urgent Alerts',
    epicLabel: 'Crit Results',
    icon: AlertCircle,
    color: '#DC2626',
    bg: '#FEF2F2',
    borderColor: '#FCA5A5',
    matcher: (n) => n.level === 'critical',
  },
  {
    id: 'triage',
    label: 'Triage & Clinical Early Warnings',
    epicLabel: 'EWS / Clinical',
    icon: HeartPulse,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
    matcher: (n) =>
      n.level !== 'critical' &&
      ['triage', 'vitals', 'news2', 'early warning', 'deteriorat', 'sepsis', 'ews'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'orders',
    label: 'Orders, Workflows & Operational Tasks',
    epicLabel: 'Orders / Flow',
    icon: ClipboardList,
    color: '#2563EB',
    bg: '#EFF6FF',
    borderColor: '#BFDBFE',
    matcher: (n) =>
      ['order', 'prescri', 'consult', 'lab result', 'radiology', 'dispens', 'queue'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'messages',
    label: 'Messages & Staff Handoffs',
    epicLabel: 'Msg / Handoff',
    icon: MessageSquare,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
    matcher: (n) =>
      ['message', 'sbar', 'handoff', 'handover', 'assign', 'refer'].some((kw) =>
        (n.title + ' ' + n.body).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'system',
    label: 'System & Facility Notices',
    epicLabel: 'Notices',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    borderColor: '#A5F3FC',
    matcher: () => true,
  },
];

/** Resolve folders according to the user's role */
export function getRoleInBasketFolders(roleKey?: string): InBasketFolderDef[] {
  const rk = (roleKey || '').toLowerCase();
  if (rk.includes('reception') || rk.includes('front') || rk.includes('cashier')) {
    return RECEPTION_FOLDERS;
  }
  if (rk.includes('nurse') || rk.includes('matron') || rk.includes('sister') || rk.includes('midwife')) {
    return NURSE_FOLDERS;
  }
  if (rk.includes('pharm')) {
    return PHARMACY_FOLDERS;
  }
  if (rk.includes('record') || rk.includes('him')) {
    return RECORDS_FOLDERS;
  }
  if (rk.includes('doctor') || rk.includes('surgeon') || rk.includes('physician') || rk.includes('consultant')) {
    return DOCTOR_FOLDERS;
  }
  return DEFAULT_FOLDERS;
}

/** Classify a notification into the best-matching folder */
export function classifyNotificationForRole(
  n: HospitalNotification,
  folders: InBasketFolderDef[]
): InBasketFolderDef {
  for (const f of folders) {
    if (f.id === 'system') continue; // keep fallback last
    if (f.matcher(n)) return f;
  }
  return folders[folders.length - 1];
}

/** Role meta for In Basket header */
export function getRoleInBasketMeta(roleKey?: string): {
  title: string;
  scopeBadge: string;
  subtitle: string;
  accent: string;
} {
  const rk = (roleKey || '').toLowerCase();
  if (rk.includes('reception') || rk.includes('front')) {
    return {
      title: 'Front Desk In Basket',
      scopeBadge: 'FRONT DESK SCOPE',
      subtitle: 'Arriving appointments, queue wait alerts, accounts payment clearances & desk tasks',
      accent: '#0284C7',
    };
  }
  if (rk.includes('nurse') || rk.includes('midwife')) {
    return {
      title: 'Nursing Station In Basket',
      scopeBadge: 'NURSING SCOPE',
      subtitle: 'Triage NEWS2 alerts, medication pass, admissions, bed census & handover',
      accent: '#0D9488',
    };
  }
  if (rk.includes('pharm')) {
    return {
      title: 'Pharmacy In Basket',
      scopeBadge: 'PHARMACY SCOPE',
      subtitle: 'CPOE prescriptions to dispense, drug formulary alerts & stock shortages',
      accent: '#2563EB',
    };
  }
  if (rk.includes('record') || rk.includes('him')) {
    return {
      title: 'HIM / Records In Basket',
      scopeBadge: 'HIM RECORDS SCOPE',
      subtitle: 'Chart deficiencies, ICD-10 coding workqueues & MPI duplicate merges',
      accent: '#7C3AED',
    };
  }
  if (rk.includes('doctor') || rk.includes('surgeon')) {
    return {
      title: 'Physician In Basket',
      scopeBadge: 'CLINICAL SCOPE',
      subtitle: 'Critical panic results, CPOE order sign-offs, consults & patient assignments',
      accent: '#DC2626',
    };
  }
  return {
    title: 'Hospital In Basket',
    scopeBadge: 'HOSPITAL OS',
    subtitle: 'Unified operational and clinical attention list for your workstation',
    accent: '#1D4ED8',
  };
}
