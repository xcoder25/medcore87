'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { nextPrintedBadgeId } from '../../lib/staffCardStore';
import {
  Building2,
  User,
  Mail,
  Lock,
  KeyRound,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Hospital,
  BadgeCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Check,
} from 'lucide-react';

/* ── Facility list (mirrors AuthScreen.tsx HOSPITALS) ─────────────────────── */
interface Facility {
  id: string;
  name: string;
  location: string;
  type: string;
}

const FACILITIES: Facility[] = [
  { id: 'IGH-EKT', name: 'Immanuel General Hospital, Eket', location: 'Eket, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-IKE', name: 'General Hospital, Ikot Ekpene', location: 'Ikot Ekpene, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-IQU', name: 'General Hospital, Iquita Oron', location: 'Oron, Akwa Ibom', type: 'General Hospital' },
  { id: 'MGH-ITM', name: 'Methodist General Hospital, Ituk Mbang', location: 'Ituk Mbang, Akwa Ibom', type: 'Mission Hospital' },
  { id: 'GH-ETN', name: 'General Hospital, Etinan', location: 'Etinan, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-UAB', name: 'General Hospital, Ukpom Abak', location: 'Abak, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-AWA', name: 'General Hospital, Awa', location: 'Awa, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-IKO', name: 'General Hospital, Ikot Okoro', location: 'Ikot Okoro, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-IKN', name: 'General Hospital, Ikono', location: 'Ikono, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-AMM', name: 'General Hospital, Amammong Okobo', location: 'Okobo, Akwa Ibom', type: 'General Hospital' },
  { id: 'MCH-AKU', name: 'Mount Carmel Hospital, Akpa Utong', location: 'Akpa Utong, Akwa Ibom', type: 'Mission Hospital' },
  { id: 'GH-URO', name: 'General Hospital, Urue-Offong/Oruko', location: 'Urue-Offong, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-IPA', name: 'General Hospital, Ikpe Annang', location: 'Ikpe Annang, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-INI', name: 'General Hospital, Ini', location: 'Ini, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-IAB', name: 'General Hospital, Ikot Abasi', location: 'Ikot Abasi, Akwa Ibom', type: 'General Hospital' },
  { id: 'GH-MB2', name: 'General Hospital, Mbioto 2', location: 'Mbioto, Akwa Ibom', type: 'General Hospital' },
  { id: 'MSG-ITU', name: 'Mary Slessor General Hospital, Itu', location: 'Itu, Akwa Ibom', type: 'Mission Hospital' },
  { id: 'GH-UAI', name: 'General Hospital, Uruk Ata Ikot Ekpor', location: 'Ikot Ekpor, Akwa Ibom', type: 'General Hospital' },
  { id: 'QIC-EPO', name: 'QIC Leprosy Hospital, Ekpene Obom', location: 'Ekpene Obom, Akwa Ibom', type: 'Specialist Hospital' },
  { id: 'IDH-IKE', name: 'Infectious Disease Hospital, Ikot Ekpene', location: 'Ikot Ekpene, Akwa Ibom', type: 'Specialist Hospital' },
  { id: 'PSY-EKT', name: 'Psychiatric Hospital, Eket', location: 'Eket, Akwa Ibom', type: 'Specialist Hospital' },
  { id: 'CH-UKA', name: 'Cottage Hospital, Ukana', location: 'Ukana, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-IBN', name: 'Cottage Hospital, Ibeno', location: 'Ibeno, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-IAB', name: 'Cottage Hospital, Ikot Abia', location: 'Ikot Abia, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-IEP', name: 'Cottage Hospital, Ikot Ekpaw', location: 'Ikot Ekpaw, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-ASO', name: 'Cottage Hospital, Asong', location: 'Asong, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-EPO', name: 'Cottage Hospital, Ekpene Obo', location: 'Ekpene Obo, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-IEI', name: 'Cottage Hospital, Ikot Eko Ibon', location: 'Ikot Eko Ibon, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-EOB', name: 'Cottage Hospital, Eastern Obolo', location: 'Eastern Obolo, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-IEU', name: 'Cottage Hospital, Ikot Ekpene Udo', location: 'Ikot Ekpene Udo, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'RCH-IBS', name: 'Redeemer Cottage Hospital, Ibesit', location: 'Ibesit, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-AKU', name: 'Cottage Hospital, Akai Ubium', location: 'Akai Ubium, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CH-IKA', name: 'Cottage Hospital, Ika', location: 'Ika, Akwa Ibom', type: 'Cottage Hospital' },
  { id: 'CHC-NTE', name: 'Comprehensive Health Care Centre, Nto Edino', location: 'Nto Edino, Akwa Ibom', type: 'Health Care Centre' },
  { id: 'CHC-MBU', name: 'Comprehensive Health Care Centre, Mbiaya Uruan', location: 'Mbiaya Uruan, Akwa Ibom', type: 'Health Care Centre' },
];

/* ── Shared input focus handlers (match AuthScreen exactly) ─────────────── */
function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = '#0052D4';
  e.target.style.boxShadow = '0 0 0 3px rgba(0,82,212,0.10)';
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = '#E2E8F0';
  e.target.style.boxShadow = 'none';
}

