/**
 * MedCore Mobile — Unified Liquid-Glass + RBAC Clinical & Patient App
 * - Single UnifiedAuthScreen with Admin 2FA + Patient OTP Verification
 * - Native persistent session & authenticated offline sync queue
 * - Real-time SSE alerts, M87 Ambient AI Scribe, Bedside QR/Barcode lookup, & HIPAA Inactivity Lock
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import {
  PATIENTS,
  subscribe,
  startClinicRealtime,
  hydratePatientsFromEmr,
  type Patient,
} from './services/clinicData';
import {
  fetchEmrPatients,
  generateAmbientSoap,
  hydrateEmrBaseUrl,
  subscribeEmrFacilityStream,
  transcribeClinicalAudio,
} from './services/emrSyncClient';
import { offlineSyncManager } from './services/offlineSync';
import {
  SESSION_STORAGE_KEY,
  clearPhiStorage,
  getStoredItem,
  initNativeStorage,
  setStoredItem,
} from './services/nativeStorage';
import {
  parseMedCoreQr,
  startWebAudioCapture,
  subscribeInAppNotifications,
  triggerLocalNotification,
  type ParsedMedCoreQr,
  type WebAudioRecorderHandle,
} from './services/deviceCapabilities';
import { useRealtimeEvents } from './hooks/useRealtimeEvents';

import { C } from './theme';
import {
  AmbientGlowBackdrop,
  LiquidGlassCard,
  GlowButton,
  LiveSyncPill,
  LiquidTabBar,
  type SyncState,
  type LiquidTabItem,
} from './components/ui/LiquidGlass';
import { MedIcon, type MedIconName } from './components/ui/PremiumIcons';
import { SessionLockOverlay } from './components/ui/SessionLockOverlay';

import { ClinicalWorkbench } from './components/workbench/ClinicalWorkbench';
import { TaskTracker } from './components/tasks/TaskTracker';
import { OrderEntryReview } from './components/orders/OrderEntryReview';
import { HandoverNotes } from './components/handover/HandoverNotes';
import { ClinicalAlerts } from './components/notifications/ClinicalAlerts';
import { DoctorAssistant } from './components/assistant/DoctorAssistant';
import { SecureTeamChat } from './components/team-chat/SecureTeamChat';
import { RosteringManagement } from './components/rostering/RosteringManagement';
import { ActivityOverview } from './components/overview/ActivityOverview';
import { MedicationAdmin } from './components/emar/MedicationAdmin';
import { ProgressNotes } from './components/notes/ProgressNotes';
import { ResultsReview } from './components/results/ResultsReview';
import { DischargeADT } from './components/discharge/DischargeADT';
import { TheatreList } from './components/theatre/TheatreList';
import { Referrals } from './components/referrals/Referrals';
import { NursingAssessments } from './components/nursing/NursingAssessments';
import { EmergencyResponse } from './components/emergency/EmergencyResponse';
import { PorteringRequest } from './components/portering/PorteringRequest';
import type { StaffSession } from './components/auth/StaffAuthScreen';
import { PrescriptionWriter } from './components/pharmacy/PrescriptionWriter';
import { StaffIdCardScreen } from './components/identity/StaffIdCardScreen';
import { FacilityAdminHub } from './components/admin/FacilityAdminHub';

import { UnifiedAuthScreen } from './auth/UnifiedAuthScreen';
import { PatientShell } from './shells/PatientShell';
import type { AppSession, PatientSession } from './auth/sessionTypes';
import { can, TOOL_PERMISSION, TAB_PERMISSION } from './rbac/permissions';

type TabKey = 'admin' | 'ward' | 'patients' | 'tasks' | 'orders' | 'more';

interface MoreToolDef {
  k: string;
  icon: MedIconName;
  glow: string;
  title: string;
  desc: string;
}

const INACTIVITY_LOCK_MS = 10 * 60 * 1000;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AppSession | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabKey>('ward');
  const [moreSection, setMoreSection] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);
  const [syncState, setSyncState] = useState<SyncState>('syncing');

  // Ambient Scribe Ward Round state
  const [isRecordingAI, setIsRecordingAI] = useState(false);
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSoapDraft, setAiSoapDraft] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const audioRecorderRef = useRef<WebAudioRecorderHandle | null>(null);

  // Bedside QR / Barcode scanner sheet
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [qrParsed, setQrParsed] = useState<ParsedMedCoreQr | null>(null);

  // Live toast notifications
  const [toastBanner, setToastBanner] = useState<{ id: string; title: string; body: string } | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const staffSession = session?.persona === 'staff' ? session : null;

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Hydrate persisted session & EMR endpoint on boot
  useEffect(() => {
    let alive = true;
    void (async () => {
      await initNativeStorage();
      await hydrateEmrBaseUrl();
      const rawSession = getStoredItem(SESSION_STORAGE_KEY);
      if (rawSession && alive) {
        try {
          const parsed = JSON.parse(rawSession) as AppSession;
          if (parsed && (parsed.persona === 'staff' || parsed.persona === 'patient')) {
            setSession(parsed);
            if (parsed.persona === 'staff') {
              offlineSyncManager.setAuthToken(parsed.sessionToken);
              setSelectedTab(can('staff', parsed.roleKey, 'staff.admin_hub') ? 'admin' : 'ward');
            }
          }
        } catch {
          /* ignore corrupt stored session */
        }
      }
      if (alive) setBooting(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Inactivity lock watchdog
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      if (!locked && Date.now() - lastActivityRef.current >= INACTIVITY_LOCK_MS) {
        setLocked(true);
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, [session, locked]);

  // In-app notifications subscription
  useEffect(() => {
    return subscribeInAppNotifications((t) => {
      setToastBanner(t);
    });
  }, []);

  const realtime = useRealtimeEvents({
    app: 'MEDCORE_MOBILE',
    facilityId: staffSession?.facilityId,
    sessionToken: staffSession?.sessionToken,
  });

  useEffect(() => {
    if (realtime.criticalAlert) {
      triggerLocalNotification(
        `CRITICAL: ${realtime.criticalAlert.topic}`,
        String((realtime.criticalAlert.payload as any)?.message || 'Immediate bedside review required.')
      );
    }
  }, [realtime.criticalAlert]);

  const syncPatientsFromEmr = useCallback(async () => {
    if (!staffSession) return;
    setSyncState((prev) => (prev === 'live' ? 'live' : 'syncing'));
    const res = await fetchEmrPatients(staffSession.facilityId, staffSession.sessionToken);
    if (res.ok) {
      hydratePatientsFromEmr(res.patients);
      setSyncState('live');
    } else if (!staffSession.sessionToken) {
      setSyncState('offline');
    }
  }, [staffSession]);

  useEffect(() => {
    if (!staffSession) return;
    offlineSyncManager.setAuthToken(staffSession.sessionToken);
    void offlineSyncManager.drainQueue();
    startClinicRealtime();
    const unsubStore = subscribe(() => setPatients([...PATIENTS]));
    void syncPatientsFromEmr();
    const unsubStream = subscribeEmrFacilityStream(
      staffSession.facilityId,
      staffSession.sessionToken,
      setSyncState,
      () => {
        void syncPatientsFromEmr();
        void offlineSyncManager.drainQueue();
      }
    );
    return () => {
      unsubStore();
      unsubStream();
    };
  }, [staffSession, syncPatientsFromEmr]);

  const staffRole = staffSession?.roleKey;

  const allowedTabs = useMemo(() => {
    return (['admin', 'ward', 'patients', 'tasks', 'orders', 'more'] as TabKey[]).filter((t) =>
      can('staff', staffRole, TAB_PERMISSION[t])
    );
  }, [staffRole]);

  useEffect(() => {
    if (staffSession && allowedTabs.length && !allowedTabs.includes(selectedTab)) {
      setSelectedTab(allowedTabs[0]);
    }
  }, [allowedTabs, selectedTab, staffSession]);

  const persistSession = (next: AppSession) => {
    setSession(next);
    setLocked(false);
    touchActivity();
    try {
      setStoredItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const signOut = () => {
    clearPhiStorage();
    offlineSyncManager.setAuthToken(undefined);
    setSession(null);
    setLocked(false);
    setMoreSection(null);
    setIsRecordingAI(false);
    setAiSoapDraft(null);
    setSelectedTab('ward');
  };

  const handleToggleAmbientRound = async () => {
    if (!staffSession) return;
    setAiError(null);
    if (!isRecordingAI) {
      const rec = await startWebAudioCapture();
      audioRecorderRef.current = rec;
      setIsRecordingAI(true);
      setAiSoapDraft(null);
      return;
    }

    setIsRecordingAI(false);
    setAiBusy(true);
    try {
      let combinedTranscript = aiTranscript.trim();
      if (audioRecorderRef.current) {
        const audio = await audioRecorderRef.current.stop();
        audioRecorderRef.current = null;
        if (audio) {
          const tr = await transcribeClinicalAudio({
            audioBase64: audio.audioBase64,
            mimeType: audio.mimeType,
            roleHint: staffSession.roleKey,
            sessionToken: staffSession.sessionToken,
          });
          if (tr.ok && tr.transcript) {
            combinedTranscript = `${combinedTranscript} ${tr.transcript}`.trim();
            setAiTranscript(combinedTranscript);
          }
        }
      }
      if (!combinedTranscript) {
        combinedTranscript = `Bedside ward round by ${staffSession.name} on ${patients[0]?.name || 'ward patient'}: stable vitals, continue current inpatient treatment plan.`;
        setAiTranscript(combinedTranscript);
      }
      const res = await generateAmbientSoap({
        facilityId: staffSession.facilityId,
        transcript: combinedTranscript,
        patientName: patients[0]?.name || 'Ward Patient',
        sessionToken: staffSession.sessionToken,
      });
      if (res.ok && res.draft) {
        setAiSoapDraft(res.draft);
      } else {
        setAiSoapDraft({
          soap: {
            subjective: combinedTranscript,
            objective: 'Bedside vitals reviewed during mobile ward round.',
            assessment: 'Ongoing inpatient care.',
            plan: 'Sync SOAP summary to EMR chart.',
          },
        });
        if (res.error) setAiError(res.error);
      }
    } finally {
      setAiBusy(false);
    }
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <AmbientGlowBackdrop variant="auth" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <MedIcon name="shield" size={28} color="#FFFFFF" glowColor={C.glowCyan} />
          <Text style={{ color: '#CBD5E1', marginTop: 12, fontWeight: '700' }}>
            Restoring MedCore Vault…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <UnifiedAuthScreen
        onStaffLogin={(s: StaffSession) => {
          const next: AppSession = { ...s, persona: 'staff' };
          offlineSyncManager.setAuthToken(s.sessionToken);
          persistSession(next);
          setMoreSection(null);
          setSelectedTab(can('staff', s.roleKey, 'staff.admin_hub') ? 'admin' : 'ward');
        }}
        onPatientAuth={(s: PatientSession) => {
          persistSession(s);
          setMoreSection(null);
        }}
      />
    );
  }

  if (session.persona === 'patient') {
    return (
      <View style={{ flex: 1 }} onTouchStart={touchActivity}>
        <PatientShell
          session={session}
          onSignOut={signOut}
          onLock={() => setLocked(true)}
        />
        <SessionLockOverlay
          visible={locked}
          actorName={session.name}
          subtitle={session.shid || session.patientId}
          facilityId={session.facilityId || 'IGH-EKT'}
          isStaff={false}
          onUnlock={() => {
            touchActivity();
            setLocked(false);
          }}
          onSignOut={signOut}
        />
      </View>
    );
  }

  const staff = session;

  const moreItems: MoreToolDef[] = (
    [
      { k: 'admin-hub', icon: 'building', glow: C.glowBlue, title: 'Facility Admin Hub', desc: 'Staff enrolment, directory & EMR policies' },
      { k: 'staff-enrol', icon: 'user-plus', glow: C.glowCyan, title: 'Enrol Facility Staff', desc: 'Issue facility-scoped staff badge & PIN' },
      { k: 'emar', icon: 'pill', glow: C.glowEmerald, title: 'eMAR', desc: 'Record drug administration' },
      { k: 'prescription', icon: 'clipboard', glow: C.glowBlue, title: 'e-Prescription Writer', desc: 'Issue digital Rx · Route to pharmacy' },
      { k: 'notes', icon: 'clipboard', glow: C.glowCyan, title: 'Progress Notes', desc: 'Clinical documentation & SOAP' },
      { k: 'results', icon: 'lab', glow: C.glowViolet, title: 'Results Review', desc: 'Lab & Imaging acknowledgment' },
      { k: 'discharge', icon: 'arrow-right', glow: C.glowAmber, title: 'Discharge & ADT', desc: 'Discharge checklist & bed board' },
      { k: 'theatre', icon: 'activity', glow: C.glowRose, title: 'Theatre List', desc: "Today's operating theatre cases" },
      { k: 'referrals', icon: 'users', glow: C.glowBlue, title: 'Referrals', desc: 'Internal & external referrals' },
      { k: 'nursing', icon: 'stethoscope', glow: C.glowEmerald, title: 'Nursing Assessments', desc: 'Pain, fall risk, I&O, wounds' },
      { k: 'emergency', icon: 'bell', glow: C.glowRose, title: 'Emergency Response', desc: 'Code Blue & Rapid Response' },
      { k: 'portering', icon: 'activity', glow: C.glowAmber, title: 'Portering & Transport', desc: 'Patient & specimen transport' },
      { k: 'handover', icon: 'sync', glow: C.glowCyan, title: 'Handover Notes (SBAR)', desc: 'Structured shift handovers' },
      { k: 'chat', icon: 'sparkles', glow: C.glowViolet, title: 'Secure Team Chat', desc: 'Encrypted clinical messaging' },
      { k: 'roster', icon: 'calendar', glow: C.glowBlue, title: 'Rostering & Shifts', desc: 'On-call coverage & fatigue risk' },
      { k: 'alerts', icon: 'bell', glow: C.glowAmber, title: 'Clinical Alerts', desc: 'Panic values & STAT notifications' },
      { k: 'assistant', icon: 'sparkles', glow: C.glowViolet, title: 'Doctor Assistant (M87)', desc: 'SOAP, ICD-10 & discharge drafts' },
      { k: 'activity', icon: 'activity', glow: C.glowEmerald, title: 'Activity Overview', desc: 'Caseload & documentation metrics' },
      { k: 'staff-id', icon: 'card', glow: C.glowCyan, title: 'My Staff ID Card', desc: 'Badge & scannable QR linked to OS' },
    ] as MoreToolDef[]
  ).filter((item) => {
    const perm = TOOL_PERMISSION[item.k];
    return perm ? can('staff', staff.roleKey, perm) : false;
  });

  const renderLegacyToolSurface = (node: React.ReactNode) => (
    <View style={styles.legacyToolSurface}>{node}</View>
  );

  const renderMoreBody = () => {
    if (moreSection === 'admin-hub' || moreSection === 'staff-enrol') {
      return (
        <FacilityAdminHub
          session={staff}
          onOpenTool={(toolKey) => setMoreSection(toolKey)}
        />
      );
    }
    if (moreSection === 'staff-id') {
      return <StaffIdCardScreen session={staff} onBack={() => setMoreSection(null)} />;
    }
    if (moreSection === 'emar') return renderLegacyToolSurface(<MedicationAdmin />);
    if (moreSection === 'prescription') return renderLegacyToolSurface(<PrescriptionWriter />);
    if (moreSection === 'notes') return renderLegacyToolSurface(<ProgressNotes />);
    if (moreSection === 'results') return renderLegacyToolSurface(<ResultsReview />);
    if (moreSection === 'discharge') return renderLegacyToolSurface(<DischargeADT />);
    if (moreSection === 'theatre') return renderLegacyToolSurface(<TheatreList />);
    if (moreSection === 'referrals') return renderLegacyToolSurface(<Referrals />);
    if (moreSection === 'nursing') return renderLegacyToolSurface(<NursingAssessments />);
    if (moreSection === 'emergency') return renderLegacyToolSurface(<EmergencyResponse />);
    if (moreSection === 'portering') return renderLegacyToolSurface(<PorteringRequest />);
    if (moreSection === 'handover') return renderLegacyToolSurface(<HandoverNotes />);
    if (moreSection === 'chat') return renderLegacyToolSurface(<SecureTeamChat />);
    if (moreSection === 'roster') return renderLegacyToolSurface(<RosteringManagement />);
    if (moreSection === 'alerts') return renderLegacyToolSurface(<ClinicalAlerts />);
    if (moreSection === 'assistant') return renderLegacyToolSurface(<DoctorAssistant />);
    if (moreSection === 'activity') return renderLegacyToolSurface(<ActivityOverview />);

    return (
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 112 }}
      >
        <Text style={styles.sectionTitle}>Tools for {staff.role}</Text>
        <Text style={styles.sectionSub}>
          RBAC active · {moreItems.length} clinical module(s) · {staff.facilityId}
        </Text>

        {moreItems.map((item) => (
          <TouchableOpacity
            key={item.k}
            onPress={() => setMoreSection(item.k)}
            activeOpacity={0.85}
            style={{ marginBottom: 10 }}
          >
            <LiquidGlassCard glowColor={item.glow} style={styles.moreCardInner}>
              <MedIcon name={item.icon} size={20} color="#F8FAFC" glowColor={item.glow} />
              <View style={{ flex: 1 }}>
                <Text style={styles.moreTitle}>{item.title}</Text>
                <Text style={styles.moreDesc}>{item.desc}</Text>
              </View>
              <MedIcon name="arrow-right" size={16} color={C.muted} badge={false} />
            </LiquidGlassCard>
          </TouchableOpacity>
        ))}

        {moreItems.length === 0 && (
          <LiquidGlassCard glowColor={C.glowAmber} style={{ marginBottom: 12 }}>
            <Text style={styles.moreDesc}>No extra tools assigned for this role.</Text>
          </LiquidGlassCard>
        )}

        <View style={{ marginTop: 8 }}>
          <GlowButton
            label="Lock & Scrub Session"
            variant="danger"
            icon="logout"
            onPress={signOut}
          />
        </View>
      </ScrollView>
    );
  };

  const renderWard = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 112 }}
    >
      {toastBanner && (
        <LiquidGlassCard glowColor={C.glowRose} style={{ marginBottom: 12 }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.bannerTitle, { color: '#FDA4AF' }]}>{toastBanner.title}</Text>
            <TouchableOpacity onPress={() => setToastBanner(null)}>
              <Text style={styles.refreshLink}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bannerDesc}>{toastBanner.body}</Text>
        </LiquidGlassCard>
      )}

      <LiquidGlassCard glowColor={C.glowCyan} intensity="strong" animateIn style={styles.bannerCard}>
        <MedIcon name="activity" size={20} color="#38BDF8" glowColor={C.glowCyan} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Live Ward Telemetry &amp; QR Lookup</Text>
          <Text style={styles.bannerDesc}>
            {syncState === 'live'
              ? `Synced live with MedCore OS (${staff.facilityId}) · Offline queue: ${offlineSyncManager.getStatus().pendingCount}`
              : syncState === 'syncing'
              ? 'Synchronizing inpatient roster with MedCore OS…'
              : 'Offline mobile cache active — mutations queue with Bearer auth.'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowQrModal((v) => !v)}
          style={styles.qrQuickBtn}
        >
          <Text style={styles.qrQuickText}>QR Scan</Text>
        </TouchableOpacity>
      </LiquidGlassCard>

      {showQrModal && (
        <LiquidGlassCard glowColor={C.glowCyan} style={{ marginBottom: 14 }}>
          <Text style={styles.aiTitle}>Bedside QR / Drug Barcode Decoder</Text>
          <Text style={[styles.bannerDesc, { marginBottom: 8 }]}>
            Scan or paste `MEDCORE:SHID:...`, `MEDCORE:BADGE:...`, or drug barcode:
          </Text>
          <TextInput
            style={styles.qrInput}
            value={qrInput}
            onChangeText={setQrInput}
            placeholder="e.g. MEDCORE:SHID:SHID-AKS-123456:IGH-EKT"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
          />
          <GlowButton
            label="Decode & Match Patient / Drug"
            icon="check"
            variant="primary"
            onPress={() => {
              if (!qrInput.trim()) return;
              setQrParsed(parseMedCoreQr(qrInput));
            }}
          />
          {qrParsed && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.qrDecoded}>
                Type: {qrParsed.type.toUpperCase()} · ID: {qrParsed.id}{' '}
                {qrParsed.facilityId ? `· Facility ${qrParsed.facilityId}` : ''}
              </Text>
            </View>
          )}
        </LiquidGlassCard>
      )}

      {can('staff', staff.roleKey, 'staff.assistant') && (
        <LiquidGlassCard glowColor={isRecordingAI ? C.glowRose : C.glowViolet} style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <MedIcon
                name="sparkles"
                size={18}
                color="#F8FAFC"
                glowColor={isRecordingAI ? C.glowRose : C.glowViolet}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiTitle}>M87 Ambient Assistant</Text>
                <Text style={styles.aiSub}>Live Voice &amp; AI SOAP Generator (/api/ai/scribe)</Text>
              </View>
            </View>
            <View style={[styles.livePill, isRecordingAI && styles.livePillOn]}>
              <Text style={[styles.liveText, isRecordingAI && styles.liveTextOn]}>
                {isRecordingAI ? '● LIVE' : aiBusy ? 'DRAFTING' : 'READY'}
              </Text>
            </View>
          </View>
          <TextInput
            style={styles.qrInput}
            value={aiTranscript}
            onChangeText={setAiTranscript}
            placeholder="Dictate bedside observation or tap Record below…"
            placeholderTextColor="#64748B"
            multiline
          />
          {aiError && <Text style={[styles.bannerDesc, { color: '#FBBF24', marginBottom: 8 }]}>{aiError}</Text>}
          <GlowButton
            label={
              isRecordingAI
                ? 'Stop & Generate SOAP Note'
                : aiBusy
                ? 'Generating SOAP…'
                : 'Start Ambient Ward Round'
            }
            variant={isRecordingAI ? 'danger' : 'violet'}
            icon="sparkles"
            loading={aiBusy}
            onPress={() => void handleToggleAmbientRound()}
          />
          {aiSoapDraft?.soap && (
            <View style={styles.soapBox}>
              <Text style={styles.soapLabel}>S: {aiSoapDraft.soap.subjective}</Text>
              <Text style={styles.soapLabel}>O: {aiSoapDraft.soap.objective}</Text>
              <Text style={styles.soapLabel}>A: {aiSoapDraft.soap.assessment}</Text>
              <Text style={styles.soapLabel}>P: {aiSoapDraft.soap.plan}</Text>
            </View>
          )}
        </LiquidGlassCard>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>On This Shift · {patients.length} patient(s)</Text>
        <TouchableOpacity onPress={() => void syncPatientsFromEmr()} activeOpacity={0.8}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {patients.length === 0 && (
        <LiquidGlassCard glowColor={C.glowBlue} style={{ marginBottom: 12 }}>
          <Text style={styles.moreDesc}>No patients loaded yet — EMR sync will populate this ward list.</Text>
        </LiquidGlassCard>
      )}

      {patients.slice(0, 12).map((p) => (
        <LiquidGlassCard key={p.id || p.name} glowColor={C.glowCyan} style={styles.patientCard}>
          <View style={styles.patientTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bedTag}>{p.bed || p.ward || 'General Ward'}</Text>
              <Text style={styles.patientName}>{p.name}</Text>
              <Text style={styles.dx}>{p.dx || 'Active inpatient care'}</Text>
            </View>
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>INPATIENT</Text>
            </View>
          </View>
        </LiquidGlassCard>
      ))}
    </ScrollView>
  );

  const tabItems: LiquidTabItem<TabKey>[] = (
    [
      { key: 'admin', icon: 'building', label: 'Admin' },
      { key: 'ward', icon: 'activity', label: 'Ward' },
      { key: 'patients', icon: 'users', label: 'Patients' },
      { key: 'tasks', icon: 'check', label: 'Tasks' },
      { key: 'orders', icon: 'clipboard', label: 'Orders' },
      { key: 'more', icon: 'grid', label: 'More' },
    ] as LiquidTabItem<TabKey>[]
  ).filter((t) => allowedTabs.includes(t.key));

  return (
    <SafeAreaView style={styles.safe} onTouchStart={touchActivity}>
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
      <AmbientGlowBackdrop variant="clinical" />

      <View style={styles.headerWrap}>
        <LiquidGlassCard glowColor={C.glowBlue} intensity="strong" style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <MedIcon
              name={staff.roleKey === 'hospital_admin' ? 'shield' : 'stethoscope'}
              size={20}
              color="#F8FAFC"
              glowColor={staff.roleKey === 'hospital_admin' ? C.glowViolet : C.glowCyan}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>MEDCORE STAFF · {staff.facilityId}</Text>
              <Text style={styles.doctor} numberOfLines={1}>{staff.name}</Text>
              <Text style={styles.ward} numberOfLines={1}>{staff.role} · {staff.facility}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <LiveSyncPill state={syncState} onPress={() => void syncPatientsFromEmr()} />
            <TouchableOpacity style={styles.pauseBtn} onPress={() => setLocked(true)} activeOpacity={0.8}>
              <MedIcon name="lock" size={14} color="#7DD3FC" badge={false} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.lockBtn} onPress={signOut} activeOpacity={0.8}>
              <MedIcon name="logout" size={14} color="#FCA5A5" badge={false} />
            </TouchableOpacity>
          </View>
        </LiquidGlassCard>
      </View>

      <View style={styles.body}>
        {selectedTab === 'admin' && can('staff', staff.roleKey, 'staff.admin_hub') && (
          <FacilityAdminHub
            session={staff}
            onOpenTool={(toolKey) => {
              setSelectedTab('more');
              setMoreSection(toolKey);
            }}
          />
        )}
        {selectedTab === 'ward' && can('staff', staff.roleKey, 'staff.ward') && renderWard()}
        {selectedTab === 'patients' &&
          can('staff', staff.roleKey, 'staff.patients') && (
            <ClinicalWorkbench session={staff} onOpenAiScribe={() => setSelectedTab('ward')} />
          )}
        {selectedTab === 'tasks' &&
          can('staff', staff.roleKey, 'staff.tasks') && <TaskTracker session={staff} />}
        {selectedTab === 'orders' &&
          can('staff', staff.roleKey, 'staff.orders') &&
          renderLegacyToolSurface(<OrderEntryReview session={staff} />)}
        {selectedTab === 'more' && renderMoreBody()}
      </View>

      {moreSection ? (
        <View style={styles.backDockWrap}>
          <GlowButton
            label="Back to Clinical Tools"
            variant="glass"
            icon="back"
            onPress={() => setMoreSection(null)}
          />
        </View>
      ) : (
        <LiquidTabBar
          items={tabItems}
          activeKey={selectedTab}
          onSelect={(k) => {
            setSelectedTab(k);
            setMoreSection(null);
          }}
          accentColor={selectedTab === 'admin' ? C.glowViolet : C.glowCyan}
        />
      )}

      <SessionLockOverlay
        visible={locked}
        actorName={staff.name}
        subtitle={`${staff.role} · ${staff.staffId}`}
        facilityId={staff.facilityId}
        identifier={staff.staffId}
        isStaff
        onUnlock={() => {
          touchActivity();
          setLocked(false);
        }}
        onSignOut={signOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  headerWrap: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 10 : 6,
    paddingBottom: 8,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  brand: {
    color: C.glowCyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  doctor: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginTop: 1 },
  ward: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pauseBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  lockBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
  },
  body: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  legacyToolSurface: {
    flex: 1,
    marginHorizontal: 10,
    marginBottom: 86,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  bannerTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  bannerDesc: { color: '#CBD5E1', fontSize: 12, marginTop: 2, lineHeight: 17 },
  qrQuickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  qrQuickText: { color: '#BAE6FD', fontSize: 11, fontWeight: '800' },
  qrInput: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 10,
  },
  qrDecoded: { color: '#6EE7B7', fontSize: 12.5, fontWeight: '800' },
  aiCard: { marginBottom: 18 },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  aiTitle: { fontSize: 15, fontWeight: '800', color: '#F8FAFC' },
  aiSub: { fontSize: 11, color: '#C4B5FD', marginTop: 1, fontWeight: '600' },
  livePill: {
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  livePillOn: {
    backgroundColor: 'rgba(244, 63, 94, 0.22)',
    borderColor: 'rgba(251, 113, 133, 0.5)',
  },
  liveText: { fontSize: 10, fontWeight: '900', color: '#DDD6FE', letterSpacing: 0.6 },
  liveTextOn: { color: '#FDA4AF' },
  soapBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  soapLabel: { color: '#F8FAFC', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  sectionSub: { color: C.muted, marginBottom: 12, fontSize: 12 },
  refreshLink: { color: C.glowCyan, fontSize: 12, fontWeight: '800' },
  patientCard: { marginBottom: 10 },
  patientTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  bedTag: { fontSize: 11, fontWeight: '800', color: C.glowCyan, letterSpacing: 0.4 },
  patientName: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', marginTop: 3 },
  dx: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 17 },
  statusChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: { color: '#6EE7B7', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  moreCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moreTitle: { fontSize: 15, fontWeight: '800', color: '#F8FAFC' },
  moreDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  backDockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 20 : 12,
  },
});
