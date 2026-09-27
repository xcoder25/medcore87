/**
 * Patient experience — premium Care-style shell
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
  navy: '#0B1220',
  bg: '#F0FDFA',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
  blue: '#0066FF',
};

type PatientTab = 'home' | 'appointments' | 'records' | 'card' | 'profile';

interface Props {
  session: PatientSession;
  onSignOut: () => void;
}

export function PatientShell({ session, onSignOut }: Props) {
  const [tab, setTab] = useState<PatientTab>('home');
  const [bookNote, setBookNote] = useState('');
  const [booked, setBooked] = useState(false);

  const first = session.name.split(' ')[0] || 'there';

  const renderHome = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>MedCore Care</Text>
        <Text style={styles.hello}>Hello, {first} 👋</Text>
        <Text style={styles.heroSub}>{session.facility}</Text>
        <View style={styles.mrnPill}>
          <Text style={styles.mrn}>ID · {session.patientId}</Text>
        </View>
      </View>

      <Text style={styles.section}>Quick actions</Text>
      <View style={styles.grid}>
        {[
          { k: 'appointments' as const, icon: '📅', label: 'Book visit', tint: '#ECFDF5' },
          { k: 'records' as const, icon: '📋', label: 'My records', tint: '#EFF6FF' },
          { k: 'card' as const, icon: '🪪', label: 'Health card', tint: '#F5F3FF' },
          { k: 'profile' as const, icon: '👤', label: 'Profile', tint: '#FFF7ED' },
        ].map((a) => (
          <TouchableOpacity
            key={a.k}
            style={[styles.gridBtn, { backgroundColor: a.tint }]}
            onPress={() => setTab(a.k)}
            activeOpacity={0.85}
          >
            <Text style={styles.gridIcon}>{a.icon}</Text>
            <Text style={styles.gridLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.emergency} activeOpacity={0.9}>
        <View style={styles.emergencyIcon}>
          <Text style={{ fontSize: 22 }}>🚨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.emergencyTitle}>Emergency</Text>
          <Text style={styles.emergencySub}>Nearest A&E · hospital emergency desk</Text>
        </View>
        <Text style={styles.emergencyChev}>›</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next appointment</Text>
        {booked ? (
          <Text style={styles.cardBodyOk}>Request sent — the hospital will confirm your time.</Text>
        ) : (
          <Text style={styles.cardBody}>None scheduled. Book a visit when you need care.</Text>
        )}
        <TouchableOpacity style={styles.ghostBtn} onPress={() => setTab('appointments')}>
          <Text style={styles.ghostBtnText}>Book a visit</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderAppointments = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
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
            setBooked(true);
            setTab('home');
          }}
        >
          <Text style={styles.primaryBtnText}>Request appointment</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Your facility will confirm the time. Works offline, syncs later.</Text>
      </View>
    </ScrollView>
  );

  const renderRecords = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.section}>My health records</Text>
      <View style={styles.card}>
        <Text style={styles.cardBody}>
          No shared records yet. After your first visit, lab results and notes from {session.facility} will appear here.
        </Text>
      </View>
    </ScrollView>
  );

  const renderCard = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.idCard}>
        <Text style={styles.idBrand}>MEDCORE HEALTH CARD</Text>
        <Text style={styles.idName}>{session.name}</Text>
        <View style={styles.idDivider} />
        <Text style={styles.idMeta}>{session.patientId}</Text>
        <Text style={styles.idMeta}>{session.facility}</Text>
        <Text style={styles.idMeta}>{session.phone || 'Phone on file'}</Text>
        <View style={styles.idFooter}>
          <Text style={styles.idFooterText}>Akwa Ibom State</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.section}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.rowLabel}>Name</Text>
        <Text style={styles.rowValue}>{session.name}</Text>
        <Text style={styles.rowLabel}>Patient ID</Text>
        <Text style={styles.rowValue}>{session.patientId}</Text>
        <Text style={styles.rowLabel}>Facility</Text>
        <Text style={styles.rowValue}>{session.facility}</Text>
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
        <TouchableOpacity onPress={onSignOut} style={styles.headerBtn}>
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
              {active && <View style={styles.tabDot} />}
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
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerLink: { color: '#CCFBF1', fontWeight: '700', fontSize: 13 },
  content: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  heroCard: {
    backgroundColor: C.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroEyebrow: { color: '#99F6E4', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  hello: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 6 },
  heroSub: { color: '#CCFBF1', marginTop: 6, fontSize: 13, lineHeight: 18 },
  mrnPill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mrn: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  gridBtn: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
  },
  gridIcon: { fontSize: 24, marginBottom: 8 },
  gridLabel: { fontSize: 13, fontWeight: '700', color: C.text },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
    gap: 12,
  },
  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyTitle: { fontWeight: '800', color: '#991B1B', fontSize: 15 },
  emergencySub: { color: '#7F1D1D', marginTop: 2, fontSize: 12 },
  emergencyChev: { color: '#F87171', fontSize: 24 },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontWeight: '800', color: C.text, marginBottom: 6, fontSize: 15 },
  cardBody: { color: C.muted, fontSize: 13, lineHeight: 19 },
  cardBodyOk: { color: C.primary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  ghostBtn: { marginTop: 12, alignSelf: 'flex-start' },
  ghostBtnText: { color: C.blue, fontWeight: '800', fontSize: 13 },
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
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  hint: { marginTop: 10, fontSize: 12, color: C.muted, lineHeight: 17 },
  idCard: {
    backgroundColor: '#0F766E',
    borderRadius: 24,
    padding: 24,
    minHeight: 220,
    shadowColor: '#0F766E',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  idBrand: { color: '#99F6E4', fontWeight: '800', fontSize: 11, letterSpacing: 1.2 },
  idName: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 20 },
  idDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 },
  idMeta: { color: '#CCFBF1', marginTop: 6, fontSize: 13 },
  idFooter: { marginTop: 24 },
  idFooterText: { color: '#5EEAD4', fontSize: 11, fontWeight: '700' },
  rowLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 10 },
  rowValue: { fontSize: 15, fontWeight: '600', color: C.text, marginTop: 2 },
  signOut: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
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
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 18, color: '#94A3B8' },
  tabIconOn: { color: C.primary },
  tabLabel: { fontSize: 10, color: '#94A3B8', marginTop: 3, fontWeight: '600' },
  tabLabelOn: { color: C.primary, fontWeight: '800' },
  tabDot: { width: 16, height: 3, borderRadius: 2, backgroundColor: C.primary, marginTop: 4 },
});
