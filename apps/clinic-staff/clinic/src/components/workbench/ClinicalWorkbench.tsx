import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { C } from '../../theme';
import { PATIENTS, subscribe, startClinicRealtime, type Patient } from '../../services/clinicData';

export const ClinicalWorkbench: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);
  const [selected, setSelected] = useState<Patient | null>(null);

  useEffect(() => {
    startClinicRealtime();
    return subscribe(() => setPatients([...PATIENTS]));
  }, []);

  if (selected) {
    return (
      <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← All patients</Text>
        </TouchableOpacity>
        <View style={s.hero}>
          <Text style={s.bedTag}>BED {selected.bed}  ·  {selected.mrn}</Text>
          <Text style={s.name}>{selected.name}</Text>
          <Text style={s.meta}>{selected.age} · {selected.dx}</Text>
          <View style={s.badgeRow}>
            <View style={[s.newsPill, selected.high ? s.newsHigh : s.newsOk]}>
              <Text style={[s.newsLabel, selected.high ? s.newsHighT : s.newsOkT]}>NEWS2 {selected.news}</Text>
            </View>
            <View style={s.chip}><Text style={s.chipT}>{selected.codeStatus}</Text></View>
            <View style={s.chip}><Text style={s.chipT}>Allergy: {selected.allergies}</Text></View>
          </View>
        </View>

        <Text style={s.section}>Live Vitals</Text>
        <View style={s.vitalsGrid}>
          {selected.vitals.map((v, i) => (
            <View key={i} style={s.vitalCard}>
              <Text style={s.vitalVal}>{v}</Text>
              <Text style={s.vitalLbl}>{['BP', 'HR', 'SpO₂', 'Temp'][i]}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Problem List</Text>
        <View style={s.card}>
          <Text style={s.row}>• {selected.dx}</Text>
          <Text style={s.rowMuted}>• Hypertension (chronic)</Text>
          <Text style={s.rowMuted}>• Type 2 Diabetes Mellitus</Text>
        </View>

        <Text style={s.section}>Active Medications</Text>
        <View style={s.card}>
          <Text style={s.row}>Aspirin 75 mg PO daily</Text>
          <Text style={s.row}>Heparin infusion 1000 U/hr</Text>
          <Text style={s.rowMuted}>Metformin 500 mg PO BD</Text>
        </View>

        <Text style={s.section}>Recent Labs</Text>
        <View style={s.card}>
          <View style={s.labRow}>
            <Text style={s.labName}>Troponin-I</Text>
            <Text style={s.labCrit}>0.84 ng/mL ⚠</Text>
          </View>
          <View style={s.labRow}>
            <Text style={s.labName}>Creatinine</Text>
            <Text style={s.labVal}>1.1 mg/dL</Text>
          </View>
          <View style={s.labRow}>
            <Text style={s.labName}>Hb</Text>
            <Text style={s.labVal}>11.2 g/dL</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={s.pageTitle}>Patients</Text>
      <Text style={s.pageSub}>Ward 4-West · Live workbench</Text>
      {patients.map((p) => (
        <TouchableOpacity key={p.id} style={s.patientCard} onPress={() => setSelected(p)} activeOpacity={0.9}>
          <View style={s.patientTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.bedTag}>BED {p.bed}  ·  {p.mrn}</Text>
              <Text style={s.name}>{p.name} <Text style={s.age}>({p.age})</Text></Text>
              <Text style={s.dx}>{p.dx}</Text>
            </View>
            <View style={[s.newsPill, p.high ? s.newsHigh : s.newsOk]}>
              <Text style={[s.newsLabel, p.high ? s.newsHighT : s.newsOkT]}>NEWS2</Text>
              <Text style={[s.newsNum, p.high ? s.newsHighT : s.newsOkT]}>{p.news}</Text>
            </View>
          </View>
          <View style={s.vitalsRow}>
            {p.vitals.map((v, i) => (
              <View key={i} style={s.vitalChip}><Text style={s.vitalText}>{v}</Text></View>
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 16, marginTop: 2 },
  hero: { backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 16, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  bedTag: { fontSize: 11, fontWeight: '800', color: C.teal, letterSpacing: 0.3 },
  name: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 4 },
  age: { fontSize: 13, fontWeight: '500', color: C.muted },
  meta: { fontSize: 13, color: C.muted, marginTop: 4 },
  dx: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 17 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  newsPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 56 },
  newsHigh: { backgroundColor: C.dangerSoft },
  newsOk: { backgroundColor: C.successSoft },
  newsLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  newsNum: { fontSize: 18, fontWeight: '800', marginTop: 1 },
  newsHighT: { color: '#DC2626' },
  newsOkT: { color: C.success },
  chip: { backgroundColor: C.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  chipT: { fontSize: 11, fontWeight: '600', color: C.primary },
  section: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10, marginTop: 4 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  vitalCard: { width: '47%', backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  vitalVal: { fontSize: 18, fontWeight: '800', color: C.text },
  vitalLbl: { fontSize: 11, color: C.muted, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 14, elevation: 2 },
  row: { fontSize: 14, color: C.text, marginBottom: 6, fontWeight: '600' },
  rowMuted: { fontSize: 13, color: C.muted, marginBottom: 4 },
  labRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  labName: { fontSize: 13, color: C.muted },
  labVal: { fontSize: 13, fontWeight: '700', color: C.text },
  labCrit: { fontSize: 13, fontWeight: '800', color: C.danger },
  patientCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 3 },
  patientTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  vitalChip: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  vitalText: { fontSize: 11, fontWeight: '600', color: '#334155' },
});
