'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react';

// --- Types --------------------------------------------------------------------

export interface UserSession {
  id: string;
  name: string;
  role: string;
  roleKey: string;
  title: string;
  facility: string;
  hospitalId: string;
  department: string;
  avatarInitials: string;
  clearanceLabel: string;
  clearanceLevel: number;
  permissions: string[];
  badgeId?: string;
  authMethod?: string;
  token?: string;
  loginTime?: string;
}

export interface PresetStaff {
  badgeId: string;
  name: string;
  role: string;
  shortRole: string;
  title: string;
  roleKey: string;
  clearanceLevel: number;
  clearanceLabel: string;
  department: string;
  initials: string;
  permissions: string[];
  pin: string;
  hospitalId?: string;
  hospitalName?: string;
  color?: string;
}

export interface Hospital {
  id: string;
  name: string;
  location: string;
  type: string;
  domain: string;
}

// --- Data ---------------------------------------------------------------------

// LIST OF SECONDARY HEALTH CARE FACILITIES IN AKWA IBOM STATE (Official AKSHB Registry)
export const HOSPITALS: Hospital[] = [
  // General Hospitals
  { id: 'IGH-EKT',  name: 'Immanuel General Hospital, Eket',               location: 'Eket, Akwa Ibom',             type: 'General Hospital',    domain: 'igh-eket.medcore.ng'         },
  { id: 'GH-IKE',  name: 'General Hospital, Ikot Ekpene',                  location: 'Ikot Ekpene, Akwa Ibom',      type: 'General Hospital',    domain: 'gh-ikotekpene.medcore.ng'    },
  { id: 'GH-IQU',  name: 'General Hospital, Iquita Oron',                  location: 'Oron, Akwa Ibom',             type: 'General Hospital',    domain: 'gh-iquita.medcore.ng'        },
  { id: 'MGH-ITM', name: 'Methodist General Hospital, Ituk Mbang',         location: 'Ituk Mbang, Akwa Ibom',       type: 'Mission Hospital',    domain: 'mgh-itukmbang.medcore.ng'    },
  { id: 'GH-ETN',  name: 'General Hospital, Etinan',                       location: 'Etinan, Akwa Ibom',           type: 'General Hospital',    domain: 'gh-etinan.medcore.ng'        },
  { id: 'GH-UAB',  name: 'General Hospital, Ukpom Abak',                   location: 'Abak, Akwa Ibom',             type: 'General Hospital',    domain: 'gh-ukpomabak.medcore.ng'     },
  { id: 'GH-AWA',  name: 'General Hospital, Awa',                          location: 'Awa, Akwa Ibom',              type: 'General Hospital',    domain: 'gh-awa.medcore.ng'           },
  { id: 'GH-IKO',  name: 'General Hospital, Ikot Okoro',                   location: 'Ikot Okoro, Akwa Ibom',       type: 'General Hospital',    domain: 'gh-ikotokoro.medcore.ng'     },
  { id: 'GH-IKN',  name: 'General Hospital, Ikono',                        location: 'Ikono, Akwa Ibom',            type: 'General Hospital',    domain: 'gh-ikono.medcore.ng'         },
  { id: 'GH-AMM',  name: 'General Hospital, Amammong Okobo',               location: 'Okobo, Akwa Ibom',            type: 'General Hospital',    domain: 'gh-amammong.medcore.ng'      },
  { id: 'MCH-AKU', name: 'Mount Carmel Hospital, Akpa Utong',              location: 'Akpa Utong, Akwa Ibom',       type: 'Mission Hospital',    domain: 'mch-akpautong.medcore.ng'    },
  { id: 'GH-URO',  name: 'General Hospital, Urue-Offong/Oruko',            location: 'Urue-Offong, Akwa Ibom',      type: 'General Hospital',    domain: 'gh-urueoffong.medcore.ng'    },
  { id: 'GH-IPA',  name: 'General Hospital, Ikpe Annang',                  location: 'Ikpe Annang, Akwa Ibom',      type: 'General Hospital',    domain: 'gh-ikpeannang.medcore.ng'    },
  { id: 'GH-INI',  name: 'General Hospital, Ini',                          location: 'Ini, Akwa Ibom',              type: 'General Hospital',    domain: 'gh-ini.medcore.ng'           },
  { id: 'GH-IAB',  name: 'General Hospital, Ikot Abasi',                   location: 'Ikot Abasi, Akwa Ibom',       type: 'General Hospital',    domain: 'gh-ikotabasi.medcore.ng'     },
  { id: 'GH-MB2',  name: 'General Hospital, Mbioto 2',                     location: 'Mbioto, Akwa Ibom',           type: 'General Hospital',    domain: 'gh-mbioto2.medcore.ng'       },
  { id: 'MSG-ITU', name: 'Mary Slessor General Hospital, Itu',             location: 'Itu, Akwa Ibom',              type: 'Mission Hospital',    domain: 'msg-itu.medcore.ng'          },
  { id: 'GH-UAI',  name: 'General Hospital, Uruk Ata Ikot Ekpor',         location: 'Ikot Ekpor, Akwa Ibom',       type: 'General Hospital',    domain: 'gh-urukataekpor.medcore.ng'  },
  // Specialist Hospitals
  { id: 'QIC-EPO', name: 'QIC Leprosy Hospital, Ekpene Obom',              location: 'Ekpene Obom, Akwa Ibom',      type: 'Specialist Hospital', domain: 'qic-ekpeneobom.medcore.ng'   },
  { id: 'IDH-IKE', name: 'Infectious Disease Hospital, Ikot Ekpene',       location: 'Ikot Ekpene, Akwa Ibom',      type: 'Specialist Hospital', domain: 'idh-ikotekpene.medcore.ng'   },
  { id: 'PSY-EKT', name: 'Psychiatric Hospital, Eket',                     location: 'Eket, Akwa Ibom',             type: 'Specialist Hospital', domain: 'psy-eket.medcore.ng'         },
  // Cottage Hospitals
  { id: 'CH-UKA',  name: 'Cottage Hospital, Ukana',                        location: 'Ukana, Akwa Ibom',            type: 'Cottage Hospital',    domain: 'ch-ukana.medcore.ng'         },
  { id: 'CH-IBN',  name: 'Cottage Hospital, Ibeno',                        location: 'Ibeno, Akwa Ibom',            type: 'Cottage Hospital',    domain: 'ch-ibeno.medcore.ng'         },
  { id: 'CH-IAB',  name: 'Cottage Hospital, Ikot Abia',                    location: 'Ikot Abia, Akwa Ibom',        type: 'Cottage Hospital',    domain: 'ch-ikotabia.medcore.ng'      },
  { id: 'CH-IEP',  name: 'Cottage Hospital, Ikot Ekpaw',                   location: 'Ikot Ekpaw, Akwa Ibom',       type: 'Cottage Hospital',    domain: 'ch-ikotekpaw.medcore.ng'     },
  { id: 'CH-ASO',  name: 'Cottage Hospital, Asong',                        location: 'Asong, Akwa Ibom',            type: 'Cottage Hospital',    domain: 'ch-asong.medcore.ng'         },
  { id: 'CH-EPO',  name: 'Cottage Hospital, Ekpene Obo',                   location: 'Ekpene Obo, Akwa Ibom',       type: 'Cottage Hospital',    domain: 'ch-ekpeneobo.medcore.ng'     },
  { id: 'CH-IEI',  name: 'Cottage Hospital, Ikot Eko Ibon',                location: 'Ikot Eko Ibon, Akwa Ibom',    type: 'Cottage Hospital',    domain: 'ch-ikotekoinbon.medcore.ng'  },
  { id: 'CH-EOB',  name: 'Cottage Hospital, Eastern Obolo',                location: 'Eastern Obolo, Akwa Ibom',    type: 'Cottage Hospital',    domain: 'ch-easternobolo.medcore.ng'  },
  { id: 'CH-IEU',  name: 'Cottage Hospital, Ikot Ekpene Udo',              location: 'Ikot Ekpene Udo, Akwa Ibom',  type: 'Cottage Hospital',    domain: 'ch-ikotekpeneudo.medcore.ng' },
  { id: 'RCH-IBS', name: 'Redeemer Cottage Hospital, Ibesit',              location: 'Ibesit, Akwa Ibom',           type: 'Cottage Hospital',    domain: 'rch-ibesit.medcore.ng'       },
  { id: 'CH-AKU',  name: 'Cottage Hospital, Akai Ubium',                   location: 'Akai Ubium, Akwa Ibom',       type: 'Cottage Hospital',    domain: 'ch-akaiubium.medcore.ng'     },
  { id: 'CH-IKA',  name: 'Cottage Hospital, Ika',                          location: 'Ika, Akwa Ibom',              type: 'Cottage Hospital',    domain: 'ch-ika.medcore.ng'           },
  // Comprehensive Health Care Centres
  { id: 'CHC-NTE', name: 'Comprehensive Health Care Centre, Nto Edino',    location: 'Nto Edino, Akwa Ibom',        type: 'Health Care Centre',  domain: 'chc-ntoedino.medcore.ng'     },
  { id: 'CHC-MBU', name: 'Comprehensive Health Care Centre, Mbiaya Uruan', location: 'Mbiaya Uruan, Akwa Ibom',     type: 'Health Care Centre',  domain: 'chc-mbiayauruan.medcore.ng'  },
];

