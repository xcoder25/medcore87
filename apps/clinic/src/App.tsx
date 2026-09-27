/**
 * MedCore Mobile — unified Patient + Staff app (RBAC)
 * Formerly separate Care (patient) and Clinic (staff) apps.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity, StatusBar, Image, Platform,
} from 'react-native';
import { PATIENTS, subscribe, startClinicRealtime, type Patient } from './services/clinicData';

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
import { StaffAuthScreen, StaffSession } from './components/auth/StaffAuthScreen';
import { PrescriptionWriter } from './components/pharmacy/PrescriptionWriter';
import { StaffIdCardScreen } from './components/identity/StaffIdCardScreen';

import { UnifiedGate } from './auth/UnifiedGate';
import { PatientAuthScreen } from './auth/PatientAuthScreen';
import { PatientShell } from './shells/PatientShell';
import type { AppSession, PatientSession } from './auth/sessionTypes';
import type { Persona } from './rbac/permissions';
import { can, TOOL_PERMISSION, TAB_PERMISSION } from './rbac/permissions';

type TabKey = 'ward' | 'patients' | 'tasks' | 'orders' | 'more';
type Stage = 'gate' | 'patient-auth' | 'staff-auth' | 'app';

const C = {
  primary: '#1E3A8A', teal: '#0D9488', bg: '#F0F9FF', card: '#FFFFFF',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
  danger: '#EF4444', dangerSoft: '#FEF2F2', success: '#059669', successSoft: '#ECFDF5',
  purple: '#7C3AED', purpleSoft: '#FAF5FF',
};

export default function App() {
  const [stage, setStage] = useState<Stage>('gate');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);

  const [selectedTab, setSelectedTab] = useState<TabKey>('ward');
  const [isRecordingAI, setIsRecordingAI] = useState(false);
  const [moreSection, setMoreSection] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);

  useEffect(() => {
    if (session?.persona !== 'staff') return;
    startClinicRealtime();
    return subscribe(() => setPatients([...PATIENTS]));
  }, [session?.persona]);

  const staffRole = session?.persona === 'staff' ? session.roleKey : undefined;

  const allowedTabs = useMemo(() => {
    return (['ward', 'patients', 'tasks', 'orders', 'more'] as TabKey[]).filter((t) =>
      can('staff', staffRole, TAB_PERMISSION[t])
    );
  }, [staffRole]);

  useEffect(() => {
    if (session?.persona === 'staff' && allowedTabs.length && !allowedTabs.includes(selectedTab)) {
      setSelectedTab(allowedTabs[0]);
    }
  }, [allowedTabs, selectedTab, session?.persona]);

  const signOut = () => {
    setSession(null);
    setPersona(null);
    setStage('gate');
    setMoreSection(null);
  };

  if (stage === 'gate') {
    return (
      <UnifiedGate
        onSelect={(p) => {
          setPersona(p);
          setStage(p === 'patient' ? 'patient-auth' : 'staff-auth');
        }}
      />
    );
  }

  if (stage === 'patient-auth') {
    return (
      <PatientAuthScreen
        onBack={() => setStage('gate')}
        onSuccess={(s: PatientSession) => {
          setSession(s);
          setStage('app');
        }}
      />
    );
  }

  if (stage === 'staff-auth') {
    return (
      <StaffAuthScreen
        onLoginSuccess={(s: StaffSession) => {
          setSession({ ...s, persona: 'staff' });
          setStage('app');
        }}
      />
    );
  }

  if (session?.persona === 'patient') {
    return <PatientShell session={session} onSignOut={signOut} />;
  }

  if (!session || session.persona !== 'staff') {
    return null;
  }

  const staff = session;

  const moreItems = [
    { k: 'emar', icon: '💊', title: 'eMAR', desc: 'Record drug administration' },
    { k: 'prescription', icon: '🖊', title: 'e-Prescription Writer', desc: 'Issue digital Rx · Route to pharmacy' },
    { k: 'notes', icon: '📝', title: 'Progress Notes', desc: 'Clinical documentation & SOAP' },
    { k: 'results', icon: '🧪', title: 'Results Review', desc: 'Lab & Imaging acknowledgment' },
    { k: 'discharge', icon: '🚪', title: 'Discharge & ADT', desc: 'Discharge checklist & bed board' },
    { k: 'theatre', icon: '🏥', title: 'Theatre List', desc: "Today's operating theatre cases" },
    { k: 'referrals', icon: '📤', title: 'Referrals', desc: 'Internal & external referrals' },
    { k: 'nursing', icon: '🩺', title: 'Nursing Assessments', desc: 'Pain, fall risk, I&O, wounds' },
    { k: 'emergency', icon: '🚨', title: 'Emergency Response', desc: 'Code Blue & Rapid Response' },
    { k: 'portering', icon: '🛏️', title: 'Portering & Transport', desc: 'Patient & specimen transport' },
    { k: 'handover', icon: '🔄', title: 'Handover Notes (SBAR)', desc: 'Structured shift handovers' },
    { k: 'chat', icon: '💬', title: 'Secure Team Chat', desc: 'Encrypted clinical messaging' },
    { k: 'roster', icon: '📅', title: 'Rostering & Shifts', desc: 'On-call coverage & fatigue risk' },
    { k: 'alerts', icon: '🔔', title: 'Clinical Alerts', desc: 'Panic values & STAT notifications' },
    { k: 'assistant', icon: '🤖', title: 'Doctor Assistant (M87)', desc: 'SOAP, ICD-10 & discharge drafts' },
    { k: 'activity', icon: '📊', title: 'Activity Overview', desc: 'Caseload & documentation metrics' },
    { k: 'staff-id', icon: '🪪', title: 'My Staff ID Card', desc: 'Badge linked to OS enrolment & auth' },
  ].filter((item) => {
    const perm = TOOL_PERMISSION[item.k];
    return perm ? can('staff', staff.roleKey, perm) : false;
  });

  const renderMoreBody = () => {
    if (moreSection === 'emar') return <MedicationAdmin />;
    if (moreSection === 'prescription') return <PrescriptionWriter />;
    if (moreSection === 'notes') return <ProgressNotes />;
    if (moreSection === 'results') return <ResultsReview />;
    if (moreSection === 'discharge') return <DischargeADT />;
    if (moreSection === 'theatre') return <TheatreList />;
    if (moreSection === 'referrals') return <Referrals />;
    if (moreSection === 'nursing') return <NursingAssessments />;
    if (moreSection === 'emergency') return <EmergencyResponse />;
    if (moreSection === 'portering') return <PorteringRequest />;
    if (moreSection === 'handover') return <HandoverNotes />;
    if (moreSection === 'chat') return <SecureTeamChat />;
    if (moreSection === 'roster') return <RosteringManagement />;
    if (moreSection === 'alerts') return <ClinicalAlerts />;
    if (moreSection === 'assistant') return <DoctorAssistant />;
    if (moreSection === 'activity') return <ActivityOverview />;
    if (moreSection === 'staff-id') return <StaffIdCardScreen session={staff} />;
    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={styles.sectionTitle}>Tools for {staff.role}</Text>
        <Text style={{ color: C.muted, marginBottom: 12, fontSize: 12 }}>
          Access controlled by your role · {moreItems.length} tools available
        </Text>
        {moreItems.map((item) => (
          <TouchableOpacity key={item.k} style={styles.moreCard} onPress={() => setMoreSection(item.k)} activeOpacity={0.85}>
            <View style={styles.moreIconBox}><Text style={{ fontSize: 22 }}>{item.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.moreTitle}>{item.title}</Text>
              <Text style={styles.moreDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
        {moreItems.length === 0 && (
          <Text style={{ color: C.muted }}>No extra tools for this role.</Text>
        )}
        <TouchableOpacity style={[styles.moreCard, { marginTop: 8 }]} onPress={signOut}>
          <Text style={{ color: C.danger, fontWeight: '800' }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderWard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={styles.alertBanner}>
        <View style={styles.alertIconWrap}><Text style={{ fontSize: 20 }}>🚨</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle}>Live ward</Text>
          <Text style={styles.alertDesc}>Alerts and patients appear as the hospital hub syncs data.</Text>
        </View>
      </View>

      {can('staff', staff.roleKey, 'staff.assistant') && (
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View>
              <Text style={styles.aiTitle}>M87 Ambient Assistant</Text>
              <Text style={styles.aiSub}>AI SOAP Generator</Text>
            </View>
            <View style={[styles.livePill, isRecordingAI && styles.livePillOn]}>
              <Text style={[styles.liveText, isRecordingAI && styles.liveTextOn]}>{isRecordingAI ? '● LIVE' : 'Ready'}</Text>
            </View>
          </View>
          <Text style={styles.aiDesc}>
            {isRecordingAI ? 'Listening & drafting structured SOAP notes…' : 'Tap to start ambient recording during bedside rounds.'}
          </Text>
          <TouchableOpacity style={[styles.aiBtn, isRecordingAI && styles.aiBtnOn]} onPress={() => setIsRecordingAI(!isRecordingAI)} activeOpacity={0.85}>
            <Text style={styles.aiBtnText}>{isRecordingAI ? 'Stop & Generate SOAP Note' : 'Start Ambient Ward Round'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>On this shift · {patients.length} patient(s) in list</Text>
      {patients.length === 0 && (
        <Text style={{ color: C.muted, marginBottom: 12 }}>No patients loaded yet — hub will fill this list.</Text>
      )}
      {patients.slice(0, 8).map((p) => (
        <View key={p.id || p.name} style={styles.patientCard}>
          <View style={styles.patientTop}>
            <View>
              <Text style={styles.bedTag}>{p.bed || p.ward || 'Ward'}</Text>
              <Text style={styles.patientName}>{p.name}</Text>
              <Text style={styles.dx}>{p.dx || '—'}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View>
            <Text style={styles.brand}>MedCore Staff</Text>
            <Text style={styles.doctor}>{staff.name}</Text>
            <Text style={styles.ward}>{staff.role} · {staff.facility}</Text>
          </View>
        </View>
        <View style={styles.onDuty}>
          <View style={styles.dot} />
          <Text style={styles.onDutyText}>ON DUTY</Text>
        </View>
      </View>

      {selectedTab === 'ward' && can('staff', staff.roleKey, 'staff.ward') && renderWard()}
      {selectedTab === 'patients' && can('staff', staff.roleKey, 'staff.patients') && <ClinicalWorkbench />}
      {selectedTab === 'tasks' && can('staff', staff.roleKey, 'staff.tasks') && <TaskTracker />}
      {selectedTab === 'orders' && can('staff', staff.roleKey, 'staff.orders') && <OrderEntryReview />}
      {selectedTab === 'more' && renderMoreBody()}

      {moreSection ? (
        <TouchableOpacity
          style={{ backgroundColor: '#FFF', padding: 12, borderTopWidth: 1, borderTopColor: C.border }}
          onPress={() => setMoreSection(null)}
        >
          <Text style={{ textAlign: 'center', fontWeight: '700', color: C.primary }}>← Back to tools</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.tabBar}>
          {(
            [
              { k: 'ward' as const, icon: '🏥', label: 'Ward' },
              { k: 'patients' as const, icon: '👥', label: 'Patients' },
              { k: 'tasks' as const, icon: '✅', label: 'Tasks' },
              { k: 'orders' as const, icon: '📋', label: 'Orders' },
              { k: 'more' as const, icon: '☰', label: 'More' },
            ] as const
          )
            .filter((t) => allowedTabs.includes(t.k))
            .map((t) => {
              const active = selectedTab === t.k;
              return (
                <TouchableOpacity
                  key={t.k}
                  style={styles.tabItem}
                  onPress={() => {
                    setSelectedTab(t.k);
                    setMoreSection(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabIcon, active && styles.tabIconOn]}>{t.icon}</Text>
                  <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{t.label}</Text>
                  {active && <View style={styles.tabDot} />}
                </TouchableOpacity>
              );
            })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.primary },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  brand: { color: '#93C5FD', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  doctor: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 1 },
  ward: { color: '#BFDBFE', fontSize: 12, marginTop: 1 },
  onDuty: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.18)', borderWidth: 1, borderColor: '#34D399', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  onDutyText: { color: '#A7F3D0', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  content: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dangerSoft, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FECACA' },
  alertIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  alertDesc: { fontSize: 12, color: '#7F1D1D', marginTop: 2, lineHeight: 17 },
  aiCard: { backgroundColor: C.purpleSoft, borderRadius: 18, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#E9D5FF' },
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  aiTitle: { fontSize: 15, fontWeight: '700', color: '#581C87' },
  aiSub: { fontSize: 11, color: '#7E22CE', marginTop: 1, fontWeight: '600' },
  livePill: { backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  livePillOn: { backgroundColor: '#FEE2E2' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#7E22CE' },
  liveTextOn: { color: '#DC2626' },
  aiDesc: { fontSize: 13, color: '#6B21A8', lineHeight: 19, marginBottom: 14 },
  aiBtn: { backgroundColor: C.purple, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  aiBtnOn: { backgroundColor: C.danger },
  aiBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12, marginTop: 4, letterSpacing: 0.2 },
  patientCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  patientTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  bedTag: { fontSize: 11, fontWeight: '800', color: C.teal, letterSpacing: 0.3 },
  patientName: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 3 },
  dx: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 17 },
  moreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  moreIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  moreTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  moreDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: '#CBD5E1', fontWeight: '300' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 10, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 20, color: '#94A3B8' },
  tabIconOn: { color: C.primary },
  tabLabel: { fontSize: 10, color: '#94A3B8', marginTop: 3, fontWeight: '600' },
  tabLabelOn: { color: C.primary, fontWeight: '800' },
  tabDot: { width: 18, height: 3, borderRadius: 2, backgroundColor: C.teal, marginTop: 5 },
});
