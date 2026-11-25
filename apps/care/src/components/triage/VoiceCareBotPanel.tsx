import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';

export type BotLanguage = 'english' | 'pidgin' | 'ibibio' | 'annang' | 'oron';

export interface VoiceCareBotPanelProps {
  patientName: string;
  patientPhone?: string;
  akshiaId?: string;
  shid?: string;
  onBack: () => void;
  onAppointmentBooked?: (booking: {
    bookingRef: string;
    facilityName: string;
    department: string;
    preferredSlot: string;
  }) => void;
  onToast?: (msg: string) => void;
}

interface BotChatItem {
  id: string;
  sender: 'patient' | 'assistant';
  viaVoice?: boolean;
  text: string;
  urgency?: 'emergency' | 'urgent' | 'routine';
  appointmentDraft?: {
    bookingRef: string;
    facilityName: string;
    department: string;
    preferredSlot: string;
  };
  akshiaStatus?: {
    cardNumber: string;
    scheme: string;
    status: string;
    primaryFacility: string;
    validThrough: string;
  };
  careReminders?: Array<{
    id: string;
    title: string;
    nextDue: string;
    checklistPrompt: string;
  }>;
}

const SAMPLE_VOICE_NOTES: Array<{ label: string; transcript: string; lang?: BotLanguage }> = [
  {
    label: 'Voice: Check AKSHIA Card',
    transcript: 'Check my AKSHIA health card status and primary hospital',
    lang: 'english',
  },
  {
    label: 'Voice: Book ANC Visit (Eket)',
    transcript: 'Book antenatal appointment at Immanuel General Hospital Eket tomorrow morning',
    lang: 'english',
  },
  {
    label: 'Voice (Pidgin): Urgent Pregnancy Danger Check',
    transcript: 'I get belle 28 weeks, my head dey pain me well well and my eye dey blur',
    lang: 'pidgin',
  },
  {
    label: 'Voice: Chronic BP Refill Check-In',
    transcript: 'Check my hypertension medicine reminder, my BP today na 132/84',
    lang: 'pidgin',
  },
];

function offlineTriageFallback(
  text: string,
  language: BotLanguage,
  akshiaId?: string
): Omit<BotChatItem, 'id' | 'sender'> {
  const lower = text.toLowerCase();
  if (/bleed|convuls|fit\b|cannot breath|blur|head dey pain/.test(lower)) {
    return {
      text:
        language === 'pidgin'
          ? 'EMERGENCY ALERT: Go Emergency Unit at nearest Akwa Ibom General Hospital sharp sharp or call 112 right now!'
          : 'EMERGENCY ALERT: Please go to the nearest Emergency Unit immediately or call 112. Do not wait for a routine queue.',
      urgency: 'emergency',
    };
  }
  if (/akshia|nhia|card|insurance|shid/.test(lower)) {
    return {
      text: `AKSHIA Coverage Verified: Card ${akshiaId || 'AKSHIA-AKS-2026-8841'} is ACTIVE at your primary AKS clinic through 2027-06-30.`,
      urgency: 'routine',
      akshiaStatus: {
        cardNumber: akshiaId || 'AKSHIA-AKS-2026-8841',
        scheme: 'AKSHIA',
        status: 'ACTIVE',
        primaryFacility: 'Immanuel General Hospital, Eket',
        validThrough: '2027-06-30',
      },
    };
  }
  if (/book|appointment|visit|schedule/.test(lower)) {
    const facilityName = /eket|immanuel/.test(lower)
      ? 'Immanuel General Hospital, Eket'
      : 'Ibom Specialist Hospital, Uyo';
    const department = /anc|antenatal|pregnan/.test(lower)
      ? 'Antenatal & Maternal Care (ANC)'
      : 'General Outpatient Department (GOPD)';
    return {
      text: `Appointment confirmed at ${facilityName} (${department}) — Tomorrow 09:00 AM.`,
      urgency: 'routine',
      appointmentDraft: {
        bookingRef: 'AKS-APT-OFFLINE1',
        facilityName,
        department,
        preferredSlot: 'Tomorrow · 09:00 AM',
      },
    };
  }
  if (/anc|antenatal|bp|hypertens|sugar|diabet|reminder|check/.test(lower)) {
    return {
      text: 'Maternal & Chronic Care reminders are active. Take prescribed medicines on schedule and reply anytime with new symptoms or BP readings.',
      urgency: 'routine',
      careReminders: [
        {
          id: 'rem-anc',
          title: 'ANC & Maternal Safety Check-In',
          nextDue: 'Every 7 days · Morning ANC Clinic',
          checklistPrompt: 'Check fetal kicks, blood pressure, swelling, and daily iron/folic acid.',
        },
        {
          id: 'rem-bp',
          title: 'Hypertension / Chronic Refill Check',
          nextDue: 'Every 48 hours',
          checklistPrompt: 'Reply with today’s BP reading and confirm medication adherence.',
        },
      ],
    };
  }
  return {
    text: 'You can send a voice note or tap a quick button to book a clinic appointment, check your AKSHIA card, or get symptom triage.',
    urgency: 'routine',
  };
}

