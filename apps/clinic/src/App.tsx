import React, { useState, useEffect } from 'react';
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

type TabKey = 'ward' | 'patients' | 'tasks' | 'orders' | 'more';

const C = {
  primary: '#1E3A8A', teal: '#0D9488', bg: '#F0F9FF', card: '#FFFFFF',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
  danger: '#EF4444', dangerSoft: '#FEF2F2', success: '#059669', successSoft: '#ECFDF5',
  purple: '#7C3AED', purpleSoft: '#FAF5FF',
};

export default function App() {
  const [selectedTab, setSelectedTab] = useState<TabKey>('ward');
  const [isRecordingAI, setIsRecordingAI] = useState(false);
  const [moreSection, setMoreSection] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);

  useEffect(() => {
    startClinicRealtime();
    return subscribe(() => setPatients([...PATIENTS]));
  }, []);

  const renderWard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={styles.alertBanner}>
        <View style={styles.alertIconWrap}><Text style={{ fontSize: 20 }}>🚨</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle}>STAT · Bed 4B</Text>
          <Text style={styles.alertDesc}>Troponin-I Critical (0.84 ng/mL) — Immediate review required</Text>
        </View>
      </View>

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
          {isRecordingAI ? 'Listening & drafting structured SOAP notes in real time…' : 'Tap to start ambient recording during bedside rounds.'}
        </Text>
        <TouchableOpacity style={[styles.aiBtn, isRecordingAI && styles.aiBtnOn]} onPress={() => setIsRecordingAI(!isRecordingAI)} activeOpacity={0.85}>
          <Text style={styles.aiBtnText}>{isRecordingAI ? 'Stop & Generate SOAP Note' : 'Start Ambient Ward Round'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Bedside Actions</Text>
      <View style={styles.toolsRow}>
        {[
          { icon: '🫀', label: 'Log Vitals' },
          { icon: '💊', label: 'eMAR', go: 'more' as const, section: 'emar' },
          { icon: '📋', label: 'CPOE', go: 'orders' as TabKey },
          { icon: '🧪', label: 'Results', go: 'more' as const, section: 'results' },
        ].map((t, i) => (
          <TouchableOpacity key={i} style={styles.toolBtn} onPress={() => {
            if (t.go === 'orders') setSelectedTab('orders');
            else if (t.section) { setSelectedTab('more'); setMoreSection(t.section); }
          }} activeOpacity={0.8}>
            <Text style={styles.toolIcon}>{t.icon}</Text>
            <Text style={styles.toolLabel}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{'Ward 4-West · ' + patients.length + ' Assigned · Live'}</Text>
      {patients.map((p) => (
        <TouchableOpacity key={p.id} style={styles.patientCard} onPress={() => setSelectedTab('patients')} activeOpacity={0.9}>
          <View style={styles.patientTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bedTag}>BED {p.bed}  ·  {p.mrn}</Text>
              <Text style={styles.patientName}>{p.name} <Text style={styles.age}>({p.age})</Text></Text>
              <Text style={styles.dx}>{p.dx}</Text>
            </View>
            <View style={[styles.newsPill, p.high ? styles.newsHigh : styles.newsOk]}>
              <Text style={[styles.newsLabel, p.high ? styles.newsHighText : styles.newsOkText]}>NEWS2</Text>
              <Text style={[styles.newsNum, p.high ? styles.newsHighText : styles.newsOkText]}>{p.news}</Text>
            </View>
          </View>
          <View style={styles.vitalsRow}>
            {p.vitals.map((v, vi) => (<View key={vi} style={styles.vitalChip}><Text style={styles.vitalText}>{v}</Text></View>))}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMore = () => {
    const map: Record<string, React.ReactNode> = {
      emar: <MedicationAdmin onBack={() => setMoreSection(null)} />,
      notes: <ProgressNotes onBack={() => setMoreSection(null)} />,
      results: <ResultsReview onBack={() => setMoreSection(null)} />,
      discharge: <DischargeADT onBack={() => setMoreSection(null)} />,
      theatre: <TheatreList onBack={() => setMoreSection(null)} />,
      referrals: <Referrals onBack={() => setMoreSection(null)} />,
      nursing: <NursingAssessments onBack={() => setMoreSection(null)} />,
      emergency: <EmergencyResponse onBack={() => setMoreSection(null)} />,
      portering: <PorteringRequest onBack={() => setMoreSection(null)} />,
      handover: <HandoverNotes onBack={() => setMoreSection(null)} />,
      chat: <SecureTeamChat onBack={() => setMoreSection(null)} />,
      roster: <RosteringManagement onBack={() => setMoreSection(null)} />,
      alerts: <ClinicalAlerts onBack={() => setMoreSection(null)} />,
      assistant: <DoctorAssistant onBack={() => setMoreSection(null)} />,
      activity: <ActivityOverview onBack={() => setMoreSection(null)} />,
      prescription: <PrescriptionWriter onBack={() => setMoreSection(null)} />,
    };
    if (moreSection && map[moreSection]) return map[moreSection];

    const items = [
      { k: 'emar', icon: '💊', title: 'eMAR · Medication Admin', desc: 'Record drug administration' },
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
    ];

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={styles.sectionTitle}>All Clinical Tools</Text>
        {items.map((item) => (
          <TouchableOpacity key={item.k} style={styles.moreCard} onPress={() => setMoreSection(item.k)} activeOpacity={0.85}>
            <View style={styles.moreIconBox}><Text style={{ fontSize: 22 }}>{item.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.moreTitle}>{item.title}</Text>
              <Text style={styles.moreDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.brand}>MedCore Clinic</Text>
            <Text style={styles.doctor}>Dr. Julian Thorne, MD</Text>
            <Text style={styles.ward}>Ward 4-West · Day 07:00–19:00</Text>
          </View>
        </View>
        <View style={styles.onDuty}>
          <View style={styles.dot} />
          <Text style={styles.onDutyText}>ON DUTY</Text>
        </View>
      </View>

      {selectedTab === 'ward' && renderWard()}
      {selectedTab === 'patients' && <ClinicalWorkbench />}
      {selectedTab === 'tasks' && <TaskTracker />}
      {selectedTab === 'orders' && <OrderEntryReview />}
      {selectedTab === 'more' && renderMore()}

      <View style={styles.tabBar}>
        {[
          { k: 'ward', icon: '🏥', label: 'Ward' },
          { k: 'patients', icon: '👥', label: 'Patients' },
          { k: 'tasks', icon: '✅', label: 'Tasks' },
          { k: 'orders', icon: '📋', label: 'Orders' },
          { k: 'more', icon: '☰', label: 'More' },
        ].map((t) => {
          const active = selectedTab === t.k;
          return (
            <TouchableOpacity key={t.k} style={styles.tabItem} onPress={() => { setSelectedTab(t.k as TabKey); setMoreSection(null); }} activeOpacity={0.7}>
              <Text style={[styles.tabIcon, active && styles.tabIconOn]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{t.label}</Text>
              {active && <View style={styles.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.primary },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
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
  toolsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  toolBtn: { width: '23%', backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  toolIcon: { fontSize: 22, marginBottom: 6 },
  toolLabel: { fontSize: 11, fontWeight: '700', color: C.muted },
  patientCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  patientTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  bedTag: { fontSize: 11, fontWeight: '800', color: C.teal, letterSpacing: 0.3 },
  patientName: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 3 },
  age: { fontSize: 13, fontWeight: '500', color: C.muted },
  dx: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 17 },
  newsPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 56 },
  newsHigh: { backgroundColor: C.dangerSoft },
  newsOk: { backgroundColor: C.successSoft },
  newsLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  newsNum: { fontSize: 18, fontWeight: '800', marginTop: 1 },
  newsHighText: { color: '#DC2626' },
  newsOkText: { color: C.success },
  vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  vitalChip: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  vitalText: { fontSize: 11, fontWeight: '600', color: '#334155' },
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
