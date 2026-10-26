'use client';

/**
 * Per-role accent themes for OS chrome (sidebar / workspace header).
 */
import {
  Activity,
  Baby,
  Building2,
  CreditCard,
  FlaskConical,
  HeartPulse,
  Layers,
  Pill,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';

export interface RoleThemeConfig {
  label: string;
  badge: string;
  accent: string;
  gradient: string;
  activeBg: string;
  icon: any;
  workspaceTitle: string;
}

export const ROLE_THEMES: Record<string, RoleThemeConfig> = {
  doctor: {
    label: 'Doctor desk',
    badge: 'DOCTOR WORKSPACE',
    accent: '#0052D4',
    gradient: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 82, 212, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Stethoscope,
    workspaceTitle: 'Doctor Clinical Workspace',
  },
  surgeon: {
    label: 'Theatre & surgery',
    badge: 'SURGEON OPERATING DESK',
    accent: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #F43F5E 100%)',
    activeBg: 'linear-gradient(90deg, rgba(220, 38, 38, 0.28) 0%, rgba(244, 63, 94, 0.12) 100%)',
    icon: Activity,
    workspaceTitle: 'Operating Theatre & Surgeries',
  },
  nurse: {
    label: 'Nursing station',
    badge: 'WARD NURSING STATION',
    accent: '#00BFA5',
    gradient: 'linear-gradient(135deg, #00BFA5 0%, #00D2A0 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 191, 165, 0.28) 0%, rgba(0, 210, 160, 0.12) 100%)',
    icon: HeartPulse,
    workspaceTitle: 'Inpatient Nursing & e-MAR',
  },
  midwife: {
    label: 'Labour & Delivery Desk',
    badge: 'LABOUR WARD COMMAND',
    accent: '#D946EF',
    gradient: 'linear-gradient(135deg, #D946EF 0%, #EC4899 100%)',
    activeBg: 'linear-gradient(90deg, rgba(217, 70, 239, 0.28) 0%, rgba(236, 72, 153, 0.12) 100%)',
    icon: Baby,
    workspaceTitle: 'Maternity, Labour & CTG',
  },
  pharmacist: {
    label: 'Pharmacy desk',
    badge: 'PHARMACY DISPENSARY',
    accent: '#059669',
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    activeBg: 'linear-gradient(90deg, rgba(5, 150, 105, 0.28) 0%, rgba(16, 185, 129, 0.12) 100%)',
    icon: Pill,
    workspaceTitle: 'Prescription Dispensing & Stocks',
  },
  lab: {
    label: 'Pathology & Diagnostic Desk',
    badge: 'LABORATORY COMMAND',
    accent: '#0891B2',
    gradient: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)',
    activeBg: 'linear-gradient(90deg, rgba(8, 145, 178, 0.28) 0%, rgba(6, 182, 212, 0.12) 100%)',
    icon: FlaskConical,
    workspaceTitle: 'Lab LIS & Automated Analyzers',
  },
  radiologist: {
    label: 'Medical Imaging Desk',
    badge: 'RADIOLOGY PACS DESK',
    accent: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    activeBg: 'linear-gradient(90deg, rgba(99, 102, 241, 0.28) 0%, rgba(139, 92, 246, 0.12) 100%)',
    icon: Layers,
    workspaceTitle: 'Radiology & PACS Viewer',
  },
  reception: {
    label: 'Reception',
    badge: 'RECEPTION',
    accent: '#0284C7',
    gradient: 'linear-gradient(135deg, #0284C7 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(2, 132, 199, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Users,
    workspaceTitle: 'Reception',
  },
  accountant: {
    label: 'Revenue & Finance Desk',
    badge: 'FINANCE COMMAND DESK',
    accent: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    activeBg: 'linear-gradient(90deg, rgba(217, 119, 6, 0.28) 0%, rgba(245, 158, 11, 0.12) 100%)',
    icon: CreditCard,
    workspaceTitle: 'Accounts · Cashier & Billing',
  },
  records: {
    label: 'Health Records & Patient MPI',
    badge: 'RECORDS COMMAND DESK',
    accent: '#0D9488',
    gradient: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
    activeBg: 'linear-gradient(90deg, rgba(13, 148, 136, 0.28) 0%, rgba(20, 184, 166, 0.12) 100%)',
    icon: FileText,
    workspaceTitle: 'Digital Patient Card & Transit',
  },
  biomedical: {
    label: 'Clinical Engineering Desk',
    badge: 'ENGINEERING COMMAND',
    accent: '#EA580C',
    gradient: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
    activeBg: 'linear-gradient(90deg, rgba(234, 88, 12, 0.28) 0%, rgba(249, 115, 22, 0.12) 100%)',
    icon: Wrench,
    workspaceTitle: 'Clinical device log (not CMMS) Assets',
  },
  medical_director: {
    label: 'Executive Oversight Hub',
    badge: 'DIRECTOR COMMAND DESK',
    accent: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
    activeBg: 'linear-gradient(90deg, rgba(124, 58, 237, 0.28) 0%, rgba(147, 51, 234, 0.12) 100%)',
    icon: Shield,
    workspaceTitle: 'Medical Director Oversight',
  },
  hospital_admin: {
    label: 'Hospital Administration',
    badge: 'ADMINISTRATOR DESK',
    accent: '#0052D4',
    gradient: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
    activeBg: 'linear-gradient(90deg, rgba(0, 82, 212, 0.28) 0%, rgba(0, 191, 165, 0.12) 100%)',
    icon: Building2,
    workspaceTitle: 'Hospital Staff & Operations',
  },
  sysadmin: {
    label: 'System settings',
    badge: 'SYSTEM ARCHITECT DESK',
    accent: '#38BDF8',
    gradient: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
    activeBg: 'linear-gradient(90deg, rgba(56, 189, 248, 0.28) 0%, rgba(14, 165, 233, 0.12) 100%)',
    icon: Settings,
    workspaceTitle: 'System Admin & IAM Hub',
  },
};