/** Platform admin — Firebase email + password */
export const PLATFORM_ADMIN = {
  email: 'xcoder2442@gmail.com',
  password: 'AKS-0012442',
  badgeId: 'AKS-ADM-001',
  name: 'Hospital Administrator',
  roleKey: 'hospital_admin' as const,
};

export const PRESET_STAFF: PresetStaff[] = [
  {
    badgeId: 'AKS-ADM-001', name: 'Hospital Administrator', role: 'Hospital Administrator', shortRole: 'Admin',
    title: 'Hospital Administrator', roleKey: 'hospital_admin', clearanceLevel: 5, clearanceLabel: 'Administrator',
    department: 'Hospital Management', initials: 'HA',
    permissions: ['dashboard', 'command', 'emr', 'beds', 'patient-flow', 'staffing', 'enrolment', 'my-card', 'cashier', 'patient-card', 'auth', 'facility', 'data-hub', 'analytics', 'rbac', 'sysadmin', 'compliance', 'transfer', 'ai'],
    pin: 'AKS-0012442', hospitalId: 'IGH-EKT', hospitalName: 'Immanuel General Hospital, Eket', color: '#EA580C',
  },

  {
    badgeId: 'IGH-DOC-001', name: 'Dr. Amara Okafor', role: 'Medical Officer', shortRole: 'Doctor',
    title: 'Medical Officer', roleKey: 'doctor', clearanceLevel: 4, clearanceLabel: 'Clinical',
    department: 'Internal Medicine', initials: 'AO',
    permissions: ['dashboard', 'doctor-portal', 'emergency', 'beds', 'patient-flow', 'staffing', 'patient-card', 'ai', 'm87-ai'],
    pin: '1234', hospitalId: 'IGH-EKT', hospitalName: 'Immanuel General Hospital, Eket', color: '#0284C7',
  },
  {
    badgeId: 'GHI-SUR-002', name: 'Dr. Emeka Adeyemi', role: 'Consultant Surgeon', shortRole: 'Surgeon',
    title: 'Consultant Surgeon', roleKey: 'surgeon', clearanceLevel: 5, clearanceLabel: 'Consultant',
    department: 'Surgery & Theatre', initials: 'EA',
    permissions: ['dashboard', 'theatre', 'icu', 'doctor-portal', 'emergency', 'ai'],
    pin: '1234', hospitalId: 'GH-IKE', hospitalName: 'General Hospital, Ikot Ekpene', color: '#DC2626',
  },
  {
    badgeId: 'MSG-NUR-003', name: 'Nurse Aisha Bello', role: 'Senior Nursing Officer', shortRole: 'Nurse',
    title: 'Senior Nursing Officer', roleKey: 'nurse', clearanceLevel: 3, clearanceLabel: 'Nursing',
    department: 'Female Medical Ward', initials: 'AB',
    permissions: ['dashboard', 'nursing', 'beds', 'patient-flow', 'emergency', 'maternity'],
    pin: '1234', hospitalId: 'MSG-ITU', hospitalName: 'Mary Slessor General Hospital, Itu', color: '#7C3AED',
  },
  {
    badgeId: 'IGH-ADM-004', name: 'Adm. Ngozi Eze', role: 'Hospital Administrator', shortRole: 'Admin',
    title: 'Hospital Administrator', roleKey: 'hospital_admin', clearanceLevel: 5, clearanceLabel: 'Administrator',
    department: 'Hospital Administration', initials: 'NE',
    permissions: ['*'],
    pin: '1234', hospitalId: 'IGH-EKT', hospitalName: 'Immanuel General Hospital, Eket', color: '#D97706',
  },
  {
    badgeId: 'GHE-PHA-005', name: 'Pharm. Chidi Otu', role: 'Chief Pharmacist', shortRole: 'Pharmacist',
    title: 'Chief Pharmacist', roleKey: 'pharmacist', clearanceLevel: 3, clearanceLabel: 'Pharmacy',
    department: 'Pharmacy', initials: 'CO',
    permissions: ['dashboard', 'pharmacy', 'inventory'],
    pin: '1234', hospitalId: 'GH-ETN', hospitalName: 'General Hospital, Etinan', color: '#059669',
  },
  {
    badgeId: 'GHI-LAB-006', name: 'Kelechi Obiora', role: 'Senior Lab Scientist', shortRole: 'Lab',
    title: 'Senior Lab Scientist', roleKey: 'lab', clearanceLevel: 3, clearanceLabel: 'Laboratory',
    department: 'Laboratory', initials: 'KO',
    permissions: ['dashboard', 'laboratory', 'blood-bank'],
    pin: '1234', hospitalId: 'GH-IKE', hospitalName: 'General Hospital, Ikot Ekpene', color: '#0891B2',
  },
  {
    badgeId: 'MGH-RAD-007', name: 'Dr. Fatima Al-Hassan', role: 'Radiologist', shortRole: 'Radiology',
    title: 'Consultant Radiologist', roleKey: 'radiologist', clearanceLevel: 5, clearanceLabel: 'Radiology',
    department: 'Radiology', initials: 'FA',
    permissions: ['dashboard', 'radiology'],
    pin: '1234', hospitalId: 'MGH-ITM', hospitalName: 'Methodist General Hospital, Ituk Mbang', color: '#6D28D9',
  },
  {
    badgeId: 'GHA-REC-008', name: 'Bisi Adewale', role: 'Records Officer', shortRole: 'Records',
    title: 'Health Records Officer', roleKey: 'records', clearanceLevel: 2, clearanceLabel: 'Records',
    department: 'Medical Records', initials: 'BA',
    permissions: ['dashboard', 'patient-card', 'command'],
    pin: '1234', hospitalId: 'GH-IAB', hospitalName: 'General Hospital, Ikot Abasi', color: '#0F766E',
  },
  {
    badgeId: 'PSY-ACC-009', name: 'Amaka Oguike', role: 'Accountant', shortRole: 'Accounts',
    title: 'Finance Officer', roleKey: 'accountant', clearanceLevel: 3, clearanceLabel: 'Finance',
    department: 'Finance & Accounts', initials: 'AO',
    permissions: ['dashboard', 'cashier', 'billing', 'claims', 'revenue-cycle'],
    pin: '1234', hospitalId: 'PSY-EKT', hospitalName: 'Psychiatric Hospital, Eket', color: '#B45309',
  },
  {
    badgeId: 'MHQB-ICT-010', name: 'Ola Bankole', role: 'ICT / System Admin', shortRole: 'SysAdmin',
    title: 'Chief Information Officer', roleKey: 'sysadmin', clearanceLevel: 6, clearanceLabel: 'IT Admin',
    department: 'IT & Infrastructure', initials: 'OB',
    permissions: ['*'],
    pin: '1234', hospitalId: 'IGH-EKT', hospitalName: 'Immanuel General Hospital, Eket', color: '#374151',
  },
];

