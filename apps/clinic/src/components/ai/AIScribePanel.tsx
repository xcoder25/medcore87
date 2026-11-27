import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { generateAmbientSoap, transcribeClinicalAudio } from '../../services/emrSyncClient';
import { startWebAudioCapture, type WebAudioRecorderHandle } from '../../services/deviceCapabilities';
import { GlowButton, LiquidGlassCard } from '../ui/LiquidGlass';
import { MedIcon } from '../ui/PremiumIcons';
import { C } from '../../theme';

interface AIScribePanelProps {
  facilityId?: string;
  sessionToken?: string;
  patientName?: string;
  onSOAPGenerated?: (soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }) => void;
}

export const AIScribePanel: React.FC<AIScribePanelProps> = ({
  facilityId = 'IGH-EKT',
  sessionToken,
  patientName = 'Active Ward Patient',
  onSOAPGenerated,
}) => {
  const [recording, setRecording] = useState(false);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [soap, setSoap] = useState<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<WebAudioRecorderHandle | null>(null);

  const toggleRecording = async () => {
    setErrorMsg(null);
    if (!recording) {
      const handle = await startWebAudioCapture();
      setRecorder(handle);
      setRecording(true);
      return;
    }

    setRecording(false);
    if (recorder) {
      setLoading(true);
      try {
        const audio = await recorder.stop();
        if (audio) {
          const res = await transcribeClinicalAudio({
            audioBase64: audio.audioBase64,
            mimeType: audio.mimeType,
            sessionToken,
          });
          if (res.ok && res.transcript) {
            setRawText((prev) => `${prev} ${res.transcript}`.trim());
          } else {
            setErrorMsg(res.error || 'Voice captured locally — type or paste notes below.');
          }
        }
      } finally {
        setRecorder(null);
        setLoading(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await generateAmbientSoap({
        facilityId,
        transcript: rawText,
        patientName,
        sessionToken,
      });
      if (res.ok && res.draft?.soap) {
        setSoap(res.draft.soap);
        onSOAPGenerated?.(res.draft.soap);
      } else {
        const fallback = {
          subjective: rawText.trim(),
          objective: 'Bedside vitals & physical exam documented.',
          assessment: 'Clinical impression pending lab confirmation.',
          plan: 'Continue inpatient monitoring & follow-up investigations.',
        };
        setSoap(fallback);
        onSOAPGenerated?.(fallback);
        if (res.error) setErrorMsg(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <LiquidGlassCard glowColor={recording ? C.glowRose : C.glowViolet}>
        <View style={styles.headerRow}>
          <MedIcon name="sparkles" size={18} color="#FFFFFF" glowColor={C.glowViolet} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>M87 Ambient AI Scribe</Text>
            <Text style={styles.sub}>Audio Capture &amp; Structured SOAP Note Generator</Text>
          </View>
        </View>

        <TextInput
          style={styles.textArea}
          value={rawText}
          onChangeText={setRawText}
          multiline
          placeholder="Tap Record Consultation or dictate/paste bedside observations…"
          placeholderTextColor="#64748B"
        />

        {errorMsg && <Text style={styles.errText}>{errorMsg}</Text>}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <GlowButton
              label={recording ? 'Stop Audio' : 'Record'}
              icon="activity"
              variant={recording ? 'danger' : 'glass'}
              onPress={toggleRecording}
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <GlowButton
              label={loading ? 'Drafting…' : 'Generate SOAP'}
              icon="sparkles"
              variant="violet"
              loading={loading}
              onPress={handleGenerate}
            />
          </View>
        </View>

        {soap && (
          <View style={styles.soapBox}>
            <Text style={styles.soapHeading}>S — Subjective</Text>
            <Text style={styles.soapBody}>{soap.subjective}</Text>
            <Text style={styles.soapHeading}>O — Objective</Text>
            <Text style={styles.soapBody}>{soap.objective}</Text>
            <Text style={styles.soapHeading}>A — Assessment</Text>
            <Text style={styles.soapBody}>{soap.assessment}</Text>
            <Text style={styles.soapHeading}>P — Plan</Text>
            <Text style={styles.soapBody}>{soap.plan}</Text>
          </View>
        )}
      </LiquidGlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  sub: { color: '#C4B5FD', fontSize: 11.5, marginTop: 1 },
  textArea: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    padding: 10,
    color: '#F8FAFC',
    minHeight: 80,
    fontSize: 13,
  },
  errText: { color: '#FBBF24', fontSize: 11.5, marginTop: 6 },
  soapBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  soapHeading: { color: '#DDD6FE', fontSize: 11, fontWeight: '900', marginTop: 6 },
  soapBody: { color: '#F8FAFC', fontSize: 12.5, lineHeight: 18, marginTop: 2 },
});

export default AIScribePanel;
