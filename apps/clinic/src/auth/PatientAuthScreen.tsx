import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import type { PatientSession } from './sessionTypes';
import { AKWA_IBOM_HOSPITALS } from '../components/auth/StaffAuthScreen';

interface Props {
  onSuccess: (session: PatientSession) => void;
  onBack: () => void;
}

export function PatientAuthScreen({ onSuccess, onBack }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hospitalIdx, setHospitalIdx] = useState(0);
  const [error, setError] = useState('');

  const hospital = AKWA_IBOM_HOSPITALS[hospitalIdx];

  const submit = () => {
    if (!name.trim()) {
      setError('Enter your full name');
      return;
    }
    const id = `PAT-${hospital.id.slice(-3)}-${Date.now().toString().slice(-6)}`;
    onSuccess({
      persona: 'patient',
      patientId: id,
      name: name.trim(),
      facility: hospital.name,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0F766E" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Patient sign-in</Text>
        <Text style={styles.sub}>Access your care tools only — not staff systems</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="As on your hospital card"
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="080…"
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.label}>Hospital</Text>
        <View style={styles.hospitalList}>
          {AKWA_IBOM_HOSPITALS.slice(0, 5).map((h, i) => (
            <TouchableOpacity
              key={h.id}
              style={[styles.hItem, hospitalIdx === i && styles.hItemOn]}
              onPress={() => setHospitalIdx(i)}
            >
              <Text style={[styles.hText, hospitalIdx === i && styles.hTextOn]}>{h.short}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.btn} onPress={submit}>
          <Text style={styles.btnText}>Enter patient app</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F766E' },
  header: { padding: 20, paddingTop: 12 },
  back: { color: '#99F6E4', fontWeight: '700', marginBottom: 12 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  sub: { color: '#CCFBF1', marginTop: 6, fontSize: 13 },
  body: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  hospitalList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  hItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hItemOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  hText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  hTextOn: { color: '#FFF' },
  error: { color: '#DC2626', marginTop: 10, fontWeight: '600' },
  btn: {
    marginTop: 24,
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
