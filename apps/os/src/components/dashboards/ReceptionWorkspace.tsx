'use client';

/**
 * World-class Reception OS — register, queue, POS, insurance, appointments
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
  searchPatients,
  countPatients,
  clearAllPatients,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import {
  todayVisits,
  dayStats,
  checkInPatient,
  updateVisitStatus,
  assignVisitDoctor,
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
import { listStaffCards } from '../../lib/staffCardStore';
import { listActiveStaff, type StaffPresence } from '../../lib/staffPresenceStore';
import { pushNotification } from '../../lib/notificationEngine';
import {
  AKWA_IBOM_LGAS,
  NIGERIA_INSURANCE,
  RECEPTION_DEPTS,
  CONSULT_FEES,
  verifyInsurance,
} from '../../lib/receptionConstants';
import { emitLiveAction } from '../../lib/liveActions';
import {
  sendPaymentRequestToAccounts,
  DEFAULT_REGISTRATION_FEE_NGN,
  listAccountsRequests,
  subscribeAccountsRequests,
  type FrontDeskAccountsRequest,
  reconcileAllVisitPayments,
} from '../../lib/frontDeskAccountsBridge';
import { patientBalance } from '../../lib/patientBillingStore';
import { printQueueTicket, printPaymentReceipt } from '../../lib/printService';
import { opdStageHint } from '../../lib/nigerianOpdFlow';
import { PaystackBrandedCheckout } from '../reception/PaystackBrandedCheckout';
import { hasPaystackKey } from '../../lib/paystackClient';
import { withViewTransition, measureRect, flipElement } from '../../lib/motion';
import { appendAudit } from '../../lib/auditLogStore';
import { sendPatientAlert, verifyNinLive } from '../../lib/integrations/gateways';
import { getPatientByNin, getCrossFacilityPatientByNin } from '../../lib/patientRegistryStore';
import { getOrCreateStateHealthCard } from '../../lib/stateHealthCardService';
import { SearchablePatientSelect } from '../common/SearchablePatientSelect';
import {
  orchestrateArrival,
  orchestrateDeskOverview,
  enrichCardWithGemini,
  actionLabel,
  type AiCheckInCard,
  type ArrivalIntent,
} from '../../lib/receptionAiOrchestrator';
import { ReceptionDeskHome } from './ReceptionDeskHome';
import { markPatientOutstandingPaid } from '../../lib/patientBillingStore';
import {
  subscribePresence,
  processPresenceArrival,
  admitFromPresence,
  emitPatientPresence,
} from '../../lib/presenceArrivalEngine';
import { broadcastOpdStage } from '../../hooks/useOpdSync';

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



/** Hospital journey stages after enroll — drives Front Desk strip */
type JourneyStageId = 'enrolled' | 'pending' | 'paid' | 'queued' | 'consult' | 'done';

function getPatientJourney(
  facilityId: string,
  patient: { id: string; hospitalNumber: string },
  visits: ReceptionVisit[]
): {
  stage: JourneyStageId;
  index: number;
  steps: { id: JourneyStageId; label: string }[];
  detail: string;
  visit?: ReceptionVisit;
} {
  const steps: { id: JourneyStageId; label: string }[] = [
    { id: 'enrolled', label: 'Enrolled' },
    { id: 'pending', label: 'Pending pay' },
    { id: 'paid', label: 'Paid' },
    { id: 'queued', label: 'Queued' },
    { id: 'consult', label: 'In consult' },
    { id: 'done', label: 'Done' },
  ];
  const gate = getPaymentGate(facilityId, patient.id, patient.hospitalNumber);
  const today = visits
    .filter(
      (v) =>
        (v.patientId === patient.id || v.hospitalNumber === patient.hospitalNumber) &&
        v.status !== 'cancelled'
    )
    .sort((a, b) => (b.checkedInAt || '').localeCompare(a.checkedInAt || ''));
  const visit = today[0];

  if (visit && (visit.status === 'completed' || visit.status === 'no_show')) {
    return {
      stage: 'done',
      index: 5,
      steps,
      detail: visit.status === 'no_show' ? 'Marked no-show' : `Visit complete · ${visit.queueNumber || ''}`.trim(),
      visit,
    };
  }
  if (visit && visit.status === 'with_provider') {
    return {
      stage: 'consult',
      index: 4,
      steps,
      detail: `With clinician · ${visit.department || ''} · ${visit.queueNumber || ''}`.trim(),
      visit,
    };
  }
  if (visit && (visit.status === 'waiting' || visit.status === 'called')) {
    return {
      stage: 'queued',
      index: 3,
      steps,
      detail: `In queue · ${visit.department || 'OPD'} · ${visit.queueNumber || ''}`.trim(),
      visit,
    };
  }
  if (!gate.cleared || gate.tone === 'wait') {
    return {
      stage: 'pending',
      index: 1,
      steps,
      detail: gate.label,
      visit,
    };
  }
  if (gate.tone === 'ok' || gate.cleared) {
    // Paid (or no fee) but not yet on queue
    const hasPaidEvidence = gate.tone === 'ok';
    return {
      stage: hasPaidEvidence || !visit ? 'paid' : 'enrolled',
      index: hasPaidEvidence || gate.cleared ? 2 : 0,
      steps,
      detail: hasPaidEvidence
        ? gate.label
        : 'Ready — check in to place on clinical queue',
      visit,
    };
  }
  return { stage: 'enrolled', index: 0, steps, detail: 'Folder open', visit };
}


