'use client';

import React, { useState } from 'react';
import {
  Building2, User, Phone, Mail, MapPin, Shield, CheckCircle2, ArrowRight, IdCard
} from 'lucide-react';
import type { UserSession } from './AuthScreen';
import { HOSPITALS } from './AuthScreen';

export const ONBOARDING_STORAGE_KEY = 'medcore_admin_onboarding_complete';
export const ADMIN_PROFILE_STORAGE_KEY = 'medcore_admin_profile';

export interface AdminProfile {
  fullName: string;
  preferredTitle: string;
  phone: string;
  email: string;
  nin?: string;
  hospitalId: string;
  hospitalName: string;
  department: string;
  jobTitle: string;
  yearsExperience?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  completedAt: string;
}

interface Props {
  session: UserSession;
  onComplete: (updatedSession: UserSession, profile: AdminProfile) => void;
}

export function isAdminOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function loadAdminProfile(): AdminProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminProfile) : null;
  } catch {
    return null;
  }
}

export const AdminOnboarding: React.FC<Props> = ({ session, onComplete }) => {
  const defaultHospital =
    HOSPITALS.find((h) => h.id === session.hospitalId) || HOSPITALS[0];

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(session.name === 'Hospital Administrator' ? '' : session.name);
  const [preferredTitle, setPreferredTitle] = useState('Mr / Mrs / Dr');
  const [jobTitle, setJobTitle] = useState('Hospital Administrator');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nin, setNin] = useState('');
  const [hospitalId, setHospitalId] = useState(defaultHospital?.id || '');
  const [department, setDepartment] = useState('Hospital Management');
  const [yearsExperience, setYearsExperience] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const hospital = HOSPITALS.find((h) => h.id === hospitalId) || defaultHospital;

  const validateStep = (): boolean => {
    setError('');
    if (step === 0) {
      if (!fullName.trim() || fullName.trim().length < 3) {
        setError('Enter your full legal name (at least 3 characters).');
        return false;
      }
      if (!jobTitle.trim()) {
        setError('Enter your job title.');
        return false;
      }
    }
    if (step === 1) {
      if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
        setError('Enter a valid phone number.');
        return false;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Enter a valid work email.');
        return false;
      }
    }
    if (step === 2) {
      if (!hospitalId) {
        setError('Select your hospital.');
        return false;
      }
    }
    return true;
  };

  const finish = () => {
    if (!validateStep()) return;
    setSaving(true);

    const profile: AdminProfile = {
      fullName: fullName.trim(),
      preferredTitle: preferredTitle.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      nin: nin.trim() || undefined,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      department: department.trim() || 'Hospital Management',
      jobTitle: jobTitle.trim(),
      yearsExperience: yearsExperience.trim() || undefined,
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      completedAt: new Date().toISOString(),
    };

    const initials = profile.fullName
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const updated: UserSession = {
      ...session,
      name: profile.fullName,
      title: profile.jobTitle,
      role: profile.jobTitle,
      facility: profile.hospitalName,
      hospitalId: profile.hospitalId,
      department: profile.department,
      avatarInitials: initials || session.avatarInitials,
    };

    try {
      localStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
      localStorage.setItem('medcore_os_session', JSON.stringify(updated));
      const regRaw = localStorage.getItem('medcore_os_staff_registry');
      let reg = regRaw ? JSON.parse(regRaw) : [];
      if (!Array.isArray(reg)) reg = [];
      const adminEntry = {
        id: session.badgeId || 'AKS-ADM-001',
        badgeId: session.badgeId || 'AKS-ADM-001',
        name: profile.fullName,
        role: profile.jobTitle,
        shortRole: 'Admin',
        title: profile.jobTitle,
        roleKey: 'hospital_admin',
        clearanceLevel: 5,
        clearanceLabel: 'Administrator',
        department: profile.department,
        initials,
        permissions: session.permissions,
        pin: 'AKS-0012442',
        hospitalId: profile.hospitalId,
        hospitalName: profile.hospitalName,
        status: 'active',
        phone: profile.phone,
        email: profile.email,
      };
      reg = [adminEntry, ...reg.filter((r: { badgeId?: string }) => r.badgeId !== adminEntry.badgeId)];
      localStorage.setItem('medcore_os_staff_registry', JSON.stringify(reg));
    } catch {
      /* ignore */
    }

    setTimeout(() => {
      setSaving(false);
      onComplete(updated, profile);
    }, 400);
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < 2) setStep(step + 1);
    else finish();
  };

  const steps = ['Your identity', 'Contact', 'Hospital'];

  const labelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155',
  };
  const inputStyle: React.CSSProperties = {
    padding: '11px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.9rem', color: '#0A2540', outline: 'none', fontWeight: 500,
  };
  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
  };
  const btnGhost: React.CSSProperties = {
    padding: '12px 18px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'linear-gradient(160deg, #E0F2FE 0%, #F0F9FF 45%, #ECFDF5 100%)', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 520, background: '#FFFFFF', borderRadius: 20, border: '1px solid #E2E8F0',
        boxShadow: '0 20px 50px -12px rgba(0, 82, 212, 0.15)', padding: '32px 36px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0052D4, #00BFA5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0052D4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              First-time setup
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0A2540' }}>
              Hospital Administrator onboarding
            </h1>
          </div>
        </div>
        <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.55, marginBottom: 20 }}>
          This system starts <strong>empty</strong> — no demo patients or staff. Complete your profile,
          then enrol real staff from <strong>Add staff</strong>. Only you can sign in until then.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {steps.map((label, i) => (
            <div key={label} style={{
              flex: 1, padding: '8px 6px', borderRadius: 10, textAlign: 'center', fontSize: '0.72rem', fontWeight: 700,
              background: i === step ? 'linear-gradient(90deg, #0052D4, #00BFA5)' : '#F1F5F9',
              color: i === step ? '#fff' : '#64748B',
            }}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '10px 12px', borderRadius: 10, fontSize: '0.84rem', marginBottom: 14 }}>
            {error}
          </div>
        )}

        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <User size={14} /> Full legal name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ngozi Eze" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Preferred title
              <input value={preferredTitle} onChange={(e) => setPreferredTitle(e.target.value)} placeholder="Mr / Mrs / Dr / Pharm" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <IdCard size={14} /> Job title
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Hospital Administrator" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Years in administration (optional)
              <input value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="e.g. 8" style={inputStyle} />
            </label>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <Phone size={14} /> Mobile phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 …" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <Mail size={14} /> Work email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@hospital.gov.ng" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              NIN (optional)
              <input value={nin} onChange={(e) => setNin(e.target.value)} placeholder="11-digit NIN" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Emergency contact name (optional)
              <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Emergency contact phone (optional)
              <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} style={inputStyle} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <Building2 size={14} /> Your hospital (one admin per facility)
              <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} style={inputStyle}>
                {HOSPITALS.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              <MapPin size={14} /> Department
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Hospital Management" style={inputStyle} />
            </label>
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 14, fontSize: '0.84rem', color: '#0C4A6E', lineHeight: 1.5 }}>
              <strong>After this:</strong> the hospital starts with zero patients and zero other staff.
              Use <strong>Staff enrolment</strong> to add doctors, nurses, reception, and others.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} style={btnGhost}>Back</button>
          )}
          <button type="button" onClick={next} disabled={saving} style={{ ...btnPrimary, marginLeft: 'auto', opacity: saving ? 0.7 : 1 }}>
            {step < 2 ? (<>Continue <ArrowRight size={16} /></>) : (<>{saving ? 'Saving…' : 'Complete setup'} <CheckCircle2 size={16} /></>)}
          </button>
        </div>
      </div>
    </div>
  );
};
