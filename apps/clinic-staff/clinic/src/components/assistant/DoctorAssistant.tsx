import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { C, type PropsWithBack } from '../../theme';

const SUGGESTIONS = [
  { id: '1', type: 'SOAP', title: 'Draft SOAP — Chen 4B', preview: 'S: Post-PCI Day 1, mild chest discomfort…' },
  { id: '2', type: 'ICD-10', title: 'Suggested codes', preview: 'I21.4 NSTEMI · I25.10 CAD · Z95.5 Presence of coronary angioplasty implant' },
  { id: '3', type: 'Discharge', title: 'Discharge summary draft', preview: 'Margaret Taylor — CHF, planned home with TTO…' },
];

export const DoctorAssistant: React.FC<PropsWithBack> = ({ onBack }) => {
  const [recording, setRecording] = useState(false);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <Text style={s.pageTitle}>Doctor Assistant</Text>
      <Text style={s.pageSub}>M87 AI · SOAP · ICD-10 · Discharge drafts</Text>

      <View style={s.aiCard}>
        <View style={s.aiHead}>
          <Text style={s.aiTitle}>Ambient recording</Text>
          <View style={[s.live, recording && s.liveOn]}>
            <Text style={[s.liveT, recording && s.liveTOn]}>{recording ? '● LIVE' : 'Ready'}</Text>
          </View>
        </View>
        <Text style={s.aiDesc}>
          {recording
            ? 'Listening & drafting structured SOAP notes in real time…'
            : 'Tap to start ambient recording during bedside rounds.'}
        </Text>
        <TouchableOpacity
          style={[s.aiBtn, recording && s.aiBtnOn]}
          onPress={() => setRecording(!recording)}
          activeOpacity={0.85}
        >
          <Text style={s.aiBtnT}>{recording ? 'Stop & Generate SOAP' : 'Start Ambient Round'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.section}>AI suggestions</Text>
      {SUGGESTIONS.map((g) => (
        <View key={g.id} style={s.card}>
          <View style={s.typeBadge}><Text style={s.typeT}>{g.type}</Text></View>
          <Text style={s.title}>{g.title}</Text>
          <Text style={s.preview}>{g.preview}</Text>
          <TouchableOpacity style={s.useBtn}><Text style={s.useT}>Use draft</Text></TouchableOpacity>
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
  aiCard: { backgroundColor: C.purpleSoft, borderRadius: 18, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#E9D5FF' },
  aiHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  aiTitle: { fontSize: 15, fontWeight: '700', color: '#581C87' },
  live: { backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveOn: { backgroundColor: '#FEE2E2' },
  liveT: { fontSize: 11, fontWeight: '800', color: '#7E22CE' },
  liveTOn: { color: '#DC2626' },
  aiDesc: { fontSize: 13, color: '#6B21A8', lineHeight: 19, marginBottom: 14 },
  aiBtn: { backgroundColor: C.purple, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  aiBtnOn: { backgroundColor: C.danger },
  aiBtnT: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: C.purpleSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  typeT: { fontSize: 10, fontWeight: '800', color: C.purple },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  preview: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 19 },
  useBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: C.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  useT: { fontSize: 12, fontWeight: '700', color: C.primary },
});
