/**
 * Patient experience inside unified MedCore Mobile (RBAC: patient.*)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Platform,
} from 'react-native';
import type { PatientSession } from '../auth/sessionTypes';

const C = {
  primary: '#0D9488',
  deep: '#0F766E',
  bg: '#F0FDFA',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
};

type PatientTab = 'home' | 'appointments' | 'records' | 'card' | 'profile';

interface Props {
  session: PatientSession;
  onSignOut: () => void;
}

export function PatientShell({ session, onSignOut }: Props) {
  const [tab, setTab] = useState<PatientTab>('home');
  const [bookNote, setBookNote] = useState('');

  const renderHome = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={styles.heroCard}>
        <Text style={styles.hello}>Hello, {session.name.split(' ')[0]}</Text>
        <Text style={styles.heroSub}>{session.facility}</Text>
        <Text style={styles.mrn}>Patient ID · {session.patientId}</Text>
      </View>

      <Text style={styles.section}>Quick actions</Text>
      <View style={styles.grid}>
        {[
          { k: 'appointments' as const, icon: '📅', label: 'Book visit' },
          { k: 'records' as const, icon: '📋', label: 'My records' },
          { k: 'card' as const, icon: '🪪', label: 'Health card' },
          { k: 'profile' as const, icon: '👤', label: 'Profile' },
        ].map((a) => (
          <TouchableOpacity key={a.k} style={styles.gridBtn} onPress={() => setTab(a.k)} activeOpacity={0.85}>
            <Text style={styles.gridIcon}>{a.icon}</Text>
            <Text style={styles.gridLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.emergency} activeOpacity={0.9}>
        <Text style={styles.emergencyTitle}>🚨 Emergency</Text>
        <Text style={styles.emergencySub}>Call hospital emergency desk / nearest A&E</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next appointment</Text>
        <Text style={styles.muted}>None scheduled — book a visit when you need care.</Text>
      </View>
    </ScrollView>
  );

  const renderAppointments = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={styles.section}>Book a visit</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Reason for visit</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Follow-up, fever, antenatal"
          placeholderTextColor="#94A3B8"
          value={bookNote}
          onChangeText={setBookNote}
        />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            setBookNote('');
            setTab('home');
          }}
        >
          <Text style={styles.primaryBtnText}>Request appointment</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Your facility will confirm the time. Data syncs when online.</Text>
      </View>
    </ScrollView>
  );

  const renderRecords = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={styles.section}>My health records</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>No shared records yet. After your first visit, lab results and notes from {session.facility} will appear here.</Text>
      </View>
    </ScrollView>
  );

  const renderCard = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={styles.idCard}>
        <Text style={styles.idBrand}>MedCore Health Card</Text>
        <Text style={styles.idName}>{session.name}</Text>
        <Text style={styles.idMeta}>{session.patientId}</Text>
        <Text style={styles.idMeta}>{session.facility}</Text>
        <Text style={styles.idMeta}>{session.phone || 'Phone on file'}</Text>
      </View>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={styles.section}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.row}>Name: {session.name}</Text>
        <Text style={styles.row}>Patient ID: {session.patientId}</Text>
        <Text style={styles.row}>Facility: {session.facility}</Text>
      </View>
      <TouchableOpacity style={styles.signOut} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.deep} />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>MedCore Care</Text>
          <Text style={styles.doctor}>{session.name}</Text>
        </View>
        <TouchableOpacity onPress={onSignOut}>
          <Text style={styles.headerLink}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {tab === 'home' && renderHome()}
      {tab === 'appointments' && renderAppointments()}
      {tab === 'records' && renderRecords()}
      {tab === 'card' && renderCard()}
      {tab === 'profile' && renderProfile()}

      <View style={styles.tabBar}>
        {(
          [
            { k: 'home' as const, icon: '🏠', label: 'Home' },
            { k: 'appointments' as const, icon: '📅', label: 'Visits' },
            { k: 'records' as const, icon: '📋', label: 'Records' },
            { k: 'card' as const, icon: '🪪', label: 'Card' },
            { k: 'profile' as const, icon: '👤', label: 'Me' },
          ] as const
        ).map((t) => {
          const active = tab === t.k;
          return (
            <TouchableOpacity key={t.k} style={styles.tabItem} onPress={() => setTab(t.k)} activeOpacity={0.7}>
              <Text style={[styles.tabIcon, active && styles.tabIconOn]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.deep },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.deep,
  },
  brand: { color: '#99F6E4', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  doctor: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 2 },
  headerLink: { color: '#CCFBF1', fontWeight: '700', fontSize: 13 },
  content: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  heroCard: {
    backgroundColor: C.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  hello: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: '#CCFBF1', marginTop: 4, fontSize: 13 },
  mrn: { color: '#99F6E4', marginTop: 10, fontSize: 12, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  gridBtn: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  gridIcon: { fontSize: 22, marginBottom: 6 },
  gridLabel: { fontSize: 13, fontWeight: '700', color: C.text },
  emergency: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },
  emergencyTitle: { fontWeight: '800', color: '#991B1B', fontSize: 15 },
  emergencySub: { color: '#7F1D1D', marginTop: 4, fontSize: 12 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: '800', color: C.text, marginBottom: 6 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: C.text,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  hint: { marginTop: 10, fontSize: 12, color: C.muted },
  idCard: {
    backgroundColor: '#0F766E',
    borderRadius: 20,
    padding: 24,
    minHeight: 200,
  },
  idBrand: { color: '#99F6E4', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  idName: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 20 },
  idMeta: { color: '#CCFBF1', marginTop: 8, fontSize: 13 },
  row: { color: C.text, marginBottom: 8, fontSize: 14 },
  signOut: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  signOutText: { color: C.danger, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 18, color: '#94A3B8' },
  tabIconOn: { color: C.primary },
  tabLabel: { fontSize: 10, color: '#94A3B8', marginTop: 3, fontWeight: '600' },
  tabLabelOn: { color: C.primary, fontWeight: '800' },
});
