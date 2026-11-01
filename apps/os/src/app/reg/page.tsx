'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronRight,
  Hospital,
  BadgeCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ArrowLeft,
  Check,
  Shield,
  Layers,
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

/* ── Badge ID generator ───────────────────────────────────────────────────── */
function generateBadgeId(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(1000 + Math.random() * 9000));
  return `AMC-${year}-${seq}`;
}

export default function RegPage() {
  const [facilityId, setFacilityId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [badgeId] = useState(generateBadgeId);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [adminExists, setAdminExists] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [existingAdminName, setExistingAdminName] = useState('');
  const [done, setDone] = useState<{ badgeId: string; facilityName: string; fullName: string } | null>(null);

  /* Real-time check if an admin already exists for the chosen facility */
  const checkAdminExists = useCallback(async (fid: string) => {
    if (!fid) {
      setAdminExists(false);
      setExistingAdminName('');
      return;
    }
    setCheckingAdmin(true);
    setAdminExists(false);
    try {
      const res = await fetch(`/api/staff?facilityId=${encodeURIComponent(fid)}`);
      if (res.ok) {
        const data = await res.json();
        const cards: Array<{ roleKey?: string; clearanceLevel?: number; fullName?: string; name?: string }> =
          data.staffCards ?? data.staff ?? [];
        const existing = cards.find(
          (c) => c.roleKey === 'hospital_admin' || (c.clearanceLevel ?? 0) >= 5
        );
        if (existing) {
          setAdminExists(true);
          setExistingAdminName(existing.fullName || existing.name || 'Hospital Administrator');
        } else {
          setAdminExists(false);
          setExistingAdminName('');
        }
      }
    } catch {
      /* network error — do not block */
    } finally {
      setCheckingAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (facilityId) {
      checkAdminExists(facilityId);
    } else {
      setAdminExists(false);
      setExistingAdminName('');
    }
  }, [facilityId, checkAdminExists]);

  const selectedFacility = useMemo(() => FACILITIES.find((f) => f.id === facilityId) ?? null, [facilityId]);

  /* Real-time password strength computation */
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  /* Form validation */
  const isValid = useMemo(() => {
    return (
      Boolean(facilityId) &&
      fullName.trim().length >= 3 &&
      password.length >= 6 &&
      /^\d{4,6}$/.test(pin) &&
      !adminExists &&
      !checkingAdmin
    );
  }, [facilityId, fullName, password, pin, adminExists, checkingAdmin]);

  /* Submit handler */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    if (!facilityId) {
      setServerError('Please select your hospital / facility.');
      return;
    }
    if (fullName.trim().length < 3) {
      setServerError('Full name must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setServerError('Password must be at least 6 characters.');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setServerError('PIN must be 4–6 digits.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        badgeId,
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

      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error ?? 'Enrollment failed. Please try again.');
        return;
      }

      // Pre-save to localStorage so login screen remembers enrolled facility
      try {
        localStorage.setItem('medcore_claimed_facility_id', facilityId);
        localStorage.setItem('medcore_claimed_facility_name', selectedFacility?.name ?? facilityId);
      } catch { /* ignore */ }

      setDone({
        badgeId: data.badgeId,
        facilityName: selectedFacility?.name ?? facilityId,
        fullName: fullName.trim(),
      });
    } catch (err) {
      setServerError('Network error. Check connection and try again.');
      console.error('[/reg] submit error', err);
    } finally {
      setSubmitting(false);
    }
  }

          return (
          <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
            {/* ── Background: authos-hero.png with ambient liquid-glass fade ── */}
            <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden" aria-hidden>
              <img
                src="/authos-hero.png"
                alt="MedCore Hospital OS"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-[center_20%] scale-[1.02] filter brightness-[0.92] contrast-[1.05]"
              />
              {/* Soft liquid color fade overlays */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#0A192F]/80 via-[#0B2545]/60 to-[#0D9488]/30 backdrop-blur-[2px]" />
              <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#0A192F]/40 to-[#0A192F]/90" />
            </div>

            {/* Floating luminous liquid light orbs */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden>
              <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl" />
            </div>

            {/* ── Top Bar ── */}
            <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/20 bg-white/10 backdrop-blur-md shadow-sm">
              <div className="flex items-center gap-3">
                <img src="/authos-logo.png" alt="Hospital OS Logo" className="h-7 w-auto object-contain drop-shadow" />
                <div className="h-4 w-px bg-white/30" />
                <span className="text-xs font-semibold text-white/90 tracking-wide">
                  Akwa Ibom State Ministry of Health
                </span>
              </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/30 backdrop-blur-md shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                Realtime Enrollment
              </span>
            </div>
          </header>

                    {/* ── Main Liquid Glass Card ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
                    <div className="w-full max-w-lg transition-all duration-300">
                      {done ? (
            /* ── Success State: Liquid Glass Active ID Card ── */
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(32px) saturate(200%)',
                WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                border: '1.5px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0 30px 90px rgba(0, 82, 212, 0.28), 0 4px 24px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9)',
              }}
              className="rounded-3xl p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300"
            >
                    <div className="relative inline-flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 size={42} strokeWidth={2} className="text-emerald-600" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow">
                        <Sparkles size={13} />
                      </span>
                    </div>

                        <div>
                          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest border border-emerald-200 mb-2">
                            Enrollment Verified & Active
                          </span>
                          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                            Facility Admin Enrolled
                          </h2>
                          <p className="text-slate-600 text-sm mt-1">{done.facilityName}</p>
                        </div>

                  {/* Holographic Credential Badge */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #0B2545 0%, #0052D4 50%, #0D9488 100%)',
                      boxShadow: '0 16px 40px rgba(0, 82, 212, 0.35)',
                    }}
                    className="rounded-2xl p-6 text-white text-left relative overflow-hidden"
                  >
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                          MedCore Smart ID
                        </p>
                        <p className="text-lg font-bold mt-0.5">{done.fullName}</p>
                        <p className="text-xs text-blue-100/90 font-medium">Hospital Administrator · L5</p>
                      </div>
                      <BadgeCheck size={32} className="text-emerald-300" />
                    </div>

                    <div className="pt-3 border-t border-white/20 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-white/70">Badge ID</p>
                        <p className="text-xl font-mono font-extrabold tracking-wider text-emerald-300">
                          {done.badgeId}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-white/15 text-white">
                        Cloud Synced
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                    Your administrator account is now active across all hospital terminals and ready for immediate login.
                  </p>

              <div className="pt-2">
                        <a
                          href="/"
                          className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-bold text-sm text-white shadow-xl shadow-blue-600/30 transition-all duration-200 active:scale-[0.98]"
                          style={{
                            background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
                          }}
                        >
                          <span>Sign In to Hospital OS</span>
                          <ArrowRight size={16} />
                        </a>
                      </div>
                    </div>
                    ) : (
                    /* ── Form: Liquid Glass Container ── */
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.86)',
                        backdropFilter: 'blur(36px) saturate(210%)',
                        WebkitBackdropFilter: 'blur(36px) saturate(210%)',
                        border: '1.5px solid rgba(255, 255, 255, 0.85)',
                        boxShadow: '0 30px 90px rgba(0, 82, 212, 0.28), 0 4px 24px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9)',
                      }}
                      className="rounded-3xl p-7 sm:p-9 shadow-2xl transition-all"
                    >
              {/* Form Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white shadow-md shadow-blue-500/25 mb-3 p-3">
                  <ShieldCheck size={28} strokeWidth={2} />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Facility Admin Enrollment
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Initialize administrator credentials for your health institution
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* ── Facility Selector ── */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Hospital size={14} className="text-blue-600" />
                      Hospital Facility
                    </span>
                    {checkingAdmin && (
                      <span className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold animate-pulse">
                        <Loader2 size={11} className="animate-spin" /> Verifying...
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      value={facilityId}
                      onChange={(e) => setFacilityId(e.target.value)}
                      className="w-full bg-white/90 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 shadow-sm transition"
                    >
                      <option value="">Select your hospital / facility...</option>
                      {['General Hospital', 'Mission Hospital', 'Specialist Hospital', 'Cottage Hospital', 'Health Care Centre'].map(
                        (grp) => (
                          <optgroup key={grp} label={grp}>
                            {FACILITIES.filter((f) => f.type === grp).map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} — {f.location}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </select>
                    <ChevronRight size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                  </div>

                  {/* Realtime facility status banner */}
                  {adminExists && !checkingAdmin && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 animate-in fade-in duration-200">
                      <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold">Administrator Already Registered</p>
                        <p className="mt-0.5 text-amber-800">
                          {existingAdminName} is active for this facility.{' '}
                          <a href="/" className="font-bold underline hover:text-amber-950">
                            Sign In to station →
                          </a>
                        </p>
                      </div>
                    </div>
                  )}

                  {facilityId && !adminExists && !checkingAdmin && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                      <Check size={13} className="text-emerald-600" />
                      <span>Ready for enrollment · {selectedFacility?.type}</span>
                    </div>
                  )}
                </div>

                {/* ── Full Name ── */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <User size={14} className="text-blue-600" />
                    Full Name &amp; Title
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Ini Akpan"
                    autoComplete="name"
                    className="w-full bg-white/90 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 shadow-sm transition"
                  />
                </div>

          {/* ── Email (optional) ── */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Mail size={14} className="text-blue-600" />
              Official Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hospital.medcore.ng"
              autoComplete="email"
              className="w-full bg-white/90 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 shadow-sm transition"
            />
            <p className="text-[11px] text-slate-500 pl-0.5">
              If omitted, system auto-binds to your Badge ID account.
            </p>
          </div>

            {/* ── Password ── */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Lock size={14} className="text-blue-600" />
                  Sign-in Password
                </span>
                {password && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    Strength: {['Too short', 'Weak', 'Fair', 'Strong', 'Very Strong'][passwordStrength]}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  className="w-full bg-white/90 border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 shadow-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* ── PIN ── */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <KeyRound size={14} className="text-blue-600" />
                Badge Terminal PIN (4–6 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="e.g. 1234"
                autoComplete="off"
                className="w-full bg-white/90 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-600 shadow-sm transition"
              />
              <p className="text-[11px] text-slate-500 pl-0.5">
                Enables fast tap-in authentication at physical hospital wards and desks.
              </p>
            </div>

                {/* ── Realtime Badge ID Preview ── */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={18} className="text-blue-600" />
                    <div>
                      <p className="font-bold text-slate-800">Assigned Badge ID</p>
                      <p className="font-mono font-bold text-blue-700 text-sm">{badgeId}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded">
                    L5 Admin
                  </span>
                </div>

                {/* ── Error message ── */}
                {serverError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs">
                    <AlertCircle size={15} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}

                {/* ── Submit Button ── */}
                <button
                  type="submit"
                  disabled={submitting || adminExists || !isValid}
                  style={{
                    background:
                      submitting || adminExists || !isValid
                        ? '#94A3B8'
                        : 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg shadow-blue-600/25 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating Administrator Account...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Enroll Facility Administrator
                    </>
                  )}
                </button>

                <div className="pt-2 text-center text-xs text-slate-600">
                  Already have hospital credentials?{' '}
                  <a href="/" className="font-bold text-blue-600 hover:text-blue-700 underline transition">
                    Sign in to MedCore OS →
                  </a>
                </div>
              </form>
          </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */ }
    <footer className="relative z-10 py-3 text-center text-xs text-white/80 font-medium drop-shadow">
      Powered by <strong className="text-white">ARISE</strong> | <strong className="text-white">Akwa Ibom State Ministry of Health</strong>
    </footer>
    </div >
  );
  }