/** Front desk: patient may enter clinical queue only after Accounts payment (or no open fee) */
function getPaymentGate(
  facilityId: string,
  patientId: string,
  hospitalNumber: string
): {
  cleared: boolean;
  label: string;
  tone: 'ok' | 'wait' | 'none';
  awaiting?: FrontDeskAccountsRequest[];
  balanceNgn: number;
} {
  const awaiting = listAccountsRequests(facilityId, {
    status: 'awaiting_payment',
    patientId,
  }).filter(
    (r) => r.patientId === patientId || r.hospitalNumber === hospitalNumber
  );
  const also = listAccountsRequests(facilityId, { status: 'awaiting_payment' }).filter(
    (r) => r.hospitalNumber === hospitalNumber || r.patientId === patientId
  );
  const openReq = [...awaiting, ...also].filter(
    (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
  );
  const bal =
    patientBalance(facilityId, patientId) || patientBalance(facilityId, hospitalNumber);
  if (openReq.length > 0 || bal > 0) {
    const amt = openReq.reduce((s, r) => s + r.amountNgn, 0) || bal;
    return {
      cleared: false,
      label: `PENDING · ₦${amt.toLocaleString()} at Accounts — patient pays, then returns here`,
      tone: 'wait',
      awaiting: openReq,
      balanceNgn: amt,
    };
  }
  const paid = listAccountsRequests(facilityId, { status: 'paid', patientId }).filter(
    (r) => r.patientId === patientId || r.hospitalNumber === hospitalNumber
  );
  if (paid.length > 0) {
    const last = paid[0];
    return {
      cleared: true,
      label: `PAID · ${last.paidReference || last.invoiceNumber || 'receipt'} · continue check-in`,
      tone: 'ok',
      balanceNgn: 0,
    };
  }
  return {
    cleared: true,
    label: 'No open account charge — may check in',
    tone: 'none',
    balanceNgn: 0,
  };
}

export const ReceptionWorkspace: React.FC<Props> = ({ session, initialView = 'home', onNavigate }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const facilityName = session.facility || 'Hospital';
  const firstName = (session.name || 'Reception').split(' ')[0];

  const [view, setView] = useState<View>(initialView);
  const [viewHistory, setViewHistory] = useState<View[]>([]);
  /** Navigate with View Transition when browser supports it */
  const goView = useCallback((next: View) => {
    const mapped: View =
      next === 'payment' || (next as string) === 'cashier' || (next as string) === 'send-accounts'
        ? 'home'
        : next;
    withViewTransition(() => {
      setView((prev) => {
        if (prev !== mapped) {
          setViewHistory((h) => [...h.slice(-19), prev]);
        }
        return mapped;
      });
    });
  }, []);
  const goBackView = useCallback(() => {
    setViewHistory((h) => {
      if (!h.length) {
        withViewTransition(() => setView('home'));
        return h;
      }
      const prev = h[h.length - 1];
      withViewTransition(() => setView(prev));
      return h.slice(0, -1);
    });
  }, []);
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
  /** 'idle' | 'checking' | 'prefilled' | 'conflict' | 'invalid' */
  const [ninStatus, setNinStatus] = useState<'idle' | 'checking' | 'prefilled' | 'conflict' | 'invalid'>('idle');
  const [ninConflictPatient, setNinConflictPatient] = useState<FacilityPatient | null>(null);
  const [crossFacilityPatient, setCrossFacilityPatient] = useState<FacilityPatient | null>(null);
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
  const [paystackOpen, setPaystackOpen] = useState(false);
  const payMethodBoxRef = useRef<HTMLDivElement>(null);
  const [posAmount, setPosAmount] = useState('5000');
  const [posPurpose, setPosPurpose] = useState('OPD consultation');
  const [posPatient, setPosPatient] = useState<FacilityPatient | null>(null);
  const [acctTargetBadge, setAcctTargetBadge] = useState('');
  const [acctTargetName, setAcctTargetName] = useState('');
  const [sendAcctTab, setSendAcctTab] = useState<'queue' | 'flow'>('queue');
  const [sendAcctDialog, setSendAcctDialog] = useState<{
    kind: 'success' | 'no_officer' | 'error';
    title: string;
    body: string;
  } | null>(null);

  // Appointment form
  const [apDept, setApDept] = useState('General OPD');
  const [apDoctor, setApDoctor] = useState('Any available');

  /** Doctors on staff at this facility (for assignment dropdown) */
  const facilityDoctors = useMemo(() => {
    const CLINICAL = new Set(['doctor', 'surgeon', 'medical_director', 'consultant']);
    return listStaffCards()
      .filter(
        (c) =>
          (c.facilityId === facilityId || !c.facilityId) &&
          c.status === 'ACTIVE' &&
          (CLINICAL.has((c.roleKey || '').toLowerCase()) ||
            /doctor|surgeon|consultant|physician/i.test(c.role || c.title || ''))
      )
      .map((c) => c.fullName)
      .filter(Boolean);
  }, [facilityId, patients.length, visits.length]);
  const [apDate, setApDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [apTime, setApTime] = useState('09:00');
  const [apReason, setApReason] = useState('Follow-up');
  const [apPatient, setApPatient] = useState<FacilityPatient | null>(null);

  // Stay on reception for payments — do not force-navigate away (that left buttons dead)


  useEffect(() => {
    if (initialView === 'payment' || (initialView as string) === 'send-accounts') goView('home');
  }, [initialView, goView]);

  const reload = useCallback(() => {
    try {
      reconcileAllVisitPayments(facilityId);
    } catch {
      /* ignore */
    }

    setPatients(listPatients(facilityId));
    setVisits(todayVisits(facilityId));
    setAppts(listAppointments(facilityId));
    setPayments(todayPayments(facilityId));
    setStats(dayStats(facilityId));
  }, [facilityId]);

  useEffect(() => {
    const bump = () => reload();
    window.addEventListener('medcore-opd-stage', bump);
    window.addEventListener('medcore-accounts-paid', bump);
    window.addEventListener('medcore-clinical-orders', bump);
    return () => {
      window.removeEventListener('medcore-opd-stage', bump);
      window.removeEventListener('medcore-accounts-paid', bump);
      window.removeEventListener('medcore-clinical-orders', bump);
    };
  }, [reload]);


  useEffect(() => {
    return subscribeAccountsRequests(() => {
      try {
        reload();
      } catch {
        /* ignore */
      }
    });
  }, [facilityId, reload]);

  useEffect(() => {
    reload();
    const u1 = subscribePatients(reload);
    const u2 = subscribeReceptionOps(reload);
    const bump = () => reload();
    window.addEventListener('medcore-reception-ops', bump);
    window.addEventListener('medcore-patients-updated', bump);
    window.addEventListener('medcore-admin-sync', bump);
    window.addEventListener('medcore-billing', bump);
    window.addEventListener('medcore-staff-cards-updated', bump);
    window.addEventListener('medcore-vitals', bump);   // nurse saves vitals → queue badge updates
    window.addEventListener('storage', bump);
    // Cross-tab (from doctor calling/completing, or nurse triaging)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('medcore_reception');
      bc.onmessage = () => reload();
    } catch { /* ignore */ }
    const poll = window.setInterval(reload, 8000); // 8s poll for snappy live feel
    return () => {
      u1();
      u2();
      window.removeEventListener('medcore-reception-ops', bump);
      window.removeEventListener('medcore-patients-updated', bump);
      window.removeEventListener('medcore-admin-sync', bump);
      window.removeEventListener('medcore-billing', bump);
      window.removeEventListener('medcore-staff-cards-updated', bump);
      window.removeEventListener('medcore-vitals', bump);
      window.removeEventListener('storage', bump);
      try { bc?.close(); } catch { /* */ }
      window.clearInterval(poll);
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

  // ── #4 Smart NIN validation (runs synchronously on every change) ──────────
  const ninValidationWarning = useMemo(() => {
    const digits = reg.nin.replace(/\D/g, '');
    if (!digits || digits.length < 11) return null;
    // Detect all-same digit (e.g. 11111111111)
    if (/^(\d)\1{10}$/.test(digits)) return 'Looks like a placeholder — all digits are the same';
    // Detect sequential run (12345678901, etc.)
    const isSequential = [...digits].every((d, i, a) => i === 0 || Math.abs(Number(d) - Number(a[i - 1])) <= 1);
    if (isSequential) return 'Possible sequential pattern — verify the NIN with the patient';
    return null;
  }, [reg.nin]);

  // ── #1 & #3 NIN Conflict Guard & Cross-Facility Continuity ─────────────
  useEffect(() => {
    const digits = reg.nin.replace(/\D/g, '');
    if (digits.length !== 11) {
      setNinStatus('idle');
      setNinConflictPatient(null);
      setCrossFacilityPatient(null);
      return;
    }

    // 1. Check local facility duplicate
    const existing = getPatientByNin(digits, facilityId);
    if (existing) {
      setNinStatus('conflict');
      setNinConflictPatient(existing);
      setCrossFacilityPatient(null);
      return;
    }
    setNinConflictPatient(null);

    // 2. Check cross-facility statewide match (Feature #3)
    const crossExisting = getCrossFacilityPatientByNin(digits, facilityId);
    if (crossExisting) {
      setCrossFacilityPatient(crossExisting);
      setNinStatus('prefilled');
      // If name fields are still empty, auto-populate demographics from cross-facility record
      const namesEmpty = !reg.firstName.trim() && !reg.lastName.trim();
      if (namesEmpty) {
        setReg((prev) => ({
          ...prev,
          firstName: crossExisting.firstName || prev.firstName,
          lastName: crossExisting.lastName || prev.lastName,
          middleName: crossExisting.middleName || prev.middleName,
          dob: crossExisting.dob || prev.dob,
          sex: crossExisting.sex || prev.sex,
          phone: crossExisting.phone || prev.phone,
          email: crossExisting.email || prev.email,
          address: crossExisting.address || prev.address,
          state: crossExisting.state || prev.state,
          lga: crossExisting.lga || prev.lga,
          bloodGroup: crossExisting.bloodGroup || prev.bloodGroup,
          genotype: crossExisting.genotype || prev.genotype,
          emergencyContact: crossExisting.emergencyContact || prev.emergencyContact,
          emergencyRelation: crossExisting.emergencyRelation || prev.emergencyRelation,
          occupation: crossExisting.occupation || prev.occupation,
        }));
      }
      return;
    }
    setCrossFacilityPatient(null);

    // ── #2 Gateway Auto-Prefill — silent, non-blocking ──────────────────────
    // Only prefill if the main name fields are still empty (don't overwrite deliberate entries)
    const namesEmpty = !reg.firstName.trim() && !reg.lastName.trim();
    if (!namesEmpty) {
      setNinStatus('idle');
      return;
    }
    setNinStatus('checking');
    void verifyNinLive(digits).then((result) => {
      if (!result.ok || !result.data) {
        setNinStatus('idle');
        return;
      }
      const d = result.data;
      setReg((prev) => ({
        ...prev,
        firstName:    d.firstName  || prev.firstName,
        lastName:     d.lastName   || prev.lastName,
        middleName:   d.middleName || prev.middleName,
        dob:          d.dob        || prev.dob,
        sex:          (d.sex && ['Male','Female','Other'].includes(d.sex) ? d.sex as FacilityPatient['sex'] : prev.sex),
        phone:        d.phone      || prev.phone,
      }));
      setNinStatus('prefilled');
    }).catch(() => setNinStatus('idle'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg.nin, facilityId]);

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

  const runInsVerify = () => {
    const res = verifyInsurance(reg.insuranceProvider, reg.insuranceId || reg.nhiaNumber || '');
    setInsVerify(res);
    flash(res.message);
  };

  /** Auto-send payment request to Accounting desk (zero manual clicks required) */
  const autoSendToAccounts = useCallback(
    (patient: FacilityPatient, amount: number, purpose: string) => {
      if (!patient || amount <= 0) return null;
      try {
        const req = sendPaymentRequestToAccounts({
          facilityId,
          facilityName,
          patientId: patient.id,
          hospitalNumber: patient.hospitalNumber,
          patientName: fullName(patient),
          amountNgn: amount,
          purpose,
          source: 'reception',
          sentBy: session.name || 'Reception',
          sentByBadge: session.badgeId,
          note: 'Auto-sent from Front Desk upon registration / check-in. Patient directed to Accounts to pay.',
        });
        try {
          pushNotification({
            facilityId,
            level: 'important',
            title: 'New payment request from Front Desk',
            body: `${fullName(patient)} · ₦${amount.toLocaleString()} · ${purpose} · ${req.invoiceNumber}`,
            module: 'cashier',
            roleHint: 'accountant',
          });
          pushNotification({
            facilityId,
            level: 'important',
            title: 'New payment request from Front Desk',
            body: `${fullName(patient)} · ₦${amount.toLocaleString()} · ${purpose}`,
            module: 'cashier',
            roleHint: 'cashier',
          });
        } catch {
          /* ignore */
        }
        emitLiveAction(`FD → Accounts · ${req.invoiceNumber} · ₦${amount}`, { module: 'reception' });
        return req;
      } catch (err) {
        console.warn('[reception] autoSendToAccounts failed', err);
        return null;
      }
    },
    [facilityId, facilityName, session.name, session.badgeId]
  );

  // Auto-send payment request to Accounts whenever Patient Reception View is shown
  useEffect(() => {
    if (panelOpen && selected) {
      const existing = listAccountsRequests(facilityId, { patientId: selected.id });
      const day = new Date().toISOString().slice(0, 10);
      const hasActiveToday = existing.some(
        (r) =>
          r.sentAt.slice(0, 10) === day &&
          (r.status === 'awaiting_payment' || r.status === 'paid')
      );
      if (!hasActiveToday) {
        const fee =
          selected.category === 'NHIA' || selected.insuranceProvider
            ? Math.round(DEFAULT_REGISTRATION_FEE_NGN * 0.5)
            : DEFAULT_REGISTRATION_FEE_NGN;
        const req = autoSendToAccounts(selected, fee, 'OPD consultation / hospital fee');
        if (req) {
          flash(`⚡ Auto-sent ₦${fee.toLocaleString()} invoice to Accounts (${req.invoiceNumber})`);
        }
      }
    }
  }, [panelOpen, selected, facilityId, autoSendToAccounts]);

  const saveRegistration = () => {
    if (!reg.firstName.trim() || !reg.lastName.trim() || !reg.phone.trim()) {
      flash('First name, last name and phone are required');
      return;
    }

    // ── #1 NIN Conflict Guard — hard block on duplicate NIN ─────────────────
    if (reg.nin) {
      const digits = reg.nin.replace(/\D/g, '');
      if (digits.length === 11) {
        const conflict = getPatientByNin(digits, facilityId);
        if (conflict) {
          flash(`NIN already registered to ${conflict.firstName} ${conflict.lastName} (${conflict.hospitalNumber}). Check if this is a duplicate registration.`);
          setNinStatus('conflict');
          setNinConflictPatient(conflict);
          return;
        }
      }
    }

    const shid = `AKSHIA-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const patient: FacilityPatient = {
      id: `PT-${Date.now().toString(36).toUpperCase()}`,
      hospitalNumber: generateHospitalNumber(facilityId),
      shid,
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
      cardIssueDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      cardExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    upsertPatient(patient);

    // ── #5 Auto-draft Statewide Digital Health Card ──────────────────────────
    // Non-blocking — card is created in background; receptionist sees confirmation badge
    void (async () => {
      try {
        getOrCreateStateHealthCard(patient); // Warms the card service & persists via upsert pipeline
        appendAudit({
          facilityId,
          actor: session.name,
          actorBadge: session.badgeId,
          action: 'card_auto_issued',
          entity: 'patient',
          entityId: patient.id,
          detail: `SHID ${shid}${patient.nin ? ` · NIN bound` : ' · No NIN'}`,
        });
      } catch { /* non-critical */ }
    })();

    setSelected(patient);
    setPanelOpen(true);
    goView('home');
    setReg(emptyReg);
    setRegStep(1);
    setNinStatus('idle');
    setNinConflictPatient(null);
    setCrossFacilityPatient(null);
    setInsVerify(null);
    stopCam();
    emitLiveAction(`Patient registered · ${patient.hospitalNumber}${patient.nin ? ' · NIN bound' : ''}`, { module: 'reception' });

    // Digital handoff → Accounts: registration / folder fee auto-sent immediately
    const fee =
      patient.category === 'NHIA' || patient.insuranceProvider
        ? Math.round(DEFAULT_REGISTRATION_FEE_NGN * 0.5)
        : DEFAULT_REGISTRATION_FEE_NGN;
    if (fee > 0) {
      const req = autoSendToAccounts(patient, fee, 'New folder · Registration fee');
      if (req) {
        flash(
          `Registered ${fullName(patient)} · ${patient.hospitalNumber}${
            patient.nin ? ' · 🔗 NIN bound' : ''
          } · Auto-sent ₦${fee.toLocaleString()} to Accounts (${req.invoiceNumber}).`
        );
      } else {
        flash(`Registered ${fullName(patient)} · ${patient.hospitalNumber}${patient.nin ? ' · NIN bound' : ''}`);
      }
    } else {
      flash(`Registered ${fullName(patient)} · ${patient.hospitalNumber}${patient.nin ? ' · 🔗 NIN bound to digital card' : ''}`);
    }
  };

  const notifyDoctorAssignment = (visit: ReceptionVisit, patientLabel: string) => {
    const assigned = (visit.doctor || '').trim();
    const isPool = !assigned || /^any\b/i.test(assigned);
    pushNotification({
      facilityId,
      level: 'important',
      title: isPool ? 'New patient in clinic queue' : `Patient assigned to you`,
      body: isPool
        ? `${patientLabel} · ${visit.queueNumber} · ${visit.department} (open pool)`
        : `${patientLabel} · Queue ${visit.queueNumber} · ${visit.department} — assigned by reception`,
      module: 'doctor-portal',
      patientId: visit.patientId,
      roleHint: 'doctor',
      targetStaff: isPool ? undefined : assigned,
      visitId: visit.id,
    });
  };

  const doCheckIn = (p: FacilityPatient) => {
    const gate = getPaymentGate(facilityId, p.id, p.hospitalNumber);
    if (!gate.cleared) {
      flash(gate.label);
      setSelected(p);
      setPanelOpen(true);
      return;
    }
    const visit = checkInPatient({
      patient: p,
      facilityId,
      department: ciDept,
      doctor: ciDoctor,
      visitType: ciType,
      reason: ciReason,
      paymentStatus: gate.tone === 'ok' ? 'paid' : ciPay,
      amount: Number(ciAmount) || 0,
    });
    reload();
    emitLiveAction(
      `Check-in ${visit.queueNumber} · ${p.lastName} → ${ciDoctor}`,
      { module: 'queue' }
    );
    notifyDoctorAssignment(visit, fullName(p));
    // Notify nurse triage station so the patient appears in OPD queue immediately
    broadcastOpdStage('medcore_triage', {
      facilityId,
      patientId: p.id,
      hospitalNumber: p.hospitalNumber,
      patientName: fullName(p),
      queueNumber: visit.queueNumber,
      department: ciDept,
      stage: 'checked_in',
    });
    // Also notify doctor desk so queue count updates
    broadcastOpdStage('medcore_doctor', {
      facilityId, patientId: p.id,
      stage: 'checked_in', patientName: fullName(p),
    });
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
      detail: `${visit.queueNumber} → ${ciDoctor}`,
    });
    if (p.phone) {
      void sendPatientAlert({
        phone: p.phone,
        message: `MedCore: You are checked in at ${facilityName}. Queue ${visit.queueNumber} for ${ciDept}${ciDoctor && !/^any/i.test(ciDoctor) ? ` with ${ciDoctor}` : ''}.`,
      });
    }
    flash(
      ciDoctor && !/^any/i.test(ciDoctor)
        ? `Checked in · Queue ${visit.queueNumber} · assigned to ${ciDoctor}`
        : `Checked in · Queue ${visit.queueNumber}`
    );
  };


  const settlePaystackPayment = (result: {
    reference: string;
    paystackRef: string;
    amountNgn: number;
    channel: string;
  }) => {
    const p = posPatient || selected;
    if (!p) return;
    const method =
      result.channel === 'card' || result.channel === 'pos'
        ? ('card' as const)
        : result.channel === 'bank_transfer' || result.channel === 'bank' || result.channel === 'ussd'
          ? ('transfer' as const)
          : posMethod === 'card'
            ? ('card' as const)
            : ('transfer' as const);
    const activeVisit = visits.find(
      (v) => v.patientId === p.id && v.status !== 'completed' && v.status !== 'cancelled'
    );
    const pay = recordPayment({
      facilityId,
      patientId: p.id,
      hospitalNumber: p.hospitalNumber,
      patientName: fullName(p),
      amount: result.amountNgn,
      method,
      purpose: posPurpose || 'Hospital payment',
      cashier: session.name || 'Reception',
      reference: result.reference,
      visitId: activeVisit?.id,
    });
    try {
      markPatientOutstandingPaid(facilityId, p.id, {
        via: 'paystack',
        paidBy: session.name,
        paymentRef: result.paystackRef || result.reference,
      });
    } catch { /* ignore */ }
    emitLiveAction(`Paystack ${result.paystackRef} · ₦${result.amountNgn}`, { module: 'cashier' });
    try {
      printPaymentReceipt({
        reference: result.reference,
        patientName: fullName(p),
        hospitalNumber: p.hospitalNumber,
        amount: result.amountNgn,
        method: 'paystack',
        channel: result.channel,
        purpose: posPurpose || 'Hospital payment',
        facilityName: session.facility || session.hospitalId || 'Hospital',
        facilityId,
        patientId: p.id,
        cashier: session.name,
        cashierBadge: session.badgeId,
        paystackRef: result.paystackRef,
        visitId: activeVisit?.id,
      });
    } catch { /* ignore */ }
    try {
      appendAudit({
        facilityId,
        actor: session.name || 'Reception',
        action: 'payment_paystack',
        entity: 'payment',
        detail: `${result.paystackRef} · ₦${result.amountNgn} · ${result.channel}`,
      });
    } catch { /* ignore */ }
    setPayments(todayPayments(facilityId));
    setPaystackOpen(false);
    flash(`Paystack paid · ${result.paystackRef} · ₦${result.amountNgn.toLocaleString()}`);
  };


  /** Front desk does not collect money — hand financial data to Accounting */
  const sendToAccountingDesk = (overridePatient?: FacilityPatient | null) => {
    const p = overridePatient || posPatient || selected;
    if (!p) {
      setSendAcctDialog({
        kind: 'error',
        title: 'Select a patient',
        body: 'Choose a patient from the queue or hospital flow before sending to Accounts.',
      });
      return;
    }
    const amt = Number(posAmount) || 0;
    if (amt <= 0) {
      setSendAcctDialog({
        kind: 'error',
        title: 'Amount required',
        body: 'Enter the invoice amount (₦) to send to the Accounting desk.',
      });
      return;
    }

    const activeAcct = listActiveStaff(facilityId).filter((pr) => {
      const rk = String(pr.roleKey || '').toLowerCase();
      const r = String(pr.role || '').toLowerCase();
      return (
        rk === 'accountant' ||
        rk === 'cashier' ||
        rk === 'hospital_admin' ||
        r.includes('account') ||
        r.includes('cashier') ||
        r.includes('finance') ||
        r.includes('billing')
      );
    });
    const hasOfficer = activeAcct.length > 0 || Boolean(acctTargetBadge);

    try {
      const req = sendPaymentRequestToAccounts({
        facilityId,
        facilityName,
        patientId: p.id,
        hospitalNumber: p.hospitalNumber,
        patientName: fullName(p),
        amountNgn: amt,
        purpose: posPurpose || 'OPD / front desk fee',
        source: 'reception',
        sentBy: session.name || 'Reception',
        sentByBadge: session.badgeId,
        note: acctTargetName
          ? `Assigned to ${acctTargetName}. Patient pays at Accounts, then returns with receipt.`
          : 'Patient directed to Accounting desk. Return to Front Desk with receipt for clinical queue.',
        assignedAccountantBadge: acctTargetBadge || undefined,
        assignedAccountantName: acctTargetName || undefined,
      });
      try {
        pushNotification({
          facilityId,
          level: 'important',
          title: 'New payment request from Front Desk',
          body: `${fullName(p)} · ₦${amt.toLocaleString()} · ${req.purpose} · ${req.invoiceNumber || req.id}${acctTargetName ? ` · desk: ${acctTargetName}` : ''}`,
          module: 'cashier',
          roleHint: 'accountant',
        });
        pushNotification({
          facilityId,
          level: 'important',
          title: 'New payment request from Front Desk',
          body: `${fullName(p)} · ₦${amt.toLocaleString()} · ${req.purpose}`,
          module: 'cashier',
          roleHint: 'cashier',
        });
      } catch { /* ignore */ }
      emitLiveAction(`FD → Accounts · ${req.invoiceNumber} · ₦${amt}`, { module: 'reception' });
      try {
        appendAudit({
          facilityId,
          actor: session.name || 'Reception',
          actorBadge: session.badgeId,
          action: 'send_to_accounts',
          entity: 'accounts_request',
          entityId: req.id,
          detail: `${fullName(p)} ₦${amt} · ${req.invoiceNumber}`,
        });
      } catch { /* ignore */ }
      setPosAmount('5000');
      if (!hasOfficer) {
        setSendAcctDialog({
          kind: 'no_officer',
          title: 'No active account officer',
          body: `Invoice ${req.invoiceNumber || req.id} for ${fullName(p)} · ₦${amt.toLocaleString()} was queued. No Accounting desk is online right now — it will appear when an officer signs in.`,
        });
      } else {
        setSendAcctDialog({
          kind: 'success',
          title: 'Sent to Accounts',
          body: `${fullName(p)} · ₦${amt.toLocaleString()} · ${req.invoiceNumber || req.id}${
            acctTargetName ? ` · routed to ${acctTargetName}` : ` · ${activeAcct.length} desk(s) online`
          }. Patient pays at Accounts, then returns with the receipt.`,
        });
      }
    } catch (e: any) {
      setSendAcctDialog({
        kind: 'error',
        title: 'Could not send',
        body: e?.message || 'Could not send invoice to Accounts. Try again.',
      });
    }
  };

  const doPayment = () => {
    // Digital methods must go through Paystack verify — never manual PAID
    if (posMethod === 'card' || posMethod === 'transfer') {
      flash('Use Paystack Terminal or Transfer flow — payment is marked PAID only after verification');
      setPaystackOpen(true);
      return;
    }
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
    const activeVisit = visits.find(
      (v) => v.patientId === p.id && v.status !== 'completed' && v.status !== 'cancelled'
    );
    const pay = recordPayment({
      facilityId,
      patientId: p.id,
      patientName: fullName(p),
      hospitalNumber: p.hospitalNumber,
      visitId: activeVisit?.id,
      amount: amt,
      method: posMethod,
      purpose: posPurpose || 'Consultation',
      cashier: session.name,
    });
    reload();
    emitLiveAction(`Payment ${pay.reference} · ₦${amt} · ${posMethod}`, { module: 'cashier' });
    try {
      printPaymentReceipt({
        reference: pay.reference,
        patientName: fullName(p),
        hospitalNumber: p.hospitalNumber,
        amount: amt,
        method: posMethod,
        purpose: posPurpose || 'Consultation',
        facilityName,
        facilityId,
        patientId: p.id,
        cashier: session.name,
        cashierBadge: session.badgeId,
        paymentId: pay.id,
        visitId: activeVisit?.id,
      });
    } catch { /* ignore */ }
    appendAudit({
      facilityId,
      actor: session.name,
      actorBadge: session.badgeId,
      action: 'payment_recorded',
      entity: 'payment',
      entityId: pay.id,
      detail: `${posMethod} ₦${amt} · ${pay.reference}`,
    });
    flash(`Payment recorded · ${pay.reference} · ₦${amt.toLocaleString()} · ${posMethod.toUpperCase()}`);
  };

  /**
   * Clinical governance rule:
   * – First-time patients (no prior completed/waiting visits) → department pool only,
   *   routed through nurse triage on arrival.
   * – Returning patients (prior visit history) → may select a specific follow-up doctor.
   */
  const isReturningPatient = (p: FacilityPatient): boolean => {
    return visits.some(
      (v) => v.patientId === p.id && (v.status === 'completed' || v.status === 'waiting' || v.status === 'with_provider')
    );
  };

  const doBookAppt = () => {
    const p = apPatient || selected;
    if (!p) {
      flash('Select a patient to book');
      return;
    }
    const returning = isReturningPatient(p);
    // Enforce triage pathway for first-time patients
    const effectiveDoctor = returning ? apDoctor : 'Any available';
    if (!returning && apDoctor !== 'Any available') {
      flash('First-time patients go through nurse triage — assigned to open pool');
    }
    const scheduledAt = `${apDate}T${apTime}:00`;
    bookAppointment({
      patientId: p.id,
      hospitalNumber: p.hospitalNumber,
      patientName: fullName(p),
      facilityId,
      department: apDept,
      doctor: effectiveDoctor,
      scheduledAt,
      reason: apReason,
    });
    reload();
    flash(
      returning
        ? `Follow-up booked · ${apDate} ${apTime} · ${effectiveDoctor}`
        : `Appointment booked · ${apDate} ${apTime} · Routes through nurse triage on arrival`
    );
  };


  
  // Realtime presence / gesture from patient app → AI check-in card
  useEffect(() => {
    return subscribePresence((payload) => {
      if (payload.facilityId !== facilityId) return;
      const result = processPresenceArrival(payload);
      if ('error' in result) {
        flash(result.error);
        return;
      }
      setAiCard(result.card);
      setSelected(result.patient);
      flash(`Presence · ${result.patient.firstName} ${result.patient.lastName}`);
    });
  }, [facilityId]);

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
      const gateP = getPaymentGate(
        facilityId,
        card.patientId || '',
        card.hospitalNumber || card.patientId || ''
      );
      if (!gateP.cleared) {
        flash(gateP.label);
        return;
      }
      const visit = admitFromPresence({
        patient: p,
        facilityId,
        facilityName,
        department: card.appointment?.department || ciDept,
        doctor: card.appointment?.provider || ciDoctor,
        visitType: action === 'start_walkin' || !card.appointment ? 'walkin' : 'appointment',
        actorName: session.name,
        actorBadge: session.badgeId,
        printTicket: false,
      });
      notifyDoctorAssignment(visit, fullName(p));
      reload();
      setAiCard(null);
      goView('home');
      flash(`Admitted · Queue ${visit.queueNumber} · doctor notified`);
      return;
    }
    if (action === 'take_payment') {
      setPosPatient(p);
      setAiCard(null);
      const fee = DEFAULT_REGISTRATION_FEE_NGN;
      const req = autoSendToAccounts(p, fee, 'OPD consultation / hospital fee');
      if (req) {
        flash(`Auto-sent ₦${fee.toLocaleString()} invoice to Accounts (${req.invoiceNumber})`);
      }
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
      goView('appointments');
      return;
    }
    if (action === 'verify_insurance') {
      setSelected(p);
      goView('register');
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
    { id: 'register' as View, icon: UserPlus, label: 'Register', desc: 'New patient · full form' },
    { id: 'walkin' as View, icon: Users, label: 'Walk-in', desc: 'No appointment · queue now' },
    { id: 'appointments' as View, icon: Calendar, label: 'Appointments', desc: 'Book · confirm · arrive' },
    { id: 'queue' as View, icon: Ticket, label: 'Live queue', desc: 'Call · skip · complete' },
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
      {sendAcctDialog && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setSendAcctDialog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: 18,
              background: '#fff',
              boxShadow: '0 24px 60px rgba(15,23,42,0.28)',
              padding: '22px 22px 18px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  sendAcctDialog.kind === 'success'
                    ? '#D1FAE5'
                    : sendAcctDialog.kind === 'no_officer'
                      ? '#FEF3C7'
                      : '#FEE2E2',
                color:
                  sendAcctDialog.kind === 'success'
                    ? '#047857'
                    : sendAcctDialog.kind === 'no_officer'
                      ? '#B45309'
                      : '#B91C1C',
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {sendAcctDialog.kind === 'success' ? '✓' : sendAcctDialog.kind === 'no_officer' ? '!' : '×'}
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0F172A', marginBottom: 8 }}>
              {sendAcctDialog.title}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
              {sendAcctDialog.body}
            </p>
            <button
              type="button"
              onClick={() => setSendAcctDialog(null)}
              style={{
                marginTop: 18,
                width: '100%',
                height: 42,
                borderRadius: 12,
                border: 'none',
                background:
                  sendAcctDialog.kind === 'success'
                    ? 'linear-gradient(135deg,#0D9488,#0284C7)'
                    : sendAcctDialog.kind === 'no_officer'
                      ? 'linear-gradient(135deg,#D97706,#B45309)'
                      : '#DC2626',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

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

      {/* Back to previous reception screen */}
      {view !== 'home' && (
        <div
          className="recep-back-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            borderBottom: `1px solid ${C.border}`,
            background: '#fff',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          <button
            type="button"
            onClick={goBackView}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: '#F8FAFC',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              color: C.navy,
            }}
            title="Back"
          >
            ← Back
          </button>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'capitalize' }}>
            {String(view).replace(/-/g, ' ')}
          </span>
        </div>
      )}
      {/* HOME — MedCore Front Desk design */}
      {view === 'home' && (
        <ReceptionDeskHome
          session={session}
          patients={patients}
          visits={visits}
          appts={appts}
          stats={stats}
          onGo={(v) => {
            if (v === 'cashier' || v === 'payment') {
              if (onNavigate) onNavigate('cashier');
              else goView('home');
              return;
            }
            if (v === 'home') goView('home');
            else goView(v as View);
          }}
          onCheckIn={(p) => doCheckIn(p)}
          onUpdateVisit={(id, status) => {
            updateVisitStatus(id, status);
            reload();
          }}
          onSelectPatient={(p) => openPatient(p)}
          onRefresh={reload}
        />
      )}

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
            {patients.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete all ${patients.length} registered patients and their visit records for a fresh test?`)) {
                    clearAllPatients(facilityId);
                    reload();
                    flash('All patients deleted. Ready for a fresh test.');
                  }
                }}
                style={{
                  ...inputStyle,
                  width: 'auto',
                  cursor: 'pointer',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  borderColor: '#FCA5A5',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                Delete All Patients
              </button>
            )}
            <button type="button" onClick={() => goView('home')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
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
                <button type="button" onClick={() => goView('register')} style={{ color: C.blue, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
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
              <div style={{ fontSize: 12, opacity: 0.9 }}>Step {regStep} of 4</div>
            </div>
            <button type="button" onClick={() => goView('home')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
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
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>
                    National Identity Number (NIN)
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 6 }}>(optional)</span>
                    {ninStatus === 'checking' && (
                      <span style={{ fontSize: 11, color: C.blue, marginLeft: 8 }}>⟳ Checking…</span>
                    )}
                    {ninStatus === 'prefilled' && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginLeft: 8 }}>✓ Prefilled from NIMC</span>
                    )}
                  </label>
                  <input
                    style={{
                      ...inputStyle,
                      borderColor: ninStatus === 'conflict' ? '#EF4444'
                                 : ninStatus === 'prefilled' ? '#10B981'
                                 : ninStatus === 'checking' ? C.blue
                                 : C.border,
                      transition: 'border-color 0.2s',
                    }}
                    placeholder="11-digit NIN (e.g. 12345678901)"
                    value={reg.nin}
                    onChange={(e) => {
                      setNinStatus('idle');
                      setNinConflictPatient(null);
                      setReg({ ...reg, nin: e.target.value.replace(/\D/g, '').slice(0, 11) });
                    }}
                    maxLength={11}
                  />
                  {/* #1 Conflict banner */}
                  {ninStatus === 'conflict' && ninConflictPatient && (
                    <div style={{ marginTop: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <span style={{ color: '#B91C1C', fontWeight: 700 }}>⚠ Duplicate NIN detected — </span>
                      <span style={{ color: '#7F1D1D' }}>
                        already registered to <strong>{ninConflictPatient.firstName} {ninConflictPatient.lastName}</strong> ({ninConflictPatient.hospitalNumber}).
                        Open their record or clear the NIN to continue.
                      </span>
                    </div>
                  )}
                  {/* #3 Cross-Facility Recognized Link */}
                  {crossFacilityPatient && ninStatus !== 'conflict' && (
                    <div style={{ marginTop: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ color: '#1E40AF', fontWeight: 600 }}>
                          🌐 <strong>State Registry Match:</strong> Recognized from {crossFacilityPatient.facilityName || 'network facility'} ({crossFacilityPatient.hospitalNumber}).
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setReg((prev) => ({
                              ...prev,
                              firstName: crossFacilityPatient.firstName || prev.firstName,
                              middleName: crossFacilityPatient.middleName || prev.middleName,
                              lastName: crossFacilityPatient.lastName || prev.lastName,
                              dob: crossFacilityPatient.dob || prev.dob,
                              sex: crossFacilityPatient.sex || prev.sex,
                              phone: crossFacilityPatient.phone || prev.phone,
                              email: crossFacilityPatient.email || prev.email,
                              address: crossFacilityPatient.address || prev.address,
                              state: crossFacilityPatient.state || prev.state,
                              lga: crossFacilityPatient.lga || prev.lga,
                              bloodGroup: crossFacilityPatient.bloodGroup || prev.bloodGroup,
                              genotype: crossFacilityPatient.genotype || prev.genotype,
                              emergencyContact: crossFacilityPatient.emergencyContact || prev.emergencyContact,
                              emergencyRelation: crossFacilityPatient.emergencyRelation || prev.emergencyRelation,
                              occupation: crossFacilityPatient.occupation || prev.occupation,
                            }));
                            flash(`✓ Demographics loaded from ${crossFacilityPatient.facilityName || 'State Registry'}`);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#2563EB',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Re-import Demographics
                        </button>
                      </div>
                    </div>
                  )}
                  {/* #4 Suspicious pattern warning */}
                  {ninValidationWarning && ninStatus !== 'conflict' && (
                    <div style={{ marginTop: 6, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#92400E' }}>
                      ⚠ {ninValidationWarning}
                    </div>
                  )}
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
                    {reg.nin ? (
                      <div style={{ color: '#047857', fontWeight: 700 }}>
                        NIN (Bound to Card): {reg.nin}
                      </div>
                    ) : (
                      <div style={{ color: C.muted }}>NIN: Not provided</div>
                    )}
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
              <div style={{ fontSize: 13, color: C.muted }}>
                Nigerian OPD flow · stages move with doctor / pharmacy / payment — desk only calls next
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { setCiType('walkin'); goView('walkin'); }} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>
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
                        <td style={{ padding: 10 }}>
                          {v.department === 'Triage' || !v.triagedAt ? (
                            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#F0FDFA', color: '#0D9488', border: '1px solid #99F6E4' }}>Triage</span>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{v.department || 'General OPD'}</div>
                              {v.doctor && v.doctor !== 'Any available' && <div style={{ fontSize: 10, color: '#6B7280' }}>Dr. {v.doctor}</div>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>{v.visitType}</td>
                        <td style={{ padding: 10 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            background: v.paymentStatus === 'paid' || v.paymentStatus === 'hmo' ? '#D1FAE5' : '#FEF3C7',
                            color: v.paymentStatus === 'paid' || v.paymentStatus === 'hmo' ? '#047857' : '#B45309',
                          }}>{v.paymentStatus}</span>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{v.status}{v.aiReminderSent ? ' 🔔' : ''}</span>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, maxWidth: 160 }}>{opdStageHint(v.status, v.paymentStatus, v.department, v.triagedAt)}</div>
                        </div>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Triage-stage: patient paid but not yet nurse-assessed */}
                            {v.status === 'waiting' && (v.department === 'Triage' || !v.triagedAt) && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: '#FEF9C3', color: '#854D0E', display: 'inline-flex', alignItems: 'center', gap: 5 }}>🩺 Awaiting Nurse Vitals</span>
                            )}
                            {/* Doctor-stage: nurse done, patient in OPD doctor queue */}
                            {v.status === 'waiting' && v.department !== 'Triage' && v.triagedAt && (
                              <button type="button" onClick={() => { updateVisitStatus(v.id, 'called'); reload(); flash(`Called ${v.queueNumber}`); }} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', cursor: 'pointer' }}>Call next</button>
                            )}
                            {v.status === 'called' && (v.department === 'Triage' || !v.triagedAt) && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: '#FEF9C3', color: '#854D0E' }}>In Nurse Triage · being assessed</span>
                            )}
                            {v.status === 'called' && v.department !== 'Triage' && v.triagedAt && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: '#E0F2FE', color: '#0369A1' }}>Called · auto in-room when doctor starts</span>
                            )}
                            {v.status === 'with_provider' && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: '#EDE9FE', color: '#5B21B6' }}>With doctor · closes on Rx / lab order</span>
                            )}
                            {v.status === 'completed' && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: '#D1FAE5', color: '#047857' }}>Consult complete</span>
                            )}
                            {v.paymentStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const p = patients.find((x) => x.id === v.patientId);
                                  if (p) {
                                    const fee = Number(v.amount) || 5000;
                                    const req = autoSendToAccounts(p, fee, `${v.department || 'OPD'} consultation`);
                                    flash(`Auto-sent ₦${fee.toLocaleString()} invoice to Accounts (${req?.invoiceNumber || 'INV'})`);
                                  }
                                }}
                                style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: 'none', background: '#FEF3C7', color: '#B45309', cursor: 'pointer' }}
                                title="Click to auto-send or re-notify Accounts"
                              >
                                Invoice at Accounts
                              </button>
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
                        (p.shid || '').toLowerCase() === q ||
                        p.id.toLowerCase() === q ||
                        (p.nin || '').replace(/\D/g, '') === q.replace(/\D/g, '') ||
                        (p.nhiaNumber || '').toLowerCase() === q ||
                        (p.shid && q.includes(p.shid.toLowerCase()))
                    ) ||
                    patients.find(
                      (p) =>
                        p.hospitalNumber.toLowerCase().includes(q) ||
                        (p.shid || '').toLowerCase().includes(q) ||
                        (p.nhiaNumber || '').toLowerCase().includes(q)
                    );
                  if (hit) {
                    setSelected(hit);
                    setScanCode('');
                    // If we came from the walk-in flow, return there with patient pre-selected
                    const fromWalkIn = viewHistory[viewHistory.length - 1] === 'walkin';
                    if (fromWalkIn) {
                      setWalkStep(2);
                      goView('walkin');
                      flash(`Card matched · ${fullName(hit)} · Continue check-in below`);
                    } else {
                      setPanelOpen(true);
                      flash(`Card matched · ${fullName(hit)}`);
                    }
                  } else {
                    const cross = getCrossFacilityPatientByNin(q, facilityId);
                    if (cross) {
                      setReg({
                        ...emptyReg,
                        firstName: cross.firstName || '',
                        middleName: cross.middleName || '',
                        lastName: cross.lastName || '',
                        dob: cross.dob || '',
                        sex: cross.sex || 'Female',
                        phone: cross.phone || '',
                        email: cross.email || '',
                        address: cross.address || '',
                        state: cross.state || 'Akwa Ibom',
                        lga: cross.lga || 'Uyo',
                        bloodGroup: cross.bloodGroup || '',
                        genotype: cross.genotype || '',
                        emergencyContact: cross.emergencyContact || '',
                        emergencyRelation: cross.emergencyRelation || '',
                        occupation: cross.occupation || '',
                        nin: cross.nin || q.replace(/\D/g, ''),
                      });
                      setCrossFacilityPatient(cross);
                      setNinStatus('prefilled');
                      setScanCode('');
                      goView('register');
                      flash(`🌐 Patient recognized in State Registry from ${cross.facilityName || 'network facility'}! Demographics prefilled.`);
                    } else {
                      flash('No patient found for this scan — register or try Find patient');
                    }
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
                        (p.shid || '').toLowerCase() === q ||
                        p.id.toLowerCase() === q ||
                        (p.nin || '').replace(/\D/g, '') === q.replace(/\D/g, '') ||
                        (p.nhiaNumber || '').toLowerCase() === q ||
                        (p.shid && q.includes(p.shid.toLowerCase()))
                    ) ||
                    patients.find(
                      (p) =>
                        p.hospitalNumber.toLowerCase().includes(q) ||
                        (p.shid || '').toLowerCase().includes(q)
                    );
                  if (hit) {
                    setSelected(hit);
                    setScanCode('');
                    const fromWalkIn = viewHistory[viewHistory.length - 1] === 'walkin';
                    if (fromWalkIn) {
                      setWalkStep(2);
                      goView('walkin');
                      flash(`Matched · ${fullName(hit)} · Continue check-in below`);
                    } else {
                      setPanelOpen(true);
                      flash(`Matched · ${fullName(hit)}`);
                    }
                  } else {
                    const cross = getCrossFacilityPatientByNin(q, facilityId);
                    if (cross) {
                      setReg({
                        ...emptyReg,
                        firstName: cross.firstName || '',
                        middleName: cross.middleName || '',
                        lastName: cross.lastName || '',
                        dob: cross.dob || '',
                        sex: cross.sex || 'Female',
                        phone: cross.phone || '',
                        email: cross.email || '',
                        address: cross.address || '',
                        state: cross.state || 'Akwa Ibom',
                        lga: cross.lga || 'Uyo',
                        bloodGroup: cross.bloodGroup || '',
                        genotype: cross.genotype || '',
                        emergencyContact: cross.emergencyContact || '',
                        emergencyRelation: cross.emergencyRelation || '',
                        occupation: cross.occupation || '',
                        nin: cross.nin || q.replace(/\D/g, ''),
                      });
                      setCrossFacilityPatient(cross);
                      setNinStatus('prefilled');
                      setScanCode('');
                      goView('register');
                      flash(`🌐 Patient recognized in State Registry from ${cross.facilityName || 'network facility'}! Demographics prefilled.`);
                    } else {
                      flash('No match — register new patient');
                      goView('register');
                    }
                  }
                }}
                style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                Look up card
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = scanCode.trim();
                  if (!q) {
                    flash('Enter NIN or card number first');
                    return;
                  }
                  emitPatientPresence({
                    facilityId,
                    patientKey: q,
                    source: 'kiosk',
                    intent: 'qr_scan',
                  });
                  setScanCode('');
                  flash('⚡ Self-service arrival registered — Front desk notified!');
                }}
                style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                Self-Service Check-in
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanCode('');
                  goView('register');
                }}
                style={{ padding: '12px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                No card · Register
              </button>
              <button
                type="button"
                onClick={() => goView('search')}
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
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      // Use 'walkin' as the visit type — card scan at reception = walk-in arrival
                      setCiType('walkin');
                      doCheckIn(selected);
                      setScanCode('');
                      goView('queue');
                    }}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Walk-in check-in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Has an appointment — honour appointment type
                      setCiType('appointment');
                      doCheckIn(selected);
                      setScanCode('');
                      goView('queue');
                    }}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', color: C.navy, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Appointment check-in
                  </button>
                </div>
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
              <div style={{ marginBottom: 6 }}>
                <SearchablePatientSelect
                  facilityId={facilityId}
                  selectedPatient={selected}
                  onChange={(p) => {
                    setSelected(p);
                    if (p) setWalkStep(2);
                  }}
                  placeholder="Type patient name or hospital number to check in…"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  goView('search');
                  flash('Find existing patient, then return to Walk-in or Check in from panel');
                }}
                style={{ padding: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: '#F8FAFC', textAlign: 'left', cursor: 'pointer', fontWeight: 700 }}
              >
                Existing patient · search MPI
              </button>
              <button
                type="button"
                onClick={() => {
                  goView('scan');
                  flash('Scan card for walk-in');
                }}
                style={{ padding: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: '#F8FAFC', textAlign: 'left', cursor: 'pointer', fontWeight: 700 }}
              >
                Scan hospital card / QR
              </button>
              <button
                type="button"
                onClick={() => goView('register')}
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
              <label style={labelStyle}>Assign to doctor *</label>
              <select style={inputStyle} value={ciDoctor} onChange={(e) => setCiDoctor(e.target.value)}>
                <option value="Any available">Any available (open pool)</option>
                {facilityDoctors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {facilityDoctors.length === 0 && (
                <div style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>
                  No enrolled doctors found — type is free-text below, or enrol clinicians under Staff.
                </div>
              )}
              {facilityDoctors.length === 0 && (
                <input
                  style={{ ...inputStyle, marginTop: 6 }}
                  placeholder="Doctor full name"
                  value={ciDoctor === 'Any available' ? '' : ciDoctor}
                  onChange={(e) => setCiDoctor(e.target.value || 'Any available')}
                />
              )}
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
                  if (ciPay === 'pending') {
                    const fee = Number(ciAmount) || CONSULT_FEES[ciDept] || 5000;
                    autoSendToAccounts(selected, fee, `${ciDept} consultation fee`);
                  }
                  doCheckIn(selected);
                  setWalkStep(1);
                  goView('queue');
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
            <SearchablePatientSelect
              facilityId={facilityId}
              selectedPatient={apPatient}
              onChange={(p) => setApPatient(p)}
              placeholder="Type patient name or hospital number…"
            />
            <label style={{ ...labelStyle, marginTop: 8 }}>Department</label>
            <select style={inputStyle} value={apDept} onChange={(e) => setApDept(e.target.value)}>
              {RECEPTION_DEPTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            {/* Clinical governance: only returning patients may pick a specific doctor */}
            {apPatient && isReturningPatient(apPatient) ? (
              <>
                <label style={{ ...labelStyle, marginTop: 8 }}>Assign to doctor</label>
                <select style={inputStyle} value={apDoctor} onChange={(e) => setApDoctor(e.target.value)}>
                  <option value="Any available">Any available (open pool)</option>
                  {facilityDoctors.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {facilityDoctors.length === 0 && (
                  <input
                    style={{ ...inputStyle, marginTop: 6 }}
                    placeholder="Doctor full name"
                    value={apDoctor === 'Any available' ? '' : apDoctor}
                    onChange={(e) => setApDoctor(e.target.value || 'Any available')}
                  />
                )}
              </>
            ) : (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>🩺</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>Routes through Nurse Triage</div>
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                    {apPatient
                      ? 'First-time patient — nurse triage assesses and assigns a doctor on arrival.'
                      : 'Select a patient above to determine if direct doctor booking is available.'}
                  </div>
                </div>
              </div>
            )}
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
                          const fee = CONSULT_FEES[a.department] || 5000;
                          autoSendToAccounts(p, fee, `${a.department} appointment fee`);
                          const visit = checkInPatient({
                            patient: p,
                            facilityId,
                            department: a.department,
                            doctor: a.doctor,
                            visitType: 'appointment',
                            reason: a.reason,
                            paymentStatus: 'pending',
                            amount: fee,
                            appointmentId: a.id,
                            appointmentTime: a.scheduledAt.slice(11, 16),
                          });
                          notifyDoctorAssignment(visit, fullName(p));
                          reload();
                          flash(
                            a.doctor && !/^any/i.test(a.doctor)
                              ? `Appointment checked in · assigned to ${a.doctor} · Auto-sent ₦${fee.toLocaleString()} to Accounts`
                              : `Appointment checked in · Auto-sent ₦${fee.toLocaleString()} to Accounts`
                          );
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





      {/* AI contextual check-in card — human must confirm */}
            <PaystackBrandedCheckout
        open={paystackOpen}
        input={
          paystackOpen && (posPatient || selected)
            ? {
                patientName: fullName(posPatient || selected!),
                hospitalNumber: (posPatient || selected)!.hospitalNumber,
                patientEmail: (posPatient || selected)!.email,
                amountNgn: Number(posAmount) || 0,
                purpose: posPurpose || 'Hospital payment',
                facilityName: session.facility || session.hospitalId || 'Hospital',
                facilityId,
                cashierName: session.name,
                mode: posMethod === 'card' ? 'card_terminal' : 'transfer',
              }
            : null
        }
        onClose={() => setPaystackOpen(false)}
        onPaid={(r) => settlePaystackPayment(r)}
      />



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
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, background: 'rgba(255,255,255,0.22)', padding: '3px 8px', borderRadius: 6 }}>
                      📁 Folder: {selected.hospitalNumber}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, background: 'rgba(255,255,255,0.22)', padding: '3px 8px', borderRadius: 6 }}>
                      🆔 SHID: {selected.shid || 'AKSHIA-ISSUED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: 18, display: 'grid', gap: 10, fontSize: 13 }}>
              {[
                ['Hospital Folder No.', selected.hospitalNumber],
                ['State Health ID (SHID)', selected.shid || '—'],
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

              {(() => {
                const j = getPatientJourney(facilityId, selected, visits);
                return (
                  <div
                    style={{
                      marginTop: 4,
                      marginBottom: 10,
                      padding: '14px 12px',
                      borderRadius: 14,
                      background: 'linear-gradient(180deg,#F8FAFC,#fff)',
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.06em', marginBottom: 10 }}>
                      PATIENT JOURNEY
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
                      {j.steps.map((s, i) => {
                        const done = i < j.index;
                        const cur = i === j.index;
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 52 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  background: cur
                                    ? 'linear-gradient(135deg,#0052D4,#0D9488)'
                                    : done
                                      ? '#10B981'
                                      : '#E2E8F0',
                                  color: cur || done ? '#fff' : '#94A3B8',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: cur ? '0 0 0 3px rgba(2,132,199,0.25)' : 'none',
                                }}
                              >
                                {done ? '✓' : i + 1}
                              </div>
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 9,
                                  fontWeight: cur ? 800 : 600,
                                  color: cur ? C.navy : C.muted,
                                  textAlign: 'center',
                                  lineHeight: 1.2,
                                }}
                              >
                                {s.label}
                              </div>
                            </div>
                            {i < j.steps.length - 1 && (
                              <div
                                style={{
                                  height: 2,
                                  width: 8,
                                  flexShrink: 0,
                                  background: i < j.index ? '#10B981' : '#E2E8F0',
                                  marginBottom: 16,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        color: j.stage === 'pending' ? '#92400E' : j.stage === 'paid' || j.stage === 'queued' ? '#047857' : C.navy,
                        lineHeight: 1.4,
                      }}
                    >
                      {j.detail}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const gate = getPaymentGate(facilityId, selected.id, selected.hospitalNumber);
                const reqs = listAccountsRequests(facilityId, { patientId: selected.id });
                const latestReq = reqs[0];
                return (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '16px',
                      borderRadius: 14,
                      border: gate.tone === 'wait' ? '1.5px solid #FCD34D' : gate.tone === 'ok' ? '1.5px solid #6EE7B7' : `1px solid ${C.border}`,
                      background: gate.tone === 'wait' ? 'linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)' : gate.tone === 'ok' ? 'linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 100%)' : '#F8FAFC',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: gate.tone === 'wait' ? '#B45309' : gate.tone === 'ok' ? '#047857' : C.muted,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {gate.tone === 'wait' ? '⚡ Auto-Sent to Accounts' : gate.tone === 'ok' ? '✓ Payment Cleared' : 'Accounts Handoff'}
                      </span>
                      {latestReq && (
                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: C.navy, background: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: 6 }}>
                          {latestReq.invoiceNumber || latestReq.id}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: gate.tone === 'wait' ? '#92400E' : gate.tone === 'ok' ? '#065F46' : C.navy, lineHeight: 1.4 }}>
                      {gate.tone === 'wait'
                        ? `Invoice ₦${(latestReq?.amountNgn || 5000).toLocaleString()} is in Accounts Queue.`
                        : `Payment confirmed · Automatically queued for Triage.`}
                    </div>

                    <p style={{ margin: '8px 0 0', fontSize: 12, color: gate.tone === 'wait' ? '#B45309' : '#047857', lineHeight: 1.45 }}>
                      {gate.tone === 'wait'
                        ? 'Patient is currently in the Accounts Queue awaiting payment. Once cashier confirms payment, patient will automatically advance to the Triage Queue for vital signs.'
                        : 'Patient has cleared payment and automatically moved to the Triage Queue. Nurse will collect vitals and assign department.'}
                    </p>
                  </div>
                );
              })()}

              {/* Action Buttons: "Register New Patient" is next; removed all other buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPanelOpen(false);
                    setSelected(null);
                    setReg(emptyReg);
                    setRegStep(1);
                    goView('register');
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(2,132,199,0.3)',
                  }}
                >
                  <UserPlus size={18} />
                  <span>Register New Patient</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: '#F8FAFC',
                    color: C.navy,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  ← Back to Front Desk
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