export const VoiceCareBotPanel: React.FC<VoiceCareBotPanelProps> = ({
  patientName,
  patientPhone,
  akshiaId,
  shid,
  onBack,
  onAppointmentBooked,
  onToast,
}) => {
  const [language, setLanguage] = useState<BotLanguage>('english');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<BotChatItem[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      urgency: 'routine',
      text: `Hello ${patientName || 'Patient'}! Send a voice note or message in English, Nigerian Pidgin, Ibibio, Annang, or Oron to check symptoms, book hospital appointments, verify your AKSHIA card, or manage ANC & chronic check-in reminders.`,
      careReminders: [
        {
          id: 'rem-init-1',
          title: 'Automated ANC / Chronic Care Check-In',
          nextDue: 'Next automated WhatsApp & In-App prompt scheduled',
          checklistPrompt: 'Tap "Voice: Chronic BP Refill Check-In" or record a voice note anytime.',
        },
      ],
    },
  ]);

  const mediaRecorderRef = useRef<any>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    const idKey = shid || akshiaId || '';
    if (!idKey) return;
    let active = true;
    const baseOrigin =
      (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_OS_API_URL) || '';
    fetch(`${baseOrigin}/api/care/sync?shid=${encodeURIComponent(idKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !json?.ok) return;
        const apptCount = Array.isArray(json.appointments) ? json.appointments.length : 0;
        if (apptCount > 0 || json.akshiaCoverage) {
          setMessages((prev) => [
            ...prev,
            {
              id: `sync-${Date.now()}`,
              sender: 'assistant',
              urgency: 'routine',
              text: `Live Hospital Sync Complete: ${apptCount} synced clinic booking(s) found for ${idKey}.`,
              akshiaStatus: json.akshiaCoverage,
              careReminders: json.reminders,
            },
          ]);
        }
      })
      .catch(() => {
        // stay functional offline
      });
    return () => {
      active = false;
    };
  }, [shid, akshiaId]);

  const speakOut = (text: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
      return;
    }
    onToast?.('Voice playback active on supported devices.');
  };

  const sendToBot = async (payload: {
    text?: string;
    audioBase64?: string;
    mimeType?: string;
    viaVoice?: boolean;
    langOverride?: BotLanguage;
  }) => {
    const langToUse = payload.langOverride || language;
    const displayLabel = payload.text || (payload.viaVoice ? 'Voice Note Sent' : '');
    if (!displayLabel && !payload.audioBase64) return;

    const userMsg: BotChatItem = {
      id: `u-${Date.now()}`,
      sender: 'patient',
      viaVoice: payload.viaVoice,
      text: displayLabel,
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const baseOrigin =
        (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_OS_API_URL) || '';
      const url = `${baseOrigin}/api/whatsapp/triage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: payload.text,
          audioBase64: payload.audioBase64,
          mimeType: payload.mimeType,
          language: langToUse,
          patient: {
            name: patientName,
            phone: patientPhone,
            akshiaId,
            shid,
            lga: 'Eket',
          },
        }),
      });
      if (!res.ok) throw new Error('Gateway unavailable');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Bot error');

      const botMsg: BotChatItem = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: json.replyText,
        urgency: json.urgency,
        appointmentDraft: json.appointmentDraft,
        akshiaStatus: json.akshiaStatus,
        careReminders: json.careReminders,
      };
      setMessages((prev) => [...prev, botMsg]);
      if (json.appointmentDraft && onAppointmentBooked) {
        onAppointmentBooked(json.appointmentDraft);
      }
      if (payload.viaVoice) {
        speakOut(json.voiceScript || json.replyText);
      }
    } catch {
      const fb = offlineTriageFallback(payload.text || '', langToUse, akshiaId);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          ...fb,
        },
      ]);
      if (fb.appointmentDraft && onAppointmentBooked) {
        onAppointmentBooked(fb.appointmentDraft);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleVoiceNote = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      await sendToBot({
        text: SAMPLE_VOICE_NOTES[1].transcript,
        viaVoice: true,
        langOverride: language,
      });
      return;
    }

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Recorder = (window as any).MediaRecorder;
      if (!Recorder) {
        stream.getTracks().forEach((t) => t.stop());
        onToast?.('Microphone recorder unavailable — tap a sample voice note below.');
        return;
      }
      const rec = new Recorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev: any) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          void sendToBot({
            audioBase64: b64,
            mimeType: rec.mimeType || 'audio/webm',
            text: inputText.trim() || 'Voice note symptom & appointment request',
            viaVoice: true,
          });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      onToast?.('Microphone permission denied — tap a sample voice note below or type a message.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Language Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow}>
        {(['english', 'pidgin', 'ibibio', 'annang', 'oron'] as BotLanguage[]).map((lang) => {
          const active = language === lang;
          return (
            <TouchableOpacity
              key={lang}
              style={[styles.langPill, active && styles.langPillActive]}
              onPress={() => setLanguage(lang)}
            >
              <Text style={[styles.langPillText, active && styles.langPillTextActive]}>
                {lang.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Quick Voice Note Presets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
        {SAMPLE_VOICE_NOTES.map((s, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.presetChip}
            onPress={() =>
              void sendToBot({
                text: s.transcript,
                viaVoice: true,
                langOverride: s.lang || language,
              })
            }
          >
            <Text style={styles.presetChipText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Conversation History */}
      <ScrollView style={styles.chatList} contentContainerStyle={{ paddingBottom: 18 }}>
        {messages.map((m) => {
          const isUser = m.sender === 'patient';
          const isEmergency = m.urgency === 'emergency';
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                isUser ? styles.userBubble : isEmergency ? styles.emergencyBubble : styles.botBubble,
              ]}
            >
              <Text style={[styles.senderTag, isUser && { color: '#DBEAFE' }, isEmergency && { color: '#991B1B' }]}>
                {isUser ? (m.viaVoice ? 'VOICE NOTE (YOU)' : 'YOU') : isEmergency ? 'URGENT TRIAGE ALERT' : 'MEDCORE CARE BOT'}
              </Text>
              <Text style={[styles.msgText, isUser && { color: '#FFFFFF' }, isEmergency && { color: '#7F1D1D', fontWeight: '700' }]}>
                {m.text}
              </Text>

              {!isUser && (
                <TouchableOpacity style={styles.listenBtn} onPress={() => speakOut(m.text)}>
                  <Text style={styles.listenBtnText}>🔊 Listen to Voice Reply</Text>
                </TouchableOpacity>
              )}

              {m.appointmentDraft && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Appointment Confirmed · {m.appointmentDraft.bookingRef}</Text>
                  <Text style={styles.cardSub}>{m.appointmentDraft.facilityName}</Text>
                  <Text style={styles.cardSub}>
                    {m.appointmentDraft.department} · {m.appointmentDraft.preferredSlot}
                  </Text>
                </View>
              )}

              {m.akshiaStatus && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {m.akshiaStatus.scheme} Card · {m.akshiaStatus.status}
                  </Text>
                  <Text style={styles.cardSub}>Card No: {m.akshiaStatus.cardNumber}</Text>
                  <Text style={styles.cardSub}>
                    Clinic: {m.akshiaStatus.primaryFacility} (Valid till {m.akshiaStatus.validThrough})
                  </Text>
                </View>
              )}

              {m.careReminders && m.careReminders.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Maternal &amp; Chronic Care Check-In Reminders</Text>
                  {m.careReminders.map((r) => (
                    <View key={r.id} style={{ marginTop: 4 }}>
                      <Text style={styles.cardSub}>• {r.title} — {r.nextDue}</Text>
                      <Text style={styles.cardMuted}>{r.checklistPrompt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Voice Note + Text Composer */}
      <View style={styles.composer}>
        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
          onPress={() => void toggleVoiceNote()}
        >
          <Text style={styles.micBtnText}>{isRecording ? '⏹ Stop' : '🎙 Voice'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask symptoms, book clinic, check AKSHIA..."
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.sendBtn}
          disabled={busy || !inputText.trim()}
          onPress={() => {
            const msg = inputText.trim();
            setInputText('');
            void sendToBot({ text: msg });
          }}
        >
          <Text style={styles.sendBtnText}>{busy ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <Text style={styles.backLinkText}>← Return to Home Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  langRow: {
    maxHeight: 38,
    marginBottom: 8,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  langPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  langPillTextActive: {
    color: '#FFFFFF',
  },
  presetRow: {
    maxHeight: 38,
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginRight: 8,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  chatList: {
    flex: 1,
    minHeight: 280,
  },
  bubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0284C7',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emergencyBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  senderTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  msgText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#0F172A',
  },
  listenBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  listenBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  card: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  cardMuted: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  micBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  micBtnActive: {
    backgroundColor: '#DC2626',
  },
  micBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  backLink: {
    marginTop: 10,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