export interface AuthScreenProps {
  onLogin?: (session: UserSession) => void;
  onLoginSuccess?: (session: UserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onLoginSuccess }) => {
  const [selectedHospital, setSelectedHospital] = useState(HOSPITALS[0]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffRegistry, setStaffRegistry] = useState<PresetStaff[]>(PRESET_STAFF);
  /** email = work email form; badge = Staff ID No. + PIN */
  const [authMode, setAuthMode] = useState<'email' | 'badge'>('email');
  const [firebaseLive, setFirebaseLive] = useState(false);

  // Load enrolled staff (local) + live Firebase facility directory
  useEffect(() => {
    const mapEntry = (p: any): PresetStaff => ({
      badgeId: p.badgeId || p.id,
      name: p.name || p.fullName || 'Staff',
      role: p.role || 'Staff',
      shortRole: p.shortRole || p.role || 'Staff',
      title: p.title || p.role || 'Staff',
      roleKey: p.roleKey || 'doctor',
      clearanceLevel: p.clearanceLevel ?? 2,
      clearanceLabel: p.clearanceLabel || 'L2',
      department: p.department || '',
      initials: p.initials || String(p.name || 'S').slice(0, 2).toUpperCase(),
      permissions: p.permissions || ['dashboard'],
      pin: p.pin || '1234',
      hospitalId: p.hospitalId || p.facilityId || selectedHospital.id,
      hospitalName: p.hospitalName || p.facilityName || selectedHospital.name,
      color: p.color || '#0052D4',
    });

    const mergeLocal = () => {
      try {
        const saved = localStorage.getItem('medcore_os_staff_registry');
        const parsed: any[] = saved ? JSON.parse(saved) : [];
        const enrolled = Array.isArray(parsed) ? parsed.map(mapEntry) : [];
        // Bootstrap platform admin always available (can claim empty facilities); enrolled staff appended (dedupe by badge)
        const byBadge = new Map<string, PresetStaff>();
        for (const s of PRESET_STAFF.filter((x) => x.roleKey === 'hospital_admin' || x.badgeId === PLATFORM_ADMIN.badgeId)) {
          byBadge.set(s.badgeId, s);
        }
        // Prefer only PLATFORM_ADMIN from presets if present
        const admin = PRESET_STAFF.find((x) => x.badgeId === PLATFORM_ADMIN.badgeId);
        if (admin) byBadge.set(admin.badgeId, admin);
        for (const s of enrolled) {
          if (s.badgeId) byBadge.set(s.badgeId, s);
        }
        setStaffRegistry(Array.from(byBadge.values()));
      } catch (e) {
        console.error(e);
      }
    };

    mergeLocal();
    const onCards = () => mergeLocal();
    window.addEventListener('medcore-staff-cards-updated', onCards);
    window.addEventListener('medcore-staff-registry-updated', onCards);
    window.addEventListener('medcore-admin-sync', onCards);

    let unsubDir = () => {};
    let unsubCol = () => {};
    let unsubAuth = () => {};
    void (async () => {
      try {
        const {
          firestoreSubscribeStaffDirectory,
          firestoreSubscribeStaffCollection,
          subscribeFirebaseAuth,
          enableFirestoreOffline,
        } = await import('../../lib/firebase');
        await enableFirestoreOffline();
        setFirebaseLive(true);

        unsubDir = firestoreSubscribeStaffDirectory(selectedHospital.id, (data) => {
          if (data.staffRegistry && Array.isArray(data.staffRegistry)) {
            try {
              const localRaw = localStorage.getItem('medcore_os_staff_registry');
              const localArr: any[] = localRaw ? JSON.parse(localRaw) : [];
              const byBadge = new Map<string, any>();
              for (const s of Array.isArray(localArr) ? localArr : []) {
                const b = String(s.badgeId || s.id || '').toUpperCase();
                if (b) byBadge.set(b, s);
              }
              for (const s of data.staffRegistry as any[]) {
                const b = String(s.badgeId || s.id || '').toUpperCase();
                if (!b) continue;
                const prev = byBadge.get(b);
                byBadge.set(b, { ...prev, ...s, badgeId: b, pin: s.pin || prev?.pin || '1234' });
              }
              localStorage.setItem('medcore_os_staff_registry', JSON.stringify(Array.from(byBadge.values())));
            } catch { /* ignore */ }
            mergeLocal();
          }
          if (data.staffCards && Array.isArray(data.staffCards)) {
            try {
              const localCards = JSON.parse(localStorage.getItem('medcore_staff_id_cards') || '[]');
              const byId = new Map<string, any>();
              for (const c of Array.isArray(localCards) ? localCards : []) {
                const b = String(c.badgeId || '').toUpperCase();
                if (b) byId.set(b, c);
              }
              for (const c of data.staffCards as any[]) {
                const b = String(c.badgeId || '').toUpperCase();
                if (b) byId.set(b, { ...byId.get(b), ...c, badgeId: b });
              }
              localStorage.setItem('medcore_staff_id_cards', JSON.stringify(Array.from(byId.values())));
            } catch { /* ignore */ }
          }
        });

        // Live staff docs (enrolment on any PC appears here immediately)
        unsubCol = firestoreSubscribeStaffCollection(selectedHospital.id, (rows) => {
          if (!rows.length) return;
          try {
            const mapped = rows.map((r) => ({
              id: r.badgeId || r.id,
              badgeId: String(r.badgeId || r.id || '').toUpperCase(),
              name: r.name || r.fullName,
              fullName: r.name || r.fullName,
              role: r.role,
              shortRole: r.shortRole || r.role,
              title: r.title || r.role,
              roleKey: r.roleKey || 'doctor',
              clearanceLevel: r.clearanceLevel ?? 2,
              clearanceLabel: r.clearanceLabel || 'L2',
              department: r.department || '',
              initials: r.initials,
              permissions: r.permissions || ['dashboard'],
              pin: r.pin || '1234',
              hospitalId: r.hospitalId || r.facilityId || selectedHospital.id,
              hospitalName: r.hospitalName || r.facilityName || selectedHospital.name,
              status: r.status || 'active',
            }));
            // MERGE with local — never wipe enrolments that are not yet on cloud
            const localRaw = localStorage.getItem('medcore_os_staff_registry');
            const localArr: any[] = localRaw ? JSON.parse(localRaw) : [];
            const byBadge = new Map<string, any>();
            for (const s of Array.isArray(localArr) ? localArr : []) {
              const b = String(s.badgeId || s.id || '').toUpperCase();
              if (b) byBadge.set(b, s);
            }
            for (const s of mapped) {
              const b = String(s.badgeId || '').toUpperCase();
              if (!b) continue;
              const prev = byBadge.get(b);
              // Keep local PIN if remote missing
              byBadge.set(b, {
                ...prev,
                ...s,
                pin: s.pin || prev?.pin || '1234',
              });
            }
            const merged = Array.from(byBadge.values());
            localStorage.setItem('medcore_os_staff_registry', JSON.stringify(merged));
            mergeLocal();
          } catch (e) {
            console.warn('[auth] map staff collection', e);
          }
        });

        unsubAuth = subscribeFirebaseAuth((user) => {
          setFirebaseLive(true);
          if (user) {
            /* session restore handled on explicit sign-in for now */
          }
        });
      } catch (e) {
        console.warn('[auth] firestore staff subscribe', e);
        setFirebaseLive(false);
      }
    })();

    return () => {
      window.removeEventListener('medcore-staff-cards-updated', onCards);
      window.removeEventListener('medcore-staff-registry-updated', onCards);
      window.removeEventListener('medcore-admin-sync', onCards);
      unsubDir();
      unsubCol();
      unsubAuth();
    };
  }, [selectedHospital.id]);

  const triggerLogin = (session: UserSession) => {
    if (onLogin) onLogin(session);
    if (onLoginSuccess) onLoginSuccess(session);
  };

  // Strict staff match by badge ID only (no fuzzy / demo name shortcuts)
  const detectedStaff = useMemo(() => {
    const u = (username || '').trim().toLowerCase();
    if (!u) return null;
    const exact = staffRegistry.find((s) => s.badgeId.toLowerCase() === u);
    if (exact) return exact;
    // Allow partial only if a single badge starts with the typed id (min 4 chars)
    if (u.length >= 4) {
      const starts = staffRegistry.filter((s) => s.badgeId.toLowerCase().startsWith(u));
      if (starts.length === 1) return starts[0];
    }
    return null;
  }, [username, staffRegistry]);

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const withTimeout = <T,>(p: Promise<T>, ms = 6000): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
        ),
      ]);

    try {
    const u = (username || '').trim();
    const pass = (password || '').trim();
    const effectiveHospital = selectedHospital;
    const adminEmail = PLATFORM_ADMIN.email.toLowerCase();
    const badgeNorm = u.trim().toUpperCase().replace(/\s+/g, '');
    const isPlatformAdmin =
      (authMode === 'email' &&
        (u.toLowerCase() === adminEmail ||
          (u.toLowerCase().includes('xcoder2442') && pass === PLATFORM_ADMIN.password))) ||
      (authMode === 'badge' &&
        badgeNorm === PLATFORM_ADMIN.badgeId.toUpperCase() &&
        (pass === PLATFORM_ADMIN.password || pass === PLATFORM_ADMIN.password));

    // ── Badge + PIN ────────────────────────────────────────────────────────
    if (authMode === 'badge') {
      const badgeQuery = u.trim().toUpperCase().replace(/\s+/g, '');
      const pinQuery = pass.trim();
      if (!badgeQuery) {
        setError('Enter your staff badge / ID number.');
        setLoading(false);
        return;
      }
      if (!pinQuery) {
        setError('Enter your PIN.');
        setLoading(false);
        return;
      }

      const { resolveStaffByBadge, normalizeBadgeId, inferRoleKey } = await import('../../lib/staffCardStore');
      const {
        firestoreGetStaffByBadge,
        firestoreRecordLogin,
        firebaseSignInWithBadge,
        firebaseEnsureBadgeAccount,
        normalizeStaffPin,
      } = await import('../../lib/firebase');

      const mapProfile = (raw: Record<string, unknown>): PresetStaff => ({
        badgeId: normalizeBadgeId(String(raw.badgeId || raw.id || badgeQuery)),
        name: String(raw.name || raw.fullName || 'Staff'),
        role: String(raw.role || 'Staff'),
        shortRole: String(raw.shortRole || raw.role || 'Staff'),
        title: String(raw.title || raw.role || 'Staff'),
        roleKey: inferRoleKey(String(raw.roleKey || raw.role || ''), String(raw.badgeId || raw.id || badgeQuery)),
        clearanceLevel: Number(raw.clearanceLevel ?? 2),
        clearanceLabel: String(raw.clearanceLabel || 'L2'),
        department: String(raw.department || ''),
        initials: String(raw.initials || 'ST'),
        permissions: (raw.permissions as string[]) || ['dashboard'],
        pin: String(raw.pin || pinQuery),
        hospitalId: String(raw.hospitalId || raw.facilityId || effectiveHospital.id),
        hospitalName: String(raw.hospitalName || raw.facilityName || effectiveHospital.name),
        color: '#0052D4',
      });

      // 1) Local resolution (registry + cards + access) — same browser as admin create
      let profile: PresetStaff | undefined;
      const local = resolveStaffByBadge(badgeQuery);
      if (local) {
        profile = mapProfile(local as unknown as Record<string, unknown>);
      }

      // 2) In-memory registry
      if (!profile) {
        const hit = staffRegistry.find(
          (s) => normalizeBadgeId(s.badgeId) === badgeQuery
        );
        if (hit) profile = hit;
      }

      // 3) Firestore — selected hospital (timed); brief peer scan
      try {
        let remote = await withTimeout(
          firestoreGetStaffByBadge(effectiveHospital.id, badgeQuery),
          4000
        );
        if (!remote) {
          for (const h of HOSPITALS.slice(0, 5)) {
            if (h.id === effectiveHospital.id) continue;
            try {
              remote = await withTimeout(firestoreGetStaffByBadge(h.id, badgeQuery), 2000);
            } catch {
              remote = null;
            }
            if (remote) break;
          }
        }
        if (remote && (remote.badgeId || remote.id)) {
          profile = mapProfile(remote);
        }
      } catch (e) {
        console.warn('[auth] firestore badge', e);
      }

      // 4) If still no profile, try Firebase Auth — account may exist from admin create
      const pinNorm = normalizeStaffPin(pinQuery);
      let fbUser: import('firebase/auth').User | null = null;

      if (!profile) {
        try {
          fbUser = await withTimeout(firebaseSignInWithBadge(badgeQuery, pinNorm), 6000);
          // Auth worked — build minimal session profile
          profile = mapProfile({
            badgeId: badgeQuery,
            name: badgeQuery,
            role: 'Staff',
            roleKey: inferRoleKey('', badgeQuery),
            pin: pinNorm,
            hospitalId: effectiveHospital.id,
            hospitalName: effectiveHospital.name,
          });
        } catch {
          // 5) First login to an empty facility → auto-provision facility admin
          //    (only when using platform bootstrap credentials, so facilities stay claimable securely)
          const {
            hasFacilityAdmin,
            provisionFacilityAdmin,
          } = await import('../../lib/staffCardStore');

          const canClaim =
            isPlatformAdmin ||
            (badgeNorm === PLATFORM_ADMIN.badgeId.toUpperCase() &&
              (pinQuery === PLATFORM_ADMIN.password || pinNorm === normalizeStaffPin(PLATFORM_ADMIN.password)));

          if (canClaim && !hasFacilityAdmin(effectiveHospital.id)) {
            const prov = provisionFacilityAdmin(
              { id: effectiveHospital.id, name: effectiveHospital.name },
              { pin: PLATFORM_ADMIN.password, fullName: `${effectiveHospital.name.split(',')[0]} Administrator` }
            );
            if (prov.ok && prov.badgeId) {
              // Ensure Firebase Auth account for the new facility admin
              try {
                await withTimeout(
                  firebaseEnsureBadgeAccount(prov.badgeId, normalizeStaffPin(prov.pin || PLATFORM_ADMIN.password)),
                  6000
                );
              } catch { /* offline / timeout ok */ }

              const created = resolveStaffByBadge(prov.badgeId);
              if (created) {
                profile = mapProfile(created as unknown as Record<string, unknown>);
                // continue into normal session creation below
              } else {
                setError(prov.error || 'Could not provision facility admin.');
                setLoading(false);
                return;
              }
            } else {
              setError(
                prov.error ||
                  'Staff ID not found. Use the exact badge from the confirmation screen (e.g. IGH-EKT-DOC-XXXX). Create the account under Staff Access Control if needed.'
              );
              setLoading(false);
              return;
            }
          } else {
            setError(
              'Staff ID not found. Use the exact badge from the confirmation screen (e.g. IGH-EKT-DOC-XXXX). Create the account under Staff Access Control if needed.'
            );
            setLoading(false);
            return;
          }
        }
      }

      // Verify PIN when we have a stored pin
      if (profile.pin && String(profile.pin) !== pinQuery && normalizeStaffPin(profile.pin) !== pinNorm) {
        // still allow if Firebase accepts the PIN (timed)
        try {
          if (!fbUser) {
            fbUser = await withTimeout(firebaseSignInWithBadge(profile.badgeId, pinNorm), 6000);
          }
        } catch {
          setError('Incorrect PIN.');
          setLoading(false);
          return;
        }
      } else {
        // PIN matches local — try Firebase quickly, then fall back to local session
        try {
          if (!fbUser) {
            try {
              fbUser = await withTimeout(firebaseSignInWithBadge(profile.badgeId, pinNorm), 6000);
            } catch {
              try {
                await withTimeout(firebaseEnsureBadgeAccount(profile.badgeId, pinNorm), 6000);
                fbUser = await withTimeout(firebaseSignInWithBadge(profile.badgeId, pinNorm), 6000);
              } catch {
                fbUser = null; // valid local PIN — proceed without cloud Auth
              }
            }
          }
        } catch (authErr: unknown) {
          // Offline / Auth disabled / timeout: still allow local PIN session
          console.warn('[auth] firebase badge optional', authErr);
          const sessionLocal: UserSession = {
            id: profile.badgeId,
            badgeId: profile.badgeId,
            name: profile.name,
            role: profile.role,
            roleKey: profile.roleKey,
            title: profile.title,
            facility: profile.hospitalName || effectiveHospital.name,
            hospitalId: profile.hospitalId || effectiveHospital.id,
            department: profile.department,
            avatarInitials: profile.initials,
            clearanceLabel: profile.clearanceLabel,
            clearanceLevel: profile.clearanceLevel,
            permissions: profile.permissions,
            authMethod: 'Staff PIN (local)',
            loginTime: new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setSuccess(true);
          setLoading(false);
          setTimeout(() => triggerLogin(sessionLocal), 300);
          return;
        }
      }

      if (fbUser) {
        void firestoreRecordLogin(profile.hospitalId || effectiveHospital.id, profile.badgeId, {
          method: 'badge_pin_firebase',
          uid: fbUser.uid,
        });
      }

      const session: UserSession = {
        id: fbUser?.uid || profile.badgeId,
        badgeId: profile.badgeId,
        name: profile.name,
        role: profile.role,
        roleKey: profile.roleKey,
        title: profile.title,
        facility: profile.hospitalName || effectiveHospital.name,
        hospitalId: profile.hospitalId || effectiveHospital.id,
        department: profile.department,
        avatarInitials: profile.initials,
        clearanceLabel: profile.clearanceLabel,
        clearanceLevel: profile.clearanceLevel,
        permissions: profile.permissions,
        authMethod: fbUser ? 'Firebase · Staff ID' : 'Staff PIN',
        token: fbUser
          ? await withTimeout(fbUser.getIdToken(), 4000).catch(() => `PIN-${Date.now().toString(36)}`)
          : `PIN-${Date.now().toString(36)}`,
        loginTime: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setSuccess(true);
      setLoading(false);
      setTimeout(() => triggerLogin(session), 300);
      return;
    }

    // ── Email → Firebase ───────────────────────────────────────────────────
    if (u.includes('@') || isPlatformAdmin) {
      const email = u.includes('@') ? u : PLATFORM_ADMIN.email;
      try {
        const { firebaseSignIn, firebaseSignUp, isEmailCredential } = await import('../../lib/firebase');
        if (!isEmailCredential(email)) {
          setError('Please enter a valid work email address.');
          setLoading(false);
          return;
        }
        if (pass.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        if (email.toLowerCase() === adminEmail && pass !== PLATFORM_ADMIN.password) {
          setError('Incorrect password for this administrator account.');
          setLoading(false);
          return;
        }

        let fbUser;
        try {
          fbUser = await withTimeout(firebaseSignIn(email, pass), 8000);
        } catch (signInErr: unknown) {
          const code = (signInErr as { code?: string })?.code || '';
          const timedOut = String((signInErr as Error)?.message || '').includes('timeout');
          if (
            code === 'auth/user-not-found' ||
            code === 'auth/invalid-credential' ||
            code === 'auth/wrong-password' ||
            timedOut
          ) {
            if (email.toLowerCase() === adminEmail && pass === PLATFORM_ADMIN.password) {
              try {
                fbUser = await withTimeout(firebaseSignUp(email, pass), 8000);
              } catch (signUpErr: unknown) {
                try {
                  fbUser = await withTimeout(firebaseSignIn(email, pass), 6000);
                } catch {
                  setError(
                    (signUpErr as { message?: string })?.message ||
                      'Could not sign in. Enable Email/Password in Firebase Console.'
                  );
                  setLoading(false);
                  return;
                }
              }
            } else {
              setError('Invalid email or password.');
              setLoading(false);
              return;
            }
          } else {
            setError(
              (signInErr as { message?: string })?.message ||
                'Sign-in failed. Check your connection and try again.'
            );
            setLoading(false);
            return;
          }
        }

        // Auto-provision facility admin on first login to an empty facility
        let matchedStaff: PresetStaff | undefined;
        if (email.toLowerCase() === adminEmail) {
          const {
            hasFacilityAdmin,
            provisionFacilityAdmin,
            resolveStaffByBadge,
          } = await import('../../lib/staffCardStore');

          if (!hasFacilityAdmin(effectiveHospital.id)) {
            const prov = provisionFacilityAdmin(
              { id: effectiveHospital.id, name: effectiveHospital.name },
              { pin: PLATFORM_ADMIN.password, fullName: `${effectiveHospital.name.split(',')[0]} Administrator` }
            );
            if (prov.ok && prov.badgeId) {
              try {
                const { firebaseEnsureBadgeAccount, normalizeStaffPin } = await import('../../lib/firebase');
                await withTimeout(
                  firebaseEnsureBadgeAccount(prov.badgeId, normalizeStaffPin(prov.pin || PLATFORM_ADMIN.password)),
                  6000
                );
              } catch { /* offline / timeout ok */ }
              const created = resolveStaffByBadge(prov.badgeId);
              if (created) {
                matchedStaff = {
                  badgeId: created.badgeId,
                  name: created.name,
                  role: created.role,
                  shortRole: 'Admin',
                  title: created.title,
                  roleKey: created.roleKey,
                  clearanceLevel: created.clearanceLevel,
                  clearanceLabel: created.clearanceLabel,
                  department: created.department,
                  initials: created.initials,
                  permissions: created.permissions,
                  pin: created.pin,
                  hospitalId: effectiveHospital.id,
                  hospitalName: effectiveHospital.name,
                  color: '#EA580C',
                };
              }
            }
          }

          if (!matchedStaff) {
            const adminStaff = staffRegistry.find((s) => s.badgeId === PLATFORM_ADMIN.badgeId);
            matchedStaff = adminStaff;
            // Re-bind session to selected facility even if using global bootstrap profile
            if (matchedStaff) {
              matchedStaff = {
                ...matchedStaff,
                hospitalId: effectiveHospital.id,
                hospitalName: effectiveHospital.name,
              };
            }
          }
        } else {
          matchedStaff = detectedStaff ?? undefined;
        }

        if (!matchedStaff) {
          setError(
            email.toLowerCase() === adminEmail
              ? 'Admin profile missing. Contact support.'
              : 'No staff profile linked to this email. Use Sign in with ID No. or ask admin to enrol you.'
          );
          setLoading(false);
          return;
        }

        const displayName =
          email.toLowerCase() === adminEmail
            ? PLATFORM_ADMIN.name
            : fbUser.displayName || matchedStaff.name;
        const initials = displayName
          .split(/\s+/)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        const session: UserSession = {
          id: fbUser.uid,
          badgeId: matchedStaff.badgeId,
          name: displayName,
          role: matchedStaff.role,
          roleKey: matchedStaff.roleKey,
          title: matchedStaff.title,
          facility: effectiveHospital.name,
          hospitalId: effectiveHospital.id,
          department: matchedStaff.department,
          avatarInitials: initials || matchedStaff.initials,
          clearanceLabel: matchedStaff.clearanceLabel,
          clearanceLevel: matchedStaff.clearanceLevel,
          permissions: matchedStaff.permissions,
          authMethod: 'Firebase',
          token: await withTimeout(fbUser.getIdToken(), 4000).catch(() => `EMAIL-${Date.now().toString(36)}`),
          loginTime: new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setSuccess(true);
        setLoading(false);
        setTimeout(() => triggerLogin(session), 300);
        return;
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || 'Sign-in error. Please try again.');
        setLoading(false);
        return;
      }
    }

    setError('Use work email, or switch to Sign in with ID No. (badge + PIN).');
    setLoading(false);
    } catch (fatal: unknown) {
      console.error('[auth] sign-in fatal', fatal);
      setError(
        (fatal as { message?: string })?.message ||
          'Sign-in failed. Check your connection and try again.'
      );
      setLoading(false);
    } finally {
      // Never leave the button stuck on "Signing in…"
      setLoading(false);
    }
  };


  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      background: '#FFFFFF',
    }}>
      {/* -- Left Hero Section — portrait art cropped to fill panel -- */}
      <div style={{
        flex: '1 1 52%',
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #E0F2FE 0%, #F0F9FF 50%, #ECFDF5 100%)',
      }}>
        <img
          src="/authos-hero.png"
          alt="Hospital OS - Efficient Health Management for a Healthier Tomorrow"
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            /* Portrait source (844×1024): keep faces/headline near upper-center */
            objectPosition: 'center 22%',
            display: 'block',
          }}
        />
        {/* Soft edge so crop meets the form panel cleanly */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 48,
            background: 'linear-gradient(90deg, transparent, rgba(248,250,252,0.55))',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* -- Right Auth Form Section (Exact replica of authos.png floating card) -- */}
      <div style={{
        flex: '1 1 46%',
        position: 'relative',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 40px',
        background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
        overflowY: 'auto',
      }}>
        {/* Faint ECG Watermark in top right */}
        <svg
          style={{
            position: 'absolute',
            top: 24,
            right: 30,
            opacity: 0.22,
            pointerEvents: 'none',
          }}
          width="190"
          height="80"
          viewBox="0 0 190 80"
          fill="none"
        >
          <path
            d="M0 40H50L60 12L74 68L88 28L98 52L108 40H190"
            stroke="#00A3BF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Floating White Card */}
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: '#FFFFFF',
          borderRadius: 22,
          padding: '36px 36px 28px',
          boxShadow: '0 20px 50px rgba(10, 37, 64, 0.07), 0 1px 4px rgba(0, 0, 0, 0.04)',
          border: '1px solid #E2E8F0',
          position: 'relative',
          zIndex: 2,
          animation: 'fadeUp 0.3s ease-out',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <img
              src="/authos-logo.png"
              alt="Hospital OS Logo"
              style={{
                height: 60,
                display: 'inline-block',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: '#0A2540',
            textAlign: 'center',
            margin: '0 0 6px',
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.02em',
          }}>
            Welcome Back
          </h1>
          <p style={{
            fontSize: '0.88rem',
            color: '#64748B',
            textAlign: 'center',
            margin: '0 0 22px',
          }}>
            {authMode === 'badge' ? 'Enter your staff badge number and PIN' : 'Sign in with work email or switch to ID No.'}
          </p>

          {/* Error Message */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#B91C1C',
              fontSize: '0.82rem',
              marginBottom: 16,
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Sign-In Form */}
          <div style={{ position: 'relative' }}>
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
            {/* Hospital Facility Selector */}
            <div>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                transition: 'border-color 0.15s ease',
              }}>
                <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <Building2 size={18} color="#00A3BF" />
                </div>
                <select
                  value={selectedHospital.id}
                  onChange={(e) => {
                    const found = HOSPITALS.find(h => h.id === e.target.value);
                    if (found) setSelectedHospital(found);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    fontSize: '0.86rem',
                    color: '#0A2540',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: 10,
                  }}
                >
                  {HOSPITALS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Username / Email */}
            <div>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}>
                <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <User size={18} color="#94A3B8" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={authMode === 'badge' ? 'Staff badge / ID number' : 'Work email'}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    fontSize: '0.88rem',
                    color: '#0A2540',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    outline: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#0052D4')}
                  onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
              {detectedStaff && (
                <div style={{
                  marginTop: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'rgba(0, 82, 212, 0.06)',
                  border: '1px solid rgba(0, 82, 212, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} color="#059669" />
                    <span style={{ color: '#0A2540', fontWeight: 600 }}>
                      {detectedStaff.name} ({detectedStaff.shortRole}) � Assigned to: <strong style={{ color: '#0052D4' }}>{detectedStaff.hospitalName}</strong>
                    </span>
                  </div>
                  {selectedHospital.id !== detectedStaff.hospitalId && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = HOSPITALS.find(h => h.id === detectedStaff.hospitalId);
                        if (target) setSelectedHospital(target);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0052D4',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '0.72rem',
                        padding: 0,
                      }}
                    >
                      Log in to Assigned Hospital
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}>
              <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} color="#94A3B8" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMode === 'badge' ? 'PIN' : 'Password'}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  fontSize: '0.88rem',
                  color: '#0A2540',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0052D4')}
                onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.84rem',
              marginTop: 2,
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#475569',
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: '#0052D4',
                    cursor: 'pointer',
                  }}
                />
                <span>Remember me</span>
              </label>

              <a
                href="#forgot"
                onClick={(e) => { e.preventDefault(); alert('Password reset link sent to registered email.'); }}
                style={{
                  color: '#0284C7',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Forgot password?
              </a>
            </div>

            {/* Primary Sign In Button (Gradient matching authos.png) */}
            <button
              type="submit"
              disabled={loading || success}
              style={{
                marginTop: 6,
                height: 48,
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
                color: '#0A2540',
                fontWeight: 700,
                fontSize: '0.96rem',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 20px rgba(0, 82, 212, 0.28)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading && !success) e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {success ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Authenticated � Launching...</span>
                </>
              ) : loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            {(loading || success) && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.72)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                }}
              >
                <style>{`@keyframes authSpin { to { transform: rotate(360deg); } }`}</style>
                <div
                  className="auth-round-loader"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '3.5px solid #E2E8F0',
                    borderTopColor: '#0284C7',
                    borderRightColor: '#00BFA5',
                    animation: 'authSpin 0.75s linear infinite',
                    boxShadow: '0 8px 24px rgba(2, 132, 199, 0.2)',
                  }}
                />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                  {success ? 'Launching Hospital OS…' : 'Signing in…'}
                </span>
              </div>
            )}
          </form>
          </div>


          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '22px 0',
            color: '#94A3B8',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ padding: '0 14px', letterSpacing: '0.05em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          {/* Toggle email ↔ badge + PIN */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(false);
              setUsername('');
              setPassword('');
              setAuthMode((m) => (m === 'badge' ? 'email' : 'badge'));
            }}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              background: authMode === 'badge' ? 'rgba(0, 82, 212, 0.06)' : '#FFFFFF',
              border: authMode === 'badge' ? '1px solid rgba(0, 82, 212, 0.35)' : '1px solid #E2E8F0',
              color: authMode === 'badge' ? '#0052D4' : '#334155',
              fontWeight: 600,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (authMode !== 'badge') e.currentTarget.style.background = '#F8FAFC';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = authMode === 'badge' ? 'rgba(0, 82, 212, 0.06)' : '#FFFFFF';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <circle cx="8" cy="12" r="2" />
              <path d="M14 9h4M14 12h4M14 15h2" />
            </svg>
            <span>{authMode === 'badge' ? 'Sign in with email instead' : 'Sign in with ID No.'}</span>
          </button>

          {/* Footer */}
          <div style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: '0.78rem',
            color: '#64748B',
          }}>
            Powered by <strong style={{ color: '#0A2540' }}>ARISE</strong> | <strong style={{ color: '#0A2540' }}>Ministry of Health</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
