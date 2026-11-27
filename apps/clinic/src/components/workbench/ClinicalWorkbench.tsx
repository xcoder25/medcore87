import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PATIENTS, type Patient } from '../../services/clinicData';
import type { StaffSession } from '../auth/StaffAuthScreen';
import { GlowButton, LiquidGlassCard } from '../ui/LiquidGlass';
import { MedIcon } from '../ui/PremiumIcons';
import { QrMatrix } from '../ui/QrMatrix';
import { C } from '../../theme';

interface ClinicalWorkbenchProps {
  session?: StaffSession;
  onOpenAiScribe?: () => void;
}

export const ClinicalWorkbench: React.FC<ClinicalWorkbenchProps> = ({ session, onOpenAiScribe }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(PATIENTS[0]?.id || '');
  const [noteInput, setNoteInput] = useState('');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PATIENTS;
    return PATIENTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.bed || '').toLowerCase().includes(q) ||
        (p.dx || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [query]);

  const activePatient: Patient | undefined =
    PATIENTS.find((p) => p.id === selectedId) || filtered[0] || PATIENTS[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 112 }}
      showsVerticalScrollIndicator={false}
    >
      <LiquidGlassCard glowColor={C.glowCyan} intensity="strong" style={{ marginBottom: 12 }}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>360° CLINICAL WORKBENCH</Text>
            <Text style={styles.title}>Inpatient &amp; OPD Chart View</Text>
          </View>
          <MedIcon name="stethoscope" size={20} color="#FFFFFF" glowColor={C.glowCyan} />
        </View>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search patient name, bed, diagnosis or SHID…"
          placeholderTextColor="#64748B"
        />
      </LiquidGlassCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {filtered.map((p) => {
          const active = activePatient?.id === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => {
                setSelectedId(p.id);
                setSavedToast(null);
              }}
              style={[styles.patientPill, active && styles.patientPillActive]}
            >
              <Text style={[styles.pillBed, active && { color: '#7DD3FC' }]}>
                {p.bed || p.ward || 'WARD'}
              </Text>
              <Text style={[styles.pillName, active && { color: '#FFFFFF' }]}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activePatient ? (
        <LiquidGlassCard glowColor={C.glowBlue} style={{ marginBottom: 12 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bedTag}>{activePatient.bed || activePatient.ward || 'General Ward'}</Text>
              <Text style={styles.patName}>{activePatient.name}</Text>
              <Text style={styles.dx}>{activePatient.dx || 'Active hospital care'}</Text>
            </View>
            <QrMatrix
              value={`MEDCORE:SHID:${activePatient.id}:${session?.facilityId || 'IGH-EKT'}`}
              size={64}
            />
          </View>

          <View style={styles.vitalsRow}>
            <View style={styles.vitalTile}>
              <Text style={styles.vitalLabel}>MRN / NEWS</Text>
              <Text style={styles.vitalVal}>{activePatient.mrn || activePatient.id} · {activePatient.news}</Text>
            </View>
            <View style={styles.vitalTile}>
              <Text style={styles.vitalLabel}>PRIMARY VITAL</Text>
              <Text style={styles.vitalVal}>{activePatient.vitals?.[0] || 'BP 122/78'}</Text>
            </View>
            <View style={styles.vitalTile}>
              <Text style={styles.vitalLabel}>OXYGEN / HR</Text>
              <Text style={[styles.vitalVal, { color: '#6EE7B7' }]}>
                {activePatient.vitals?.[1] || 'SpO2 98%'}
              </Text>
            </View>
          </View>

          <Text style={styles.noteLabel}>QUICK BEDSIDE ADDENDUM</Text>
          <TextInput
            style={styles.noteInput}
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="Record assessment or bedside observation…"
            placeholderTextColor="#64748B"
            multiline
          />
          {savedToast && <Text style={styles.toast}>{savedToast}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <GlowButton
                label="Save Addendum"
                icon="check"
                variant="primary"
                onPress={() => {
                  if (!noteInput.trim()) return;
                  setSavedToast(`Addendum logged for ${activePatient.name}.`);
                  setNoteInput('');
                }}
              />
            </View>
            {onOpenAiScribe && (
              <View style={{ flex: 1 }}>
                <GlowButton
                  label="AI SOAP"
                  icon="sparkles"
                  variant="violet"
                  onPress={onOpenAiScribe}
                />
              </View>
            )}
          </View>
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard glowColor={C.glowAmber}>
          <Text style={styles.dx}>No matching patients loaded for this shift.</Text>
        </LiquidGlassCard>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eyebrow: { color: C.glowCyan, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', marginTop: 2 },
  searchInput: {
    marginTop: 12,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
  },
  patientPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginRight: 8,
  },
  patientPillActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.24)',
    borderColor: C.glowCyan,
  },
  pillBed: { color: C.muted, fontSize: 10, fontWeight: '800' },
  pillName: { color: '#CBD5E1', fontSize: 13, fontWeight: '700', marginTop: 2 },
  bedTag: { color: C.glowCyan, fontSize: 11, fontWeight: '800' },
  patName: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 2 },
  dx: { color: C.muted, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  vitalsRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  vitalTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 10,
  },
  vitalLabel: { color: C.muted, fontSize: 10, fontWeight: '800' },
  vitalVal: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', marginTop: 3 },
  noteLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
  noteInput: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    padding: 10,
    color: '#F8FAFC',
    minHeight: 68,
    marginBottom: 10,
    fontSize: 13,
  },
  toast: { color: '#6EE7B7', fontSize: 12, fontWeight: '700', marginBottom: 8 },
});
