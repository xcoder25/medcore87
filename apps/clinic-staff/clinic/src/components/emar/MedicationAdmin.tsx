import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { C, type PropsWithBack } from '../../theme';
import { MEDS, subscribe, markMedGiven, type MedDose } from '../../services/clinicData';

export const MedicationAdmin: React.FC<PropsWithBack> = ({ onBack }) => {
  const [meds, setMeds] = useState<MedDose[]>(MEDS);
  const [filter, setFilter] = useState<'due' | 'all' | 'given'>('due');

  useEffect(() => subscribe(() => setMeds([...MEDS])), []);

  const list = meds.filter((m) =>
    filter === 'due' ? m.status === 'due' || m.status === 'overdue'
      : filter === 'given' ? m.status === 'given' : true
  );

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <Text style={s.pageTitle}>eMAR · Medication Admin</Text>
      <Text style={s.pageSub}>AKS-EML aligned · Record administration</Text>

      <View style={s.filters}>
        {(['due', 'all', 'given'] as const).map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterOn]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextOn]}>
              {f === 'due' ? 'Due / Overdue' : f === 'given' ? 'Given' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {list.map((m) => (
        <View key={m.id} style={[s.card, m.status === 'overdue' && s.cardOverdue]}>
          <View style={s.top}>
            <View style={[
              s.status,
              m.status === 'overdue' ? s.overdue : m.status === 'due' ? s.due : s.given,
            ]}>
              <Text style={s.statusText}>{m.status.toUpperCase()}</Text>
            </View>
            <Text style={s.dueTime}>{m.due}</Text>
          </View>
          <Text style={s.drug}>{m.drug}</Text>
          <Text style={s.meta}>{m.patient} · Bed {m.bed} · {m.route}</Text>
          <View style={s.badgeRow}>
            {m.eml && <View style={s.emlBadge}><Text style={s.emlT}>AKS-EML</Text></View>}
            {m.aware && <View style={s.awareBadge}><Text style={s.awareT}>AWaRe {m.aware}</Text></View>}
          </View>
          {m.status !== 'given' ? (
            <TouchableOpacity style={s.giveBtn} onPress={() => markMedGiven(m.id)} activeOpacity={0.85}>
              <Text style={s.giveText}>Mark as Given</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.givenAt}>✓ Given at {m.givenAt}</Text>
          )}
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
  filters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterOn: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: C.muted },
  filterTextOn: { color: '#FFF' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  cardOverdue: { borderWidth: 1.5, borderColor: '#FECACA' },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  overdue: { backgroundColor: C.dangerSoft },
  due: { backgroundColor: C.warningSoft },
  given: { backgroundColor: C.successSoft },
  statusText: { fontSize: 10, fontWeight: '800', color: C.text },
  dueTime: { fontSize: 12, color: C.muted, fontWeight: '600' },
  drug: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  emlBadge: { backgroundColor: C.tealSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  emlT: { fontSize: 10, fontWeight: '800', color: C.teal },
  awareBadge: { backgroundColor: C.orangeSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  awareT: { fontSize: 10, fontWeight: '800', color: C.orange },
  giveBtn: { marginTop: 12, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  giveText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  givenAt: { marginTop: 10, fontSize: 13, color: C.success, fontWeight: '700' },
});
