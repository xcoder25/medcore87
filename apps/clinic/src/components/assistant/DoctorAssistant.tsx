import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';

type Props = { onBack?: () => void };

const C = {
  primary: '#1E3A8A',
  teal: '#0D9488',
  bg: '#F0F9FF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  purple: '#7C3AED',
};

export const DoctorAssistant: React.FC<Props> = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = () => {
    if (!query.trim()) return;
    setAnswer(
      `M87 AI Insight for "${query}": Based on current clinical guidelines, dual antiplatelet therapy with Aspirin and Clopidogrel is indicated post-PCI for 12 months. Monitor renal panel and CBC for any signs of occult bleeding.`
    );
  };

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>M87 Doctor Assistant</Text>
      <Text style={s.pageSub}>Clinical decision support & drug interaction AI</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>Ask Clinical Query</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Dosing for IV Furosemide in acute HF..."
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity style={s.askBtn} onPress={ask}>
          <Text style={s.askText}>Query M87 AI</Text>
        </TouchableOpacity>
      </View>

      {answer && (
        <View style={s.answerCard}>
          <Text style={s.answerTitle}>M87 Recommendation</Text>
          <Text style={s.answerText}>{answer}</Text>
        </View>
      )}
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
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    marginBottom: 10,
  },
  askBtn: { backgroundColor: C.purple, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  askText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  answerCard: {
    backgroundColor: '#F3E8FF',
    borderColor: '#D8B4FE',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  answerTitle: { fontSize: 13, fontWeight: '700', color: C.purple, marginBottom: 6 },
  answerText: { fontSize: 13, color: '#3B0764', lineHeight: 18 },
});
