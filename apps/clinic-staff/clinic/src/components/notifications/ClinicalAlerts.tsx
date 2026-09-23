import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { C, type PropsWithBack } from '../../theme';

const ALERTS = [
  { id: '1', level: 'critical', title: 'Troponin-I Critical', detail: 'Robert Chen · Bed 4B · 0.84 ng/mL', time: '2 min ago' },
  { id: '2', level: 'urgent', title: 'NEWS2 Rising', detail: 'James Okafor · Bed 7A · Score 3 → review', time: '18 min ago' },
  { id: '3', level: 'info', title: 'Lab resulted', detail: 'CXR for James Okafor ready for review', time: '32 min ago' },
  { id: '4', level: 'urgent', title: 'Med overdue', detail: 'Paracetamol 1 g IV · Bed 7A · due 11:30', time: '45 min ago' },
];

export const ClinicalAlerts: React.FC<PropsWithBack> = ({ onBack }) => (
  <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
    {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}><Text style={s.back}>← Back</Text></TouchableOpacity>}
    <Text style={s.pageTitle}>Clinical Alerts</Text>
    <Text style={s.pageSub}>Panic values · STAT · Sepsis triggers</Text>
    {ALERTS.map((a) => (
      <View key={a.id} style={[s.card, a.level === 'critical' && s.crit, a.level === 'urgent' && s.urg]}>
        <View style={s.top}>
          <View style={[s.level, a.level === 'critical' ? s.levelCrit : a.level === 'urgent' ? s.levelUrg : s.levelInfo]}>
            <Text style={s.levelT}>{a.level.toUpperCase()}</Text>
          </View>
          <Text style={s.time}>{a.time}</Text>
        </View>
        <Text style={s.title}>{a.title}</Text>
        <Text style={s.detail}>{a.detail}</Text>
      </View>
    ))}
  </ScrollView>
);

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 16, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  crit: { borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: C.dangerSoft },
  urg: { borderWidth: 1, borderColor: '#FDE68A' },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  level: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  levelCrit: { backgroundColor: '#FEE2E2' },
  levelUrg: { backgroundColor: C.warningSoft },
  levelInfo: { backgroundColor: C.primarySoft },
  levelT: { fontSize: 10, fontWeight: '800', color: C.text },
  time: { fontSize: 12, color: C.muted },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  detail: { fontSize: 13, color: C.muted, marginTop: 4 },
});
