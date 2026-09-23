import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

type Props = { onBack?: () => void };

const C = {
  primary: '#1E3A8A',
  teal: '#0D9488',
  bg: '#F0F9FF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  red: '#DC2626',
  amber: '#D97706',
};

const ALERTS = [
  { id: '1', title: 'Critical Troponin Elevation', desc: 'Troponin-I 0.84 ng/mL for Robert Chen (Bed 4B)', severity: 'CRITICAL', time: '11:18 AM' },
  { id: '2', title: 'NEWS2 Score Warning (Score 6)', desc: 'RR 24, HR 108 for Margaret Taylor (Bed 5A)', severity: 'ELEVATED', time: '10:45 AM' },
  { id: '3', title: 'Drug Interaction Flag', desc: 'Aspirin + Clopidogrel bleed risk review', severity: 'ROUTINE', time: '09:30 AM' },
];

export const ClinicalAlerts: React.FC<Props> = ({ onBack }) => {
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>Clinical Alerts</Text>
      <Text style={s.pageSub}>Real-time patient deterioration alerts & lab flags</Text>

      {ALERTS.map((a) => (
        <View key={a.id} style={[s.card, a.severity === 'CRITICAL' && s.critCard]}>
          <View style={s.top}>
            <Text style={s.title}>{a.title}</Text>
            <Text style={s.time}>{a.time}</Text>
          </View>
          <Text style={s.desc}>{a.desc}</Text>
          <View style={[s.severityBadge, a.severity === 'CRITICAL' ? s.critBadge : s.warnBadge]}>
            <Text style={s.severityText}>{a.severity}</Text>
          </View>
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
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: C.teal,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  critCard: { borderLeftColor: C.red },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '700', color: C.text },
  time: { fontSize: 11, color: C.muted },
  desc: { fontSize: 13, color: '#334155', lineHeight: 18, marginBottom: 8 },
  severityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  critBadge: { backgroundColor: '#FEE2E2' },
  warnBadge: { backgroundColor: '#FEF3C7' },
  severityText: { fontSize: 10, fontWeight: '800', color: C.text },
});
