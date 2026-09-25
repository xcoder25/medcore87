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

export const PRESET_STAFF: PresetStaff[] = [
  {
    badgeId: 'IGH-DOC-001', name: 'Dr. Amara Okafor', role: 'Medical Officer', shortRole: 'Doctor',
    title: 'Medical Officer', roleKey: 'doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical',
    department: 'Internal Medicine', initials: 'AO',
    permissions: ['dashboard', 'doctor-portal', 'emergency', 'beds', 'patient-flow', 'staffing', 'patient-card', 'ai', 'm87-ai'],
    pin: '1234', hospitalId: 'IGH-EKT', hospitalName: 'Immanuel General Hospital, Eket', color: '#0284C7',
  },
  {
    badgeId: 'GHI-SUR-002', name: 'Dr. Emeka Adeyemi', role: 'Consultant Surgeon', shortRole: 'Surgeon',
    title: 'Consultant Surgeon', roleKey: 'surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Consultant',
    department: 'Surgery & Theatre', initials: 'EA',
    permissions: ['dashboard', 'theatre', 'icu', 'doctor-portal', 'emergency', 'ai'],
    pin: '1234', hospitalId: 'GH-IKE', hospitalName: 'General Hospital, Ikot Ekpene', color: '#DC2626',
  },
  {
    badgeId: 'MSG-NUR-003', name: 'Nurse Aisha Bello', role: 'Senior Nursing Officer', shortRole: 'Nurse',
    title: 'Senior Nursing Officer', roleKey: 'nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing',
    department: 'Female Medical Ward', initials: 'AB',
    permissions: ['dashboard', 'nursing', 'beds', 'patient-flow', 'emergency', 'maternity'],
    pin: '1234', hospitalId: 'MSG-ITU', hospitalName: 'Mary Slessor General Hospital, Itu', color: '#7C3AED',
  },
  {
    badgeId: 'IGH-ADM-004', name: 'Adm. Ngozi Eze', role: 'Hospital Administrator', shortRole: 'Admin',
    title: 'Hospital Administrator', roleKey: 'hospital_admin', clearanceLevel: 5, clearanceLabel: 'L5 Executive',
    department: 'Hospital Administration', initials: 'NE',
    permissions: ['*'],
    pin: '1234', hospitalId: 'IGH-EKT', hospitalName: 'Immanuel General Hospital, Eket', color: '#D97706',
  },
  {
    badgeId: 'GHE-PHA-005', name: 'Pharm. Chidi Otu', role: 'Chief Pharmacist', shortRole: 'Pharmacist',
    title: 'Chief Pharmacist', roleKey: 'pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy',
    department: 'Pharmacy', initials: 'CO',
    permissions: ['dashboard', 'pharmacy', 'inventory'],
    pin: '1234', hospitalId: 'GH-ETN', hospitalName: 'General Hospital, Etinan', color: '#059669',
  },
  {
    badgeId: 'GHI-LAB-006', name: 'Kelechi Obiora', role: 'Senior Lab Scientist', shortRole: 'Lab',
    title: 'Senior Lab Scientist', roleKey: 'lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab',
    department: 'Laboratory', initials: 'KO',
    permissions: ['dashboard', 'laboratory', 'blood-bank'],
    pin: '1234', hospitalId: 'GH-IKE', hospitalName: 'General Hospital, Ikot Ekpene', color: '#0891B2',
  },
  {
    badgeId: 'MGH-RAD-007', name: 'Dr. Fatima Al-Hassan', role: 'Radiologist', shortRole: 'Radiology',
    title: 'Consultant Radiologist', roleKey: 'radiologist', clearanceLevel: 5, clearanceLabel: 'L5 Radiology',
    department: 'Radiology', initials: 'FA',
    permissions: ['dashboard', 'radiology'],
    pin: '1234', hospitalId: 'MGH-ITM', hospitalName: 'Methodist General Hospital, Ituk Mbang', color: '#6D28D9',
  },
  {
    badgeId: 'GHA-REC-008', name: 'Bisi Adewale', role: 'Records Officer', shortRole: 'Records',
    title: 'Health Records Officer', roleKey: 'records', clearanceLevel: 2, clearanceLabel: 'L2 Records',
    department: 'Medical Records', initials: 'BA',
    permissions: ['dashboard', 'patient-card', 'command'],
    pin: '1234', hospitalId: 'GH-IAB', hospitalName: 'General Hospital, Ikot Abasi', color: '#0F766E',
  },
  {
    badgeId: 'PSY-ACC-009', name: 'Amaka Oguike', role: 'Accountant', shortRole: 'Accounts',
    title: 'Finance Officer', roleKey: 'accountant', clearanceLevel: 3, clearanceLabel: 'L3 Finance',
    department: 'Finance & Accounts', initials: 'AO',
    permissions: ['dashboard', 'cashier', 'billing', 'claims', 'revenue-cycle'],
    pin: '1234', hospitalId: 'PSY-EKT', hospitalName: 'Psychiatric Hospital, Eket', color: '#B45309',
  },
  {
    badgeId: 'MHQB-ICT-010', name: 'Ola Bankole', role: 'ICT / System Admin', shortRole: 'SysAdmin',
    title: 'Chief Information Officer', roleKey: 'sysadmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin',
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

  // Dynamic reload from localStorage to capture any admin transfers
  useEffect(() => {
    try {
      const saved = localStorage.getItem('medcore_os_staff_registry');
      if (saved) {
        const parsed: any[] = JSON.parse(saved);
        setStaffRegistry(PRESET_STAFF.map(ps => {
          const match = parsed.find(p => p.id === ps.badgeId || p.name.toLowerCase() === ps.name.toLowerCase());
          if (match && match.hospitalId) {
            return {
              ...ps,
              hospitalId: match.hospitalId,
              hospitalName: match.hospitalName,
            };
          }
          return ps;
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const triggerLogin = (session: UserSession) => {
    if (onLogin) onLogin(session);
    if (onLoginSuccess) onLoginSuccess(session);
  };

  // Detected staff based on username/badge
  const detectedStaff = useMemo(() => {
    const u = (username || '').trim().toLowerCase();
    if (!u) return null;
    return staffRegistry.find(s =>
      s.badgeId.toLowerCase().includes(u) ||
      s.name.toLowerCase().includes(u) ||
      (u.includes('admin') && s.roleKey === 'hospital_admin') ||
      (u.includes('ngozi') && s.roleKey === 'hospital_admin') ||
      (u.includes('surgeon') && s.roleKey === 'surgeon') ||
      (u.includes('emeka') && s.roleKey === 'surgeon') ||
      (u.includes('nurse') && s.roleKey === 'nurse') ||
      (u.includes('aisha') && s.roleKey === 'nurse') ||
      (u.includes('pharm') && s.roleKey === 'pharmacist') ||
      (u.includes('chidi') && s.roleKey === 'pharmacist') ||
      (u.includes('lab') && s.roleKey === 'lab') ||
      (u.includes('kelechi') && s.roleKey === 'lab') ||
      (u.includes('rad') && s.roleKey === 'radiologist') ||
      (u.includes('fatima') && s.roleKey === 'radiologist') ||
      (u.includes('record') && s.roleKey === 'records') ||
      (u.includes('bisi') && s.roleKey === 'records') ||
      (u.includes('account') && s.roleKey === 'accountant') ||
      (u.includes('amaka') && s.roleKey === 'accountant') ||
      (u.includes('sys') && s.roleKey === 'sysadmin') ||
      (u.includes('ola') && s.roleKey === 'sysadmin') ||
      (u.includes('doc') && s.roleKey === 'doctor') ||
      (u.includes('amara') && s.roleKey === 'doctor')
    ) || null;
  }, [username, staffRegistry]);

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const u = (username || '').trim();
    const pass = (password || '').trim();
    const effectiveHospital = selectedHospital;

    // ── Firebase Auth test path: email + password ──────────────────────────
    if (u.includes('@')) {
      try {
        const { firebaseSignIn, firebaseSignUp, isEmailCredential } = await import('../../lib/firebase');
        if (!isEmailCredential(u)) {
          setError('Enter a valid email for Firebase test auth.');
          setLoading(false);
          return;
        }
        if (pass.length < 6) {
          setError('Firebase password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        let fbUser;
        try {
          fbUser = await firebaseSignIn(u, pass);
        } catch (signInErr: unknown) {
          const code = (signInErr as { code?: string })?.code || '';
          // Auto-register on first test so you can create a user from the OS login form
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            try {
              fbUser = await firebaseSignUp(u, pass);
            } catch (signUpErr: unknown) {
              const msg =
                (signUpErr as { message?: string })?.message ||
                'Firebase sign-up failed. Enable Email/Password in Firebase Console.';
              setError(msg);
              setLoading(false);
              return;
            }
          } else {
            const msg =
              (signInErr as { message?: string })?.message ||
              'Firebase sign-in failed. Check Email/Password is enabled in Firebase Console.';
            setError(msg);
            setLoading(false);
            return;
          }
        }

        const matchedStaff = detectedStaff || staffRegistry[0];
        const displayName =
          fbUser.displayName ||
          u.split('@')[0] ||
          matchedStaff.name;
        const initials = displayName
          .split(/\s+/)
          .map((p) => p[0])
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
          authMethod: 'Firebase Auth',
          token: await fbUser.getIdToken(),
          loginTime: new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setSuccess(true);
        setLoading(false);
        setTimeout(() => triggerLogin(session), 400);
        return;
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || 'Firebase auth error');
        setLoading(false);
        return;
      }
    }

    // ── Legacy demo path: badge ID / name + PIN (offline) ──────────────────
    setTimeout(() => {
      let matchedStaff = detectedStaff || staffRegistry[0];

      const session: UserSession = {
        id: matchedStaff.badgeId,
        badgeId: matchedStaff.badgeId,
        name: u
          ? u.includes('@')
            ? u.split('@')[0]
            : matchedStaff.name
          : matchedStaff.name,
        role: matchedStaff.role,
        roleKey: matchedStaff.roleKey,
        title: matchedStaff.title,
        facility: effectiveHospital.name,
        hospitalId: effectiveHospital.id,
        department: matchedStaff.department,
        avatarInitials: matchedStaff.initials,
        clearanceLabel: matchedStaff.clearanceLabel,
        clearanceLevel: matchedStaff.clearanceLevel,
        permissions: matchedStaff.permissions,
        authMethod: 'Password Credential',
        token: `AUTH-${Date.now().toString(36).toUpperCase()}`,
        loginTime: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setSuccess(true);
      setLoading(false);
      setTimeout(() => triggerLogin(session), 600);
    }, 400);
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
            Sign in to your account to continue
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
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  placeholder="Email (Firebase) or Staff Badge ID"
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
                placeholder="Password"
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
          </form>

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

          {/* Sign in with ID No. */}
          <button
            type="button"
            onClick={() => handleSignIn()}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            {/* ID Card Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D4F8B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <circle cx="8" cy="12" r="2" />
              <path d="M14 9h4M14 12h4M14 15h2" />
            </svg>
            <span>Sign in with ID No.</span>
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
