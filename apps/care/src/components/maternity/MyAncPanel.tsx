import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';

/**
 * Patient Care — My ANC (antenatal) card.
 * Reads facility-synced plans from localStorage (web / same-device demo)
 * and lets the mother set SMS language + opt-in.
 */

type SmsLang = 'en' | 'pidgin' | 'ibibio' | 'annang' | 'oron';

interface AncVisitSlot {
  week: number;
  label: string;
  dueDate: string;
}

interface AncPlan {
  patientId: string;
  facilityId: string;
  patientName: string;
  phone?: string;
  lmp?: string;
  edd: string;
  gaWeeksAtReg: number;
  visits: AncVisitSlot[];
  smsOptIn?: boolean;
  smsLang?: SmsLang;
  lastSmsAt?: string;
  createdAt: string;
  updatedAt?: string;
}

const ANC_KEY = 'medcore_anc_plans_v1';
const PREF_KEY = 'medcore_anc_sms_prefs_v1';
const LINK_KEY = 'medcore_care_anc_link_v1';

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {
    /* */
  }
  return null;
}

function storageSet(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* */
  }
}

function readPlans(): AncPlan[] {
  try {
    return JSON.parse(storageGet(ANC_KEY) || '[]');
  } catch {
    return [];
  }
}

function digitsOnly(s: string) {
  return String(s || '').replace(/\D/g, '');
}

function findPlan(phone: string, patientName: string): AncPlan | null {
  const plans = readPlans();
  const d = digitsOnly(phone);
  if (d.length >= 10) {
    const byPhone = plans.find((p) => {
      const pd = digitsOnly(p.phone || '');
      return pd && (pd.endsWith(d.slice(-10)) || d.endsWith(pd.slice(-10)));
    });
    if (byPhone) return byPhone;
  }
  const name = (patientName || '').trim().toLowerCase();
  if (name.length > 2) {
    const byName = plans.find((p) => p.patientName.toLowerCase().includes(name) || name.includes(p.patientName.toLowerCase()));
    if (byName) return byName;
  }
  try {
    const link = JSON.parse(storageGet(LINK_KEY) || 'null');
    if (link?.patientId) {
      return plans.find((p) => p.patientId === link.patientId) || null;
    }
  } catch {
    /* */
  }
  return plans[0] || null;
}

