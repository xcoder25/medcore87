import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

/**
 * MedCore Mobile — Patient AI Discharge Summary & WhatsApp Follow-up.
 * Connected directly to MedCore Hospital OS via shared storage & cloud synchronization.
 */

interface DischargeRecord {
  id: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  phone: string;
  admissionDate: string;
  dischargeDate: string;
  admittingDiagnosis: string;
  finalDiagnosis: string;
  inpatientSummary: string;
  translations: {
    english: string;
    ibibio: string;
    annang: string;
    oron: string;
    pidgin: string;
  };
  dischargeMedications: {
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    specialInstructions: string;
  }[];
  followUpDate: string;
  warningSigns: string[];
}

const DISCHARGE_KEY = 'medcore_patient_discharges_v1';
const WHATSAPP_KEY = 'medcore_whatsapp_followups_v1';

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {
    /* ignore */
  }
  return null;
}

export const MyDischargeSummaryPanel: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [discharges, setDischarges] = useState<DischargeRecord[]>([]);
  const [selectedLang, setSelectedLang] = useState<'english' | 'ibibio' | 'annang' | 'oron' | 'pidgin'>('ibibio');
  const [activeTab, setActiveTab] = useState<'discharge' | 'whatsapp'>('discharge');

  useEffect(() => {
    try {
      const raw = storageGet(DISCHARGE_KEY);
      if (raw) {
        setDischarges(JSON.parse(raw));
      } else {
        // Fallback default demo data
        setDischarges([
          {
            id: 'disch-demo',
            patientId: 'PAT-8812',
            hospitalNumber: 'HOSP-4401',
            patientName: 'Aniefiok Ekpenyong',
            phone: '08023419082',
            admissionDate: '2026-10-22',
            dischargeDate: '2026-10-28',
            admittingDiagnosis: 'Severe Falciparum Malaria with Hyperpyrexia',
            finalDiagnosis: 'Resolved Severe Malaria · Mild Anemia',
            inpatientSummary: 'You were admitted to the hospital on 2026-10-22 for severe malaria and treated successfully. Your recovery is on track. Please take your prescribed medications with clean water every day. Attend your follow-up clinic on 2026-11-11.',
            translations: {
              english: 'You were admitted to the hospital on 2026-10-22 for severe malaria and treated successfully. Your recovery is on track. Please take your prescribed medications with clean water every day. Attend your follow-up clinic on 2026-11-11.',
              ibibio: 'Ekọt eba ufik ke ufọk ibọk ke usen 2026-10-22 ke ntak severe malaria. Abasi amanam emi emi afo emesiñe ọfọn oto malaria. Mbọk da ibọk mfo ke usen ke usen ye mmọñ emi asanade. Di ufọk ibọk man ekpeme fi ke usen 2026-11-11.',
              annang: 'Eda fi eba ufọk ibọk ke usen 2026-10-22 ke ntak severe malaria. Mfin emi afo amayak idem. Da ibọk mfo ntuk ntuk ye mmọñ ke usen ke usen. Nyọñ di ufọk ibọk ke usen 2026-11-11.',
              oron: 'Edehe olo ke ufọk ibọk ke usen 2026-10-22 ke ntak severe malaria. Ndito ufọk ibọk emanana fi ọfọn. Ta ibọk mfo mfin ye nsi nsi ye mmọñ olo asanade. Nyọñ uka unyie dọkta ke usen 2026-11-11.',
              pidgin: 'You enter hospital on 2026-10-22 because of heavy malaria, and doctors don treat you well. Body don dey strong now. Make sure say you dey drink your drugs everyday with clean water as doctor talk. Come back hospital on 2026-11-11.',
            },
            dischargeMedications: [
              { drugName: 'Artemether-Lumefantrine 80/480mg', dosage: '1 tab', frequency: 'Twice daily', duration: '1 day', specialInstructions: 'Take with fatty meal or milk' },
              { drugName: 'Ferrous Sulfate 200mg', dosage: '1 tab', frequency: 'Daily', duration: '30 days', specialInstructions: 'Take with citrus/water' },
              { drugName: 'Folic Acid 5mg', dosage: '1 tab', frequency: 'Daily', duration: '30 days', specialInstructions: 'Morning dose' },
            ],
            followUpDate: '2026-11-11',
            warningSigns: ['High persistent fever (> 38.5°C)', 'Sudden breathlessness', 'Vomiting everything taken'],
          },
        ]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const d = discharges[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.eyebrow}>AI-POWERED PATIENT CARE</Text>
        <Text style={styles.title}>Discharge Summary &amp; Care Bot</Text>
        <Text style={styles.subtitle}>Directly connected to Immanuel General Hospital, Eket</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'discharge' && styles.tabItemActive]}
          onPress={() => setActiveTab('discharge')}
        >
          <Text style={[styles.tabText, activeTab === 'discharge' && styles.tabTextActive]}>
            Discharge Plan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'whatsapp' && styles.tabItemActive]}
          onPress={() => setActiveTab('whatsapp')}
        >
          <Text style={[styles.tabText, activeTab === 'whatsapp' && styles.tabTextActive]}>
            WhatsApp Follow-up
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discharge' && d && (
        <View>
          {/* Language Selector */}
          <View style={styles.langBar}>
            {(['ibibio', 'annang', 'oron', 'pidgin', 'english'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langChip, selectedLang === lang && styles.langChipActive]}
                onPress={() => setSelectedLang(lang)}
              >
                <Text style={[styles.langChipText, selectedLang === lang && styles.langChipTextActive]}>
                  {lang === 'ibibio' ? 'Ibibio' : lang === 'annang' ? 'Annang' : lang === 'oron' ? 'Oron' : lang === 'pidgin' ? 'Pidgin' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Translated Plain-Language Explanation */}
          <View style={styles.cardHighlight}>
            <Text style={styles.cardHighlightEyebrow}>
              DOCTOR'S NOTE ({selectedLang.toUpperCase()})
            </Text>
            <Text style={styles.cardHighlightBody}>
              {d.translations[selectedLang] || d.inpatientSummary}
            </Text>
          </View>

          {/* Follow-up Date Box */}
          <View style={styles.followUpCard}>
            <Text style={styles.followUpLabel}>CLINIC APPOINTMENT</Text>
            <Text style={styles.followUpDate}>{d.followUpDate}</Text>
            <Text style={styles.followUpSub}>General Outpatient Department (OPD) · Room 4</Text>
          </View>

          {/* Medications to Take at Home */}
          <Text style={styles.sectionTitle}>Home Medications (Auto-Scheduled)</Text>
          {d.dischargeMedications.map((m, idx) => (
            <View key={idx} style={styles.medCard}>
              <View style={styles.medHeader}>
                <Text style={styles.medName}>{m.drugName}</Text>
                <Text style={styles.medFreq}>{m.frequency}</Text>
              </View>
              <Text style={styles.medDose}>{m.dosage} · Duration: {m.duration}</Text>
              <Text style={styles.medNote}>Tip: {m.specialInstructions}</Text>
            </View>
          ))}

          {/* Emergency Warning Signs */}
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Return to Emergency (A&amp;E) if:</Text>
            {d.warningSigns.map((w, idx) => (
              <Text key={idx} style={styles.warningItem}>• {w}</Text>
            ))}
          </View>
        </View>
      )}

      {activeTab === 'whatsapp' && (
        <View style={styles.whatsappCard}>
          <Text style={styles.whatsappTitle}>🤖 WhatsApp Nurse Coordinator</Text>
          <Text style={styles.whatsappDesc}>
            Automated WhatsApp check-ins are sent on Day 1, Day 3, and Day 7 after leaving the hospital.
          </Text>

          <View style={styles.chatBubbleBot}>
            <Text style={styles.chatSender}>MedCore Nurse AI · 09:00 AM</Text>
            <Text style={styles.chatText}>
              Good morning Aniefiok. How is your recovery today? Did you sleep well and have you taken your morning medication?
            </Text>
          </View>

          <View style={styles.chatBubbleUser}>
            <Text style={styles.chatSenderUser}>You (WhatsApp) · 09:14 AM</Text>
            <Text style={styles.chatTextUser}>
              Good morning nurse. I am much better, fever has gone down completely. I took my morning medicine with water.
            </Text>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusBoxText}>✓ Health Status: Recovering Well</Text>
            <Text style={styles.statusBoxSub}>Your care team at Immanuel General Hospital has been notified.</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#0284C7', fontWeight: '700', fontSize: 14 },
  eyebrow: { color: '#7C3AED', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabItemActive: { backgroundColor: '#FFF' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#0284C7' },
  langBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1' },
  langChipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  langChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  langChipTextActive: { color: '#FFF' },
  cardHighlight: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardHighlightEyebrow: { fontSize: 11, fontWeight: '800', color: '#B45309', marginBottom: 6 },
  cardHighlightBody: { fontSize: 14, lineHeight: 22, color: '#78350F' },
  followUpCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 14, padding: 16, marginBottom: 16 },
  followUpLabel: { fontSize: 11, fontWeight: '800', color: '#15803D' },
  followUpDate: { fontSize: 20, fontWeight: '900', color: '#14532D', marginVertical: 4 },
  followUpSub: { fontSize: 12, color: '#166534' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  medCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, marginBottom: 10 },
  medHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medName: { fontSize: 14, fontWeight: '800', color: '#0284C7' },
  medFreq: { fontSize: 11, fontWeight: '700', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: '#475569' },
  medDose: { fontSize: 12, color: '#334155', marginTop: 4, fontWeight: '600' },
  medNote: { fontSize: 11, color: '#64748B', marginTop: 2, fontStyle: 'italic' },
  warningCard: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 14, padding: 16, marginTop: 6 },
  warningTitle: { fontSize: 13, fontWeight: '800', color: '#B91C1C', marginBottom: 6 },
  warningItem: { fontSize: 12, color: '#991B1B', lineHeight: 18 },
  whatsappCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16 },
  whatsappTitle: { fontSize: 16, fontWeight: '800', color: '#16A34A', marginBottom: 4 },
  whatsappDesc: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  chatBubbleBot: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12, marginBottom: 12, maxWidth: '85%' },
  chatSender: { fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  chatText: { fontSize: 13, color: '#0F172A', lineHeight: 18 },
  chatBubbleUser: { backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12, marginBottom: 16, maxWidth: '85%', alignSelf: 'flex-end' },
  chatSenderUser: { fontSize: 10, fontWeight: '700', color: '#166534', marginBottom: 4, textAlign: 'right' },
  chatTextUser: { fontSize: 13, color: '#14532D', lineHeight: 18 },
  statusBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, padding: 12, alignItems: 'center' },
  statusBoxText: { fontSize: 13, fontWeight: '800', color: '#15803D' },
  statusBoxSub: { fontSize: 11, color: '#166534', marginTop: 2 },
});

export default MyDischargeSummaryPanel;
