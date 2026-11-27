/**
 * Patient experience — Liquid-Glass MedCore Care Portal synced live with MedCore OS
 * Includes: Home Summary, Visits Booking, Live Records (Labs/Rx/Vitals/Summaries) & Bills Payment, Scannable QR Health Card, and AI Symptom Triage.
 */
import React, { useEffect, useState } from 'react';
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { PatientSession } from '../auth/sessionTypes';
import {
  AmbientGlowBackdrop,
  GlowButton,
  LiquidGlassCard,
  LiquidTabBar,
  LiveSyncPill,
  type SyncState,
} from '../components/ui/LiquidGlass';
import { MedIcon } from '../components/ui/PremiumIcons';
import { QrMatrix } from '../components/ui/QrMatrix';
import { C } from '../theme';
import {
  bookPatientAppointmentWithEmr,
  fetchPatientCareSync,
  initPatientPayment,
  sendPatientTriage,
} from '../services/emrSyncClient';

type PatientTab = 'home' | 'appointments' | 'records' | 'triage' | 'card' | 'profile';

interface Props {
  session: PatientSession;
  onSignOut: () => void;
  onLock?: () => void;
}

export function PatientShell({ session, onSignOut, onLock }: Props) {
  const [tab, setTab] = useState<PatientTab>('home');
  const [department, setDepartment] = useState('General Outpatient (GOPD)');
  const [preferredSlot, setPreferredSlot] = useState('Tomorrow · 09:00 AM');
  const [bookNote, setBookNote] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(
    session.emrSynced ? 'live' : 'offline'
  );
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [akshiaStatus, setAkshiaStatus] = useState<any>(null);
  const [records, setRecords] = useState<{
    labs: any[];
    prescriptions: any[];
    vitals: any[];
    summaries: any[];
  }>({ labs: [], prescriptions: [], vitals: [], summaries: [] });
  const [bills, setBills] = useState<any[]>([]);
  const [bookedToast, setBookedToast] = useState<string | null>(null);

  // Payment state
  const [payAmountInput, setPayAmountInput] = useState('2500');
  const [payBusy, setPayBusy] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    mode?: string;
    reference?: string;
    authorizationUrl?: string;
    instructions?: string;
  } | null>(null);

  // AI Triage state
  const [triageInput, setTriageInput] = useState('');
  const [triageBusy, setTriageBusy] = useState(false);
  const [triageHistory, setTriageHistory] = useState<
    Array<{
      sender: 'patient' | 'bot';
      text: string;
      urgency?: string;
      department?: string;
      redFlags?: string[];
    }>
  >([
    {
      sender: 'bot',
      text: `Hello ${session.name.split(' ')[0] || 'there'}, describe any symptoms (in English or Pidgin) and I will triage urgency and guide your care at ${session.facility}.`,
    },
  ]);

  const first = session.name.split(' ')[0] || 'there';
  const patientKey = session.shid || session.patientId;

  const refreshCareSync = async () => {
    setSyncState('syncing');
    const res = await fetchPatientCareSync({
      shid: patientKey,
      phone: session.phone,
      facilityId: session.facilityId || 'IGH-EKT',
    });
    if (res.ok) {
      setSyncState('live');
      setAppointments(res.appointments);
      setReminders(res.reminders);
      setAkshiaStatus(res.akshiaCoverage);
      if (res.records) setRecords(res.records);
      if (Array.isArray(res.bills)) setBills(res.bills);
    } else {
      setSyncState(session.emrSynced ? 'syncing' : 'offline');
    }
  };

  useEffect(() => {
    void refreshCareSync();
  }, [session.patientId, session.facilityId]);

  const handleBookVisit = async () => {
    setBookingBusy(true);
    setBookedToast(null);
    try {
      const res = await bookPatientAppointmentWithEmr({
        facilityId: session.facilityId || 'IGH-EKT',
        facilityName: session.facility,
        patientName: session.name,
        shid: patientKey,
        phone: session.phone,
        department: bookNote.trim() ? `${department} (${bookNote.trim()})` : department,
        preferredSlot,
      });
      if (res.booking) {
        setAppointments((prev) => [res.booking, ...prev]);
      } else {
        setAppointments((prev) => [
          {
            bookingRef: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
            department,
            preferredSlot,
            status: res.synced ? 'scheduled' : 'queued',
          },
          ...prev,
        ]);
      }
      setBookNote('');
      setBookedToast(
        res.synced
          ? 'Booking synced live to hospital EMR Reception queue.'
          : 'Booking saved offline and queued for hospital EMR sync.'
      );
      setTab('home');
    } finally {
      setBookingBusy(false);
    }
  };

  const handlePayHospitalBill = async (invoiceRef?: string, overrideAmount?: number) => {
    const amt = overrideAmount ?? Number(payAmountInput.replace(/[^\d.]/g, '') || 0);
    if (!amt || amt < 1) return;
    setPayBusy(true);
    setPaymentResult(null);
    try {
      const res = await initPatientPayment({
        facilityId: session.facilityId || 'IGH-EKT',
        amountNgn: amt,
        invoiceRef,
        email: session.email,
        shid: patientKey,
        patientName: session.name,
      });
      if (res.ok) {
        setPaymentResult(res);
      }
    } finally {
      setPayBusy(false);
    }
  };

  const handleSendTriage = async () => {
    const msg = triageInput.trim();
    if (!msg) return;
    setTriageInput('');
    setTriageHistory((prev) => [...prev, { sender: 'patient', text: msg }]);
    setTriageBusy(true);
    try {
      const res = await sendPatientTriage({
        facilityId: session.facilityId || 'IGH-EKT',
        message: msg,
        patientName: session.name,
        shid: patientKey,
        phone: session.phone,
      });
      setTriageHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: res.reply || res.error || 'Triage guidance temporarily unavailable.',
          urgency: res.urgency,
          department: res.recommendedDepartment,
          redFlags: res.redFlags,
        },
      ]);
    } finally {
      setTriageBusy(false);
    }
  };

  const renderHome = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{ paddingBottom: 112 }}
      showsVerticalScrollIndicator={false}
    >
      <LiquidGlassCard glowColor={C.glowEmerald} intensity="strong" animateIn style={{ marginBottom: 14 }}>
        <Text style={styles.heroEyebrow}>MEDCORE CARE PORTAL</Text>
        <Text style={styles.hello}>Hello, {first}</Text>
        <Text style={styles.heroSub}>{session.facility}</Text>
        <View style={styles.mrnPill}>
          <MedIcon name="card" size={13} color="#6EE7B7" badge={false} />
          <Text style={styles.mrn}>{patientKey}</Text>
        </View>
      </LiquidGlassCard>

      <Text style={styles.section}>Quick Actions</Text>
      <View style={styles.grid}>
        {[
          { k: 'appointments' as const, icon: 'calendar' as const, label: 'Book Visit', glow: C.glowEmerald },
          { k: 'records' as const, icon: 'clipboard' as const, label: 'Records & Bills', glow: C.glowBlue },
          { k: 'triage' as const, icon: 'sparkles' as const, label: 'Symptom Triage', glow: C.glowCyan },
          { k: 'card' as const, icon: 'card' as const, label: 'Health Card QR', glow: C.glowViolet },
        ].map((a) => (
          <TouchableOpacity
            key={a.k}
            style={styles.gridItem}
            onPress={() => setTab(a.k)}
            activeOpacity={0.88}
          >
            <LiquidGlassCard glowColor={a.glow} style={styles.gridGlass}>
              <MedIcon name={a.icon} size={18} color="#FFFFFF" glowColor={a.glow} />
              <Text style={styles.gridLabel}>{a.label}</Text>
            </LiquidGlassCard>
          </TouchableOpacity>
        ))}
      </View>

      {bookedToast && (
        <LiquidGlassCard glowColor={C.glowEmerald} style={{ marginBottom: 14 }}>
          <Text style={{ color: '#A7F3D0', fontSize: 12.5, fontWeight: '700' }}>{bookedToast}</Text>
        </LiquidGlassCard>
      )}

      <LiquidGlassCard glowColor={C.glowCyan} style={{ marginBottom: 14 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Upcoming Visits ({appointments.length})</Text>
          <TouchableOpacity onPress={refreshCareSync}>
            <Text style={styles.linkText}>Refresh EMR</Text>
          </TouchableOpacity>
        </View>
        {appointments.length > 0 ? (
          appointments.slice(0, 3).map((a, idx) => (
            <View key={a.bookingRef || idx} style={styles.visitRow}>
              <Text style={styles.visitTitle}>{a.department || 'General OPD'}</Text>
              <Text style={styles.visitMeta}>
                {a.preferredSlot || 'Tomorrow'} · {a.bookingRef || 'Scheduled'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.cardBody}>
            No upcoming visits scheduled yet. Book a slot and it syncs straight to {session.facility} Reception.
          </Text>
        )}
        <View style={{ marginTop: 12 }}>
          <GlowButton
            label="Book a Hospital Visit"
            icon="calendar"
            variant="emerald"
            onPress={() => setTab('appointments')}
          />
        </View>
      </LiquidGlassCard>

      {reminders.length > 0 && (
        <LiquidGlassCard glowColor={C.glowViolet}>
          <Text style={styles.cardTitle}>Care Reminders from EMR</Text>
          {reminders.slice(0, 2).map((r: any, idx: number) => (
            <Text key={idx} style={[styles.cardBody, { marginTop: 6 }]}>
              • {r.title || r.message || r.track || 'Scheduled check-in reminder'}
            </Text>
          ))}
        </LiquidGlassCard>
      )}
    </ScrollView>
  );

  const renderAppointments = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 112 }}>
      <Text style={styles.section}>Book a Visit (EMR Live Sync)</Text>
      <LiquidGlassCard glowColor={C.glowEmerald}>
        <Text style={styles.label}>DEPARTMENT</Text>
        <View style={styles.chipWrap}>
          {['General Outpatient (GOPD)', 'Antenatal / Maternity', 'Paediatrics', 'Chronic Care / HTN'].map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setDepartment(d)}
              style={[styles.chip, department === d && styles.chipActive]}
            >
              <Text style={[styles.chipText, department === d && { color: '#A7F3D0' }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>PREFERRED SLOT</Text>
        <View style={styles.chipWrap}>
          {['Tomorrow · 09:00 AM', 'Tomorrow · 12:30 PM', 'In 2 Days · 09:00 AM'].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setPreferredSlot(s)}
              style={[styles.chip, preferredSlot === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, preferredSlot === s && { color: '#A7F3D0' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>SYMPTOMS / REASON FOR VISIT</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Follow-up checkup, fever, blood pressure review"
          placeholderTextColor="#64748B"
          value={bookNote}
          onChangeText={setBookNote}
        />

        <GlowButton
          label="Confirm Appointment & Sync to EMR"
          icon="check"
          variant="emerald"
          loading={bookingBusy}
          onPress={handleBookVisit}
        />
      </LiquidGlassCard>
    </ScrollView>
  );

  const renderRecords = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 112 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.section}>Records &amp; Hospital Bills</Text>
        <TouchableOpacity onPress={refreshCareSync}>
          <Text style={styles.linkText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      <LiquidGlassCard glowColor={C.glowBlue} style={{ marginBottom: 12 }}>
        <Text style={styles.cardTitle}>
          Prescriptions ({records.prescriptions.length}) &amp; Lab Results ({records.labs.length})
        </Text>
        {records.prescriptions.length === 0 && records.labs.length === 0 && records.summaries.length === 0 ? (
          <Text style={styles.cardBody}>
            Verified prescriptions, vitals, and clinician summaries from {session.facility} appear here automatically once signed off in MedCore OS.
          </Text>
        ) : (
          <>
            {records.summaries.map((s, i) => (
              <View key={`s-${i}`} style={styles.visitRow}>
                <Text style={styles.visitTitle}>Clinical Summary: {s.title}</Text>
                <Text style={styles.visitMeta}>{s.updatedAt?.slice(0, 10) || 'EMR Record'}</Text>
              </View>
            ))}
            {records.prescriptions.map((rx, i) => (
              <View key={`rx-${i}`} style={styles.visitRow}>
                <Text style={styles.visitTitle}>Rx: {rx.name || rx.medication || rx.drug || 'Prescription'}</Text>
                <Text style={styles.visitMeta}>{rx.dosage || rx.notes || rx.status || 'Dispensed'}</Text>
              </View>
            ))}
            {records.labs.map((lab, i) => (
              <View key={`lab-${i}`} style={styles.visitRow}>
                <Text style={styles.visitTitle}>Lab/Order: {lab.name || lab.title || 'Diagnostic Order'}</Text>
                <Text style={styles.visitMeta}>{lab.status || 'Synced with LIS'}</Text>
              </View>
            ))}
          </>
        )}
      </LiquidGlassCard>

      <LiquidGlassCard glowColor={C.glowAmber} style={{ marginBottom: 12 }}>
        <Text style={styles.cardTitle}>Bills &amp; Copay Checkout</Text>
        {bills.length > 0 &&
          bills.map((b, i) => (
            <View key={`b-${i}`} style={styles.visitRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.visitTitle}>{b.description || b.title || b.reference || 'Hospital Invoice'}</Text>
                <Text style={[styles.visitMeta, { fontWeight: '800' }]}>
                  NGN {Number(b.amountNgn || b.amount || 0).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => void handlePayHospitalBill(b.reference, Number(b.amountNgn || b.amount || 2500))}
                style={{ marginTop: 4 }}
              >
                <Text style={styles.linkText}>Pay This Invoice →</Text>
              </TouchableOpacity>
            </View>
          ))}

        <Text style={[styles.label, { marginTop: 10 }]}>PAY COPAY / DEPOSIT AMOUNT (NGN)</Text>
        <TextInput
          style={styles.input}
          value={payAmountInput}
          onChangeText={setPayAmountInput}
          keyboardType="numeric"
          placeholder="2500"
          placeholderTextColor="#64748B"
        />
        <GlowButton
          label={payBusy ? 'Generating Mandate…' : 'Pay via Paystack / AkwaRemit'}
          icon="card"
          variant="primary"
          loading={payBusy}
          onPress={() => void handlePayHospitalBill()}
        />

        {paymentResult && (
          <View style={styles.payBox}>
            <Text style={styles.payRef}>Ref: {paymentResult.reference}</Text>
            <Text style={styles.payDesc}>{paymentResult.instructions}</Text>
            {paymentResult.authorizationUrl && (
              <TouchableOpacity
                onPress={() => void Linking.openURL(paymentResult.authorizationUrl!)}
                style={{ marginTop: 6 }}
              >
                <Text style={[styles.linkText, { fontWeight: '800' }]}>Open Paystack Checkout →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </LiquidGlassCard>
    </ScrollView>
  );

  const renderTriage = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 112 }}>
      <Text style={styles.section}>AI Symptom Triage &amp; Care Guide</Text>
      <LiquidGlassCard glowColor={C.glowCyan} style={{ marginBottom: 12 }}>
        {triageHistory.map((m, idx) => (
          <View
            key={idx}
            style={[styles.msgBubble, m.sender === 'patient' ? styles.msgUser : styles.msgBot]}
          >
            {m.urgency && (
              <Text style={styles.urgencyTag}>URGENCY: {m.urgency.toUpperCase()}</Text>
            )}
            <Text style={styles.msgText}>{m.text}</Text>
            {m.department && (
              <TouchableOpacity
                onPress={() => {
                  setDepartment(m.department!);
                  setTab('appointments');
                }}
                style={{ marginTop: 6 }}
              >
                <Text style={styles.linkText}>Book {m.department} →</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={[styles.label, { marginTop: 10 }]}>DESCRIBE SYMPTOMS (ENGLISH / PIDGIN)</Text>
        <TextInput
          style={styles.input}
          value={triageInput}
          onChangeText={setTriageInput}
          placeholder="e.g. High fever since yesterday, headache, body weak"
          placeholderTextColor="#64748B"
        />
        <GlowButton
          label={triageBusy ? 'Analyzing…' : 'Check Urgency & Department'}
          icon="sparkles"
          variant="primary"
          loading={triageBusy}
          onPress={handleSendTriage}
        />
      </LiquidGlassCard>
    </ScrollView>
  );

  const renderCard = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 112 }}>
      <LiquidGlassCard glowColor={C.glowViolet} intensity="strong" animateIn>
        <View style={styles.rowBetween}>
          <Text style={styles.idBrand}>MEDCORE DIGITAL HEALTH CARD</Text>
          <MedIcon name="sparkles" size={16} color="#C4B5FD" badge={false} />
        </View>
        <Text style={styles.idName}>{session.name}</Text>

        <View style={{ alignItems: 'center', marginVertical: 14 }}>
          <QrMatrix
            value={`MEDCORE:SHID:${patientKey}:${session.facilityId || 'IGH-EKT'}`}
            size={126}
            label={`SHID · ${patientKey}`}
          />
        </View>

        <View style={styles.idDivider} />
        <Text style={styles.idMeta}>SHID / ID: {patientKey}</Text>
        <Text style={styles.idMeta}>Primary Facility: {session.facility}</Text>
        <Text style={styles.idMeta}>Phone: {session.phone || 'On file'}</Text>
        {akshiaStatus && (
          <Text style={[styles.idMeta, { color: '#6EE7B7', marginTop: 8 }]}>
            AKSHIA Status: {akshiaStatus.status || akshiaStatus.tier || 'Verified Enrollee'}
          </Text>
        )}
      </LiquidGlassCard>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 112 }}>
      <Text style={styles.section}>Patient Profile</Text>
      <LiquidGlassCard glowColor={C.glowCyan} style={{ marginBottom: 16 }}>
        <Text style={styles.rowLabel}>Full Name</Text>
        <Text style={styles.rowValue}>{session.name}</Text>
        <Text style={styles.rowLabel}>Patient / SHID</Text>
        <Text style={styles.rowValue}>{patientKey}</Text>
        <Text style={styles.rowLabel}>Registered Facility</Text>
        <Text style={styles.rowValue}>{session.facility} ({session.facilityId})</Text>
      </LiquidGlassCard>
      <GlowButton label="Sign Out" icon="logout" variant="danger" onPress={onSignOut} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AmbientGlowBackdrop variant="care" />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>MedCore Care</Text>
          <Text style={styles.patientName}>{session.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LiveSyncPill state={syncState} onPress={refreshCareSync} />
          {onLock && (
            <TouchableOpacity onPress={onLock} style={styles.lockBtn}>
              <MedIcon name="lock" size={14} color="#7DD3FC" badge={false} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onSignOut} style={styles.headerBtn}>
            <MedIcon name="logout" size={14} color="#FDA4AF" badge={false} />
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'home' && renderHome()}
      {tab === 'appointments' && renderAppointments()}
      {tab === 'records' && renderRecords()}
      {tab === 'triage' && renderTriage()}
      {tab === 'card' && renderCard()}
      {tab === 'profile' && renderProfile()}

      <LiquidTabBar<PatientTab>
        accentColor={C.glowEmerald}
        activeKey={tab}
        onSelect={setTab}
        items={[
          { key: 'home', icon: 'heart', label: 'Home' },
          { key: 'appointments', icon: 'calendar', label: 'Visits' },
          { key: 'records', icon: 'clipboard', label: 'Records' },
          { key: 'triage', icon: 'sparkles', label: 'Triage' },
          { key: 'card', icon: 'card', label: 'Card' },
          { key: 'profile', icon: 'users', label: 'Profile' },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brand: { color: '#6EE7B7', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  patientName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 1 },
  lockBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 14 },
  heroEyebrow: { color: '#6EE7B7', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9 },
  hello: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
  heroSub: { color: '#CBD5E1', marginTop: 4, fontSize: 13 },
  mrnPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  mrn: { color: '#A7F3D0', fontSize: 12, fontWeight: '800' },
  section: { fontSize: 14, fontWeight: '800', color: '#E2E8F0', marginBottom: 10, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  gridItem: { width: '48%' },
  gridGlass: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  gridLabel: { color: '#F8FAFC', fontSize: 13, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardBody: { color: '#94A3B8', fontSize: 12.5, lineHeight: 18 },
  visitRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  visitTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  visitMeta: { color: '#6EE7B7', fontSize: 11.5, marginTop: 2 },
  label: { color: '#94A3B8', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipActive: { backgroundColor: 'rgba(16, 185, 129, 0.24)', borderColor: C.glowEmerald },
  chipText: { color: '#CBD5E1', fontSize: 11.5, fontWeight: '700' },
  input: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#F8FAFC',
    fontSize: 13.5,
    marginBottom: 14,
  },
  payBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  payRef: { color: '#6EE7B7', fontSize: 12, fontWeight: '900' },
  payDesc: { color: '#E2E8F0', fontSize: 12, marginTop: 3, lineHeight: 17 },
  msgBubble: { padding: 11, borderRadius: 12, marginBottom: 8 },
  msgUser: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  msgBot: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'flex-start',
    maxWidth: '94%',
  },
  urgencyTag: { color: '#FBBF24', fontSize: 10, fontWeight: '900', marginBottom: 3 },
  msgText: { color: '#F8FAFC', fontSize: 13, lineHeight: 18 },
  idBrand: { color: '#C4B5FD', fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  idName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 10 },
  idDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginVertical: 12 },
  idMeta: { color: '#E2E8F0', fontSize: 13, marginBottom: 4, fontWeight: '600' },
  rowLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 8 },
  rowValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 2 },
});

export default PatientShell;