function nextVisit(plan: AncPlan | null): AncVisitSlot | null {
  if (!plan?.visits?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return plan.visits.find((v) => v.dueDate >= today) || plan.visits[plan.visits.length - 1] || null;
}

function gaNow(lmp?: string): number | null {
  if (!lmp) return null;
  const days = Math.floor((Date.now() - new Date(lmp).getTime()) / 864e5);
  return Math.max(0, Math.floor(days / 7));
}

interface Props {
  patientName?: string;
  patientPhone?: string;
  onToast?: (msg: string) => void;
}

export const MyAncPanel: React.FC<Props> = ({
  patientName = '',
  patientPhone = '',
  onToast,
}) => {
  const [phone, setPhone] = useState(patientPhone);
  const [tick, setTick] = useState(0);
  const plan = useMemo(() => findPlan(phone, patientName), [phone, patientName, tick]);
  const next = nextVisit(plan);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [smsLang, setSmsLang] = useState<SmsLang>('en');

  useEffect(() => {
    if (plan) {
      setSmsOptIn(plan.smsOptIn !== false);
      setSmsLang(plan.smsLang || 'en');
      if (plan.phone && !phone) setPhone(plan.phone);
    }
  }, [plan?.patientId, plan?.updatedAt]);

  const savePrefs = useCallback(() => {
    if (!plan) {
      onToast?.('No ANC plan linked yet — ask your midwife to register you with this phone number.');
      return;
    }
    const plans = readPlans();
    const i = plans.findIndex((p) => p.patientId === plan.patientId && p.facilityId === plan.facilityId);
    if (i >= 0) {
      plans[i] = {
        ...plans[i],
        phone: phone || plans[i].phone,
        smsOptIn,
        smsLang,
        updatedAt: new Date().toISOString(),
      };
      storageSet(ANC_KEY, JSON.stringify(plans));
    }
    const prefs = (() => {
      try {
        return JSON.parse(storageGet(PREF_KEY) || '[]');
      } catch {
        return [];
      }
    })();
    const pref = {
      patientId: plan.patientId,
      facilityId: plan.facilityId,
      phone: phone || plan.phone,
      smsOptIn,
      smsLang,
      updatedAt: new Date().toISOString(),
    };
    const nextPrefs = [pref, ...prefs.filter((p: any) => !(p.patientId === pref.patientId && p.facilityId === pref.facilityId))];
    storageSet(PREF_KEY, JSON.stringify(nextPrefs));
    storageSet(LINK_KEY, JSON.stringify({ patientId: plan.patientId, facilityId: plan.facilityId }));
    setTick((t) => t + 1);
    onToast?.('ANC SMS preference saved — hospital desk will respect this.');
  }, [plan, phone, smsOptIn, smsLang, onToast]);

  const ga = gaNow(plan?.lmp) ?? plan?.gaWeeksAtReg;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>PREGNANCY · ANTENATAL</Text>
        <Text style={styles.heroTitle}>My ANC card</Text>
        <Text style={styles.heroSub}>
          Official visit schedule from your hospital · SMS reminders in your language
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Phone used at ANC registration</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+234…"
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.linkBtn} onPress={() => setTick((t) => t + 1)} activeOpacity={0.85}>
          <Text style={styles.linkBtnText}>Find my ANC plan</Text>
        </TouchableOpacity>
      </View>

      {!plan ? (
        <View style={[styles.card, { backgroundColor: '#FFF7ED' }]}>
          <Text style={styles.emptyTitle}>No plan linked yet</Text>
          <Text style={styles.emptyBody}>
            When the midwife registers you for antenatal care with this phone number, your EDD and visit
            dates appear here. You can also open Care on the same device after registration at the desk.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.planName}>{plan.patientName}</Text>
            <Text style={styles.meta}>Facility · {plan.facilityId}</Text>
            <View style={styles.kpiRow}>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>EDD</Text>
                <Text style={styles.kpiVal}>{plan.edd}</Text>
              </View>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>GA now</Text>
                <Text style={styles.kpiVal}>{ga != null ? `${ga}w` : '—'}</Text>
              </View>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Next visit</Text>
                <Text style={[styles.kpiVal, { fontSize: 14 }]}>{next?.dueDate || '—'}</Text>
              </View>
            </View>
            {next && <Text style={styles.nextLabel}>{next.label}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Visit calendar</Text>
            {plan.visits.map((v) => {
              const today = new Date().toISOString().slice(0, 10);
              const past = v.dueDate < today;
              const isNext = next?.week === v.week;
              return (
                <View
                  key={v.week}
                  style={[
                    styles.visitRow,
                    isNext && styles.visitNext,
                    past && !isNext && { opacity: 0.55 },
                  ]}
                >
                  <Text style={styles.visitDate}>{v.dueDate}</Text>
                  <Text style={styles.visitLabel}>{v.label}</Text>
                  {isNext && <Text style={styles.badge}>Next</Text>}
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>SMS reminders</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Receive ANC SMS</Text>
              <Switch value={smsOptIn} onValueChange={setSmsOptIn} trackColor={{ true: '#DB2777', false: '#E2E8F0' }} />
            </View>
            <Text style={[styles.label, { marginTop: 12 }]}>Language</Text>
            <View style={styles.langRow}>
              {(['en', 'pidgin', 'ibibio', 'annang', 'oron'] as SmsLang[]).map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => setSmsLang(l)}
                  style={[styles.langChip, smsLang === l && styles.langChipOn]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.langChipText, smsLang === l && styles.langChipTextOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={savePrefs} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save preferences</Text>
            </TouchableOpacity>
            {plan.lastSmsAt ? (
              <Text style={styles.hint}>Last hospital SMS · {plan.lastSmsAt.slice(0, 16).replace('T', ' ')}</Text>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: '#9D174D',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  heroEyebrow: { color: '#FBCFE8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 6, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  linkBtn: {
    marginTop: 10,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkBtnText: { color: '#BE185D', fontWeight: '800', fontSize: 14 },
  emptyTitle: { fontWeight: '800', fontSize: 15, color: '#9A3412' },
  emptyBody: { marginTop: 8, fontSize: 13, color: '#9A3412', lineHeight: 19 },
  planName: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B', marginTop: 4 },
  kpiRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  kpi: {
    flex: 1,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    padding: 10,
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: '#9D174D', textTransform: 'uppercase' },
  kpiVal: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  nextLabel: { marginTop: 10, fontSize: 13, color: '#BE185D', fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  visitNext: { backgroundColor: '#FDF2F8', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10 },
  visitDate: { fontWeight: '800', fontSize: 12, color: '#0F172A', width: 92 },
  visitLabel: { flex: 1, fontSize: 12, color: '#475569' },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#BE185D',
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langChipOn: { backgroundColor: '#9D174D', borderColor: '#9D174D' },
  langChipText: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
  langChipTextOn: { color: '#fff' },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#DB2777',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hint: { marginTop: 10, fontSize: 11, color: '#94A3B8' },
});

export default MyAncPanel;
