import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { C, type PropsWithBack } from '../../theme';

const HANDOVERS = [
  { id: '1', from: 'Night shift · RN Ada', to: 'Day shift · Dr Thorne', patient: 'Robert Chen · 4B', time: '06:55', sbar: 'S: Post-PCI Day 1, NEWS2 5\nB: NSTEMI, on heparin\nA: Stable, troponin critical pending review\nR: Review ECG + consider ICU if deteriorates' },
  { id: '2', from: 'Day · RN Kemi', to: 'Evening · RN Tunde', patient: 'Margaret Taylor · 5A', time: '18:40', sbar: 'S: Planned discharge today\nB: CHF NYHA III\nA: Checklist 3/6 complete\nR: Book follow-up, arrange transport' },
];

export const HandoverNotes: React.FC<PropsWithBack> = ({ onBack }) => {
  const [showNew, setShowNew] = useState(false);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <View style={s.head}>
        <View>
          <Text style={s.pageTitle}>Handover (SBAR)</Text>
          <Text style={s.pageSub}>Structured shift handovers</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(!showNew)}>
          <Text style={s.newBtnT}>{showNew ? 'Cancel' : '+ SBAR'}</Text>
        </TouchableOpacity>
      </View>
      {showNew && (
        <View style={s.newCard}>
          <TextInput style={s.input} placeholder="Patient / Bed" placeholderTextColor="#94A3B8" />
          <TextInput style={[s.input, { height: 120, textAlignVertical: 'top' }]} placeholder="S: Situation&#10;B: Background&#10;A: Assessment&#10;R: Recommendation" placeholderTextColor="#94A3B8" multiline />
          <TouchableOpacity style={s.submit} onPress={() => setShowNew(false)}><Text style={s.submitT}>Save Handover</Text></TouchableOpacity>
        </View>
      )}
      {HANDOVERS.map((h) => (
        <View key={h.id} style={s.card}>
          <View style={s.top}>
            <Text style={s.time}>{h.time}</Text>
            <View style={s.badge}><Text style={s.badgeT}>SBAR</Text></View>
          </View>
          <Text style={s.patient}>{h.patient}</Text>
          <Text style={s.meta}>{h.from} → {h.to}</Text>
          <Text style={s.sbar}>{h.sbar}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  newBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnT: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  newCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10, color: C.text },
  submit: { backgroundColor: C.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitT: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  time: { fontSize: 12, color: C.muted, fontWeight: '600' },
  badge: { backgroundColor: C.tealSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeT: { fontSize: 10, fontWeight: '800', color: C.teal },
  patient: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 2 },
  sbar: { fontSize: 13, color: '#334155', marginTop: 10, lineHeight: 20 },
});
