'use client';

/**
 * World-class Reception OS — register, NIN quick-reg, queue, POS, insurance, appointments
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Search, UserPlus, CreditCard, Calendar, Users, Ticket, AlertTriangle,
  QrCode, Clock, Building2, CheckCircle2, ArrowRight, Printer, X,
  Phone, MapPin, Wallet, Sparkles, Camera, ShieldCheck, Banknote,
  IdCard, Stethoscope, Bell, ChevronRight, RefreshCw, ScanLine,
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
  bookAppointment,
  listAppointments,
  cancelAppointment,
  recordPayment,
  todayPayments,
  markAiReminder,
  type ReceptionVisit,
  type VisitType,
  type PaymentMethod,
  type ReceptionAppointment,
  type ReceptionPayment,
} from '../../lib/receptionOpsStore';
import {
  AKWA_IBOM_LGAS,
  NIGERIA_INSURANCE,
  RECEPTION_DEPTS,
  CONSULT_FEES,
  lookupNin,
  verifyInsurance,
} from '../../lib/receptionConstants';
import { emitLiveAction } from '../../lib/liveActions';
import { printQueueTicket, printPaymentReceipt } from '../../lib/printService';
import { appendAudit } from '../../lib/auditLogStore';
import { sendPatientAlert } from '../../lib/integrations/gateways';
import {
  orchestrateArrival,
  orchestrateDeskOverview,
  enrichCardWithGemini,
  actionLabel,
  type AiCheckInCard,
  type ArrivalIntent,
} from '../../lib/receptionAiOrchestrator';

interface Props {
  session: UserSession;
  onNavigate?: (moduleKey: any) => void;
  initialView?: View;
}

type View =
  | 'home'
  | 'register'
  | 'queue'
  | 'appointments'
  | 'payment'
  | 'search'
  | 'scan'
  | 'walkin';

type RegStep = 1 | 2 | 3 | 4;

const emptyReg = {
  firstName: '',
  lastName: '',
  middleName: '',
  dob: '',
  sex: 'Female' as FacilityPatient['sex'],
  phone: '',
  email: '',
  address: '',
  state: 'Akwa Ibom',
  lga: 'Uyo',
  emergencyContact: '',
  emergencyRelation: '',
  category: 'General',
  insuranceProvider: 'NONE',
  insuranceId: '',
  nhiaNumber: '',
  nin: '',
  bloodGroup: '',
  genotype: '',
  occupation: '',
  photoDataUrl: '' as string,
};

const C = {
  blue: '#0284C7',
  teal: '#0D9488',
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F0F9FF',
};

export const ReceptionWorkspace: React.FC<Props> = ({ session, initialView = 'home' }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const facilityName = session.facility || 'Hospital';
  const firstName = (session.name || 'Reception').split(' ')[0];

  const [view, setView] = useState<View>(initialView);
  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [visits, setVisits] = useState<ReceptionVisit[]>([]);
  const [appts, setAppts] = useState<ReceptionAppointment[]>([]);
  const [payments, setPayments] = useState<ReceptionPayment[]>([]);
  const [stats, setStats] = useState(dayStats(facilityId));
  const [query, setQuery] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [walkStep, setWalkStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<FacilityPatient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [regStep, setRegStep] = useState<RegStep>(1);
  const [reg, setReg] = useState(emptyReg);
  const [ninBusy, setNinBusy] = useState(false);
  const [ninMsg, setNinMsg] = useState('');
  const [insVerify, setInsVerify] = useState<ReturnType<typeof verifyInsurance> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [aiCard, setAiCard] = useState<AiCheckInCard | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check-in / POS form
  const [ciDept, setCiDept] = useState<string>('General OPD');
  const [ciDoctor, setCiDoctor] = useState('Any available');
  const [ciType, setCiType] = useState<VisitType>('walkin');
  const [ciPay, setCiPay] = useState<ReceptionVisit['paymentStatus']>('pending');
  const [ciAmount, setCiAmount] = useState('5000');
  const [ciReason, setCiReason] = useState('Consultation');
  const [posMethod, setPosMethod] = useState<PaymentMethod>('cash');
  const [posAmount, setPosAmount] = useState('5000');
  const [posPurpose, setPosPurpose] = useState('OPD consultation');
  const [posPatient, setPosPatient] = useState<FacilityPatient | null>(null);

  // Appointment form
  const [apDept, setApDept] = useState('General OPD');
  const [apDoctor, setApDoctor] = useState('Any available');
  const [apDate, setApDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [apTime, setApTime] = useState('09:00');
  const [apReason, setApReason] = useState('Follow-up');
  const [apPatient, setApPatient] = useState<FacilityPatient | null>(null);

  const reload = useCallback(() => {
    setPatients(listPatients(facilityId));
    setVisits(todayVisits(facilityId));
    setAppts(listAppointments(facilityId));
    setPayments(todayPayments(facilityId));
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

  // Auto AI queue reminders every 45s for long waits
  useEffect(() => {
    const id = setInterval(() => {
      const waiting = todayVisits(facilityId).filter(
        (v) => (v.status === 'waiting' || v.status === 'called') && !v.aiReminderSent
      );
      const longWait = waiting.find((v) => {
        const mins = (Date.now() - new Date(v.checkedInAt).getTime()) / 60000;
        return mins >= (v.estimatedWaitMin || 15);
      });
      if (longWait) {
        markAiReminder(longWait.id);
        setToast(`AI reminder: ${longWait.patientName} (${longWait.queueNumber}) — please proceed to ${longWait.department}`);
        reload();
      }
    }, 45000);
    return () => clearInterval(id);
  }, [facilityId, reload]);

  useEffect(() => {
    setCiAmount(String(CONSULT_FEES[ciDept] ?? 5000));
  }, [ciDept]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 12);
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
      .slice(0, 24);
  }, [patients, query]);

  const fullName = (p: FacilityPatient) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

  const openPatient = (p: FacilityPatient) => {
    setSelected(p);
    void runAiArrival(p, 'manual_search');
  };

  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  };

  const startCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCamOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 100);
    } catch {
      flash('Camera not available — upload a photo instead');
    }
  };

  const capturePhoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 320;
    canvas.height = v.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.85);
    setReg((r) => ({ ...r, photoDataUrl: url }));
    stopCam();
    flash('Photo captured');
  };

  const onPhotoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReg((r) => ({ ...r, photoDataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const runNinLookup = () => {
    const nin = reg.nin.replace(/\\D/g, '');
    if (nin.length < 11) {
      setNinMsg('Enter 11-digit NIN');
      return;
    }
    setNinBusy(true);
    setNinMsg('Querying identity service…');
    setTimeout(() => {
      const hit = lookupNin(nin);
      setNinBusy(false);
      if (!hit) {
        setNinMsg('No match in pilot directory — continue manual entry');
        return;
      }
      setReg((r) => ({
        ...r,
        nin,
        firstName: hit.firstName,
        lastName: hit.lastName,
        middleName: hit.middleName || '',
        dob: hit.dob,
        sex: hit.sex,
        phone: hit.phone,
        address: hit.address,
        state: hit.state,
        lga: hit.lga,
      }));
      setNinMsg('NIN verified — fields auto-filled');
      setRegStep(2);
      flash('Quick registration from NIN ready');
    }, 700);
  };

  const runInsVerify = () => {
    const res = verifyInsurance(reg.insuranceProvider, reg.insuranceId || reg.nhiaNumber || '');
    setInsVerify(res);
    flash(res.message);
  };

  const saveRegistration = () => {
    if (!reg.firstName.trim() || !reg.lastName.trim() || !reg.phone.trim()) {
      flash('First name, last name and phone are required');
      return;
    }
    const patient: FacilityPatient = {
      id: `PT-${Date.now().toString(36).toUpperCase()}`,
      hospitalNumber: generateHospitalNumber(facilityId),
      firstName: reg.firstName.trim(),
      middleName: reg.middleName.trim() || undefined,
      lastName: reg.lastName.trim(),
      dob: reg.dob,
      sex: reg.sex,
      phone: reg.phone.trim(),
      email: reg.email.trim() || undefined,
      address: reg.address.trim() || undefined,
      state: reg.state,
      lga: reg.lga,
      emergencyContact: reg.emergencyContact || undefined,
      emergencyRelation: reg.emergencyRelation || undefined,
      category: reg.category,
      insuranceProvider: reg.insuranceProvider === 'NONE' ? undefined : reg.insuranceProvider,
      insuranceId: reg.insuranceId || undefined,
      nhiaNumber: reg.nhiaNumber || undefined,
      nin: reg.nin || undefined,
      bloodGroup: reg.bloodGroup || undefined,
      genotype: reg.genotype || undefined,
      occupation: reg.occupation || undefined,
      photoUrl: reg.photoDataUrl || undefined,
      facilityId,
      facilityName,
      status: 'active',
      registeredAt: new Date().toISOString(),
    };
    upsertPatient(patient);
    setSelected(patient);
    setPanelOpen(true);
    setView('home');
    setReg(emptyReg);
    setRegStep(1);
    setInsVerify(null);
    stopCam();
    emitLiveAction(`Patient registered · ${patient.hospitalNumber}`, { module: 'reception' });
    flash(`Registered ${fullName(patient)} · ${patient.hospitalNumber}`);
  };

  const doCheckIn = (p: FacilityPatient) => {
    const visit = checkInPatient({
      patient: p,
      facilityId,
      department: ciDept,
      doctor: ciDoctor,
      visitType: ciType,
      reason: ciReason,
      paymentStatus: ciPay,
      amount: Number(ciAmount) || 0,
    });
    reload();
    emitLiveAction(`Check-in ${visit.queueNumber} · ${p.lastName}`, { module: 'queue' });
    try {
      printQueueTicket({
        queueNumber: visit.queueNumber,
        patientName: fullName(p),
        hospitalNumber: p.hospitalNumber,
        department: ciDept,
        facilityName,
      });
    } catch { /* ignore */ }
    appendAudit({
      facilityId,
      actor: session.name,
      actorBadge: session.badgeId,
      action: 'patient_checkin',
      entity: 'visit',
      entityId: visit.id,
      detail: visit.queueNumber,
    });
    if (p.phone) {
      void sendPatientAlert({
        phone: p.phone,
        message: `MedCore: You are checked in at ${facilityName}. Queue ${visit.queueNumber} for ${ciDept}.`,
      });
    }
    flash(`Checked in · Queue ${visit.queueNumber}`);
  };

  const doPayment = () => {
    const p = posPatient || selected;
    if (!p) {
      flash('Select a patient for payment');
      return;
    }
    const amt = Number(posAmount) || 0;
    if (amt <= 0 && posMethod !== 'waiver') {
      flash('Enter amount');
      return;
    }
    const activeVisit = visits.find((v) => v.patientId === p.id && v.status !== 'completed' && v.status !== 'cancelled');
    recordPayment({
      facilityId,
      patientId: p.id,
      patientName: fullName(p),
      hospitalNumber: p.hospitalNumber,
      visitId: activeVisit?.id,
      amount: amt,
      method: posMethod,
      purpose: posPurpose,
      cashier: session.name,
    });
    reload();
    try {
      printPaymentReceipt({
        reference: `POS-${Date.now().toString(36).toUpperCase()}`,
        patientName: fullName(p),
        hospitalNumber: p.hospitalNumber,
        amount: amt,
        method: posMethod,
        purpose: posPurpose,
        facilityName,
        cashier: session.name,
      });
    } catch { /* ignore */ }
    appendAudit({
      facilityId,
      actor: session.name,
      actorBadge: session.badgeId,
      action: 'payment_recorded',
      entity: 'payment',
      detail: `${posMethod} ${amt}`,
    });
    flash(`Payment recorded · ₦${amt.toLocaleString()} · ${posMethod.toUpperCase()}`);
  };

  const doBookAppt = () => {
    const p = apPatient || selected;
    if (!p) {
      flash('Select a patient to book');
      return;
    }
    const scheduledAt = `${apDate}T${apTime}:00`;
    bookAppointment({
      patientId: p.id,
      hospitalNumber: p.hospitalNumber,
      patientName: fullName(p),
      facilityId,
      department: apDept,
      doctor: apDoctor,
      scheduledAt,
      reason: apReason,
    });
    reload();
    flash(`Appointment booked · ${apDate} ${apTime}`);
  };


  const runAiArrival = async (patient: FacilityPatient, intent: ArrivalIntent = 'manual_search') => {
    setAiBusy(true);
    let card = orchestrateArrival(
      {
        patient,
        facilityId,
        facilityName,
        intent,
        arrivedAt: new Date().toISOString(),
      },
      appts,
      visits
    );
    try {
      card = await enrichCardWithGemini(card);
    } catch { /* offline rules stand */ }
    setAiCard(card);
    setSelected(patient);
    setAiBusy(false);
  };

  const executeAiAction = (action: AiCheckInCard['primaryAction'], card: AiCheckInCard) => {
    const p = patients.find((x) => x.id === card.patientId) || selected;
    if (!p) {
      flash('Patient not found');
      return;
    }
    if (action === 'admit' || action === 'start_walkin') {
      if (action === 'start_walkin') setCiType('walkin');
      else if (card.appointment) {
        setCiType('appointment');
        setCiDept(card.appointment.department);
        setCiDoctor(card.appointment.provider);
      }
      doCheckIn(p);
      setAiCard(null);
      setView('queue');
      return;
    }
    if (action === 'take_payment') {
      setPosPatient(p);
      setAiCard(null);
      setView('payment');
      return;
    }
    if (action === 'complete_registration' || action === 'review') {
      setSelected(p);
      setPanelOpen(true);
      setAiCard(null);
      return;
    }
    if (action === 'find_appointment') {
      setApPatient(p);
      setAiCard(null);
      setView('appointments');
      return;
    }
    if (action === 'verify_insurance') {
      setSelected(p);
      setView('register');
      setAiCard(null);
      flash('Open insurance step for this patient or re-register details');
      return;
    }
    if (action === 'decline') {
      setAiCard(null);
      flash('Arrival dismissed');
    }
  };

  const deskAi = useMemo(
    () => orchestrateDeskOverview(visits, patients, stats),
    [visits, patients, stats]
  );

  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called');

  const tools = [
    { id: 'search' as View, icon: Search, label: 'Find patient', desc: 'Name · phone · hospital no.' },
    { id: 'scan' as View, icon: QrCode, label: 'Scan ID / QR', desc: 'Card scan · badge lookup' },
    { id: 'register' as View, icon: UserPlus, label: 'Register', desc: 'Full form · NIN quick' },
    { id: 'walkin' as View, icon: Users, label: 'Walk-in', desc: 'No appointment · queue now' },
    { id: 'appointments' as View, icon: Calendar, label: 'Appointments', desc: 'Book · confirm · arrive' },
    { id: 'queue' as View, icon: Ticket, label: 'Live queue', desc: 'Call · skip · complete' },
    { id: 'payment' as View, icon: Wallet, label: 'POS / Payment', desc: 'Cash · POS · transfer · HMO' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    background: '#fff',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: C.muted,
    letterSpacing: 0.3,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: C.navy,
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            fontWeight: 600,
            fontSize: 13,
            maxWidth: 360,
          }}
        >
          {toast}
        </div>
      )}

      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)',
          borderRadius: 20,
          padding: '20px 24px',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700, letterSpacing: 0.6 }}>RECEPTION · {facilityName}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Good day, {firstName}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
            Check-in, register, queue, payments & appointments — all in one desk
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { l: 'Waiting', v: stats.waiting },
            { l: 'Check-ins', v: stats.checkIns },
            { l: 'Booked', v: stats.bookedToday },
            { l: 'Collected', v: `₦${(stats.collected || 0).toLocaleString()}` },
          ].map((k) => (
            <div
              key={k.l}
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 14,
                padding: '10px 16px',
                minWidth: 88,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>{k.v}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {tools.map((t) => {
          const Icon = t.icon;
          const on = view === t.id || (view === 'home' && t.id === 'queue' && false);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 14,
                border: on ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                background: on ? '#E0F2FE' : '#fff',
                cursor: 'pointer',
              }}
            >
              <Icon size={18} color={C.blue} />
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 8, color: C.navy }}>{t.label}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.desc}</div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setView('home')}
          style={{
            textAlign: 'left',
            padding: 14,
            borderRadius: 14,
            border: view === 'home' ? `2px solid ${C.teal}` : `1px solid ${C.border}`,
            background: view === 'home' ? '#CCFBF1' : '#fff',
            cursor: 'pointer',
          }}
        >
          <Stethoscope size={18} color={C.teal} />
          <div style={{ fontWeight: 800, fontSize: 13, marginTop: 8, color: C.navy }}>Cockpit</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Overview · quick actions</div>
        </button>
      </div>

      {/* HOME */}
      {view === 'home' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong style={{ color: C.navy }}>Find patient</strong>
              <span style={{ fontSize: 12, color: C.muted }}>⌘K</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: C.muted }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  placeholder="Name, hospital no., phone, NHIA, NIN…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setView('search')}
                />
              </div>
              <button
                type="button"
                onClick={() => setView('register')}
                style={{
                  background: C.blue,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '0 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <UserPlus size={16} /> New
              </button>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>LIVE QUEUE</div>
              {waiting.length === 0 && (
                <div style={{ color: C.muted, fontSize: 13, padding: 12 }}>No patients waiting — ready for check-in</div>
              )}
              {waiting.slice(0, 6).map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      background: '#E0F2FE',
                      color: C.blue,
                      fontWeight: 800,
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {v.queueNumber}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: C.navy }}>{v.patientName}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {v.department} · {v.doctor}
                      {v.aiReminderSent ? ' · AI reminded' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      updateVisitStatus(v.id, 'called');
                      reload();
                      flash(`Called ${v.queueNumber}`);
                    }}
                    style={{
                      border: `1px solid ${C.blue}`,
                      background: '#fff',
                      color: C.blue,
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Call
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateVisitStatus(v.id, 'completed');
                      reload();
                    }}
                    style={{
                      border: 'none',
                      background: C.teal,
                      color: '#fff',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setView('queue')}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: `1px dashed ${C.border}`,
                  background: '#F8FAFC',
                  fontWeight: 700,
                  color: C.blue,
                  cursor: 'pointer',
                }}
              >
                Open full live queue →
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10, color: C.navy }}>Quick check-in</div>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px' }}>
                Select a patient from search, set department, then check in to the live queue.
              </p>
              {selected ? (
                <div style={{ background: '#F0F9FF', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700 }}>{fullName(selected)}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{selected.hospitalNumber}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>No patient selected</div>
              )}
              <label style={labelStyle}>Department</label>
              <select style={inputStyle} value={ciDept} onChange={(e) => setCiDept(e.target.value)}>
                {RECEPTION_DEPTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <label style={{ ...labelStyle, marginTop: 8 }}>Visit type</label>
              <select style={inputStyle} value={ciType} onChange={(e) => setCiType(e.target.value as VisitType)}>
                <option value="walkin">Walk-in</option>
                <option value="appointment">Appointment</option>
                <option value="emergency">Emergency</option>
                <option value="referral">Referral</option>
              </select>
              <button
                type="button"
                disabled={!selected}
                onClick={() => selected && doCheckIn(selected)}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: selected ? C.blue : '#94A3B8',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: selected ? 'pointer' : 'not-allowed',
                }}
              >
                Check in to live queue
              </button>
              <button
                type="button"
                disabled={!selected || aiBusy}
                onClick={() => selected && void runAiArrival(selected, 'gesture_checkin')}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #A78BFA',
                  background: '#F5F3FF',
                  color: '#5B21B6',
                  fontWeight: 700,
                  cursor: selected ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                }}
              >
                👋 Simulate gesture / AI check-in
              </button>
            </div>
            <div style={{ background: '#FFFBEB', borderRadius: 16, border: '1px solid #FDE68A', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#92400E' }}>
                <Sparkles size={16} /> AI reception orchestrator
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                {[
                  { l: 'Waiting', v: deskAi.waiting, c: '#0284C7' },
                  { l: 'Ready', v: deskAi.ready, c: '#16A34A' },
                  { l: 'Incomplete reg', v: deskAi.incompleteRegistration, c: '#D97706' },
                  { l: 'With provider', v: deskAi.waitingForProvider, c: '#6366F1' },
                ].map((k) => (
                  <div key={k.l} style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.c }}>{k.v}</div>
                    <div style={{ fontSize: 11, color: '#78350F' }}>{k.l}</div>
                  </div>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#78350F', lineHeight: 1.55 }}>{deskAi.narrative}</p>
              <div style={{ fontSize: 11, color: '#A16207', marginTop: 8 }}>
                Gemini enriches wording when NEXT_PUBLIC_GEMINI_API_KEY is set · EMR stays source of truth
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH */}
      {view === 'search' && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              autoFocus
              style={inputStyle}
              placeholder="Search name, hospital no., phone, NHIA, NIN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" onClick={() => setView('home')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
              Close
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {searchHits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openPatient(p)}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, color: C.navy }}>{fullName(p)}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {p.hospitalNumber} · {p.phone} · {p.sex}
                </div>
                {p.lga && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {p.lga}, {p.state}
                  </div>
                )}
              </button>
            ))}
            {searchHits.length === 0 && (
              <div style={{ color: C.muted, padding: 20 }}>
                No matches.{' '}
                <button type="button" onClick={() => setView('register')} style={{ color: C.blue, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Register new patient
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTER */}
      {view === 'register' && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#0284C7,#0D9488)', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Patient registration</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Step {regStep} of 4 · NIN quick-reg available</div>
            </div>
            <button type="button" onClick={() => setView('home')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '12px 18px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
            {['Identity', 'Contact', 'Insurance', 'Photo & review'].map((s, i) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: 8,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background: regStep === i + 1 ? '#E0F2FE' : 'transparent',
                  color: regStep === i + 1 ? C.blue : C.muted,
                }}
              >
                {i + 1}. {s}
              </div>
            ))}
          </div>
          <div style={{ padding: 18 }}>
            {regStep === 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ScanLine size={16} /> Quick reg with NIN
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      style={inputStyle}
                      placeholder="11-digit NIN"
                      value={reg.nin}
                      onChange={(e) => setReg({ ...reg, nin: e.target.value })}
                      maxLength={11}
                    />
                    <button
                      type="button"
                      disabled={ninBusy}
                      onClick={runNinLookup}
                      style={{
                        background: C.teal,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '0 16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ninBusy ? 'Looking up…' : 'Lookup & fill'}
                    </button>
                  </div>
                  {ninMsg && <div style={{ fontSize: 12, marginTop: 8, color: '#166534' }}>{ninMsg}</div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Pilot: 12345678901 · 98765432109 · 11122233344</div>
                </div>
                <div>
                  <label style={labelStyle}>First name *</label>
                  <input style={inputStyle} value={reg.firstName} onChange={(e) => setReg({ ...reg, firstName: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Last name *</label>
                  <input style={inputStyle} value={reg.lastName} onChange={(e) => setReg({ ...reg, lastName: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Middle name</label>
                  <input style={inputStyle} value={reg.middleName} onChange={(e) => setReg({ ...reg, middleName: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Date of birth</label>
                  <input type="date" style={inputStyle} value={reg.dob} onChange={(e) => setReg({ ...reg, dob: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Sex</label>
                  <select style={inputStyle} value={reg.sex} onChange={(e) => setReg({ ...reg, sex: e.target.value as FacilityPatient['sex'] })}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Occupation</label>
                  <input style={inputStyle} value={reg.occupation} onChange={(e) => setReg({ ...reg, occupation: e.target.value })} />
                </div>
              </div>
            )}

            {regStep === 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input style={inputStyle} value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="080…" />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={reg.address} onChange={(e) => setReg({ ...reg, address: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={reg.state} onChange={(e) => setReg({ ...reg, state: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>LGA *</label>
                  <select style={inputStyle} value={reg.lga} onChange={(e) => setReg({ ...reg, lga: e.target.value })}>
                    {AKWA_IBOM_LGAS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Emergency contact</label>
                  <input style={inputStyle} value={reg.emergencyContact} onChange={(e) => setReg({ ...reg, emergencyContact: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Relation</label>
                  <input style={inputStyle} value={reg.emergencyRelation} onChange={(e) => setReg({ ...reg, emergencyRelation: e.target.value })} placeholder="Spouse, parent…" />
                </div>
              </div>
            )}

            {regStep === 3 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Insurance / HMO</label>
                  <select
                    style={inputStyle}
                    value={reg.insuranceProvider}
                    onChange={(e) => {
                      setReg({ ...reg, insuranceProvider: e.target.value });
                      setInsVerify(null);
                    }}
                  >
                    {NIGERIA_INSURANCE.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Member / NHIA number</label>
                  <input
                    style={inputStyle}
                    value={reg.insuranceId || reg.nhiaNumber}
                    onChange={(e) => setReg({ ...reg, insuranceId: e.target.value, nhiaNumber: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={runInsVerify}
                    style={{
                      width: '100%',
                      padding: 11,
                      borderRadius: 10,
                      border: 'none',
                      background: C.navy,
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <ShieldCheck size={16} /> Verify eligibility
                  </button>
                </div>
                {insVerify && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: 12,
                      borderRadius: 10,
                      background: insVerify.ok ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${insVerify.ok ? '#BBF7D0' : '#FECACA'}`,
                      color: insVerify.ok ? '#166534' : '#991B1B',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {insVerify.message}
                    {insVerify.plan ? ` · ${insVerify.plan}` : ''}
                    {insVerify.expiry ? ` · exp ${insVerify.expiry}` : ''}
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Blood group</label>
                  <select style={inputStyle} value={reg.bloodGroup} onChange={(e) => setReg({ ...reg, bloodGroup: e.target.value })}>
                    <option value="">Unknown</option>
                    {'O+ O- A+ A- B+ B- AB+ AB-'.split(' ').map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Genotype</label>
                  <select style={inputStyle} value={reg.genotype} onChange={(e) => setReg({ ...reg, genotype: e.target.value })}>
                    <option value="">Unknown</option>
                    {'AA AS SS AC SC'.split(' ').map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {regStep === 4 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>Patient photo</div>
                  <div
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: 16,
                      background: '#F1F5F9',
                      border: `1px dashed ${C.border}`,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {reg.photoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={reg.photoDataUrl} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : camOn ? (
                      <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                    ) : (
                      <Camera size={32} color={C.muted} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {!camOn ? (
                      <button type="button" onClick={startCam} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        Webcam
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={capturePhoto} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                          Capture
                        </button>
                        <button type="button" onClick={stopCam} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                          Stop
                        </button>
                      </>
                    )}
                    <label style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                      Upload
                      <input type="file" accept="image/*" hidden onChange={(e) => onPhotoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Review</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: C.navy }}>
                    <div>
                      <strong>{reg.firstName} {reg.middleName} {reg.lastName}</strong>
                    </div>
                    <div>
                      {reg.sex} · DOB {reg.dob || '—'}
                    </div>
                    <div>{reg.phone}</div>
                    <div>
                      {reg.lga}, {reg.state}
                    </div>
                    <div>
                      Insurance:{' '}
                      {NIGERIA_INSURANCE.find((i) => i.id === reg.insuranceProvider)?.name || reg.insuranceProvider}
                    </div>
                    {reg.nin && <div>NIN: {reg.nin}</div>}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button
                type="button"
                disabled={regStep === 1}
                onClick={() => setRegStep((s) => (s > 1 ? ((s - 1) as RegStep) : s))}
                style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Back
              </button>
              {regStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setRegStep((s) => (s < 4 ? ((s + 1) as RegStep) : s))}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveRegistration}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Complete registration
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUEUE */}
      {view === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Live queue board</div>
              <div style={{ fontSize: 13, color: C.muted }}>Call · skip · complete · overtime alerts · by department</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { setCiType('walkin'); setView('walkin'); }} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>
                + Walk-in check-in
              </button>
              <button type="button" onClick={reload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {[
              { l: 'Waiting', v: waiting.length, c: '#D97706' },
              { l: 'Called', v: visits.filter((x) => x.status === 'called').length, c: '#0284C7' },
              { l: 'With provider', v: visits.filter((x) => x.status === 'with_provider').length, c: '#7C3AED' },
              { l: 'Completed today', v: visits.filter((x) => x.status === 'completed').length, c: '#059669' },
              { l: 'Unpaid in queue', v: visits.filter((x) => x.paymentStatus === 'pending' && x.status !== 'completed').length, c: '#DC2626' },
            ].map((k) => (
              <div key={k.l} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '12px 14px', borderTop: `3px solid ${k.c}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: C.muted, textTransform: 'uppercase' }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginTop: 4 }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(260px,340px)', gap: 14 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, overflow: 'hidden' }}>
              <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 14 }}>Active tickets</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.muted, borderBottom: `1px solid ${C.border}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: 10 }}>Queue</th>
                      <th style={{ padding: 10 }}>Patient</th>
                      <th style={{ padding: 10 }}>Dept</th>
                      <th style={{ padding: 10 }}>Type</th>
                      <th style={{ padding: 10 }}>Pay</th>
                      <th style={{ padding: 10 }}>Status</th>
                      <th style={{ padding: 10 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                          No tickets yet. Use <strong>Walk-in</strong> or check in from <strong>Find patient</strong> to populate this board.
                        </td>
                      </tr>
                    )}
                    {visits.map((v) => (
                      <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: 10, fontWeight: 800, fontFamily: 'monospace', color: C.blue }}>{v.queueNumber}</td>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 700 }}>{v.patientName}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{v.hospitalNumber}</div>
                        </td>
                        <td style={{ padding: 10 }}>{v.department}</td>
                        <td style={{ padding: 10 }}>{v.visitType}</td>
                        <td style={{ padding: 10 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            background: v.paymentStatus === 'paid' || v.paymentStatus === 'hmo' ? '#D1FAE5' : '#FEF3C7',
                            color: v.paymentStatus === 'paid' || v.paymentStatus === 'hmo' ? '#047857' : '#B45309',
                          }}>{v.paymentStatus}</span>
                        </td>
                        <td style={{ padding: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{v.status}{v.aiReminderSent ? ' 🔔' : ''}</span>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {v.status === 'waiting' && (
                              <button type="button" onClick={() => { updateVisitStatus(v.id, 'called'); reload(); flash(`Called ${v.queueNumber}`); }} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', cursor: 'pointer' }}>Call</button>
                            )}
                            {v.status === 'called' && (
                              <button type="button" onClick={() => { updateVisitStatus(v.id, 'with_provider'); reload(); }} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer' }}>In room</button>
                            )}
                            {v.status !== 'completed' && v.status !== 'cancelled' && (
                              <button type="button" onClick={() => { updateVisitStatus(v.id, 'completed'); reload(); flash('Completed'); }} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer' }}>Done</button>
                            )}
                            {v.paymentStatus === 'pending' && (
                              <button type="button" onClick={() => {
                                const p = patients.find((x) => x.id === v.patientId);
                                if (p) { setSelected(p); setPosPatient(p); setView('payment'); }
                              }} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: 'none', background: '#FEF3C7', color: '#B45309', cursor: 'pointer' }}>Pay</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 13 }}>By department</div>
                {RECEPTION_DEPTS.slice(0, 6).map((d) => {
                  const n = visits.filter((v) => v.department === d && (v.status === 'waiting' || v.status === 'called')).length;
                  return (
                    <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <span>{d}</span>
                      <strong style={{ color: n ? C.blue : C.muted }}>{n}</strong>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: 'linear-gradient(135deg,#EEF2FF,#F0FDFA)', borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)', padding: 16, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, color: C.navy, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> Queue tips</div>
                Call the longest wait first. Use <strong>Pay</strong> for unpaid tickets without leaving the board. Walk-ins and appointment arrivals both land here after check-in.
              </div>
            </div>
          </div>
        </div>
      )}


      {/* SCAN ID / QR — distinct from search */}
      {view === 'scan' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,360px)', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.navy, marginBottom: 6 }}>Scan hospital card / QR</div>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px', lineHeight: 1.5 }}>
              Enter or scan the hospital number, digital card ID, or NIN printed on the patient card.
              This looks up the MPI only — it does not open clinical charts.
            </p>
            <div
              style={{
                borderRadius: 16,
                border: '2px dashed #7DD3FC',
                background: 'linear-gradient(180deg,#F0F9FF,#fff)',
                padding: 28,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <QrCode size={48} color={C.blue} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 800, color: C.navy }}>Ready to scan</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                Use a USB barcode/QR scanner into the field below, or type the ID
              </div>
            </div>
            <label style={labelStyle}>Hospital number / card ID / NIN</label>
            <input
              autoFocus
              style={{ ...inputStyle, fontSize: 16, fontFamily: 'var(--os-font-mono, monospace)', letterSpacing: '0.04em' }}
              placeholder="e.g. IGH-PT-XXXX or AKSHIA-…"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = scanCode.trim().toLowerCase();
                  const hit =
                    patients.find(
                      (p) =>
                        p.hospitalNumber.toLowerCase() === q ||
                        p.id.toLowerCase() === q ||
                        (p.nin || '').replace(/\D/g, '') === q.replace(/\D/g, '') ||
                        (p.nhiaNumber || '').toLowerCase() === q
                    ) ||
                    patients.find(
                      (p) =>
                        p.hospitalNumber.toLowerCase().includes(q) ||
                        (p.nhiaNumber || '').toLowerCase().includes(q)
                    );
                  if (hit) {
                    setSelected(hit);
                    setPanelOpen(true);
                    flash(`Card matched · ${fullName(hit)}`);
                  } else {
                    flash('No patient found for this scan — register or try Find patient');
                  }
                }
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const q = scanCode.trim().toLowerCase();
                  if (!q) {
                    flash('Enter or scan a code first');
                    return;
                  }
                  const hit =
                    patients.find(
                      (p) =>
                        p.hospitalNumber.toLowerCase() === q ||
                        p.id.toLowerCase() === q ||
                        (p.nin || '').replace(/\D/g, '') === q.replace(/\D/g, '') ||
                        (p.nhiaNumber || '').toLowerCase() === q
                    ) ||
                    patients.find((p) => p.hospitalNumber.toLowerCase().includes(q));
                  if (hit) {
                    setSelected(hit);
                    setPanelOpen(true);
                    flash(`Matched · ${fullName(hit)}`);
                  } else {
                    flash('No match — register new patient');
                    setView('register');
                  }
                }}
                style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                Look up card
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanCode('');
                  setView('register');
                }}
                style={{ padding: '12px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                No card · Register
              </button>
              <button
                type="button"
                onClick={() => setView('search')}
                style={{ padding: '12px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Manual search
              </button>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>After a successful scan</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
              <li>Patient side panel opens with identity</li>
              <li>Check-in → live queue number</li>
              <li>POS if balance due</li>
              <li>Book appointment if needed</li>
            </ul>
            {selected && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div style={{ fontWeight: 800, color: '#166534' }}>{fullName(selected)}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{selected.hospitalNumber}</div>
                <button
                  type="button"
                  onClick={() => {
                    setCiType('appointment');
                    doCheckIn(selected);
                    setView('queue');
                  }}
                  style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Check in now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WALK-IN — distinct flow */}
      {view === 'walkin' && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, maxWidth: 560 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>Walk-in registration</div>
          <p style={{ fontSize: 13, color: C.muted, margin: '6px 0 16px' }}>
            For patients <strong>without</strong> a booked appointment. Assign department, then check-in to the live queue.
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: walkStep >= s ? `linear-gradient(90deg,${C.blue},${C.teal})` : '#E2E8F0' }} />
            ))}
          </div>

          {walkStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Who is arriving?</div>
              <button
                type="button"
                onClick={() => {
                  setView('search');
                  flash('Find existing patient, then return to Walk-in or Check in from panel');
                }}
                style={{ padding: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: '#F8FAFC', textAlign: 'left', cursor: 'pointer', fontWeight: 700 }}
              >
                Existing patient · search MPI
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('scan');
                  flash('Scan card for walk-in');
                }}
                style={{ padding: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: '#F8FAFC', textAlign: 'left', cursor: 'pointer', fontWeight: 700 }}
              >
                Scan hospital card / QR
              </button>
              <button
                type="button"
                onClick={() => setView('register')}
                style={{ padding: 14, borderRadius: 12, border: 'none', background: C.blue, color: '#fff', textAlign: 'left', cursor: 'pointer', fontWeight: 800 }}
              >
                New patient · register first
              </button>
              {selected && (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#E0F2FE' }}>
                  Selected: <strong>{fullName(selected)}</strong>
                  <button type="button" onClick={() => setWalkStep(2)} style={{ display: 'block', marginTop: 8, width: '100%', padding: 10, borderRadius: 10, border: 'none', background: C.navy, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                    Continue with this patient →
                  </button>
                </div>
              )}
            </div>
          )}

          {walkStep === 2 && selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{fullName(selected)} · walk-in details</div>
              <label style={labelStyle}>Reason for visit</label>
              <input style={inputStyle} value={ciReason} onChange={(e) => setCiReason(e.target.value)} placeholder="e.g. Consultation, fever, follow-up" />
              <label style={labelStyle}>Department</label>
              <select style={inputStyle} value={ciDept} onChange={(e) => setCiDept(e.target.value)}>
                {RECEPTION_DEPTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <label style={labelStyle}>Preferred doctor</label>
              <input style={inputStyle} value={ciDoctor} onChange={(e) => setCiDoctor(e.target.value)} />
              <label style={labelStyle}>Payment at desk</label>
              <select style={inputStyle} value={ciPay} onChange={(e) => setCiPay(e.target.value as ReceptionVisit['paymentStatus'])}>
                <option value="pending">Pay later</option>
                <option value="paid">Paid now</option>
                <option value="hmo">HMO / Insurance</option>
                <option value="waived">Waived</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setWalkStep(1)} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Back</button>
                <button
                  type="button"
                  onClick={() => {
                    setCiType('walkin');
                    setWalkStep(3);
                  }}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Review & check in
                </button>
              </div>
            </div>
          )}

          {walkStep === 3 && selected && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Confirm walk-in</div>
              <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
                <div><strong>Patient:</strong> {fullName(selected)}</div>
                <div><strong>Dept:</strong> {ciDept}</div>
                <div><strong>Doctor:</strong> {ciDoctor}</div>
                <div><strong>Reason:</strong> {ciReason || '—'}</div>
                <div><strong>Payment:</strong> {ciPay}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCiType('walkin');
                  doCheckIn(selected);
                  setWalkStep(1);
                  setView('queue');
                }}
                style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                Confirm · assign queue number
              </button>
              <button type="button" onClick={() => setWalkStep(2)} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Back
              </button>
            </div>
          )}

          {walkStep === 2 && !selected && (
            <div style={{ color: C.muted, fontSize: 13 }}>
              Select a patient in step 1 first.
              <button type="button" onClick={() => setWalkStep(1)} style={{ display: 'block', marginTop: 10, fontWeight: 700, color: C.blue, background: 'none', border: 'none', cursor: 'pointer' }}>← Step 1</button>
            </div>
          )}
        </div>
      )}

      {/* APPOINTMENTS */}
      {view === 'appointments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {[
              { l: 'Today booked', v: appts.length, c: C.blue },
              { l: 'Confirmed', v: appts.filter((a) => a.status === 'booked').length, c: '#059669' },
              { l: 'Checked in', v: appts.filter((a) => a.status === 'arrived').length, c: C.teal },
              { l: 'Cancelled', v: appts.filter((a) => a.status === 'cancelled').length, c: '#DC2626' },
            ].map((k) => (
              <div key={k.l} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '12px 14px', borderTop: `3px solid ${k.c}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginTop: 4 }}>{k.v}</div>
              </div>
            ))}
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Book appointment</div>
            <label style={labelStyle}>Patient</label>
            <select
              style={inputStyle}
              value={apPatient?.id || ''}
              onChange={(e) => setApPatient(patients.find((p) => p.id === e.target.value) || null)}
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)} · {p.hospitalNumber}
                </option>
              ))}
            </select>
            <label style={{ ...labelStyle, marginTop: 8 }}>Department</label>
            <select style={inputStyle} value={apDept} onChange={(e) => setApDept(e.target.value)}>
              {RECEPTION_DEPTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <label style={{ ...labelStyle, marginTop: 8 }}>Doctor</label>
            <input style={inputStyle} value={apDoctor} onChange={(e) => setApDoctor(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" style={inputStyle} value={apDate} onChange={(e) => setApDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Time</label>
                <input type="time" style={inputStyle} value={apTime} onChange={(e) => setApTime(e.target.value)} />
              </div>
            </div>
            <label style={{ ...labelStyle, marginTop: 8 }}>Reason</label>
            <input style={inputStyle} value={apReason} onChange={(e) => setApReason(e.target.value)} />
            <button type="button" onClick={doBookAppt} style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              Book appointment
            </button>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Today · {appts.length} appointments</div>
            {appts.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                <div style={{ fontWeight: 800, color: C.blue, minWidth: 52 }}>
                  {a.scheduledAt.slice(11, 16)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{a.patientName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {a.department} · {a.doctor} · {a.status}
                  </div>
                </div>
                {a.status === 'booked' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const p = patients.find((x) => x.id === a.patientId);
                        if (p) {
                          checkInPatient({
                            patient: p,
                            facilityId,
                            department: a.department,
                            doctor: a.doctor,
                            visitType: 'appointment',
                            reason: a.reason,
                            paymentStatus: 'pending',
                            amount: CONSULT_FEES[a.department] || 5000,
                            appointmentId: a.id,
                            appointmentTime: a.scheduledAt.slice(11, 16),
                          });
                          reload();
                          flash('Appointment checked in');
                        }
                      }}
                      style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: 'none', background: C.teal, color: '#fff', cursor: 'pointer' }}
                    >
                      Check in
                    </button>
                    <button type="button" onClick={() => { cancelAppointment(a.id); reload(); }} style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ))}
            {appts.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
                <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>No appointments today</div>
                Book from the form on the left after selecting a registered patient. Walk-ins should use the <strong>Walk-in</strong> tool, not this list.
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* PAYMENT POS */}
      {view === 'payment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { l: 'Collected today', v: `₦${(stats.collected || 0).toLocaleString()}`, c: '#059669' },
              { l: 'Receipts', v: String(payments.length), c: C.blue },
              { l: 'Pending in queue', v: String(visits.filter((x) => x.paymentStatus === 'pending' && x.status !== 'completed').length), c: '#D97706' },
              { l: 'HMO / insurance', v: String(payments.filter((x) => x.method === 'hmo').length), c: '#7C3AED' },
            ].map((k) => (
              <div key={k.l} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '12px 14px', borderTop: `3px solid ${k.c}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginTop: 4 }}>{k.v}</div>
              </div>
            ))}
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Banknote size={18} color={C.teal} /> POS / Payment
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Record cash, card, transfer or HMO at the desk</div>
            <label style={labelStyle}>Patient</label>
            <select
              style={inputStyle}
              value={(posPatient || selected)?.id || ''}
              onChange={(e) => setPosPatient(patients.find((p) => p.id === e.target.value) || null)}
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)} · {p.hospitalNumber}
                </option>
              ))}
            </select>
            <label style={{ ...labelStyle, marginTop: 8 }}>Amount (₦)</label>
            <input style={inputStyle} value={posAmount} onChange={(e) => setPosAmount(e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 8 }}>Purpose</label>
            <input style={inputStyle} value={posPurpose} onChange={(e) => setPosPurpose(e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 8 }}>Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['cash', 'card', 'transfer', 'pos', 'hmo', 'waiver'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPosMethod(m)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: posMethod === m ? `2px solid ${C.teal}` : `1px solid ${C.border}`,
                    background: posMethod === m ? '#CCFBF1' : '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <button type="button" onClick={doPayment} style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              Record payment
            </button>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Today's collections · ₦{stats.collected.toLocaleString()}</div>
            {payments.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.patientName}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {p.purpose} · {p.method} · {p.reference}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: C.teal }}>₦{p.amount.toLocaleString()}</div>
              </div>
            ))}
            {payments.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 12, marginTop: 8 }}>
                No POS receipts yet. Select a patient, amount, and method, then <strong>Record payment</strong>.
              </div>
            )}
          </div>
        </div>
        </div>
      )}


      {/* AI contextual check-in card — human must confirm */}
      {aiCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setAiCard(null)}
        >
          <div
            style={{
              width: 'min(440px, 100%)',
              background: '#fff',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 18px',
                background:
                  aiCard.severity === 'success'
                    ? 'linear-gradient(135deg,#0D9488,#0284C7)'
                    : aiCard.severity === 'attention'
                      ? 'linear-gradient(135deg,#EA580C,#B91C1C)'
                      : aiCard.severity === 'warn'
                        ? 'linear-gradient(135deg,#D97706,#CA8A04)'
                        : 'linear-gradient(135deg,#0284C7,#6366F1)',
                color: '#fff',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: 0.5 }}>
                AI CHECK-IN · REQUIRES CONFIRMATION
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{aiCard.headline}</div>
              <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>{aiCard.subhead}</div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                {aiCard.hospitalNumber}
                {aiCard.appointment
                  ? ` · ${aiCard.appointment.department} · ${aiCard.appointment.provider}`
                  : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {aiCard.flags.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: '#F1F5F9',
                      color: '#334155',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 12,
                  fontSize: 12,
                }}
              >
                {[
                  ['Registration', aiCard.readiness.registration],
                  ['Insurance', aiCard.readiness.insurance],
                  ['Appointment', aiCard.readiness.appointment],
                  ['Payment clear', aiCard.readiness.paymentClear],
                ].map(([l, ok]) => (
                  <div
                    key={String(l)}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      background: ok ? '#F0FDF4' : '#FEF2F2',
                      color: ok ? '#166534' : '#991B1B',
                      fontWeight: 700,
                    }}
                  >
                    {ok ? '✓' : '!'} {l}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.55, margin: '0 0 8px' }}>
                <strong>Recommendation:</strong> {aiCard.recommendation}
              </p>
              <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: '0 0 14px' }}>
                {aiCard.explanation}
              </p>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
                Est. reception time: ~{aiCard.estimatedReceptionMin} min · AI never writes the chart without your tap
              </div>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => executeAiAction(aiCard.primaryAction, aiCard)}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: 'none',
                  background: '#0284C7',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                {actionLabel(aiCard.primaryAction)}
              </button>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {aiCard.secondaryActions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => executeAiAction(a, aiCard)}
                    style={{
                      flex: 1,
                      minWidth: 100,
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {actionLabel(a)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient detail drawer — reception-authorised fields */}
      {panelOpen && selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 80,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setPanelOpen(false)}
        >
          <div
            style={{
              width: 'min(440px, 100%)',
              height: '100%',
              background: '#fff',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
              overflowY: 'auto',
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: 'linear-gradient(135deg,#0284C7,#0D9488)', color: '#fff', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>PATIENT · RECEPTION VIEW</div>
                <button type="button" onClick={() => setPanelOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                  {selected.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 800, fontSize: 22 }}>
                      {selected.firstName[0]}
                      {selected.lastName[0]}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fullName(selected)}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, opacity: 0.95 }}>{selected.hospitalNumber}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 18, display: 'grid', gap: 10, fontSize: 13 }}>
              {[
                ['Sex / DOB', `${selected.sex} · ${selected.dob || '—'}`],
                ['Phone', selected.phone],
                ['Email', selected.email || '—'],
                ['Address', selected.address || '—'],
                ['LGA / State', `${selected.lga || '—'}, ${selected.state || '—'}`],
                ['NIN', selected.nin || '—'],
                ['NHIA / Member ID', selected.nhiaNumber || selected.insuranceId || '—'],
                ['Insurance', selected.insuranceProvider || 'Self-pay'],
                ['Blood / Genotype', `${selected.bloodGroup || '—'} / ${selected.genotype || '—'}`],
                ['Emergency', `${selected.emergencyContact || '—'} (${selected.emergencyRelation || '—'})`],
                ['Registered', selected.registeredAt.slice(0, 10)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontWeight: 600, color: C.navy, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    doCheckIn(selected);
                    setPanelOpen(false);
                    setView('queue');
                  }}
                  style={{ padding: 12, borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Check in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPosPatient(selected);
                    setPanelOpen(false);
                    setView('payment');
                  }}
                  style={{ padding: 12, borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Take payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApPatient(selected);
                    setPanelOpen(false);
                    setView('appointments');
                  }}
                  style={{ padding: 12, borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer', gridColumn: '1 / -1' }}
                >
                  Book appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionWorkspace;
