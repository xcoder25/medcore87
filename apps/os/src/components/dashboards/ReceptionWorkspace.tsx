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
  Check, Edit2, Info, UserCheck, FileText, Copy, Save, ArrowLeft,
  Plus, BarChart3, Shield,
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
  createPatientEncounter,
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
import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';
import { pushNotification } from '../../lib/notificationEngine';
import { uploadImageToS3 } from '../../lib/storageClient';
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
  | 'existing'
  | 'queue'
  | 'appointments'
  | 'payment'
  | 'search'
  | 'scan'
  | 'walkin';

type RegStep = 1 | 2 | 3 | 4 | 5;

const emptyReg = {
  firstName: '',
  lastName: '',
  middleName: '',
  dob: '',
  sex: 'Male' as FacilityPatient['sex'],
  maritalStatus: 'Single',
  nationality: 'Nigerian',
  stateOfOrigin: 'Akwa Ibom State',
  occupation: '',
  preferredLanguage: 'English',
  phone: '',
  altPhone: '',
  email: '',
  address: '',
  state: 'Akwa Ibom',
  lga: 'Uyo',
  emergencyContact: '',
  emergencyRelation: 'Spouse',
  emergencyPhone: '',
  emergencyAddress: '',
  category: 'General',
  insuranceProvider: 'NONE',
  insuranceId: '',
  nhiaNumber: '',
  employerOrg: '',
  nin: '',
  bloodGroup: '',
  genotype: '',
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

  const receptionSuggestions: SearchSuggestion[] = useMemo(() => {
    return patients.slice(0, 40).map((p) => {
      const full = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
      return {
        id: p.id,
        label: full,
        sub: p.hospitalNumber + (p.phone ? ' · Tel: ' + p.phone : '') + (p.nin ? ' · NIN: ' + p.nin : ''),
        category: p.insuranceProvider ? p.insuranceProvider.toUpperCase() : 'REGISTRY',
        icon: Users,
        onClick: () => {
          openPatient(p);
        },
      };
    });
  }, [patients]);
  const [scanCode, setScanCode] = useState('');
  const [walkStep, setWalkStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<FacilityPatient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [regStep, setRegStep] = useState<RegStep>(1);
  const [reg, setReg] = useState(emptyReg);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regTouched, setRegTouched] = useState<Record<string, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [patientIdPreview, setPatientIdPreview] = useState(() => 'PGN-2026-' + Math.floor(1000000 + Math.random() * 9000000));
  const [patientIdCopied, setPatientIdCopied] = useState(false);

  // Existing Patient Search & Visit Registration state
  const [exSearchQuery, setExSearchQuery] = useState('');
  const [exFoundPatients, setExFoundPatients] = useState<FacilityPatient[]>([]);
  const [exSelectedPatient, setExSelectedPatient] = useState<FacilityPatient | null>(null);
  const [exVisitType, setExVisitType] = useState<string>('General Consultation');
  const [exCategory, setExCategory] = useState<string>('Outpatient (OPD)');
  const [exVisitReason, setExVisitReason] = useState<string>('Regular Check-up');
  const [exPriority, setExPriority] = useState<'normal' | 'urgent' | 'emergency'>('normal');
  const [exCreatedVisit, setExCreatedVisit] = useState<ReceptionVisit | null>(null);
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
    const poll = window.setInterval(() => { if (!document.hidden) reload(); }, 20000); // 20s poll, paused when tab hidden
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

  // Existing Patient Search Effect
  useEffect(() => {
    const q = exSearchQuery.trim().toLowerCase();
    if (!q) {
      setExFoundPatients(patients.slice(0, 5));
      if (!exSelectedPatient && patients.length > 0) {
        setExSelectedPatient(patients[0]);
      }
      return;
    }
    const hits = patients.filter((p) => {
      const name = `${p.firstName} ${p.middleName || ''} ${p.lastName}`.toLowerCase();
      const num = (p.hospitalNumber || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const nin = (p.nin || '').toLowerCase();
      return name.includes(q) || num.includes(q) || phone.includes(q) || nin.includes(q);
    });
    setExFoundPatients(hits);
    if (hits.length > 0 && (!exSelectedPatient || !hits.some((h) => h.id === exSelectedPatient.id))) {
      setExSelectedPatient(hits[0]);
    }
  }, [exSearchQuery, patients]);

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
    void uploadImageToS3(url, { folder: 'patients' }).then((res) => {
      if (res.ok && res.url) {
        setReg((r) => ({ ...r, photoDataUrl: res.url }));
        flash('Photo stored to AWS S3');
      }
    });
  };

  const onPhotoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setReg((r) => ({ ...r, photoDataUrl: dataUrl }));
      void uploadImageToS3(file, { folder: 'patients' }).then((res) => {
        if (res.ok && res.url) {
          setReg((r) => ({ ...r, photoDataUrl: res.url }));
          flash('Photo uploaded to AWS S3');
        }
      });
    };
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

  const getCalculatedAge = useCallback((dobString: string): string => {
    if (!dobString) return '';
    const b = new Date(dobString);
    if (isNaN(b.getTime())) return '';
    const now = new Date();
    let years = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) {
      years--;
    }
    if (years < 0) return '';
    if (years === 0) {
      const months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
      if (months <= 0) {
        const days = Math.floor((now.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
        return `${Math.max(0, days)} day${days === 1 ? '' : 's'}`;
      }
      return `${months} mo`;
    }
    return `${years} yrs`;
  }, []);

  const validateField = useCallback((field: string, val: any, currentReg = reg): string => {
    const value = val !== undefined && val !== null ? String(val).trim() : '';
    switch (field) {
      case 'firstName':
        if (!value) return 'First name is required';
        if (value.length < 2) return 'First name must be at least 2 characters';
        return '';
      case 'lastName':
        if (!value) return 'Last name is required';
        if (value.length < 2) return 'Last name must be at least 2 characters';
        return '';
      case 'dob':
        if (!value) return 'Date of birth is required';
        if (new Date(value) > new Date()) return 'Date of birth cannot be in the future';
        return '';
      case 'sex':
        if (!value) return 'Biological sex is required';
        return '';
      case 'nin':
        if (value) {
          const digits = value.replace(/\D/g, '');
          if (digits.length !== 11) return 'NIN must be exactly 11 digits';
        }
        if (ninStatus === 'conflict') return 'Duplicate NIN: already assigned to another patient';
        return '';
      case 'maritalStatus':
        if (!value) return 'Marital status is required';
        return '';
      case 'preferredLanguage':
        if (!value) return 'Preferred language is required';
        return '';
      case 'phone': {
        const digits = value.replace(/\D/g, '');
        if (!digits) return 'Phone number is required';
        if (digits.length < 10 || digits.length > 14) return 'Valid 11-digit phone number is required (e.g. 08012345678)';
        return '';
      }
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Enter a valid email address';
        }
        return '';
      case 'address':
        if (!value) return 'Residential address is required for official medical folder';
        if (value.length < 3) return 'Please enter complete street or residential address';
        return '';
      case 'state':
        if (!value) return 'State of residence is required';
        return '';
      case 'lga':
        if (!value) return 'Local Government Area (LGA) is required';
        return '';
      case 'emergencyContact':
        if (!value) return 'Next of kin / emergency contact name is required';
        if (value.length < 3) return 'Please provide full name for next of kin';
        return '';
      case 'emergencyRelation':
        if (!value) return 'Relationship to patient is required (e.g. Spouse, Parent, Sibling)';
        return '';
      case 'category':
        if (!value) return 'Patient billing category is required';
        return '';
      case 'insuranceProvider':
        if (currentReg.category !== 'General' && (!value || value === 'NONE')) {
          return 'Please select an insurance / HMO provider';
        }
        return '';
      case 'insuranceId':
        if (currentReg.category !== 'General' && !value && !String(currentReg.nhiaNumber || '').trim()) {
          return 'Policy / Enrollee number is required for insured patients';
        }
        return '';
      default:
        return '';
    }
  }, [reg, ninStatus]);

  const validateStep = useCallback((step: RegStep, currentReg = reg): boolean => {
    const errors: Record<string, string> = {};
    if (step === 1) {
      const e1 = validateField('firstName', currentReg.firstName, currentReg);
      if (e1) errors.firstName = e1;
      const e2 = validateField('lastName', currentReg.lastName, currentReg);
      if (e2) errors.lastName = e2;
      const e3 = validateField('dob', currentReg.dob, currentReg);
      if (e3) errors.dob = e3;
      const e4 = validateField('sex', currentReg.sex, currentReg);
      if (e4) errors.sex = e4;
      const e5 = validateField('maritalStatus', currentReg.maritalStatus, currentReg);
      if (e5) errors.maritalStatus = e5;
      const e6 = validateField('preferredLanguage', currentReg.preferredLanguage, currentReg);
      if (e6) errors.preferredLanguage = e6;
      const e7 = validateField('nin', currentReg.nin, currentReg);
      if (e7) errors.nin = e7;
    } else if (step === 2) {
      const e1 = validateField('phone', currentReg.phone, currentReg);
      if (e1) errors.phone = e1;
      const e2 = validateField('email', currentReg.email, currentReg);
      if (e2) errors.email = e2;
      const e3 = validateField('address', currentReg.address, currentReg);
      if (e3) errors.address = e3;
      const e4 = validateField('state', currentReg.state, currentReg);
      if (e4) errors.state = e4;
      const e5 = validateField('lga', currentReg.lga, currentReg);
      if (e5) errors.lga = e5;
    } else if (step === 3) {
      const e1 = validateField('emergencyContact', currentReg.emergencyContact, currentReg);
      if (e1) errors.emergencyContact = e1;
      const e2 = validateField('emergencyRelation', currentReg.emergencyRelation, currentReg);
      if (e2) errors.emergencyRelation = e2;
    } else if (step === 4) {
      if (currentReg.category !== 'General' && (!currentReg.insuranceProvider || currentReg.insuranceProvider === 'NONE')) {
        errors.insuranceProvider = 'Please select your insurance scheme / HMO provider';
      }
      if (currentReg.category !== 'General' && !currentReg.insuranceId && !currentReg.nhiaNumber) {
        errors.insuranceId = 'Policy / Enrollee ID is required for health scheme coverage';
      }
    }

    setRegErrors((prev) => {
      const stepFields =
        step === 1 ? ['firstName', 'lastName', 'dob', 'sex', 'maritalStatus', 'preferredLanguage', 'nin']
        : step === 2 ? ['phone', 'email', 'address', 'state', 'lga']
        : step === 3 ? ['emergencyContact', 'emergencyRelation']
        : step === 4 ? ['category', 'insuranceProvider', 'insuranceId']
        : [];
      const next = { ...prev };
      stepFields.forEach((f) => delete next[f]);
      return { ...next, ...errors };
    });

    setRegTouched((prev) => {
      const next = { ...prev };
      if (step === 1) ['firstName', 'lastName', 'dob', 'sex', 'maritalStatus', 'preferredLanguage'].forEach((f) => { next[f] = true; });
      if (step === 2) ['phone', 'email', 'address', 'state', 'lga'].forEach((f) => { next[f] = true; });
      if (step === 3) ['emergencyContact', 'emergencyRelation'].forEach((f) => { next[f] = true; });
      if (step === 4) ['category', 'insuranceProvider', 'insuranceId'].forEach((f) => { next[f] = true; });
      return next;
    });

    const valid = Object.keys(errors).length === 0;
    if (!valid) {
      const firstKey = Object.keys(errors)[0];
      flash(`⚠️ Required field missing: ${errors[firstKey]}`);
    }
    return valid;
  }, [reg, validateField]);

  const updateRegField = (field: string, val: any) => {
    setReg((prev) => {
      const next = { ...prev, [field]: val };
      if (regTouched[field]) {
        const err = validateField(field, val, next);
        setRegErrors((prevErr) => {
          const nextErr = { ...prevErr };
          if (!err) delete nextErr[field];
          else nextErr[field] = err;
          return nextErr;
        });
      }
      return next;
    });
  };

  const touchRegField = (field: string) => {
    setRegTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, (reg as any)[field], reg);
    setRegErrors((prev) => {
      const next = { ...prev };
      if (!err) delete next[field];
      else next[field] = err;
      return next;
    });
  };

  const handleNextStep = () => {
    if (!validateStep(regStep)) {
      return;
    }
    setCompletedSteps((prev) => ({ ...prev, [regStep]: true }));
    setRegStep((s) => (s < 5 ? ((s + 1) as RegStep) : s));
  };

  const handleStepJump = (target: RegStep) => {
    if (target === regStep) return;
    if (target < regStep) {
      setRegStep(target);
      return;
    }
    for (let s = 1; s < target; s++) {
      if (!validateStep(s as RegStep)) {
        setRegStep(s as RegStep);
        return;
      }
    }
    setRegStep(target);
  };

  const resetRegistrationForm = () => {
    setReg(emptyReg);
    setRegErrors({});
    setRegTouched({});
    setCompletedSteps({});
    setRegStep(1);
    setPatientIdPreview('PGN-' + new Date().getFullYear() + '-' + Math.floor(1000000 + Math.random() * 9000000));
    setPatientIdCopied(false);
    setNinStatus('idle');
    setNinConflictPatient(null);
    setCrossFacilityPatient(null);
    setInsVerify(null);
    stopCam();
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return '';
    try {
      const birth = new Date(dobString);
      if (isNaN(birth.getTime())) return '';
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return `${Math.max(0, age)} years`;
    } catch {
      return '';
    }
  };

  const handleRegisterExistingVisit = () => {
    if (!exSelectedPatient) {
      flash('Please search and select a patient first.');
      return;
    }
    const visitTypeMap: Record<string, VisitType> = {
      'General Consultation': 'walkin',
      'Specialist Consultation': 'appointment',
      Emergency: 'emergency',
      'Follow-up': 'appointment',
      'Routine Checkup': 'walkin',
      'Antenatal / ANC': 'walkin',
      Immunization: 'walkin',
    };
    const vt = visitTypeMap[exVisitType] || 'walkin';
    const isEmerg = exPriority === 'emergency' || vt === 'emergency';

    const visit = createPatientEncounter({
      patient: exSelectedPatient,
      facilityId,
      department: exVisitType.includes('Antenatal') ? 'ANC' : isEmerg ? 'Emergency' : ciDept || 'General OPD',
      doctor: 'Any available',
      visitType: vt,
      category: exCategory,
      priority: exPriority,
      reason: exVisitReason,
      paymentStatus: isEmerg ? 'waived' : (exSelectedPatient.insuranceProvider && exSelectedPatient.insuranceProvider !== 'NONE') ? 'hmo' : 'pending',
      amount: isEmerg ? 10000 : 5000,
    });

    setExCreatedVisit(visit);
    reload();
    emitLiveAction(`Encounter registered · WAITING_FOR_TRIAGE · ${visit.hospitalNumber}`, { module: 'reception' });
    flash(`✓ Encounter ${visit.encounterId || visit.id} registered for ${fullName(exSelectedPatient)} (#${visit.queueNumber}) · Queued to Nurse Triage (WAITING_FOR_TRIAGE)`);
  };

  const saveRegistration = () => {
    // Enforce UX Rule: Form CANNOT proceed if required fields are missing
    if (!validateStep(1)) { setRegStep(1); return; }
    if (!validateStep(2)) { setRegStep(2); return; }
    if (!validateStep(3)) { setRegStep(3); return; }
    if (!validateStep(4)) { setRegStep(4); return; }

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
      hospitalNumber: patientIdPreview || generateHospitalNumber(facilityId),
      shid,
      firstName: reg.firstName.trim(),
      middleName: reg.middleName.trim() || undefined,
      lastName: reg.lastName.trim(),
      dob: reg.dob,
      sex: reg.sex,
      maritalStatus: reg.maritalStatus,
      nationality: reg.nationality,
      stateOfOrigin: reg.stateOfOrigin,
      occupation: reg.occupation || undefined,
      preferredLanguage: reg.preferredLanguage,
      phone: reg.phone.trim(),
      email: reg.email.trim() || undefined,
      address: reg.address.trim() || undefined,
      state: reg.state,
      lga: reg.lga,
      emergencyContact: reg.emergencyContact || undefined,
      emergencyRelation: reg.emergencyRelation || undefined,
      emergencyPhone: reg.emergencyPhone || undefined,
      emergencyAddress: reg.emergencyAddress || undefined,
      category: reg.category,
      insuranceProvider: reg.insuranceProvider === 'NONE' ? undefined : reg.insuranceProvider,
      insuranceId: reg.insuranceId || undefined,
      nhiaNumber: reg.nhiaNumber || undefined,
      nin: reg.nin || undefined,
      bloodGroup: reg.bloodGroup || undefined,
      genotype: reg.genotype || undefined,
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

    // Enforce Hospi Patient-Flow Rule:
    // Create new visit/encounter routed directly to Nurse Triage:
    // REGISTERED → WAITING_FOR_TRIAGE
    const initialVisit = createPatientEncounter({
      patient,
      facilityId,
      department: 'General OPD',
      doctor: 'Any available',
      visitType: 'walkin',
      category: 'Outpatient (OPD)',
      priority: 'normal',
      reason: 'Initial Registration & Baseline Triage',
      paymentStatus: (patient.insuranceProvider && patient.insuranceProvider !== 'NONE') ? 'hmo' : 'pending',
    });

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
    resetRegistrationForm();
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
      flash('Digital payments (AkwaRemit POS & Bank Transfer) are processed at Accounts / Cashier Desk');
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
            <div style={{ flex: 1 }}>
              <InteractiveSearchBar
                autoFocus
                value={query}
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder="Search name, hospital no., phone, NHIA, NIN…"
                suggestions={receptionSuggestions}
                resultsCount={searchHits.length}
                totalCount={patients.length}
                size="md"
                aria-label="Search patient registry"
              />
            </div>
            {patients.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete all test patients for this facility? This action cannot be undone.')) {
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

            {/* REGISTER — NEW PATIENT REGISTRATION FORM */}
      {view === 'register' && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.28)',
                }}
              >
                <UserPlus size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  Patient Registration
                </h1>
                <p style={{ margin: '3px 0 0 0', fontSize: 13, color: '#64748B' }}>
                  Register a new patient and create their hospital record.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => goView('existing')}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'all 0.15s ease',
                }}
              >
                <UserCheck size={16} color="#0284C7" />
                <span>Existing Patient →</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (reg.firstName || reg.lastName) {
                    if (!window.confirm('Clear form and start a new registration?')) return;
                  }
                  resetRegistrationForm();
                  flash('New registration initialized.');
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0284C7',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={16} />
                <span>New Registration</span>
              </button>
            </div>
          </div>

          {/* Stepper Bar */}
          <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              {[
                { step: 1 as RegStep, label: 'Personal Information' },
                { step: 2 as RegStep, label: 'Contact Details' },
                { step: 3 as RegStep, label: 'Next of Kin' },
                { step: 4 as RegStep, label: 'Insurance & Scheme' },
                { step: 5 as RegStep, label: 'Review & Register' },
              ].map(({ step, label }, idx, arr) => {
                const isActive = regStep === step;
                const isPassed = regStep > step || completedSteps[step];
                const isLast = idx === arr.length - 1;

                return (
                  <React.Fragment key={step}>
                    <button
                      type="button"
                      onClick={() => handleStepJump(step)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        padding: 0,
                        zIndex: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: isActive ? '#0284C7' : isPassed ? '#10B981' : '#E2E8F0',
                          color: isActive ? '#fff' : isPassed ? '#fff' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12.5,
                          boxShadow: isActive ? '0 0 0 4px rgba(2, 132, 199, 0.18)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isPassed && !isActive ? <Check size={15} /> : step}
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 800 : isPassed ? 700 : 500,
                          color: isActive ? '#0284C7' : isPassed ? '#0F172A' : '#64748B',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </span>
                    </button>

                    {!isLast && (
                      <div
                        style={{
                          flex: 1,
                          height: 2,
                          background: isPassed ? '#10B981' : '#E2E8F0',
                          margin: '0 12px',
                          transition: 'all 0.3s ease',
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Form Content Body: 2-Column Responsive Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: 20, padding: 24, alignItems: 'start' }}>
            {/* Left Form Area */}
            <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: 22 }}>
              {/* STEP 1: PERSONAL INFORMATION */}
              {regStep === 1 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Personal Information</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Enter the patient's basic details</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: 24 }}>
                    {/* Photo + Patient ID Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 120,
                          height: 120,
                          borderRadius: '50%',
                          background: '#F1F5F9',
                          border: '2px dashed #CBD5E1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {reg.photoDataUrl ? (
                          <img src={reg.photoDataUrl} alt="Patient preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={54} color="#94A3B8" />
                        )}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#0284C7',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          }}
                        >
                          <Camera size={14} />
                        </div>
                      </div>

                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          background: '#fff',
                          color: '#0F172A',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => updateRegField('photoDataUrl', String(reader.result || ''));
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: -8 }}>JPG, PNG up to 2MB</div>

                      {/* Patient ID readonly box with copy icon */}
                      <div style={{ width: '100%', marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Patient ID</div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            padding: '6px 10px',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                            {patientIdPreview}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(patientIdPreview);
                              setPatientIdCopied(true);
                              flash('Patient ID copied to clipboard');
                              setTimeout(() => setPatientIdCopied(false), 2000);
                            }}
                            title="Copy Patient ID"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: patientIdCopied ? '#16A34A' : '#64748B' }}
                          >
                            {patientIdCopied ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Fields 2-Column Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          First Name <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={reg.firstName}
                          placeholder="e.g. Blessing"
                          onChange={(e) => updateRegField('firstName', e.target.value)}
                          onBlur={() => touchRegField('firstName')}
                          style={{ ...inputStyle, borderColor: regErrors.firstName && regTouched.firstName ? '#DC2626' : '#CBD5E1' }}
                        />
                        {regErrors.firstName && regTouched.firstName && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{regErrors.firstName}</div>}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Middle Name
                        </label>
                        <input
                          type="text"
                          value={reg.middleName}
                          placeholder="e.g. Okafor"
                          onChange={(e) => updateRegField('middleName', e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Last Name <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={reg.lastName}
                          placeholder="e.g. Uche"
                          onChange={(e) => updateRegField('lastName', e.target.value)}
                          onBlur={() => touchRegField('lastName')}
                          style={{ ...inputStyle, borderColor: regErrors.lastName && regTouched.lastName ? '#DC2626' : '#CBD5E1' }}
                        />
                        {regErrors.lastName && regTouched.lastName && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{regErrors.lastName}</div>}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Date of Birth <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <input
                          type="date"
                          value={reg.dob}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => updateRegField('dob', e.target.value)}
                          onBlur={() => touchRegField('dob')}
                          style={{ ...inputStyle, borderColor: regErrors.dob && regTouched.dob ? '#DC2626' : '#CBD5E1' }}
                        />
                        {regErrors.dob && regTouched.dob && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{regErrors.dob}</div>}
                      </div>

                      {/* Gender Segmented Button Pills */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          Gender <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['Male', 'Female', 'Other'] as const).map((g) => {
                            const isSel = reg.sex === g;
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => updateRegField('sex', g)}
                                style={{
                                  flex: 1,
                                  padding: '8px 4px',
                                  borderRadius: 8,
                                  border: isSel ? '2px solid #0284C7' : '1px solid #CBD5E1',
                                  background: isSel ? '#EFF6FF' : '#fff',
                                  color: isSel ? '#0284C7' : '#475569',
                                  fontWeight: isSel ? 800 : 600,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                {g === 'Male' ? '♂ Male' : g === 'Female' ? '♀ Female' : '⚥ Other'}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Marital Status <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <select
                          value={reg.maritalStatus}
                          onChange={(e) => updateRegField('maritalStatus', e.target.value)}
                          style={inputStyle}
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Nationality <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <select
                          value={reg.nationality}
                          onChange={(e) => updateRegField('nationality', e.target.value)}
                          style={inputStyle}
                        >
                          <option value="Nigerian">Nigerian</option>
                          <option value="Ghanaian">Ghanaian</option>
                          <option value="Cameroonian">Cameroonian</option>
                          <option value="Other">Other Nationality</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          State of Origin <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <select
                          value={reg.stateOfOrigin}
                          onChange={(e) => updateRegField('stateOfOrigin', e.target.value)}
                          style={inputStyle}
                        >
                          <option value="Akwa Ibom State">Akwa Ibom State</option>
                          <option value="Lagos State">Lagos State</option>
                          <option value="Rivers State">Rivers State</option>
                          <option value="Cross River State">Cross River State</option>
                          <option value="Abia State">Abia State</option>
                          <option value="Imo State">Imo State</option>
                          <option value="Delta State">Delta State</option>
                          <option value="Edo State">Edo State</option>
                          <option value="Enugu State">Enugu State</option>
                          <option value="Oyo State">Oyo State</option>
                          <option value="Kano State">Kano State</option>
                          <option value="FCT Abuja">FCT Abuja</option>
                          <option value="Other State">Other State</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Occupation
                        </label>
                        <input
                          type="text"
                          value={reg.occupation}
                          placeholder="e.g. Teacher, Civil Servant"
                          onChange={(e) => updateRegField('occupation', e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Preferred Language <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <select
                          value={reg.preferredLanguage}
                          onChange={(e) => updateRegField('preferredLanguage', e.target.value)}
                          style={inputStyle}
                        >
                          <option value="English">English</option>
                          <option value="Ibibio">Ibibio</option>
                          <option value="Annang">Annang</option>
                          <option value="Oro (Oron)">Oro (Oron)</option>
                          <option value="Yoruba">Yoruba</option>
                          <option value="Hausa">Hausa</option>
                          <option value="Igbo">Igbo</option>
                          <option value="Pidgin">Nigerian Pidgin</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: CONTACT DETAILS */}
              {regStep === 2 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Phone size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Contact Details</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Patient telephone, email, and residential address</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Phone Number <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        value={reg.phone}
                        placeholder="08012345678"
                        onChange={(e) => updateRegField('phone', e.target.value)}
                        onBlur={() => touchRegField('phone')}
                        style={{ ...inputStyle, borderColor: regErrors.phone && regTouched.phone ? '#DC2626' : '#CBD5E1' }}
                      />
                      {regErrors.phone && regTouched.phone && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{regErrors.phone}</div>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Alternate Phone
                      </label>
                      <input
                        type="tel"
                        value={reg.altPhone}
                        placeholder="Optional backup phone"
                        onChange={(e) => updateRegField('altPhone', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={reg.email}
                        placeholder="patient@example.com (optional)"
                        onChange={(e) => updateRegField('email', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Residential Address <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={reg.address}
                        placeholder="House number, Street name, Community / Town"
                        onChange={(e) => updateRegField('address', e.target.value)}
                        onBlur={() => touchRegField('address')}
                        style={{ ...inputStyle, borderColor: regErrors.address && regTouched.address ? '#DC2626' : '#CBD5E1' }}
                      />
                      {regErrors.address && regTouched.address && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{regErrors.address}</div>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        State of Residence <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={reg.state}
                        onChange={(e) => updateRegField('state', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Akwa Ibom">Akwa Ibom</option>
                        <option value="Cross River">Cross River</option>
                        <option value="Rivers">Rivers</option>
                        <option value="Abia">Abia</option>
                        <option value="Lagos">Lagos</option>
                        <option value="FCT Abuja">FCT Abuja</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        LGA of Residence <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={reg.lga}
                        onChange={(e) => updateRegField('lga', e.target.value)}
                        style={inputStyle}
                      >
                        {AKWA_IBOM_LGAS.map((lga) => (
                          <option key={lga} value={lga}>{lga}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: NEXT OF KIN */}
              {regStep === 3 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Next of Kin Details</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Primary emergency contact and relationship</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Next of Kin Full Name <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={reg.emergencyContact}
                        placeholder="Full name of next of kin"
                        onChange={(e) => updateRegField('emergencyContact', e.target.value)}
                        onBlur={() => touchRegField('emergencyContact')}
                        style={{ ...inputStyle, borderColor: regErrors.emergencyContact && regTouched.emergencyContact ? '#DC2626' : '#CBD5E1' }}
                      />
                      {regErrors.emergencyContact && regTouched.emergencyContact && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{regErrors.emergencyContact}</div>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Relationship to Patient <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={reg.emergencyRelation}
                        onChange={(e) => updateRegField('emergencyRelation', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent (Mother / Father)</option>
                        <option value="Child">Child (Son / Daughter)</option>
                        <option value="Sibling">Sibling (Brother / Sister)</option>
                        <option value="Guardian">Legal Guardian</option>
                        <option value="Relative">Extended Relative</option>
                        <option value="Colleague">Work Colleague / Friend</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Next of Kin Phone Number
                      </label>
                      <input
                        type="tel"
                        value={reg.emergencyPhone}
                        placeholder="080XXXXXXXX"
                        onChange={(e) => updateRegField('emergencyPhone', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Next of Kin Residential Address
                      </label>
                      <input
                        type="text"
                        value={reg.emergencyAddress}
                        placeholder="Same as patient, or specify town"
                        onChange={(e) => updateRegField('emergencyAddress', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ShieldCheck size={18} color="#16A34A" />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                          Next of kin is registered as authorized primary contact for emergency notifications and clinical consents.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: INSURANCE & SCHEME WITH ELIGIBILITY VERIFICATION */}
              {regStep === 4 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Insurance & Scheme Verification</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Payer scheme, HMO enrollment, and real-time eligibility check</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Billing / Payment Category <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={reg.category}
                        onChange={(e) => {
                          const cat = e.target.value;
                          updateRegField('category', cat);
                          if (cat === 'General') {
                            updateRegField('insuranceProvider', 'NONE');
                            setInsVerify(null);
                          } else if (cat === 'AKSHIA') {
                            updateRegField('insuranceProvider', 'AKSHIA');
                          } else if (cat === 'NHIA') {
                            updateRegField('insuranceProvider', 'NHIA');
                          }
                        }}
                        style={inputStyle}
                      >
                        <option value="General">General (Self-pay / Out of Pocket)</option>
                        <option value="AKSHIA">AKSHIA (Akwa Ibom State Health Scheme)</option>
                        <option value="NHIA">NHIA (National Health Insurance Authority)</option>
                        <option value="HMO">Commercial Managed Care (Private HMO)</option>
                        <option value="Corporate">Corporate / Hospital Retainership</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Insurance / Scheme Provider
                      </label>
                      <select
                        value={reg.insuranceProvider}
                        disabled={reg.category === 'General'}
                        onChange={(e) => updateRegField('insuranceProvider', e.target.value)}
                        style={{ ...inputStyle, background: reg.category === 'General' ? '#F1F5F9' : '#fff' }}
                      >
                        {NIGERIA_INSURANCE.map((ins) => (
                          <option key={ins.id} value={ins.id}>{ins.name}</option>
                        ))}
                      </select>
                    </div>

                    {reg.category !== 'General' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                            Policy / Enrollee / NHIA Number <span style={{ color: '#DC2626' }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={reg.insuranceId || reg.nhiaNumber}
                            placeholder="e.g. AKS/1029482 or NHIA-29402"
                            onChange={(e) => {
                              updateRegField('insuranceId', e.target.value);
                              updateRegField('nhiaNumber', e.target.value);
                            }}
                            style={{ ...inputStyle, borderColor: regErrors.insuranceId ? '#DC2626' : '#CBD5E1' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                            Employer / Organization (Optional)
                          </label>
                          <input
                            type="text"
                            value={reg.employerOrg}
                            placeholder="Ministry / Company name"
                            onChange={(e) => updateRegField('employerOrg', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        {/* Verify Eligibility Action Button & Results Card */}
                        <div style={{ gridColumn: 'span 2' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={() => {
                                const idToVerify = reg.insuranceId || reg.nhiaNumber || 'TEST-ENROLLEE';
                                const res = verifyInsurance(reg.insuranceProvider, idToVerify);
                                setInsVerify(res);
                                flash(res.ok ? '✓ Insurance eligibility verified' : res.message);
                              }}
                              style={{
                                padding: '9px 18px',
                                borderRadius: 10,
                                border: 'none',
                                background: '#0D9488',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 13,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                              }}
                            >
                              <ShieldCheck size={16} />
                              <span>Verify Eligibility</span>
                            </button>
                            <span style={{ fontSize: 12, color: '#64748B' }}>
                              Instant query to AKSHIA / NHIA / HMO insurance clearinghouse
                            </span>
                          </div>

                          {insVerify && (
                            <div
                              style={{
                                marginTop: 14,
                                padding: 14,
                                borderRadius: 12,
                                background: insVerify.status === 'active' ? '#F0FDF4' : '#FFFBEB',
                                border: `1px solid ${insVerify.status === 'active' ? '#BBF7D0' : '#FDE68A'}`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: insVerify.status === 'active' ? '#16A34A' : '#D97706' }} />
                                  <strong style={{ fontSize: 13, color: insVerify.status === 'active' ? '#166534' : '#92400E' }}>
                                    {insVerify.message}
                                  </strong>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0' }}>
                                  Valid to: {insVerify.expiry || '31 Dec 2026'}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#334155', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <span><strong>Plan:</strong> {insVerify.plan}</span>
                                {insVerify.copay && <span><strong>Co-pay:</strong> {insVerify.copay}</span>}
                                {insVerify.authorizationCode && <span><strong>Pre-auth token:</strong> {insVerify.authorizationCode}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {reg.category === 'General' && (
                      <div style={{ gridColumn: 'span 2', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontSize: 12.5 }}>
                          <Wallet size={16} color="#0284C7" />
                          <span>Self-pay patient: Standard facility tariffs apply (AkwaRemit POS, Cash, or Direct Transfer).</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW & REGISTER */}
              {regStep === 5 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Dossier Review & Encounter Confirmation</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Confirm all patient demographics and hospital flow routing</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 16 }}>
                    <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Identity</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{reg.firstName} {reg.middleName} {reg.lastName}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        {reg.sex} · DOB: {reg.dob} ({calculateAge(reg.dob)}) · {reg.maritalStatus}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{reg.nationality} · {reg.stateOfOrigin}</div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Contact & Residence</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{reg.phone}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{reg.address}</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{reg.lga}, {reg.state} State</div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Next of Kin</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{reg.emergencyContact}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Relationship: {reg.emergencyRelation}</div>
                      {reg.emergencyPhone && <div style={{ fontSize: 12, color: '#475569' }}>Phone: {reg.emergencyPhone}</div>}
                    </div>

                    <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Payment & Scheme</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{reg.category}</div>
                      {reg.category !== 'General' && (
                        <div style={{ fontSize: 12, color: '#0284C7', marginTop: 2 }}>
                          {reg.insuranceProvider} · ID: {reg.insuranceId || reg.nhiaNumber}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Standard Hospital Clinical Flow Alert */}
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0284C7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Stethoscope size={16} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, color: '#1E3A8A' }}>
                          Standard Hospital Flow Rule: Mandatory Nurse Triage
                        </strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
                          Registering this patient will create permanent record <strong>#{patientIdPreview}</strong> and immediately generate encounter status: 
                          <span style={{ fontWeight: 800, background: '#DBEAFE', padding: '2px 6px', borderRadius: 4, margin: '0 4px' }}>WAITING_FOR_TRIAGE</span>.
                          The patient cannot bypass nurse triage to doctor consultation.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Summary Sidebar (Matching Reference Design) */}
            <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <FileText size={16} color="#0284C7" />
                <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Registration Summary</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, marginBottom: 18 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {reg.photoDataUrl ? (
                    <img src={reg.photoDataUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={36} color="#0284C7" />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', letterSpacing: '-0.01em' }}>
                    {patientIdPreview}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 3,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: '#EFF6FF',
                      color: '#0284C7',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    New Patient
                  </span>
                </div>
              </div>

              {/* Registration Progress */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>
                  <span>Registration Progress</span>
                  <span style={{ color: '#0284C7' }}>{regStep * 20}%</span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#E2E8F0', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(regStep / 5) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #0284C7, #10B981)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Registration Status */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Registration Status</div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: '#EFF6FF',
                    color: '#0284C7',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0284C7' }} />
                  <span>In Progress</span>
                </div>
              </div>

              {/* Registration Date */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Registration Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', fontWeight: 600 }}>
                  <Calendar size={14} color="#64748B" />
                  <span>
                    {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Privacy Badge Card */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Shield size={18} color="#0284C7" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>Secure Patient Registration</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                    Patient information is protected under hospital privacy and data protection policies.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${C.border}`,
              background: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset registration form?')) resetRegistrationForm();
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={14} />
                <span>Reset Form</span>
              </button>
              <button
                type="button"
                onClick={() => flash('Draft saved locally.')}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Save size={14} />
                <span>Save as Draft</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={regStep === 1}
                onClick={() => setRegStep((s) => (s > 1 ? ((s - 1) as RegStep) : s))}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: regStep === 1 ? '#F1F5F9' : '#fff',
                  color: regStep === 1 ? '#94A3B8' : '#0F172A',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: regStep === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ArrowLeft size={14} />
                <span>Previous</span>
              </button>

              {regStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  style={{
                    padding: '9px 22px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0284C7',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  <span>Next Step</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveRegistration}
                  style={{
                    padding: '9px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#16A34A',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Register & Queue to Triage</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EXISTING PATIENT VISIT / ENCOUNTER REGISTRATION VIEW */}
      {view === 'existing' && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.28)',
                }}
              >
                <UserCheck size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  Existing Patient
                </h1>
                <p style={{ margin: '3px 0 0 0', fontSize: 13, color: '#64748B' }}>
                  Find an existing patient and register them for a new visit.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => goView('register')}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#0284C7',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Plus size={16} />
              <span>New Patient</span>
            </button>
          </div>

          {/* Search Patient Bar */}
          <div style={{ padding: '20px 24px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={16} color="#0284C7" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Search Patient</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Search by Patient ID, phone number or patient name
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
                <input
                  type="text"
                  value={exSearchQuery}
                  onChange={(e) => setExSearchQuery(e.target.value)}
                  placeholder="Enter Patient ID, phone number or name..."
                  style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 36,
                    paddingRight: 12,
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#fff',
                    fontSize: 13,
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const hits = searchPatients(exSearchQuery, facilityId);
                  setExFoundPatients(hits);
                }}
                style={{
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0284C7',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Search size={14} />
                <span>Search</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 12 }}>
                <span>Or scan ID card</span>
                <button
                  type="button"
                  onClick={() => goView('scan')}
                  style={{
                    height: 40,
                    padding: '0 16px',
                    borderRadius: 10,
                    border: '1px solid #BFDBFE',
                    background: '#EFF6FF',
                    color: '#0284C7',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <QrCode size={16} />
                  <span>Scan Card</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main 2-Column Body */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: 20, padding: 24, alignItems: 'start' }}>
            {/* Left Column: Search Results + Visit Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Search Results Card */}
              <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} color="#0284C7" />
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Search Results</span>
                  </div>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: '#ECFDF5',
                      color: '#047857',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {exFoundPatients.length} Patient{exFoundPatients.length === 1 ? '' : 's'} Found
                  </span>
                </div>

                {exFoundPatients.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {exFoundPatients.slice(0, 3).map((p) => {
                      const isSelected = exSelectedPatient?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            border: isSelected ? '2px solid #0284C7' : '1px solid #E2E8F0',
                            background: isSelected ? '#EFF6FF' : '#F8FAFC',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            cursor: 'pointer',
                          }}
                          onClick={() => setExSelectedPatient(p)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: '#E2E8F0',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {p.photoUrl ? (
                                <img src={p.photoUrl} alt={fullName(p)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <User size={22} color="#64748B" />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
                                {fullName(p)}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                                PID: <strong style={{ color: '#0284C7' }}>{p.hospitalNumber}</strong>
                              </div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                DOB: {p.dob} ({calculateAge(p.dob)}) · {p.sex} · {p.phone}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExSelectedPatient(p);
                            }}
                            style={{
                              padding: '7px 14px',
                              borderRadius: 8,
                              border: isSelected ? '2px solid #0284C7' : '1px solid #CBD5E1',
                              background: isSelected ? '#0284C7' : '#fff',
                              color: isSelected ? '#fff' : '#0284C7',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>{isSelected ? 'Selected' : 'Select Patient'}</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13 }}>
                    No patient records found matching "{exSearchQuery}". You can register a new patient using the button above.
                  </div>
                )}
              </div>

              {/* Register Visit for This Patient Form */}
              {exSelectedPatient && (
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileSpreadsheet size={18} color="#0284C7" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>Register Visit for This Patient</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>Create a new visit/encounter for the selected patient.</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Visit Type <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={exVisitType}
                        onChange={(e) => setExVisitType(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="General Consultation">General Consultation</option>
                        <option value="Specialist Consultation">Specialist Consultation</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="Routine Checkup">Routine Checkup</option>
                        <option value="Antenatal / ANC">Antenatal / ANC</option>
                        <option value="Immunization">Immunization</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Registration Category <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={exCategory}
                        onChange={(e) => setExCategory(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Outpatient (OPD)">Outpatient (OPD)</option>
                        <option value="Inpatient (IPD)">Inpatient (IPD)</option>
                        <option value="Emergency (A&E)">Emergency (A&E)</option>
                        <option value="Day Case">Day Case</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Visit Reason <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={exVisitReason}
                        onChange={(e) => setExVisitReason(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Regular Check-up">Regular Check-up</option>
                        <option value="Malaria Symptoms">Malaria Symptoms (Fever, chills)</option>
                        <option value="Acute Illness">Acute Illness</option>
                        <option value="Chronic Condition Follow-up">Chronic Condition Follow-up (HTN / DM)</option>
                        <option value="Trauma / Injury">Trauma / Physical Injury</option>
                        <option value="Maternal / Antenatal Care">Maternal / Antenatal Care</option>
                        <option value="Immunization Review">Immunization Review</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Priority Level <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <select
                        value={exPriority}
                        onChange={(e) => setExPriority(e.target.value as any)}
                        style={inputStyle}
                      >
                        <option value="normal">● Normal (Routine OPD queue)</option>
                        <option value="urgent">● Urgent (High temperature, severe pain)</option>
                        <option value="emergency">● Emergency (Immediate clinical triage)</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#1E40AF' }}>
                        <Info size={16} color="#0284C7" />
                        <span>
                          <strong>Clinical Governance:</strong> Creating this encounter immediately issues queue status <strong>WAITING_FOR_TRIAGE</strong>. Existing patients must complete nurse triage before seeing a physician.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Patient Summary Sidebar */}
            {exSelectedPatient && (
              <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                  <User size={16} color="#0284C7" />
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Patient Summary</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, marginBottom: 18 }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {exSelectedPatient.photoUrl ? (
                      <img src={exSelectedPatient.photoUrl} alt={fullName(exSelectedPatient)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={36} color="#0284C7" />
                    )}
                  </div>
                  <div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: '#ECFDF5',
                        color: '#047857',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      <Check size={12} />
                      <span>Existing Patient</span>
                    </span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', marginTop: 4 }}>
                      {fullName(exSelectedPatient)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
                      PID: {exSelectedPatient.hospitalNumber}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: '#475569', marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Date of Birth</span>
                    <strong style={{ color: '#0F172A' }}>{exSelectedPatient.dob} ({calculateAge(exSelectedPatient.dob)})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Gender</span>
                    <strong style={{ color: '#0F172A' }}>{exSelectedPatient.sex}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Phone</span>
                    <strong style={{ color: '#0F172A' }}>{exSelectedPatient.phone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Insurance</span>
                    <strong style={{ color: '#0284C7' }}>{exSelectedPatient.insuranceProvider || 'Self-pay'}</strong>
                  </div>
                </div>

                {/* Total Visits Badge */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
                      <BarChart3 size={15} color="#0284C7" />
                      <span>Total Encounters</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0284C7' }}>
                      {visits.filter((v) => v.patientId === exSelectedPatient.id || v.hospitalNumber === exSelectedPatient.hospitalNumber).length}
                    </span>
                  </div>
                </div>

                {/* Security Card */}
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <Shield size={18} color="#0284C7" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>Secure Access</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                      Patient information is protected under hospital privacy policies.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Existing Patient Action Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${C.border}`,
              background: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setExSearchQuery('');
                  setExFoundPatients(patients.slice(0, 5));
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={14} />
                <span>Reset Form</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (exSelectedPatient) {
                    printQueueTicket(
                      {
                        queueNumber: 'REG-PENDING',
                        department: exVisitType,
                        patientName: fullName(exSelectedPatient),
                        hospitalNumber: exSelectedPatient.hospitalNumber,
                        time: new Date().toLocaleTimeString(),
                      },
                      facilityName
                    );
                  } else {
                    flash('Select a patient first to print slip');
                  }
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={14} />
                <span>Print Registration Slip</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => goView('home')}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#0F172A',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleRegisterExistingVisit}
                disabled={!exSelectedPatient}
                style={{
                  padding: '9px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: !exSelectedPatient ? '#94A3B8' : '#0284C7',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: !exSelectedPatient ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: !exSelectedPatient ? 'none' : '0 2px 6px rgba(2, 132, 199, 0.3)',
                }}
              >
                <span>Proceed to Registration</span>
                <ArrowRight size={15} />
              </button>
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
                    <button type="button" onClick={() => { if (window.confirm('Cancel scheduled appointment for ' + a.patientName + '?')) { cancelAppointment(a.id); reload(); } }} style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>
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
