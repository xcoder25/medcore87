import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { C, type PropsWithBack } from '../../theme';

const METRICS = [
  { label: 'Patients assigned', value: '8', sub: 'Ward 4-West' },
  { label: 'Tasks completed', value: '12', sub: 'Today' },
  { label: 'Notes signed', value: '6', sub: 'SOAP / progress' },
  { label: 'Orders placed', value: '9', sub: 'Lab + Rx' },
  { label: 'Meds administered', value: '14', sub: 'eMAR' },
  { label: 'Avg response', value: '4m', sub: 'STAT alerts' },
];

export const ActivityOverview: React.FC<PropsWithBack> = ({ onBack }) => (
  <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
    {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}><Text style={s.back}>← Back</Text></TouchableOpacity>}
    <Text style={s.pageTitle}>Activity Overview</Text>
    <Text style={s.pageSub}>Caseload & documentation metrics</Text>
    <View style={s.grid}>
      {METRICS.map((m, i) => (
        <View key={i} style={s.metric}>
          <Text style={s.value}>{m.value}</Text>
          <Text style={s.label}>{m.label}</Text>
          <Text style={s.sub}>{m.sub}</Text>
        </View>
      ))}
    </View>
    <View style={s.card}>
      <Text style={s.cardTitle}>Documentation compliance</Text>
      <View style={s.barBg}><View style={[s.barFill, { width: '88%' }]} /></View>
      <Text style={s.barLbl}>88% notes signed within shift</Text>
    </View>
  </ScrollView>
);

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 16, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metric: { width: '47%', backgroundColor: C.card, borderRadius: 16, padding: 16, elevation: 2 },
  value: { fontSize: 26, fontWeight: '800', color: C.primary },
  label: { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 6 },
  sub: { fontSize: 11, color: C.muted, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, elevation: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  barBg: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: C.teal, borderRadius: 6 },
  barLbl: { fontSize: 12, color: C.muted, marginTop: 8 },
});