/* ── Keyframe styles (injected once) ─────────────────────────────────────── */
const STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes regSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulseGreen {
    0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.35); }
    50%      { box-shadow: 0 0 0 8px rgba(16,185,129,0);  }
  }
  .reg-card { animation: fadeUp 0.32s cubic-bezier(0.22,1,0.36,1) both; }
  .reg-input {
    width: 100%;
    padding: 12px 14px 12px 42px;
    font-size: 0.88rem;
    color: #0A2540;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
    box-sizing: border-box;
  }
  .reg-input::placeholder { color: #94A3B8; }
  .reg-select {
    width: 100%;
    padding: 12px 36px 12px 42px;
    font-size: 0.86rem;
    color: #0A2540;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    font-weight: 600;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
    box-sizing: border-box;
  }
  /* ── Liquid Glass Motion Button ── */
  @keyframes liquidFlow {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes glassShimmer {
    0%   { transform: translateX(-120%) skewX(-15deg); opacity: 0; }
    30%  { opacity: 0.7; }
    100% { transform: translateX(240%) skewX(-15deg); opacity: 0; }
  }
  @keyframes regPulse {
    0%, 100% {
      box-shadow: 0 8px 32px rgba(0,82,212,0.38),
                  0 1px 0 rgba(255,255,255,0.28) inset,
                  0 -1px 0 rgba(0,0,0,0.10) inset;
    }
    50% {
      box-shadow: 0 14px 48px rgba(0,82,212,0.52),
                  0 0 0 6px rgba(0,82,212,0.08),
                  0 1px 0 rgba(255,255,255,0.32) inset,
                  0 -1px 0 rgba(0,0,0,0.12) inset;
    }
  }
  @keyframes liquidRipple {
    0%   { transform: scale(0); opacity: 0.55; }
    100% { transform: scale(4); opacity: 0; }
  }

  .reg-btn-primary {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 52px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.45);
    background: linear-gradient(
      135deg,
      rgba(0,82,212,0.82) 0%,
      rgba(0,140,200,0.80) 40%,
      rgba(0,191,165,0.80) 100%
    );
    background-size: 200% 200%;
    backdrop-filter: blur(14px) saturate(1.7);
    -webkit-backdrop-filter: blur(14px) saturate(1.7);
    color: #FFFFFF;
    font-weight: 800;
    font-size: 0.97rem;
    letter-spacing: 0.035em;
    text-shadow: 0 1px 3px rgba(0,0,0,0.22);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    animation: liquidFlow 5s ease infinite, regPulse 2.8s ease-in-out infinite;
    transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
                border-color 0.2s ease,
                filter 0.2s ease;
  }
  .reg-btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      180deg,
      rgba(255,255,255,0.26) 0%,
      rgba(255,255,255,0.06) 50%,
      rgba(255,255,255,0.00) 100%
    );
    pointer-events: none;
  }
  .reg-btn-primary::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 40%;
    border-radius: 0 0 16px 16px;
    background: linear-gradient(0deg, rgba(0,0,0,0.10) 0%, transparent 100%);
    pointer-events: none;
  }
  .reg-btn-primary:not(:disabled):hover {
    transform: translateY(-3px) scale(1.012);
    border-color: rgba(255,255,255,0.70);
    filter: brightness(1.08);
  }
  .reg-btn-primary:not(:disabled):active {
    transform: translateY(0) scale(0.985);
  }
  .reg-btn-primary:disabled {
    opacity: 0.68;
    background: #CBD5E1;
    border-color: #E2E8F0;
    box-shadow: none;
    cursor: not-allowed;
    color: #94A3B8;
    animation: none;
    filter: none;
  }
  .reg-lgb-shimmer {
    position: absolute;
    top: 0; left: 0;
    width: 60%;
    height: 100%;
    background: linear-gradient(
      105deg,
      transparent 25%,
      rgba(255,255,255,0.50) 50%,
      transparent 75%
    );
    animation: glassShimmer 3.2s ease-in-out infinite;
    pointer-events: none;
    border-radius: inherit;
  }
