import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlowButton, LiquidGlassCard } from '../ui/LiquidGlass';
import { MedIcon } from '../ui/PremiumIcons';
import { C } from '../../theme';

interface DiffDiagnosis {
  name: string;
  icd11: string;
  likelihood: string;
  rationale: string;
  workup: string[];
}

export const DifferentialDxPanel: React.FC<{
  symptoms?: string[];
  age?: number;
  sex?: string;
}> = ({ symptoms = [] }) => {
  const [symptomText, setSymptomText] = useState(symptoms.join(', '));
  const [diagnoses, setDiagnoses] = useState<DiffDiagnosis[]>([]);

  const evaluate = () => {
    const lower = symptomText.toLowerCase();
    const list: DiffDiagnosis[] = [];
    if (/fever|chills|rigor|malaria|headache/i.test(lower)) {
      list.push({
        name: 'Acute Uncomplicated / Severe Malaria',
        icd11: '1F40',
        likelihood: 'High',
        rationale: 'Acute cyclical fever, rigors, and headache in endemic Akwa Ibom cohort.',
        workup: ['Malaria RDT + Film', 'Full Blood Count', 'Random Blood Glucose'],
      });
    }
    if (/bp|headache|vision|oedema|pregnan/i.test(lower)) {
      list.push({
        name: 'Hypertensive Crisis / Pre-Eclampsia Screen',
        icd11: 'BA00',
        likelihood: 'Moderate',
        rationale: 'Elevated BP signs warrant immediate urine protein and maternal/organ screen.',
        workup: ['Urinalysis Protein', 'Serum Creatinine + LFT', 'Repeat Q15M BP'],
      });
    }
    if (list.length === 0) {
      list.push({
        name: 'Acute Febrile / Viral Syndrome',
        icd11: '1D90',
        likelihood: 'Moderate',
        rationale: 'General differential based on bedside history pending point-of-care diagnostics.',
        workup: ['Full Blood Count', 'Baseline Metabolic Panel'],
      });
    }
    setDiagnoses(list);
  };

  return (
    <LiquidGlassCard glowColor={C.glowCyan}>
      <View style={styles.header}>
        <MedIcon name="sparkles" size={18} color="#FFFFFF" glowColor={C.glowCyan} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Differential Diagnosis CDS</Text>
          <Text style={styles.sub}>ICD-11 Ranked Possibilities &amp; Recommended Workup</Text>
        </View>
      </View>

      <TextInput
        style={styles.input}
        value={symptomText}
        onChangeText={setSymptomText}
        placeholder="Enter presenting symptoms (e.g. high fever, rigors, headache)…"
        placeholderTextColor="#64748B"
      />
      <GlowButton label="Rank Differential Diagnoses" icon="activity" variant="primary" onPress={evaluate} />

      {diagnoses.map((d, idx) => (
        <View key={idx} style={styles.dxCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.dxName}>{d.name}</Text>
            <Text style={styles.badge}>{d.likelihood} · {d.icd11}</Text>
          </View>
          <Text style={styles.rationale}>{d.rationale}</Text>
          <Text style={styles.workup}>Workup: {d.workup.join(' · ')}</Text>
        </View>
      ))}
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 11.5 },
  input: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 10,
  },
  dxCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  dxName: { color: '#F8FAFC', fontSize: 13.5, fontWeight: '800', flex: 1 },
  badge: { color: '#7DD3FC', fontSize: 10.5, fontWeight: '900' },
  rationale: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
  workup: { color: '#6EE7B7', fontSize: 11.5, marginTop: 4, fontWeight: '700' },
});

export default DifferentialDxPanel;
