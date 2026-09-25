/**
 * Staff ID Card on Clinic app — same badgeId as Hospital OS auth.
 * Reads card from shared storage when available (web); otherwise builds from session.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import type { StaffSession } from '../auth/StaffAuthScreen';

type CardStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

interface StaffCardLike {
  badgeId: string;
  fullName: string;
  title: string;
  department: string;
  facilityName: string;
  clearanceLabel: string;
  status: CardStatus;
  expiresAt: string;
  initials: string;
  templateLabel: string;
  stripe: string;
}

function loadSharedCard(badgeId: string): StaffCardLike | null {
  try {
    // Web / shared browser with OS
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('medcore_staff_id_cards');
      if (!raw) return null;
      const list = JSON.parse(raw) as Array<Record<string, string>>;
      const hit = list.find((c) => c.badgeId === badgeId);
      if (!hit) return null;
      return {
        badgeId: hit.badgeId,
        fullName: hit.fullName,
        title: hit.title,
        department: hit.department,
        facilityName: hit.facilityName,
        clearanceLabel: hit.clearanceLabel,
        status: (hit.status as CardStatus) || 'ACTIVE',
        expiresAt: hit.expiresAt,
        initials: hit.initials || 'ST',
        templateLabel: hit.templateKey || 'Clinical',
        stripe: '#0066FF',
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function cardFromSession(session: StaffSession): StaffCardLike {
  const badgeId = session.staffId || 'STAFF-LOCAL';
  const shared = loadSharedCard(badgeId);
  if (shared) return shared;
  const parts = session.name.split(/\s+/);
  const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const exp = new Date();
  exp.setFullYear(exp.getFullYear() + 2);
  return {
    badgeId,
    fullName: session.name,
    title: session.title,
    department: session.department,
    facilityName: session.facility,
    clearanceLabel: 'Clinical',
    status: 'ACTIVE',
    expiresAt: exp.toISOString().slice(0, 10),
    initials,
    templateLabel: 'Clinical',
    stripe: '#0D9488',
  };
}

interface Props {
  session: StaffSession;
  onBack: () => void;
}

export function StaffIdCardScreen({ session, onBack }: Props) {
  const card = useMemo(() => cardFromSession(session), [session]);
  const statusColor = card.status === 'ACTIVE' ? '#059669' : '#EA580C';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>My Staff ID</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          Same identity as Hospital OS login. Enrolment on OS issues this card automatically.
        </Text>

        <View style={styles.card}>
          <View style={[styles.stripe, { backgroundColor: card.stripe }]} />
          <View style={styles.cardInner}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>MEDCORE CLINIC · STAFF ID</Text>
                <Text style={styles.name}>{card.fullName}</Text>
                <Text style={styles.sub}>{card.title}</Text>
              </View>
              <View style={[styles.avatar, { backgroundColor: card.stripe }]}>
                <Text style={styles.avatarText}>{card.initials}</Text>
              </View>
            </View>

            <View style={styles.badgeBox}>
              <Text style={styles.badgeId}>{card.badgeId}</Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.cell}>
                <Text style={styles.label}>Department</Text>
                <Text style={styles.value}>{card.department}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>Facility</Text>
                <Text style={styles.value}>{card.facilityName}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>Clearance</Text>
                <Text style={styles.value}>{card.clearanceLabel}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>Status</Text>
                <Text style={[styles.value, { color: statusColor }]}>{card.status}</Text>
              </View>
            </View>

            <Text style={styles.footer}>
              Valid until {card.expiresAt} · Auth-linked badge · Template {card.templateLabel}
            </Text>
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>How it stays in sync</Text>
          <Text style={styles.noteBody}>
            When HR enrols staff on Hospital OS, a card is written to the shared staff registry
            (badge ID). Clinic reads that record when available; otherwise it shows your session
            identity. Production: both apps call GET /api/v1/staff/cards/:badgeId.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F9FF' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E3A8A',
  },
  back: { color: '#E0F2FE', fontSize: 16, fontWeight: '600' },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: '#64748B', marginBottom: 14, lineHeight: 18 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  stripe: { height: 6 },
  cardInner: { padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
  kicker: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 },
  name: { fontSize: 18, fontWeight: '800', color: '#F8FAFC', marginTop: 4 },
  sub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  badgeBox: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  badgeId: {
    fontFamily: PlatformSelectMono(),
    fontSize: 14,
    fontWeight: '700',
    color: '#5EEAD4',
    letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  cell: { width: '50%', marginBottom: 10 },
  label: { fontSize: 11, color: '#64748B' },
  value: { fontSize: 13, fontWeight: '600', color: '#E2E8F0', marginTop: 2 },
  footer: { fontSize: 11, color: '#64748B', marginTop: 8, lineHeight: 16 },
  note: {
    marginTop: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteTitle: { fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  noteBody: { fontSize: 13, color: '#64748B', lineHeight: 19 },
});

function PlatformSelectMono() {
  return 'monospace';
}

export default StaffIdCardScreen;
