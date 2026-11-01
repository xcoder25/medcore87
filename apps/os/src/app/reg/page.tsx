'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

/* ── Facility list (mirrors AuthScreen.tsx HOSPITALS) ─────────────────────── */
interface Facility {
  id: string;
  name: string;
  location: string;
  type: string;
}

const FACILITIES: Facility[] = [
  { id: 'IGH-EKT',  name: 'Immanuel General Hospital, Eket',               location: 'Eket, Akwa Ibom',             type: 'General Hospital'    },
  { id: 'GH-IKE',  name: 'General Hospital, Ikot Ekpene',                  location: 'Ikot Ekpene, Akwa Ibom',      type: 'General Hospital'    },
  { id: 'GH-IQU',  name: 'General Hospital, Iquita Oron',                  location: 'Oron, Akwa Ibom',             type: 'General Hospital'    },
  { id: 'MGH-ITM', name: 'Methodist General Hospital, Ituk Mbang',         location: 'Ituk Mbang, Akwa Ibom',       type: 'Mission Hospital'    },
  { id: 'GH-ETN',  name: 'General Hospital, Etinan',                       location: 'Etinan, Akwa Ibom',           type: 'General Hospital'    },
  { id: 'GH-UAB',  name: 'General Hospital, Ukpom Abak',                   location: 'Abak, Akwa Ibom',             type: 'General Hospital'    },
  { id: 'GH-AWA',  name: 'General Hospital, Awa',                          location: 'Awa, Akwa Ibom',              type: 'General Hospital'    },
  { id: 'GH-IKO',  name: 'General Hospital, Ikot Okoro',                   location: 'Ikot Okoro, Akwa Ibom',       type: 'General Hospital'    },
  { id: 'GH-IKN',  name: 'General Hospital, Ikono',                        location: 'Ikono, Akwa Ibom',            type: 'General Hospital'    },
  { id: 'GH-AMM',  name: 'General Hospital, Amammong Okobo',               location: 'Okobo, Akwa Ibom',            type: 'General Hospital'    },
  { id: 'MCH-AKU', name: 'Mount Carmel Hospital, Akpa Utong',              location: 'Akpa Utong, Akwa Ibom',       type: 'Mission Hospital'    },
  { id: 'GH-URO',  name: 'General Hospital, Urue-Offong/Oruko',            location: 'Urue-Offong, Akwa Ibom',      type: 'General Hospital'    },
  { id: 'GH-IPA',  name: 'General Hospital, Ikpe Annang',                  location: 'Ikpe Annang, Akwa Ibom',      type: 'General Hospital'    },
  { id: 'GH-INI',  name: 'General Hospital, Ini',                          location: 'Ini, Akwa Ibom',              type: 'General Hospital'    },
  { id: 'GH-IAB',  name: 'General Hospital, Ikot Abasi',                   location: 'Ikot Abasi, Akwa Ibom',       type: 'General Hospital'    },
  { id: 'GH-MB2',  name: 'General Hospital, Mbioto 2',                     location: 'Mbioto, Akwa Ibom',           type: 'General Hospital'    },
  { id: 'MSG-ITU', name: 'Mary Slessor General Hospital, Itu',             location: 'Itu, Akwa Ibom',              type: 'Mission Hospital'    },
  { id: 'GH-UAI',  name: 'General Hospital, Uruk Ata Ikot Ekpor',         location: 'Ikot Ekpor, Akwa Ibom',       type: 'General Hospital'    },
  { id: 'QIC-EPO', name: 'QIC Leprosy Hospital, Ekpene Obom',              location: 'Ekpene Obom, Akwa Ibom',      type: 'Specialist Hospital' },
  { id: 'IDH-IKE', name: 'Infectious Disease Hospital, Ikot Ekpene',       location: 'Ikot Ekpene, Akwa Ibom',      type: 'Specialist Hospital' },
  { id: 'PSY-EKT', name: 'Psychiatric Hospital, Eket',                     location: 'Eket, Akwa Ibom',             type: 'Specialist Hospital' },
  { id: 'CH-UKA',  name: 'Cottage Hospital, Ukana',                        location: 'Ukana, Akwa Ibom',            type: 'Cottage Hospital'    },
  { id: 'CH-IBN',  name: 'Cottage Hospital, Ibeno',                        location: 'Ibeno, Akwa Ibom',            type: 'Cottage Hospital'    },
  { id: 'CH-IAB',  name: 'Cottage Hospital, Ikot Abia',                    location: 'Ikot Abia, Akwa Ibom',        type: 'Cottage Hospital'    },
  { id: 'CH-IEP',  name: 'Cottage Hospital, Ikot Ekpaw',                   location: 'Ikot Ekpaw, Akwa Ibom',       type: 'Cottage Hospital'    },
  { id: 'CH-ASO',  name: 'Cottage Hospital, Asong',                        location: 'Asong, Akwa Ibom',            type: 'Cottage Hospital'    },
  { id: 'CH-EPO',  name: 'Cottage Hospital, Ekpene Obo',                   location: 'Ekpene Obo, Akwa Ibom',       type: 'Cottage Hospital'    },
  { id: 'CH-IEI',  name: 'Cottage Hospital, Ikot Eko Ibon',                location: 'Ikot Eko Ibon, Akwa Ibom',    type: 'Cottage Hospital'    },
  { id: 'CH-EOB',  name: 'Cottage Hospital, Eastern Obolo',                location: 'Eastern Obolo, Akwa Ibom',    type: 'Cottage Hospital'    },
  { id: 'CH-IEU',  name: 'Cottage Hospital, Ikot Ekpene Udo',              location: 'Ikot Ekpene Udo, Akwa Ibom',  type: 'Cottage Hospital'    },
  { id: 'RCH-IBS', name: 'Redeemer Cottage Hospital, Ibesit',              location: 'Ibesit, Akwa Ibom',           type: 'Cottage Hospital'    },
  { id: 'CH-AKU',  name: 'Cottage Hospital, Akai Ubium',                   location: 'Akai Ubium, Akwa Ibom',       type: 'Cottage Hospital'    },
  { id: 'CH-IKA',  name: 'Cottage Hospital, Ika',                          location: 'Ika, Akwa Ibom',              type: 'Cottage Hospital'    },
  { id: 'CHC-NTE', name: 'Comprehensive Health Care Centre, Nto Edino',    location: 'Nto Edino, Akwa Ibom',        type: 'Health Care Centre'  },
  { id: 'CHC-MBU', name: 'Comprehensive Health Care Centre, Mbiaya Uruan', location: 'Mbiaya Uruan, Akwa Ibom',     type: 'Health Care Centre'  },
];

