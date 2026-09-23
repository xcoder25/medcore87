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
  blue: '#2563EB',
};

export const ActivityOverview: React.FC<Props> = ({ onBack }) => {
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>Clinical Activity Overview</Text>
      <Text style={s.pageSub}>Ward summary & daily task execution</Text>

      <View style={s.statsGrid}>
        <View style={s.statBox}>
          <Text style={s.statNum}>18</Text>
          <Text style={s.statLabel}>Admitted Patients</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>4</Text>
          <Text style={s.statLabel}>Pending Discharges</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>3</Text>
          <Text style={s.statLabel}>OT Theatre Cases</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>12</Text>
          <Text style={s.statLabel}>Meds Due Now</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Unit Priorities</Text>
        <Text style={s.bullet}>• Bed 4B troponin repeat due at 12:00 PM</Text>
        <Text style={s.bullet}>• Bed 5A discharge paperwork & TTO pending pharmacist review</Text>
        <Text style={s.bullet}>• Code Blue team drill scheduled for 14:00 PM</Text>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 14, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 4 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 8 },
  bullet: { fontSize: 13, color: '#334155', lineHeight: 20, marginBottom: 4 },
});
