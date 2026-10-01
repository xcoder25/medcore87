'use client';

/**
 * World-class Reception OS cockpit
 * FIND → VERIFY → REGISTER → CHECK-IN → BILL → QUEUE → DIRECT → COMPLETE
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Search, UserPlus, CreditCard, Calendar, Users, Ticket, AlertTriangle,
  QrCode, Clock, Building2, CheckCircle2, ArrowRight, Printer, X,
  ChevronRight, Phone, MapPin, Wallet, Activity, Sparkles, Command,
} from 'lucide-react';
import {
  listPatients,
  upsertPatient,
  subscribePatients,
  generateHospitalNumber,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import {
  todayVisits,
  dayStats,
  checkInPatient,
  updateVisitStatus,
  subscribeReceptionOps,
  type ReceptionVisit,
  type VisitType,
} from '../../lib/receptionOpsStore';
import { emitLiveAction } from '../../lib/liveActions';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

type View =
  | 'home'
  | 'search'
  | 'register'
  | 'checkin'
  | 'walkin'
  | 'queue'
  | 'payment'
  | 'success';

type RegStep = 1 | 2 | 3 | 4 | 5;

const DEPTS = ['General OPD', 'Pediatrics', 'Dental', 'Laboratory', 'Pharmacy', 'Radiology', 'Emergency'];

const emptyReg = {
  firstName: '',
  lastName: '',
  dob: '',
  sex: 'Female' as FacilityPatient['sex'],
  phone: '',
  email: '',
  address: '',
  state: 'Akwa Ibom',
  lga: '',
  emergencyContact: '',
  emergencyRelation: '',
  category: 'General',
  insuranceProvider: '',
  insuranceId: '',
  nhiaNumber: '',
  nin: '',
};

export const ReceptionWorkspace: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const facilityName = session.facility || 'Hospital';
  const firstName = (session.name || 'Reception').split(' ')[0];

  const [view, setView] = useState<View>('home');
  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [visits, setVisits] = useState<ReceptionVisit[]>([]);
  const [stats, setStats] = useState(dayStats(facilityId));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FacilityPatient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [regStep, setRegStep] = useState<RegStep>(1);
  const [reg, setReg] = useState(emptyReg);
  const [dupes, setDupes] = useState<FacilityPatient[]>([]);
  const [created, setCreated] = useState<FacilityPatient | null>(null);
  const [lastVisit, setLastVisit] = useState<ReceptionVisit | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Check-in form state
  const [ciDept, setCiDept] = useState('General OPD');
  const [ciDoctor, setCiDoctor] = useState('Any available');
  const [ciType, setCiType] = useState<VisitType>('appointment');
  const [ciPay, setCiPay] = useState<ReceptionVisit['paymentStatus']>('pending');
  const [ciAmount, setCiAmount] = useState('12000');
  const [ciReason, setCiReason] = useState('Consultation');

  const reload = useCallback(() => {
    setPatients(listPatients(facilityId));
    setVisits(todayVisits(facilityId));
    setStats(dayStats(facilityId));
  }, [facilityId]);

  useEffect(() => {
    reload();
    const u1 = subscribePatients(reload);
    const u2 = subscribeReceptionOps(reload);
    return () => {
      u1();
      u2();
    };
  }, [reload]);

  // Global ⌘K / Ctrl+K → search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView('search');
        setQuery('');
      }
      if (e.key === 'Escape') {
        if (panelOpen) setPanelOpen(false);
        else if (view !== 'home') setView('home');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, view]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const nowLabel = useMemo(
    () =>
      new Date().toLocaleString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.hospitalNumber.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.nhiaNumber || '').toLowerCase().includes(q) ||
          (p.nin || '').includes(q)
      )
      .slice(0, 20);
  }, [patients, query]);

  const openPatient = (p: FacilityPatient) => {
    setSelected(p);
    setPanelOpen(true);
    setView('home');
  };

  const fullName = (p: FacilityPatient) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

  const journeyOf = (p: FacilityPatient) => {
    const v = visits.find((x) => x.patientId === p.id);
    return {
      registered: true,
      checkedIn: !!v,
      payment: v?.paymentStatus === 'paid' || v?.paymentStatus === 'hmo' || v?.paymentStatus === 'waived',
      waiting: v?.status === 'waiting' || v?.status === 'called',
      withDoctor: v?.status === 'with_provider',
      completed: v?.status === 'completed',
      visit: v,
    };
  };

  // Registration wizard
  const findDupes = () => {
    const phone = reg.phone.trim();
    const name = `${reg.firstName} ${reg.lastName}`.toLowerCase();
    const hits = patients.filter(
      (p) =>
        (phone && p.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) ||
        `${p.firstName} ${p.lastName}`.toLowerCase() === name
    );
    setDupes(hits);
    return hits;
  };

  const finishRegister = (forceNew = false) => {
    if (!forceNew) {
      const d = findDupes();
      if (d.length) {
        setRegStep(4);
        return;
      }
    }
    const hospitalNumber = generateHospitalNumber(facilityId);
    const patient: FacilityPatient = {
      id: hospitalNumber,
      hospitalNumber,
      firstName: reg.firstName.trim(),
      lastName: reg.lastName.trim(),
      dob: reg.dob,
      sex: reg.sex,
      phone: reg.phone.trim(),
      email: reg.email.trim() || undefined,
      address: reg.address.trim() || undefined,
      state: reg.state,
      lga: reg.lga.trim() || undefined,
      emergencyContact: reg.emergencyContact.trim() || undefined,
      emergencyRelation: reg.emergencyRelation.trim() || undefined,
      nhiaNumber: reg.nhiaNumber.trim() || undefined,
      nin: reg.nin.trim() || undefined,
      insuranceProvider: reg.insuranceProvider.trim() || undefined,
      insuranceId: reg.insuranceId.trim() || undefined,
      category: reg.category,
      facilityId,
      facilityName,
      status: 'active',
      registeredAt: new Date().toISOString(),
    };
    upsertPatient(patient);
    setCreated(patient);
    setSelected(patient);
    setRegStep(5);
    reload();
    emitLiveAction(`Registered ${patient.hospitalNumber}`, { module: 'reception' });
    flash(`Patient created · ${patient.hospitalNumber}`);
  };

  const doCheckIn = () => {
    if (!selected) return;
    const visit = checkInPatient({
      patient: selected,
      facilityId,
      department: ciDept,
      doctor: ciDoctor,
      visitType: ciType,
      reason: ciReason,
      paymentStatus: ciPay,
      amount: ciPay === 'paid' ? Number(ciAmount) || 0 : undefined,
      appointmentTime: undefined,
    });
    setLastVisit(visit);
    setView('success');
    setPanelOpen(false);
    reload();
    emitLiveAction(`Check-in ${visit.queueNumber} · ${visit.patientName}`, { module: 'reception' });
  };

  const kpi = [
    { label: 'Patients today', value: String(stats.patientsHandled || '—'), tone: '#0052D4' },
    { label: 'Appointments', value: String(stats.appointments || '—'), tone: '#7C3AED' },
    { label: 'Waiting', value: String(stats.waiting || '—'), tone: '#D97706' },
    { label: 'Check-ins', value: String(stats.checkIns || '—'), tone: '#059669' },
  ];

  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called');

  return (
    <div className="os-mpi-shell" style={{ maxWidth: 1120, position: 'relative' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 10000,
            background: '#fff',
            border: '1px solid #86EFAC',
            color: '#047857',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* ── HOME ── */}
      {view === 'home' && (
        <>
          <div className="os-mpi-hero">
            <div>
              <div className="os-chip">Reception · Front desk</div>
              <h1>
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
                {firstName}
              </h1>
              <div className="os-mpi-hero-meta">
                <span>{nowLabel}</span>
                <span>{facilityName}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#86EFAC' }} /> Online
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="os-ghost-btn" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }} onClick={() => setView('search')}>
                <Search size={14} /> Search <kbd style={{ marginLeft: 6, opacity: 0.8, fontSize: 10 }}>⌘K</kbd>
              </button>
              <button type="button" className="os-ghost-btn" style={{ background: '#fff', color: '#0284C7', borderColor: '#fff', fontWeight: 800 }} onClick={() => { setReg(emptyReg); setRegStep(1); setCreated(null); setView('register'); }}>
                <UserPlus size={14} /> Register
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'Register patient', icon: UserPlus, act: () => { setReg(emptyReg); setRegStep(1); setView('register'); }, primary: true },
              { label: 'Scan ID / QR', icon: QrCode, act: () => setView('search') },
              { label: 'New appointment', icon: Calendar, act: () => { setView('search'); flash('Find patient first, then book'); } },
              { label: 'Walk-in', icon: Users, act: () => setView('walkin') },
              { label: 'Live queue', icon: Ticket, act: () => setView('queue') },
              { label: 'Take payment', icon: CreditCard, act: () => setView('payment') },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} type="button" className={a.primary ? 'os-primary-btn' : 'os-ghost-btn'} onClick={a.act}>
                  <Icon size={14} /> {a.label}
                </button>
              );
            })}
          </div>

          {/* KPIs — max 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {kpi.map((k) => (
              <div key={k.label} className="os-card" style={{ padding: '16px 16px', borderTop: `3px solid ${k.tone}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#94A3B8', textTransform: 'uppercase' }}>{k.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0A2540', marginTop: 4, fontFamily: 'var(--os-font-heading)', letterSpacing: '-0.03em' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Command search teaser */}
          <button
            type="button"
            onClick={() => setView('search')}
            className="os-card"
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              border: '1px solid rgba(2,132,199,0.2)',
              background: 'linear-gradient(90deg, #F0F9FF, #FFFFFF)',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <Command size={18} color="#0284C7" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#0A2540' }}>Find patient</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Name, hospital no., phone, NIN, QR · or press ⌘K</div>
            </div>
            <ChevronRight size={16} color="#94A3B8" />
          </button>

          {/* Live queue snapshot */}
          <div className="os-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Live queue</div>
              <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => setView('queue')}>
                Open full queue <ArrowRight size={12} />
              </button>
            </div>
            {waiting.length === 0 ? (
              <div className="os-empty-state" style={{ padding: 24 }}>
                No one waiting. Check in a patient to assign the next queue number.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {waiting.slice(0, 5).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--os-font-mono)', fontWeight: 800, color: '#0284C7', minWidth: 52 }}>{v.queueNumber}</span>
                    <span style={{ fontWeight: 700, flex: 1 }}>{v.patientName}</span>
                    <span style={{ color: '#64748B' }}>{v.department}</span>
                    <span style={{ color: '#D97706', fontWeight: 700, fontSize: 12 }}>{v.estimatedWaitMin}m</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assistant strip */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #EEF2FF, #F0FDFA)',
              border: '1px solid rgba(99,102,241,0.15)',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              fontSize: 13,
              color: '#334155',
            }}
          >
            <Sparkles size={16} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: '#0A2540' }}>Reception assistant</strong>
              <div style={{ marginTop: 4, lineHeight: 1.5 }}>
                {stats.waiting > 0
                  ? `${stats.waiting} patient${stats.waiting === 1 ? '' : 's'} waiting. Prefer check-in → queue over opening clinical modules.`
                  : 'Queue is clear. Use Find patient (⌘K) or Register for the next arrival.'}{' '}
                Flow: <strong>Find → Verify → Register → Check-in → Bill → Queue</strong>.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SEARCH ── */}
      {view === 'search' && (
        <div className="os-card" style={{ padding: 20, maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Find patient</div>
            <button type="button" className="os-ghost-btn" onClick={() => setView('home')}><X size={16} /></button>
          </div>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#0284C7' }} />
            <input
              autoFocus
              className="os-search-input"
              style={{ width: '100%', padding: '14px 14px 14px 42px', fontSize: 15, borderRadius: 12 }}
              placeholder="Name, ID, phone, appointment, QR…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#94A3B8', marginBottom: 8 }}>
            {query ? 'RESULTS' : 'RECENT / ALL'}
          </div>
          {searchHits.length === 0 ? (
            <div className="os-empty-state">
              No matches. <button type="button" className="os-primary-btn" style={{ marginTop: 12 }} onClick={() => { setReg(emptyReg); setRegStep(1); setView('register'); }}>Register new patient</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
              {searchHits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="os-mpi-list-item"
                  onClick={() => openPatient(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 12px',
                    border: 'none',
                    background: '#fff',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #E0F2FE, #CCFBF1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      color: '#0284C7',
                      fontSize: 13,
                    }}
                  >
                    {(p.firstName[0] || '') + (p.lastName[0] || '')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{fullName(p)}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      {p.hospitalNumber} · {p.phone}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#CBD5E1" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── REGISTER WIZARD ── */}
      {view === 'register' && (
        <div className="os-card os-register-panel" style={{ padding: 22, maxWidth: 520, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              {regStep === 5 ? 'Patient created' : 'Create patient'}
            </div>
            <button type="button" className="os-ghost-btn" onClick={() => setView('home')}><X size={16} /></button>
          </div>
          {regStep < 5 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 4,
                    background: regStep >= s ? 'linear-gradient(90deg,#0284C7,#00BFA5)' : '#E2E8F0',
                  }}
                />
              ))}
            </div>
          )}

          {regStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Step 1 — Identity</div>
              {(['firstName', 'lastName', 'dob', 'phone'] as const).map((key) => (
                <label key={key} style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                  {key === 'firstName' ? 'First name' : key === 'lastName' ? 'Last name' : key === 'dob' ? 'Date of birth' : 'Phone'}
                  <input
                    className="os-search-input"
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '11px 12px' }}
                    type={key === 'dob' ? 'date' : 'text'}
                    value={reg[key]}
                    onChange={(e) => setReg((r) => ({ ...r, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                Gender
                <select className="os-form-select" style={{ display: 'block', width: '100%', marginTop: 6 }} value={reg.sex} onChange={(e) => setReg((r) => ({ ...r, sex: e.target.value as FacilityPatient['sex'] }))}>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <button
                type="button"
                className="os-primary-btn"
                style={{ marginTop: 8 }}
                onClick={() => {
                  if (!reg.firstName.trim() || !reg.lastName.trim() || !reg.phone.trim()) {
                    flash('First name, last name and phone are required');
                    return;
                  }
                  setRegStep(2);
                }}
              >
                Continue <ArrowRight size={14} />
              </button>
            </div>
          )}

          {regStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>Step 2 — Contact</div>
              {(['email', 'address', 'lga', 'state', 'emergencyContact', 'emergencyRelation'] as const).map((key) => (
                <label key={key} style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                  {key}
                  <input
                    className="os-search-input"
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '11px 12px' }}
                    value={reg[key]}
                    onChange={(e) => setReg((r) => ({ ...r, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setRegStep(1)}>Back</button>
                <button type="button" className="os-primary-btn" style={{ flex: 1 }} onClick={() => setRegStep(3)}>Continue</button>
              </div>
            </div>
          )}

          {regStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>Step 3 — Administrative</div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                Patient type
                <select className="os-form-select" style={{ display: 'block', width: '100%', marginTop: 6 }} value={reg.category} onChange={(e) => setReg((r) => ({ ...r, category: e.target.value }))}>
                  <option>General</option>
                  <option>Paediatric</option>
                  <option>Antenatal</option>
                  <option>HMO</option>
                  <option>Emergency</option>
                </select>
              </label>
              {(['nhiaNumber', 'nin', 'insuranceProvider', 'insuranceId'] as const).map((key) => (
                <label key={key} style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                  {key === 'nhiaNumber' ? 'AKSHIA / NHIA' : key === 'nin' ? 'NIN' : key === 'insuranceProvider' ? 'HMO' : 'Insurance ID'}
                  <input className="os-search-input" style={{ display: 'block', width: '100%', marginTop: 6, padding: '11px 12px' }} value={reg[key]} onChange={(e) => setReg((r) => ({ ...r, [key]: e.target.value }))} />
                </label>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setRegStep(2)}>Back</button>
                <button type="button" className="os-primary-btn" style={{ flex: 1 }} onClick={() => finishRegister(false)}>Review & create</button>
              </div>
            </div>
          )}

          {regStep === 4 && (
            <div>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Potential duplicate</div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Match on name or phone. Use existing record to avoid double folders.</div>
              {dupes.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="os-ghost-btn"
                  style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, padding: 12 }}
                  onClick={() => {
                    openPatient(d);
                    setView('home');
                    flash('Opened existing patient');
                  }}
                >
                  {fullName(d)} · {d.hospitalNumber} · {d.phone}
                </button>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setRegStep(3)}>Back</button>
                <button type="button" className="os-primary-btn" style={{ flex: 1 }} onClick={() => finishRegister(true)}>
                  No — create new patient
                </button>
              </div>
            </div>
          )}

          {regStep === 5 && created && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle2 size={28} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>Patient created successfully</div>
              <div style={{ fontFamily: 'var(--os-font-mono)', fontWeight: 800, color: '#0284C7', fontSize: '1.25rem', margin: '10px 0' }}>{created.hospitalNumber}</div>
              <div style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>{fullName(created)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="os-primary-btn" onClick={() => { setSelected(created); setView('checkin'); }}>Check in now</button>
                <button type="button" className="os-ghost-btn" onClick={() => { openPatient(created); }}>Open patient panel</button>
                <button type="button" className="os-ghost-btn" onClick={() => setView('home')}>Done</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHECK-IN ── */}
      {view === 'checkin' && selected && (
        <div className="os-card" style={{ padding: 22, maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>Check-in</div>
            <button type="button" className="os-ghost-btn" onClick={() => setView('home')}><X size={16} /></button>
          </div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{fullName(selected)}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>{selected.hospitalNumber}</div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 10 }}>
            Department
            <select className="os-form-select" style={{ display: 'block', width: '100%', marginTop: 6 }} value={ciDept} onChange={(e) => setCiDept(e.target.value)}>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 10 }}>
            Doctor
            <input className="os-search-input" style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }} value={ciDoctor} onChange={(e) => setCiDoctor(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 10 }}>
            Visit type
            <select className="os-form-select" style={{ display: 'block', width: '100%', marginTop: 6 }} value={ciType} onChange={(e) => setCiType(e.target.value as VisitType)}>
              <option value="appointment">Appointment</option>
              <option value="walk_in">Walk-in</option>
              <option value="follow_up">Follow-up</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 16 }}>
            Payment
            <select className="os-form-select" style={{ display: 'block', width: '100%', marginTop: 6 }} value={ciPay} onChange={(e) => setCiPay(e.target.value as ReceptionVisit['paymentStatus'])}>
              <option value="paid">Paid</option>
              <option value="pending">Pay later</option>
              <option value="hmo">HMO / Insurance</option>
              <option value="waived">Waived</option>
            </select>
          </label>
          <button type="button" className="os-primary-btn" style={{ width: '100%' }} onClick={doCheckIn}>
            Confirm check-in
          </button>
        </div>
      )}

      {/* ── WALK-IN ── */}
      {view === 'walkin' && (
        <div className="os-card" style={{ padding: 22, maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>Walk-in</div>
            <button type="button" className="os-ghost-btn" onClick={() => setView('home')}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="os-primary-btn" onClick={() => setView('search')}>Existing patient</button>
            <button type="button" className="os-ghost-btn" onClick={() => { setReg(emptyReg); setRegStep(1); setView('register'); }}>New patient</button>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>After selecting a patient, use Check-in with visit type Walk-in.</div>
          </div>
        </div>
      )}

      {/* ── QUEUE ── */}
      {view === 'queue' && (
        <div className="os-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Live queue · {waiting.length} waiting</div>
            <button type="button" className="os-ghost-btn" onClick={() => setView('home')}><X size={16} /></button>
          </div>
          {visits.length === 0 ? (
            <div className="os-empty-state">No visits today. Check in patients to build the queue.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="os-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Patient</th>
                    <th>Dept</th>
                    <th>Doctor</th>
                    <th>Wait</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'var(--os-font-mono)', fontWeight: 800, color: '#0284C7' }}>{v.queueNumber}</td>
                      <td style={{ fontWeight: 600 }}>{v.patientName}</td>
                      <td>{v.department}</td>
                      <td>{v.doctor}</td>
                      <td>{v.estimatedWaitMin}m</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                          background: v.status === 'waiting' ? '#FEF3C7' : v.status === 'called' ? '#DBEAFE' : v.status === 'completed' ? '#D1FAE5' : '#E0E7FF',
                          color: v.status === 'waiting' ? '#B45309' : v.status === 'called' ? '#1D4ED8' : '#047857',
                        }}>{v.status}</span>
                      </td>
                      <td>
                        <button type="button" className="os-ghost-btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { updateVisitStatus(v.id, v.status === 'waiting' ? 'called' : v.status === 'called' ? 'with_provider' : 'completed'); reload(); }}>
                          Next status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENT ── */}
      {view === 'payment' && (
        <div className="os-card" style={{ padding: 22, maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>Payment</div>
            <button type="button" className="os-ghost-btn" onClick={() => setView('home')}><X size={16} /></button>
          </div>
          {!selected ? (
            <div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Select a patient first.</div>
              <button type="button" className="os-primary-btn" onClick={() => setView('search')}>Find patient</button>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{fullName(selected)}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>{selected.hospitalNumber}</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Consultation ₦10,000 · Registration ₦2,000</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12 }}>Total ₦{Number(ciAmount).toLocaleString()}</div>
              <input className="os-search-input" style={{ width: '100%', marginBottom: 12, padding: 10 }} value={ciAmount} onChange={(e) => setCiAmount(e.target.value)} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['Cash', 'POS', 'Transfer', 'HMO'].map((m) => (
                  <button key={m} type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => setCiPay(m === 'HMO' ? 'hmo' : 'paid')}>{m}</button>
                ))}
              </div>
              <button
                type="button"
                className="os-primary-btn"
                style={{ width: '100%' }}
                onClick={() => {
                  setCiPay('paid');
                  flash(`Payment recorded · ₦${Number(ciAmount).toLocaleString()}`);
                  setView('checkin');
                }}
              >
                Confirm payment
              </button>
            </>
          )}
        </div>
      )}

      {/* ── SUCCESS / QUEUE TICKET ── */}
      {view === 'success' && lastVisit && (
        <div className="os-card" style={{ padding: 28, maxWidth: 400, margin: '0 auto', width: '100%', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <CheckCircle2 size={28} />
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>Checked in</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{lastVisit.patientName}</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#94A3B8', marginTop: 20 }}>QUEUE NUMBER</div>
          <div style={{ fontSize: '2.75rem', fontWeight: 900, color: '#0284C7', fontFamily: 'var(--os-font-heading)', letterSpacing: '-0.03em' }}>{lastVisit.queueNumber}</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>
            {lastVisit.department} · {lastVisit.doctor}
            <br />
            Est. wait ~{lastVisit.estimatedWaitMin} min
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
            <button type="button" className="os-ghost-btn" onClick={() => window.print()}><Printer size={14} /> Print ticket</button>
            <button type="button" className="os-primary-btn" onClick={() => setView('queue')}>View queue</button>
          </div>
          <button type="button" className="os-ghost-btn" style={{ marginTop: 10, width: '100%' }} onClick={() => setView('home')}>Back to desk</button>
        </div>
      )}

      {/* ── ONE-PATIENT SIDE PANEL ── */}
      {panelOpen && selected && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 360,
            maxWidth: '100%',
            zIndex: 9500,
            background: '#fff',
            boxShadow: '-12px 0 40px rgba(15,23,42,0.14)',
            borderLeft: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            animation: 'osPremiumFade 0.25s ease',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Patient</div>
            <button type="button" className="os-ghost-btn" style={{ padding: 6 }} onClick={() => setPanelOpen(false)}><X size={16} /></button>
          </div>
          <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#E0F2FE,#CCFBF1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0284C7' }}>
                {(selected.firstName[0] || '') + (selected.lastName[0] || '')}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{fullName(selected)}</div>
                <div style={{ fontSize: 12, color: '#0284C7', fontFamily: 'var(--os-font-mono)', fontWeight: 700 }}>{selected.hospitalNumber}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {selected.sex}{selected.dob ? ` · ${selected.dob}` : ''}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Phone size={13} /> {selected.phone}</span>
              {selected.lga && <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={13} /> {selected.lga}, {selected.state || 'Akwa Ibom'}</span>}
            </div>

            {/* Journey */}
            {(() => {
              const j = journeyOf(selected);
              const steps = [
                { label: 'Registration', ok: j.registered },
                { label: 'Check-in', ok: j.checkedIn },
                { label: 'Payment', ok: j.payment },
                { label: 'Waiting', ok: j.waiting },
                { label: 'With provider', ok: j.withDoctor },
                { label: 'Completed', ok: j.completed },
              ];
              return (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#94A3B8', marginBottom: 8 }}>JOURNEY</div>
                  {steps.map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: s.ok ? '#D1FAE5' : '#F1F5F9', color: s.ok ? '#059669' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                        {s.ok ? '✓' : i + 1}
                      </span>
                      <span style={{ fontWeight: s.ok ? 700 : 500, color: s.ok ? '#0A2540' : '#94A3B8' }}>{s.label}</span>
                    </div>
                  ))}
                  {j.visit && (
                    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#F0F9FF', fontSize: 12, fontWeight: 700, color: '#0284C7' }}>
                      Queue {j.visit.queueNumber} · {j.visit.department}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="os-primary-btn" onClick={() => setView('checkin')}>
                <CheckCircle2 size={14} /> Check in
              </button>
              <button type="button" className="os-ghost-btn" onClick={() => setView('payment')}>
                <Wallet size={14} /> Payment
              </button>
              <button type="button" className="os-ghost-btn" onClick={() => { setView('queue'); setPanelOpen(false); }}>
                <Ticket size={14} /> Queue
              </button>
              <button type="button" className="os-ghost-btn" onClick={() => onNavigate('patient-card')}>
                <Activity size={14} /> Full MPI card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionWorkspace;
