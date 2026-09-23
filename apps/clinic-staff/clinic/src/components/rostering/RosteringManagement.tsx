import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { C, type PropsWithBack } from '../../theme';

const SHIFTS = [
  { role: 'Consultant', name: 'Dr. Julian Thorne', shift: '07:00–19:00', status: 'On duty', fatigue: 'Low' },
  { role: 'Registrar', name: 'Dr. Amaka Eze', shift: '07:00–19:00', status: 'On duty', fatigue: 'Low' },
  { role: 'RN', name: 'Ada Nwosu', shift: '07:00–19:00', status: 'On duty', fatigue: 'Moderate' },
  { role: 'RN', name: 'Kemi Bello', shift: '07:00–19:00', status: 'On duty', fatigue: 'Low' },
  { role: 'On-call', name: 'Dr. Yusuf Ibrahim', shift: '19:00–07:00', status: 'Tonight', fatigue: '—' },
];

export const RosteringManagement: React.FC<PropsWithBack> = ({ onBack }) => (
  <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
    {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}><Text style={s.back}>← Back</Text></TouchableOpacity>}
    <Text style={s.pageTitle}>Rostering & Shifts</Text>
    <Text style={s.pageSub}>Ward 4-West · Coverage & fatigue</Text>
    <View style={s.summary}>
      <View style={s.stat}><Text style={s.statN}>5</Text><Text style={s.statL}>On duty</Text></View>
      <View style={s.stat}><Text style={s.statN}>1</Text><Text style={s.statL}>On-call</Text></View>
      <View style={s.stat}><Text style={[s.statN, { color: C.warning }]}>1</Text><Text style={s.statL}>Fatigue flag</Text></View>
    </View>
    {SHIFTS.map((r, i) => (
      <View key={i} style={s.card}>
        <View style={s.top}>
          <Text style={s.role}>{r.role}</Text>
          <View style={[s.status, r.status === 'On duty' ? s.on : s.soon]}>
            <Text style={s.statusT}>{r.status}</Text>
          </View>
        </View>
        <Text style={s.name}>{r.name}</Text>
        <Text style={s.meta}>{r.shift} · Fatigue: {r.fatigue}</Text>
      </View>
    ))}
  </ScrollView>
);

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 14, marginTop: 2 },
  summary: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  statN: { fontSize: 22, fontWeight: '800', color: C.primary },
  statL: { fontSize: 11, color: C.muted, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  role: { fontSize: 11, fontWeight: '800', color: C.teal },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  on: { backgroundColor: C.successSoft },
  soon: { backgroundColor: C.primarySoft },
  statusT: { fontSize: 10, fontWeight: '800', color: C.text },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
});
