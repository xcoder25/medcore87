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
  blue: '#2563EB',
};

const CHATS = [
  { id: '1', sender: 'Dr. Adeyemi (Cardio)', role: 'Consultant', text: 'Bed 4B troponin normalized, can step down to ward tomorrow.', time: '10:14 AM' },
  { id: '2', sender: 'Nurse K. Okon', role: 'Staff Nurse', text: 'Noted doctor. Telemetry battery changed.', time: '10:18 AM' },
  { id: '3', sender: 'Pharmacy Central', role: 'Clinical Pharmacist', text: 'Clopidogrel 75mg dispensed for Bed 4B.', time: '10:30 AM' },
  { id: '4', sender: 'Dr. Okafor (Registrar)', role: 'Registrar', text: 'Bed 5A echo report is ready on EMR. EF 45%.', time: '11:05 AM' },
];

export const SecureTeamChat: React.FC<Props> = ({ onBack }) => {
  const [messages, setMessages] = useState(CHATS);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages([
      ...messages,
      {
        id: String(Date.now()),
        sender: 'You',
        role: 'Clinician',
        text: input.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
  };

  return (
    <View style={s.wrap}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 10 }}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      )}
      <Text style={s.pageTitle}>Secure Team Chat</Text>
      <Text style={s.pageSub}>Encrypted unit communication & on-call broadcasts</Text>

      <ScrollView style={s.msgList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {messages.map((m) => (
          <View key={m.id} style={[s.msgBubble, m.sender === 'You' && s.myBubble]}>
            <View style={s.senderRow}>
              <Text style={s.senderName}>{m.sender}</Text>
              <Text style={s.roleTag}>{m.role}</Text>
              <Text style={s.time}>{m.time}</Text>
            </View>
            <Text style={s.msgText}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Type encrypted message..."
          placeholderTextColor="#94A3B8"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={s.sendBtn} onPress={send}>
          <Text style={s.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 14, marginTop: 2 },
  msgList: { flex: 1 },
  msgBubble: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  myBubble: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  senderName: { fontSize: 12, fontWeight: '700', color: C.text },
  roleTag: { fontSize: 10, color: C.teal, backgroundColor: '#CCFBF1', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  time: { fontSize: 10, color: C.muted, marginLeft: 'auto' },
  msgText: { fontSize: 13, color: C.text, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
  },
  sendBtn: { backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
