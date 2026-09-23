import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';

type Props = { onBack?: () => void };

const C = {
  primary: '#1E3A8A', teal: '#0D9488', bg: '#F0F9FF', card: '#FFF',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
  success: '#059669', successSoft: '#ECFDF5',
  danger: '#EF4444', dangerSoft: '#FEF2F2',
  purple: '#7C3AED', purpleSoft: '#FAF5FF',
};

const PHARMACIES = [
  { id: 'PHARM-001', name: 'Ibom Specialist Hospital Pharmacy' },
  { id: 'PHARM-002', name: 'University of Uyo Teaching Hospital Pharmacy' },
  { id: 'PHARM-003', name: "St Luke's Hospital Pharmacy, Anua" },
  { id: 'PHARM-004', name: 'Eket General Hospital Pharmacy' },
  { id: 'PHARM-005', name: 'Sacred Heart Hospital Pharmacy, Adiasim' },
  { id: 'PHARM-006', name: 'General Hospital Ikot Ekpene Pharmacy' },
  { id: 'PHARM-007', name: 'Cottage Hospital Oron Pharmacy' },
  { id: 'PHARM-008', name: 'Community Pharmacy (Walk-in)' },
];

const ROUTES = ['ORAL', 'IV', 'IM', 'TOPICAL', 'INHALED', 'SUBLINGUAL'];
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed (PRN)', 'Stat (once)'];
const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '21 days', '30 days', '60 days', '90 days'];

interface DrugEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: string;
  instructions: string;
}

const emptyDrug = (): DrugEntry => ({
  id: `DRUG-${Date.now().toString(36).toUpperCase()}`,
  name: '',
  dosage: '',
  frequency: 'Once daily',
  duration: '7 days',
  route: 'ORAL',
  quantity: '1',
  instructions: '',
});

const MOCK_PATIENTS = [
  { id: 'PAT-849201', name: 'Amina Bello', mrn: 'MRN-78401' },
  { id: 'PAT-620194', name: 'Emeka Okafor', mrn: 'MRN-99201' },
];

