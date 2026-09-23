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
};

const SHIFTS = [
  { id: '1', name: 'Dr. Adeyemi', role: 'Consultant Cardiologist', ward: 'Cardiology Ward / CCU', shift: '08:00 - 16:00', status: 'On Duty' },
  { id: '2', name: 'Dr. Okafor', role: 'Cardiology Registrar', ward: 'Cardiology Ward / CCU', shift: '08:00 - 20:00', status: 'On Duty' },
  { id: '3', name: 'Nurse K. Okon', role: 'Senior Charge Nurse', ward: 'Cardiology Bed 1-8', shift: '07:00 - 19:30', status: 'On Duty' },
  { id: '4', name: 'Dr. Bello', role: 'On-Call Surgeon', ward: 'Emergency Theatre OT-1', shift: 'On Call (Night)', status: 'On Call' },
];

export const RosteringManagement: React.FC<Props> = ({ onBack }) => {
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>Clinical Rostering</Text>
      <Text style={s.pageSub}>Shift management & on-call physician cover</Text>

      {SHIFTS.map((sft) => (
        <View key={sft.id} style={s.card}>
          <View style={s.top}>
            <Text style={s.name}>{sft.name}</Text>
            <View style={[s.badge, sft.status === 'On Duty' ? s.onDuty : s.onCall]}>
              <Text style={s.badgeText}>{sft.status}</Text>
            </View>
          </View>
          <Text style={s.role}>{sft.role}</Text>
          <Text style={s.meta}>{sft.ward} · {sft.shift}</Text>
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
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  onDuty: { backgroundColor: '#DCFCE7' },
  onCall: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 10, fontWeight: '800', color: C.text },
  role: { fontSize: 13, color: C.teal, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
});
