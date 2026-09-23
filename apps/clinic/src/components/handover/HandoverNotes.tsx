import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

type Props = { onBack?: () => void };

const C = {
  primary: '#1E3A8A',
  teal: '#0D9488',
  bg: '#F0F9FF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  amber: '#D97706',
  red: '#DC2626',
};

const HANDOVERS = [
  {
    id: 'H1',
    patient: 'Robert Chen (Bed 4B)',
    sbar: {
      s: 'Post-PCI Day 1. Telemetry stable, no chest pain overnight.',
      b: 'Admitted with NSTEMI. Stented LAD yesterday by Dr. Adeyemi.',
      a: 'Vitals stable. Troponin trending down (0.84 -> 0.42). Heparin stopped.',
      r: 'Repeat ECG at 12:00. Cardiac rehab review this afternoon.',
    },
    codeStatus: 'FULL CODE',
    nurse: 'Nurse K. Okon',
  },
  {
    id: 'H2',
    patient: 'Margaret Taylor (Bed 5A)',
    sbar: {
      s: 'Acute decompensated heart failure, resolving.',
      b: 'Admitted with pulmonary edema. IV Furosemide diuresis active.',
      a: 'O2 saturation 96% on room air. Net fluid balance -1200 mL.',
      r: 'Switch to oral furosemide 40mg. Prepare discharge summary for tomorrow.',
    },
    codeStatus: 'FULL CODE',
    nurse: 'Nurse E. Danjuma',
  },
];

export const HandoverNotes: React.FC<Props> = ({ onBack }) => {
  const [activeShift, setActiveShift] = useState<'Morning' | 'Night'>('Morning');

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>Handover Notes (SBAR)</Text>
      <Text style={s.pageSub}>Clinical shift-to-shift continuity & code status</Text>

      <View style={s.tabs}>
        {(['Morning', 'Night'] as const).map((shift) => (
          <TouchableOpacity
            key={shift}
            style={[s.tab, activeShift === shift && s.tabOn]}
            onPress={() => setActiveShift(shift)}
          >
            <Text style={[s.tabText, activeShift === shift && s.tabTextOn]}>{shift} Shift</Text>
          </TouchableOpacity>
        ))}
      </View>

      {HANDOVERS.map((h) => (
        <View key={h.id} style={s.card}>
          <View style={s.header}>
            <Text style={s.patient}>{h.patient}</Text>
            <View style={s.codeBadge}>
              <Text style={s.codeText}>{h.codeStatus}</Text>
            </View>
          </View>
          <View style={s.sbarItem}>
            <Text style={s.sbarLabel}>S (Situation):</Text>
            <Text style={s.sbarText}>{h.sbar.s}</Text>
          </View>
          <View style={s.sbarItem}>
            <Text style={s.sbarLabel}>B (Background):</Text>
            <Text style={s.sbarText}>{h.sbar.b}</Text>
          </View>
          <View style={s.sbarItem}>
            <Text style={s.sbarLabel}>A (Assessment):</Text>
            <Text style={s.sbarText}>{h.sbar.a}</Text>
          </View>
          <View style={s.sbarItem}>
            <Text style={s.sbarLabel}>R (Recommendation):</Text>
            <Text style={s.sbarText}>{h.sbar.r}</Text>
          </View>
          <Text style={s.nurseNote}>Handed over by: {h.nurse}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 14, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E2E8F0' },
  tabOn: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTextOn: { color: '#FFFFFF' },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  patient: { fontSize: 15, fontWeight: '700', color: C.text },
  codeBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  codeText: { fontSize: 10, fontWeight: '800', color: '#166534' },
  sbarItem: { marginBottom: 6 },
  sbarLabel: { fontSize: 12, fontWeight: '700', color: C.teal },
  sbarText: { fontSize: 13, color: C.text, lineHeight: 18 },
  nurseNote: { fontSize: 11, color: C.muted, marginTop: 6, fontStyle: 'italic' },
});