export const PrescriptionWriter: React.FC<Props> = ({ onBack }) => {
  const [patientId, setPatientId] = useState('PAT-849201');
  const [patientName, setPatientName] = useState('Amina Bello');
  const [diagnosis, setDiagnosis] = useState('');
  const [drugs, setDrugs] = useState<DrugEntry[]>([emptyDrug()]);
  const [routedPharmacy, setRoutedPharmacy] = useState<{ id: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [successRx, setSuccessRx] = useState<string | null>(null);
  const [showPharmPicker, setShowPharmPicker] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  const updateDrug = (idx: number, field: keyof DrugEntry, value: string) => {
    setDrugs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const removeDrug = (idx: number) => {
    if (drugs.length === 1) return;
    setDrugs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      Alert.alert('Missing Info', 'Please enter a diagnosis.');
      return;
    }
    const invalid = drugs.find((d) => !d.name.trim() || !d.dosage.trim());
    if (invalid) {
      Alert.alert('Missing Info', 'Each drug must have a name and dosage.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('http://localhost:4000/api/v1/clinical/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          doctorId: 'DOC-101',
          doctorName: 'Dr. Julian Thorne',
          facilityId: 'FAC-001',
          diagnosis,
          drugs: drugs.map((d) => ({
            id: d.id,
            name: d.name,
            dosage: d.dosage,
            frequency: d.frequency,
            duration: d.duration,
            route: d.route,
            quantity: parseInt(d.quantity) || 1,
            instructions: d.instructions,
          })),
          routedToPharmacyId: routedPharmacy?.id,
          routedToPharmacyName: routedPharmacy?.name,
          notes,
        }),
      });
      const json = await resp.json();
      if (json.success) {
        setSuccessRx(json.data.id);
      } else {
        Alert.alert('Error', json.error || 'Failed to submit prescription');
      }
    } catch (e) {
      Alert.alert('Network Error', 'Could not reach the MedCore server.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDiagnosis('');
    setDrugs([emptyDrug()]);
    setRoutedPharmacy(null);
    setNotes('');
    setSuccessRx(null);
  };

  // ─── Success Screen ────────────────────────────────────────────────────────
  if (successRx) {
    return (
      <View style={s.successWrap}>
        <View style={s.successCard}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>✅</Text>
          <Text style={s.successTitle}>Prescription Issued</Text>
          <View style={s.rxIdBadge}>
            <Text style={s.rxIdLabel}>Rx ID</Text>
            <Text style={s.rxIdText}>{successRx}</Text>
          </View>
          <Text style={s.successSub}>
            {routedPharmacy
              ? `Sent directly to:\n${routedPharmacy.name}\n\nPatient has been referred — pharmacy can now see this prescription.`
              : 'Patient can present their Patient ID or this Rx ID at any pharmacy to collect medication.'}
          </Text>
          <TouchableOpacity style={s.newRxBtn} onPress={handleReset}>
            <Text style={s.newRxText}>Write Another Prescription</Text>
          </TouchableOpacity>
          {onBack && (
            <TouchableOpacity style={s.backLinkBtn} onPress={onBack}>
              <Text style={s.backLinkText}>Back to Ward</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={s.back}>Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>e-Prescription Writer</Text>
      <Text style={s.pageSub}>Digital Rx linked to Patient ID</Text>

      {/* Patient */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>PATIENT</Text>
        <TouchableOpacity style={s.selectorBtn} onPress={() => setShowPatientPicker(true)}>
          <View style={{ flex: 1 }}>
            <Text style={s.selectorMain}>{patientName}</Text>
            <Text style={s.selectorSub}>{patientId}</Text>
          </View>
          <Text style={s.chevron}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Diagnosis */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>DIAGNOSIS / INDICATION</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Hypertension, UTI, Post-CABG..."
          placeholderTextColor={C.muted}
          value={diagnosis}
          onChangeText={setDiagnosis}
          multiline
        />
      </View>

      {/* Drugs */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>PRESCRIBED DRUGS ({drugs.length})</Text>
        {drugs.map((drug, idx) => (
          <View key={drug.id} style={s.drugCard}>
            <View style={s.drugCardHeader}>
              <View style={s.drugNumBadge}>
                <Text style={s.drugNum}>Rx {idx + 1}</Text>
              </View>
              {drugs.length > 1 && (
                <TouchableOpacity onPress={() => removeDrug(idx)}>
                  <Text style={s.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={[s.input, s.drugNameInput]}
              placeholder="Drug name (e.g. Amlodipine)"
              placeholderTextColor={C.muted}
              value={drug.name}
              onChangeText={(v) => updateDrug(idx, 'name', v)}
            />
            <TextInput
              style={s.input}
              placeholder="Dosage (e.g. 5mg)"
              placeholderTextColor={C.muted}
              value={drug.dosage}
              onChangeText={(v) => updateDrug(idx, 'dosage', v)}
            />

            {/* Route chips */}
            <Text style={s.microLabel}>ROUTE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {ROUTES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.chip, drug.route === r && s.chipOn]}
                    onPress={() => updateDrug(idx, 'route', r)}
                  >
                    <Text style={[s.chipText, drug.route === r && s.chipTextOn]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Frequency chips */}
            <Text style={s.microLabel}>FREQUENCY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {FREQUENCIES.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, drug.frequency === f && s.chipOn]}
                    onPress={() => updateDrug(idx, 'frequency', f)}
                  >
                    <Text style={[s.chipText, drug.frequency === f && s.chipTextOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Duration chips */}
            <Text style={s.microLabel}>DURATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.chip, drug.duration === d && s.chipOn]}
                    onPress={() => updateDrug(idx, 'duration', d)}
                  >
                    <Text style={[s.chipText, drug.duration === d && s.chipTextOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={s.input}
              placeholder="Quantity (e.g. 30)"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              value={drug.quantity}
              onChangeText={(v) => updateDrug(idx, 'quantity', v)}
            />
            <TextInput
              style={s.input}
              placeholder="Patient instructions (e.g. Take with food)"
              placeholderTextColor={C.muted}
              value={drug.instructions}
              onChangeText={(v) => updateDrug(idx, 'instructions', v)}
            />
          </View>
        ))}

        <TouchableOpacity style={s.addDrugBtn} onPress={() => setDrugs((prev) => [...prev, emptyDrug()])}>
          <Text style={s.addDrugText}>+ Add Another Drug</Text>
        </TouchableOpacity>
      </View>

      {/* Pharmacy routing */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>SEND TO PHARMACY (OPTIONAL)</Text>
        <TouchableOpacity style={[s.selectorBtn, routedPharmacy && s.selectorActive]} onPress={() => setShowPharmPicker(true)}>
          <View style={{ flex: 1 }}>
            <Text style={[s.selectorMain, routedPharmacy ? { color: C.teal } : {}]}>
              {routedPharmacy ? routedPharmacy.name : 'Select Pharmacy (optional)'}
            </Text>
            {routedPharmacy && <Text style={s.selectorSub}>{routedPharmacy.id}</Text>}
          </View>
          <Text style={s.chevron}>{'>'}</Text>
        </TouchableOpacity>
        {routedPharmacy && (
          <TouchableOpacity onPress={() => setRoutedPharmacy(null)} style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 12, color: C.danger, fontWeight: '600' }}>Remove — patient walk-in instead</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notes */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>CLINICAL NOTES (OPTIONAL)</Text>
        <TextInput
          style={[s.input, { minHeight: 60 }]}
          placeholder="e.g. Review in 4 weeks, monitor renal function..."
          placeholderTextColor={C.muted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[s.submitBtn, loading && s.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={s.submitText}>Issue Prescription</Text>
        )}
      </TouchableOpacity>

      {/* Patient picker modal */}
      <Modal visible={showPatientPicker} transparent animationType="slide" onRequestClose={() => setShowPatientPicker(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Select Patient</Text>
            {MOCK_PATIENTS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={s.modalItem}
                onPress={() => { setPatientId(p.id); setPatientName(p.name); setShowPatientPicker(false); }}
              >
                <Text style={s.modalItemMain}>{p.name}</Text>
                <Text style={s.modalItemSub}>{p.id} · {p.mrn}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowPatientPicker(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pharmacy picker modal */}
      <Modal visible={showPharmPicker} transparent animationType="slide" onRequestClose={() => setShowPharmPicker(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Select Pharmacy</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PHARMACIES.map((ph) => (
                <TouchableOpacity
                  key={ph.id}
                  style={[s.modalItem, routedPharmacy?.id === ph.id && s.modalItemActive]}
                  onPress={() => { setRoutedPharmacy(ph); setShowPharmPicker(false); }}
                >
                  <Text style={[s.modalItemMain, routedPharmacy?.id === ph.id ? { color: C.teal } : {}]}>
                    {ph.name}
                  </Text>
                  <Text style={s.modalItemSub}>{ph.id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowPharmPicker(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600', marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 0.8,
    marginBottom: 8, textTransform: 'uppercase',
  },
  microLabel: {
    fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 0.5,
    marginBottom: 5, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  selectorBtn: {
    backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  selectorActive: { borderColor: C.teal, backgroundColor: '#F0FDFA' },
  selectorMain: { fontSize: 15, fontWeight: '700', color: C.text },
  selectorSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: '#CBD5E1', fontWeight: '300' },
  drugCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  drugCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  drugNumBadge: { backgroundColor: '#DBEAFE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  drugNum: { fontSize: 11, fontWeight: '800', color: C.primary },
  drugNameInput: { fontSize: 15, fontWeight: '700', color: C.text },
  removeText: { fontSize: 12, color: C.danger, fontWeight: '600' },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: C.border,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: C.muted },
  chipTextOn: { color: '#FFF' },
  addDrugBtn: {
    borderWidth: 1.5, borderColor: C.teal, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  addDrugText: { fontSize: 14, fontWeight: '700', color: C.teal },
  submitBtn: {
    backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  successWrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 28, alignItems: 'center', width: '100%',
    shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },
  rxIdBadge: { backgroundColor: '#DBEAFE', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 16, alignItems: 'center' },
  rxIdLabel: { fontSize: 10, fontWeight: '800', color: C.primary, letterSpacing: 0.8 },
  rxIdText: { fontSize: 16, fontWeight: '800', color: C.primary, marginTop: 2 },
  successSub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  newRxBtn: { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 10 },
  newRxText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  backLinkBtn: { paddingVertical: 8 },
  backLinkText: { fontSize: 14, color: C.muted, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalItemActive: { backgroundColor: '#F0FDFA' },
  modalItemMain: { fontSize: 15, fontWeight: '700', color: C.text },
  modalItemSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  modalCancel: { marginTop: 14, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: C.danger },
});