`;

export default function RegPage() {
  const [facilityId, setFacilityId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [badgeId, setBadgeId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [adminExists, setAdminExists] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [existingAdminName, setExistingAdminName] = useState('');
  const [done, setDone] = useState<{ badgeId: string; facilityName: string; fullName: string; email?: string } | null>(null);

  /* ── Auto-generate Badge ID matching hospital abbreviation ── */
  useEffect(() => {
    if (facilityId) {
      const match = FACILITIES.find((f) => f.id === facilityId);
      setBadgeId(nextPrintedBadgeId(facilityId, match?.name));
    } else {
      setBadgeId('');
    }
  }, [facilityId]);

  /* ── Real-time admin-exists check ─────────────────────────────────────── */
  const checkAdminExists = useCallback(async (fid: string) => {
    if (!fid) { setAdminExists(false); setExistingAdminName(''); return; }
    setCheckingAdmin(true);
    setAdminExists(false);
    try {
      const res = await fetch(`/api/staff?facilityId=${encodeURIComponent(fid)}`);
      if (res.ok) {
        const data = await res.json();
        const cards: Array<{ roleKey?: string; clearanceLevel?: number; fullName?: string; name?: string }> =
          data.staffCards ?? data.staff ?? [];
        const existing = cards.find((c) => c.roleKey === 'hospital_admin' || (c.clearanceLevel ?? 0) >= 5);
        if (existing) {
          setAdminExists(true);
          setExistingAdminName(existing.fullName || existing.name || 'Hospital Administrator');
        } else {
          setAdminExists(false);
          setExistingAdminName('');
        }
      }
    } catch { /* network error — do not block */ } finally {
      setCheckingAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (facilityId) checkAdminExists(facilityId);
    else { setAdminExists(false); setExistingAdminName(''); }
  }, [facilityId, checkAdminExists]);

  const selectedFacility = useMemo(() => FACILITIES.find((f) => f.id === facilityId) ?? null, [facilityId]);

  /* ── Password strength ─────────────────────────────────────────────────── */
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthLabel = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColor = ['', '#EF4444', '#F59E0B', '#10B981', '#0052D4'];

  /* ── Form validity ─────────────────────────────────────────────────────── */
  const isValid = useMemo(
    () => Boolean(facilityId) && fullName.trim().length >= 3 && password.length >= 6 && /^\d{4,6}$/.test(pin) && !adminExists && !checkingAdmin,
    [facilityId, fullName, password, pin, adminExists, checkingAdmin],
  );

  /* ── Submit ────────────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!facilityId) { setServerError('Please select your hospital / facility.'); return; }
    if (fullName.trim().length < 3) { setServerError('Full name must be at least 3 characters.'); return; }
    if (password.length < 6) { setServerError('Password must be at least 6 characters.'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setServerError('PIN must be 4–6 digits.'); return; }

    setSubmitting(true);
    try {
      const effectiveBadgeId = badgeId || nextPrintedBadgeId(facilityId, selectedFacility?.name);
      const body = {
        badgeId: effectiveBadgeId,
        facilityId,
        facilityName: selectedFacility?.name ?? facilityId,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        password,
        pin,
        role: 'Hospital Administrator',
        roleKey: 'hospital_admin',
        title: 'Hospital Administrator',
        department: 'Hospital Management',
        clearanceLevel: 5,
        clearanceLabel: 'Administrator',
        templateKey: 'TPL_CLINICAL',
      };
      const res = await fetch('/api/staff/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) { setServerError(data.error ?? 'Enrollment failed. Please try again.'); return; }

      const finalBadgeId = data.badgeId || effectiveBadgeId;

      /* Pre-save claimed facility & admin profile to localStorage so login recognizes it immediately */
      try {
        localStorage.setItem('medcore_claimed_facility_id', facilityId);
        localStorage.setItem('medcore_claimed_facility_name', selectedFacility?.name ?? facilityId);

        const adminEntry = {
          id: finalBadgeId,
          badgeId: finalBadgeId,
          name: fullName.trim(),
          fullName: fullName.trim(),
          role: 'Hospital Administrator',
          roleKey: 'hospital_admin',
          title: 'Hospital Administrator',
          department: 'Hospital Management',
          clearanceLevel: 5,
          clearanceLabel: 'Administrator',
          hospitalId: facilityId,
          facilityId,
          hospitalName: selectedFacility?.name ?? facilityId,
          facilityName: selectedFacility?.name ?? facilityId,
          email: email.trim() || undefined,
          pin,
          permissions: ['*'],
          status: 'ACTIVE',
        };

        const regRaw = localStorage.getItem('medcore_os_staff_registry') || '[]';
        const reg = JSON.parse(regRaw);
        const nextReg = [adminEntry, ...reg.filter((r: any) => String(r.badgeId || r.id).toUpperCase() !== finalBadgeId.toUpperCase())];
        localStorage.setItem('medcore_os_staff_registry', JSON.stringify(nextReg));
        localStorage.setItem('medcore_staff_registry', JSON.stringify(nextReg));

        const accessRaw = localStorage.getItem('medcore_os_access_control') || '[]';
        const access = JSON.parse(accessRaw);
        const accessRow = {
          id: finalBadgeId,
          name: fullName.trim(),
          role: 'Hospital Administrator',
          department: 'Hospital Management',
          status: 'Active',
          lastLogin: 'Never',
          permissions: ['*'],
        };
        const nextAccess = [accessRow, ...access.filter((a: any) => String(a.id).toUpperCase() !== finalBadgeId.toUpperCase())];
        localStorage.setItem('medcore_os_access_control', JSON.stringify(nextAccess));

        window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated', { detail: nextReg }));
        window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'staff' } }));
      } catch { /* ignore */ }

      setDone({
        badgeId: finalBadgeId,
        facilityName: selectedFacility?.name ?? facilityId,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
      });
    } catch (err) {
      setServerError('Network error. Check connection and try again.');
      console.error('[/reg] submit error', err);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      background: '#FFFFFF',
    }}>
      <style>{STYLES}</style>

      {/* ══════════════════════════════════════════════════════════════════
          LEFT — Hero image panel (exact mirror of AuthScreen left panel)
      ══════════════════════════════════════════════════════════════════ */}
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
          alt="MedCore Hospital OS — Akwa Ibom State Ministry of Health"
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 22%',
            display: 'block',
          }}
        />
        {/* Soft right-edge fade so hero meets form panel cleanly */}
        <div style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0,
          width: 56,
          background: 'linear-gradient(90deg, transparent, rgba(248,250,252,0.6))',
          pointerEvents: 'none',
        }} />

        {/* Floating info badge bottom-left */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          left: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderRadius: 12,
          background: 'rgba(10,37,64,0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#fff',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#10B981',
            animation: 'pulseGreen 2s ease-in-out infinite',
            display: 'inline-block', flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: '#A7F3D0', textTransform: 'uppercase' }}>
              Facility Enrollment Portal
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
              Akwa Ibom State Ministry of Health
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT — Auth form panel (exact mirror of AuthScreen right panel)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: '1 1 48%',
        position: 'relative',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 40px',
        background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
        overflowY: 'auto',
      }}>
        {/* Faint ECG watermark — exact copy from AuthScreen */}
        <svg
          style={{ position: 'absolute', top: 24, right: 30, opacity: 0.22, pointerEvents: 'none' }}
          width="190" height="80" viewBox="0 0 190 80" fill="none"
        >
          <path
            d="M0 40H50L60 12L74 68L88 28L98 52L108 40H190"
            stroke="#00A3BF" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>

        {/* ── Floating white card ─────────────────────────────────────── */}
        <div
          className="reg-card"
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#FFFFFF',
            borderRadius: 22,
            padding: done ? '36px 36px 28px' : '32px 36px 28px',
            boxShadow: '0 20px 50px rgba(10,37,64,0.07), 0 1px 4px rgba(0,0,0,0.04)',
            border: '1px solid #E2E8F0',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* ── Logo ─────────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img
              src="/authos-logo.png"
              alt="Hospital OS Logo"
              style={{ height: 58, display: 'inline-block', objectFit: 'contain' }}
            />
          </div>

          {/* ════════════════════════════════════════════════════════════
              SUCCESS STATE
          ════════════════════════════════════════════════════════════ */}
          {done ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Check icon */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(16,185,129,0.10)',
                  border: '2px solid rgba(16,185,129,0.30)',
                  marginBottom: 12,
                }}>
                  <CheckCircle2 size={34} color="#059669" strokeWidth={2} />
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '3px 12px',
                  borderRadius: 999,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#047857',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase' as const,
                  marginBottom: 8,
                }}>
                  Enrollment Verified &amp; Active
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0A2540', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  Administrator Enrolled
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>{done.facilityName}</p>
              </div>

              {/* Holographic credential badge — dark navy card */}
              <div style={{
                background: 'linear-gradient(135deg, #0B2545 0%, #0052D4 55%, #0D9488 100%)',
                borderRadius: 16,
                padding: '20px 22px',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0,82,212,0.32)',
              }}>
                {/* Shimmer overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%)',
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'absolute', right: -24, bottom: -24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative' }}>
                  <div>
                    <p style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#A7F3D0', margin: '0 0 4px' }}>
                      MedCore Smart ID
                    </p>
                    <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px' }}>{done.fullName}</p>
                    <p style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.72)', margin: 0 }}>Hospital Administrator · Level 5</p>
                  </div>
                  <BadgeCheck size={30} color="#A7F3D0" />
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Badge ID</p>
                    <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.08em', color: '#A7F3D0', margin: 0 }}>
                      {done.badgeId}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px',
                    borderRadius: 6, background: 'rgba(255,255,255,0.15)', color: '#fff',
                    letterSpacing: '0.04em',
                  }}>
                    Cloud Synced
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#64748B', textAlign: 'center', margin: '0', lineHeight: 1.6 }}>
                Your administrator account is now active across all hospital terminals and ready for immediate login.
              </p>

              {done.email && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '0.78rem', color: '#1E40AF', textAlign: 'center' }}>
                  Sign in with <strong>Staff ID</strong> <code style={{ fontFamily: 'monospace', background: '#DBEAFE', padding: '1px 6px', borderRadius: 4 }}>{done.badgeId}</code> + PIN, or your work email <strong>{done.email}</strong> + password.
                </div>
              )}

              <a
                href="/"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  height: 48, borderRadius: 10,
                  background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
                  color: '#0A2540', fontWeight: 700, fontSize: '0.96rem',
                  textDecoration: 'none',
                  boxShadow: '0 8px 20px rgba(0,82,212,0.28)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span>Sign In to Hospital OS</span>
                <ArrowRight size={18} />
              </a>

              <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#94A3B8', marginTop: -8 }}>
                Powered by <strong style={{ color: '#0A2540' }}>ARISE</strong> | <strong style={{ color: '#0A2540' }}>Ministry of Health</strong>
              </div>
            </div>
          ) : (
            /* ════════════════════════════════════════════════════════════
                ENROLLMENT FORM
            ════════════════════════════════════════════════════════════ */
            <>
              {/* Heading */}
              <h1 style={{
                fontSize: '1.55rem', fontWeight: 800, color: '#0A2540',
                textAlign: 'center', margin: '0 0 4px',
                fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em',
              }}>
                Facility Admin Enrollment
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#64748B', textAlign: 'center', margin: '0 0 20px' }}>
                Register administrator credentials for your health institution
              </p>

              {/* Server-side error */}
              {serverError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 8,
                  background: '#FEF2F2', border: '1px solid #FCA5A5',
                  color: '#B91C1C', fontSize: '0.82rem', marginBottom: 16,
                }}>
                  <AlertCircle size={15} />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── Hospital Facility ─────────────────────────────────── */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Hospital size={13} color="#0052D4" />
                      Hospital / Facility
                    </span>
                    {checkingAdmin && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#0052D4', fontWeight: 600 }}>
                        <Loader2 size={11} style={{ animation: 'regSpin 0.8s linear infinite' }} />
                        Verifying…
                      </span>
                    )}
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <Building2 size={18} color="#00A3BF" />
                    </div>
                    <select
                      className="reg-select"
                      value={facilityId}
                      onChange={(e) => setFacilityId(e.target.value)}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    >
                      <option value="">Select your hospital / facility…</option>
                      {['General Hospital', 'Mission Hospital', 'Specialist Hospital', 'Cottage Hospital', 'Health Care Centre'].map((grp) => (
                        <optgroup key={grp} label={grp}>
                          {FACILITIES.filter((f) => f.type === grp).map((f) => (
                            <option key={f.id} value={f.id}>{f.name} — {f.location}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div style={{ position: 'absolute', right: 12, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <ChevronDown size={15} color="#94A3B8" />
                    </div>
                  </div>

                  {/* Admin-exists warning */}
                  {adminExists && !checkingAdmin && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      marginTop: 8, padding: '9px 12px', borderRadius: 8,
                      background: '#FFFBEB', border: '1px solid #FCD34D',
                      fontSize: '0.78rem', color: '#92400E',
                    }}>
                      <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <strong>Administrator already registered</strong> — {existingAdminName} is active for this facility.{' '}
                        <a href="/" style={{ color: '#B45309', fontWeight: 700, textDecoration: 'underline' }}>Sign in →</a>
                      </div>
                    </div>
                  )}

                  {/* Available pill */}
                  {facilityId && !adminExists && !checkingAdmin && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      marginTop: 7, padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.30)',
                      fontSize: '0.72rem', fontWeight: 700, color: '#047857',
                    }}>
                      <Check size={12} color="#10B981" />
                      Available for enrollment · {selectedFacility?.type}
                    </div>
                  )}
                </div>

                {/* ── Full Name ─────────────────────────────────────────── */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    <User size={13} color="#64748B" />
                    Full Name &amp; Title
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <User size={18} color="#94A3B8" />
                    </div>
                    <input
                      type="text"
                      className="reg-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Dr. Ini Akpan"
                      autoComplete="name"
                      onFocus={onFocus as React.FocusEventHandler<HTMLInputElement>}
                      onBlur={onBlur as React.FocusEventHandler<HTMLInputElement>}
                    />
                  </div>
                </div>

                {/* ── Official Email (optional) ─────────────────────────── */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    <Mail size={13} color="#64748B" />
                    Official Email <span style={{ fontWeight: 400, color: '#94A3B8' }}>&nbsp;(optional)</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <Mail size={18} color="#94A3B8" />
                    </div>
                    <input
                      type="email"
                      className="reg-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@hospital.medcore.ng"
                      autoComplete="email"
                      onFocus={onFocus as React.FocusEventHandler<HTMLInputElement>}
                      onBlur={onBlur as React.FocusEventHandler<HTMLInputElement>}
                    />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '5px 0 0 2px' }}>
                    If omitted, system auto-binds to your Badge ID account.
                  </p>
                </div>

                {/* ── Password ─────────────────────────────────────────── */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                      <Lock size={13} color="#64748B" />
                      Sign-in Password
                    </label>
                    {password && (
                      <span style={{ fontSize: '0.70rem', fontWeight: 700, color: strengthColor[passwordStrength] }}>
                        {strengthLabel[passwordStrength]}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <Lock size={18} color="#94A3B8" />
                    </div>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="reg-input"
                      style={{ paddingRight: 42 }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                      onFocus={onFocus as React.FocusEventHandler<HTMLInputElement>}
                      onBlur={onBlur as React.FocusEventHandler<HTMLInputElement>}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex', alignItems: 'center' }}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 99,
                          background: i <= passwordStrength ? strengthColor[passwordStrength] : '#E2E8F0',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Badge Terminal PIN ────────────────────────────────── */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    <KeyRound size={13} color="#64748B" />
                    Badge Terminal PIN <span style={{ fontWeight: 400, color: '#94A3B8' }}>&nbsp;(4–6 digits)</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <KeyRound size={18} color="#94A3B8" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className="reg-input"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="e.g. 1234"
                      autoComplete="off"
                      onFocus={onFocus as React.FocusEventHandler<HTMLInputElement>}
                      onBlur={onBlur as React.FocusEventHandler<HTMLInputElement>}
                    />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '5px 0 0 2px' }}>
                    Enables fast tap-in authentication at physical hospital wards and desks.
                  </p>
                </div>

                {/* ── Assigned Badge ID preview ─────────────────────────── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(0,82,212,0.04)', border: '1px solid rgba(0,82,212,0.14)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BadgeCheck size={20} color="#0052D4" />
                    <div>
                      <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', margin: '0 0 2px' }}>Assigned Badge ID</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 800, color: '#0052D4', margin: 0 }}>{badgeId}</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.66rem', fontWeight: 800, padding: '3px 8px',
                    borderRadius: 5, background: 'rgba(13,148,136,0.10)',
                    color: '#0D9488', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                  }}>
                    L5 Admin
                  </span>
                </div>

                {/* ── Submit button ─────────────────────────────────────── */}
                <button
                  type="submit"
                  className="reg-btn-primary"
                  disabled={submitting || adminExists || !isValid}
                  style={{ marginTop: 2 }}
                  onClick={(e) => {
                    if (!submitting && !adminExists && isValid) {
                      const btn = e.currentTarget;
                      const circle = document.createElement('span');
                      const rect = btn.getBoundingClientRect();
                      const size = Math.max(rect.width, rect.height);
                      circle.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;border-radius:50%;background:rgba(255,255,255,0.35);animation:liquidRipple 0.7s ease-out forwards;pointer-events:none;`;
                      btn.appendChild(circle);
                      setTimeout(() => circle.remove(), 700);
                    }
                  }}
                >
                  {!submitting && !adminExists && isValid && <span className="reg-lgb-shimmer" aria-hidden="true" />}
                  {submitting ? (
                    <>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#FFFFFF', animation: 'regSpin 0.75s linear infinite' }} />
                      Creating Administrator Account…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Enroll Facility Administrator
                    </>
                  )}
                </button>

                {/* Already enrolled? */}
                <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
                  Already have credentials?{' '}
                  <a href="/" style={{ color: '#0284C7', fontWeight: 600, textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Sign in to MedCore OS →
                  </a>
                </div>
              </form>

              {/* Card footer */}
              <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.74rem', color: '#94A3B8' }}>
                Powered by <strong style={{ color: '#0A2540' }}>ARISE</strong> | <strong style={{ color: '#0A2540' }}>Akwa Ibom Ministry of Health</strong>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