/* ── Badge ID generator ───────────────────────────────────────────────────── */
function generateBadgeId(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(1000 + Math.random() * 9000));
  return `AMC-${year}-${seq}`;
}

/* ── Field validation ─────────────────────────────────────────────────────── */
interface FieldErrors {
  facilityId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  pin?: string;
}

function validate(fields: {
  facilityId: string;
  fullName: string;
  email: string;
  password: string;
  pin: string;
}): FieldErrors {
  const errs: FieldErrors = {};
  if (!fields.facilityId) errs.facilityId = 'Select a facility';
  if (!fields.fullName.trim() || fields.fullName.trim().length < 3)
    errs.fullName = 'Full name must be at least 3 characters';
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errs.email = 'Enter a valid email address';
  if (!fields.password || fields.password.length < 6)
    errs.password = 'Password must be at least 6 characters';
  if (!fields.pin || !/^\d{4,6}$/.test(fields.pin))
    errs.pin = 'PIN must be 4–6 digits';
  return errs;
}

/* ── Micro icon plate ─────────────────────────────────────────────────────── */
function IconPlate({
  children,
  color = 'emerald',
}: {
  children: React.ReactNode;
  color?: 'emerald' | 'indigo' | 'rose' | 'slate';
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    indigo:  'bg-indigo-500/10  text-indigo-400  ring-indigo-500/20',
    rose:    'bg-rose-500/10    text-rose-400    ring-rose-500/20',
    slate:   'bg-slate-700/50   text-slate-400   ring-slate-600/30',
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ring-1 flex-shrink-0 ${colors[color]}`}
    >
      {children}
    </span>
  );
}

/* ── Input wrapper ────────────────────────────────────────────────────────── */
function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-slate-400">
        {icon}
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-400">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 ' +
  'transition-all duration-200 hover:border-slate-600';

const inputErrorCls =
  'w-full bg-slate-900/60 border border-rose-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/60 ' +
  'transition-all duration-200';

/* ══════════════════════════════════════════════════════════════════════════ */
export default function RegPage() {
  const [facilityId, setFacilityId] = useState('');
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [pin, setPin]               = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [badgeId]                   = useState(generateBadgeId);

  const [errors, setErrors]         = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [adminExists, setAdminExists] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [done, setDone]             = useState<{ badgeId: string; facilityName: string } | null>(null);

  /* Check if an admin already exists for the chosen facility */
  const checkAdminExists = useCallback(async (fid: string) => {
    if (!fid) return;
    setCheckingAdmin(true);
    setAdminExists(false);
    try {
      const res = await fetch(`/api/staff?facilityId=${encodeURIComponent(fid)}`);
      if (res.ok) {
        const data = await res.json();
        const cards: Array<{ roleKey?: string; clearanceLevel?: number }> =
          data.staffCards ?? data.staff ?? [];
        const hasAdmin = cards.some(
          (c) => c.roleKey === 'hospital_admin' || (c.clearanceLevel ?? 0) >= 5
        );
        setAdminExists(hasAdmin);
      }
    } catch {
      /* silently ignore — don't block enrollment on network error */
    } finally {
      setCheckingAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (facilityId) checkAdminExists(facilityId);
  }, [facilityId, checkAdminExists]);

  const selectedFacility = FACILITIES.find((f) => f.id === facilityId) ?? null;

  /* ── Submit ─────────────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    const errs = validate({ facilityId, fullName, email, password, pin });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

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

      setDone({ badgeId: data.badgeId, facilityName: selectedFacility?.name ?? facilityId });
    } catch (err) {
      setServerError('Network error — check your connection and try again.');
      console.error('[/reg] submit error', err);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (done) {
    return (
      <RegShell>
        <div className="flex flex-col items-center text-center py-6 space-y-6">
          {/* animated ring */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 size={44} strokeWidth={1.5} className="text-emerald-400" />
            </div>
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Admin Enrolled</h2>
            <p className="text-slate-400 text-sm mt-1">{done.facilityName}</p>
          </div>

          {/* Badge card */}
          <div className="w-full max-w-xs bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-2xl ring-1 ring-white/5">
            <div className="flex items-center gap-3">
              <IconPlate color="emerald">
                <BadgeCheck size={16} strokeWidth={1.75} />
              </IconPlate>
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Badge ID</p>
                <p className="text-lg font-mono font-bold text-emerald-400 tracking-wider">{done.badgeId}</p>
              </div>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} strokeWidth={1.75} className="text-indigo-400" />
              <span className="text-xs text-slate-300">Hospital Administrator · Clearance 5</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            Save your Badge ID — you will need it to sign in. Head to the login screen to access MedCore OS.
          </p>

          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-emerald-900/40"
          >
            <ArrowLeft size={15} />
            Go to Login
          </a>
        </div>
      </RegShell>
    );
  }

  /* ── Enrollment form ────────────────────────────────────────────────────── */
  return (
    <RegShell>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* ── Facility selector ─────────────────────────────────────────── */}
        <Field
          label="Facility"
          icon={<Building2 size={12} strokeWidth={1.75} />}
          error={errors.facilityId}
        >
          <div className="relative">
            <Hospital
              size={16}
              strokeWidth={1.75}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className={`${errors.facilityId ? inputErrorCls : inputCls} pl-10 appearance-none cursor-pointer`}
            >
              <option value="">Select your hospital / facility…</option>
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
            <ChevronRight
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none"
            />
          </div>

          {/* Admin-already-exists warning */}
          {checkingAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Loader2 size={11} className="animate-spin" />
              Checking facility status…
            </p>
          )}
          {adminExists && !checkingAdmin && (
            <div className="mt-2 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2.5">
              <ShieldCheck size={14} strokeWidth={1.75} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-300">Admin account already exists</p>
                <p className="text-[11px] text-amber-400/70 mt-0.5">
                  This facility already has an administrator.{' '}
                  <a href="/" className="underline hover:text-amber-200">Sign in instead →</a>
                </p>
              </div>
            </div>
          )}

          {/* Facility type chip */}
          {selectedFacility && !adminExists && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {selectedFacility.type} · {selectedFacility.location}
            </p>
          )}
        </Field>

        {/* ── Full name ─────────────────────────────────────────────────── */}
        <Field
          label="Full Name"
          icon={<User size={12} strokeWidth={1.75} />}
          error={errors.fullName}
        >
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Dr. Emeka Okafor"
            autoComplete="name"
            className={errors.fullName ? inputErrorCls : inputCls}
          />
        </Field>

        {/* ── Email (optional) ──────────────────────────────────────────── */}
        <Field
          label="Email Address (optional)"
          icon={<Mail size={12} strokeWidth={1.75} />}
          error={errors.email}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hospital.ng"
            autoComplete="email"
            className={errors.email ? inputErrorCls : inputCls}
          />
          <p className="text-[11px] text-slate-500 mt-0.5 pl-0.5">
            If left blank, a system email will be auto-generated from your Badge ID.
          </p>
        </Field>

        {/* ── Password ──────────────────────────────────────────────────── */}
        <Field
          label="Password"
          icon={<Lock size={12} strokeWidth={1.75} />}
          error={errors.password}
        >
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              className={`${errors.password ? inputErrorCls : inputCls} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
            </button>
          </div>
        </Field>

        {/* ── PIN ───────────────────────────────────────────────────────── */}
        <Field
          label="Badge PIN (4–6 digits)"
          icon={<KeyRound size={12} strokeWidth={1.75} />}
          error={errors.pin}
        >
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 1234"
            autoComplete="off"
            className={errors.pin ? inputErrorCls : inputCls}
          />
          <p className="text-[11px] text-slate-500 mt-0.5 pl-0.5">
            Used for quick tap-in authentication at physical terminals.
          </p>
        </Field>

        {/* ── Role display + Badge preview ──────────────────────────────── */}
        <div className="flex gap-3">
          {/* Role badge */}
          <div className="flex-1 flex items-center gap-3 bg-indigo-500/8 border border-indigo-500/20 rounded-xl px-4 py-3">
            <IconPlate color="indigo">
              <ShieldCheck size={15} strokeWidth={1.75} />
            </IconPlate>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Role</p>
              <p className="text-sm font-semibold text-indigo-300">Hospital Administrator</p>
            </div>
          </div>
          {/* Badge preview */}
          <div className="flex-1 flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3">
            <IconPlate color="emerald">
              <BadgeCheck size={15} strokeWidth={1.75} />
            </IconPlate>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Badge ID</p>
              <p className="text-sm font-mono font-bold text-emerald-400">{badgeId}</p>
            </div>
          </div>
        </div>

        {/* ── Server error ──────────────────────────────────────────────── */}
        {serverError && (
          <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3.5 py-3">
            <AlertCircle size={15} strokeWidth={1.75} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300">{serverError}</p>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting || adminExists}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold
            bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400
            disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
            text-white shadow-lg shadow-emerald-900/30 transition-all duration-200 active:scale-[0.98]"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating administrator account…
            </>
          ) : (
            <>
              <ShieldCheck size={16} strokeWidth={1.75} />
              Enroll Facility Administrator
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <a href="/" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Sign in to MedCore OS →
          </a>
        </p>
      </form>
    </RegShell>
  );
}

/* ── Shell wrapper with header ────────────────────────────────────────────── */
function RegShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0F1C] flex flex-col">
      {/* Ambient gradient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-600/5 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-md shadow-emerald-900/40">
            <Hospital size={16} strokeWidth={2} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight">MedCore OS</span>
            <span className="text-slate-500 text-xs ml-2">by Akwa Ibom MOH</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck size={11} strokeWidth={2} className="text-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Secure Enrollment</span>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Card header */}
          <div className="mb-7 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 shadow-xl mb-4 ring-1 ring-white/5">
              <ShieldCheck size={26} strokeWidth={1.5} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Facility Admin Enrollment</h1>
            <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
              Register the first administrator account for your hospital facility.
              <br />
              <span className="text-slate-500 text-xs">This portal is restricted to initial facility setup only.</span>
            </p>
          </div>

          {/* Glass form card */}
          <div className="bg-slate-900/70 border border-slate-700/50 rounded-2xl p-7 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-white/[0.03]">
            {children}
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-[11px] text-slate-600">
            MedCore OS · Akwa Ibom State Ministry of Health · Secure Platform v2
          </p>
        </div>
      </main>
    </div>
  );
}

