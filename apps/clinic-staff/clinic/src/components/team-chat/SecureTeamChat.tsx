import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { C, type PropsWithBack } from '../../theme';

const MSGS = [
  { id: '1', from: 'RN Ada', text: 'Bed 4B — family at bedside, asking about PCI results.', time: '10:42', me: false },
  { id: '2', from: 'You', text: 'Will review with them after rounds. Keep on telemetry.', time: '10:45', me: true },
  { id: '3', from: 'Lab', text: 'STAT Troponin resulted critical for Chen 4B.', time: '11:02', me: false },
  { id: '4', from: 'RN Kemi', text: 'Discharge checklist for Taylor 5A — transport pending.', time: '11:15', me: false },
];

export const SecureTeamChat: React.FC<PropsWithBack> = ({ onBack }) => {
  const [text, setText] = useState('');
  return (
    <View style={s.wrap}>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 8, paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>}
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={s.pageTitle}>Secure Team Chat</Text>
        <Text style={s.pageSub}>Encrypted · Ward 4-West channel</Text>
      </View>
      <ScrollView style={s.msgs} contentContainerStyle={{ padding: 16, paddingBottom: 12 }}>
        {MSGS.map((m) => (
          <View key={m.id} style={[s.bubble, m.me ? s.bubbleMe : s.bubbleThem]}>
            {!m.me && <Text style={s.from}>{m.from}</Text>}
            <Text style={[s.msgText, m.me && s.msgTextMe]}>{m.text}</Text>
            <Text style={[s.msgTime, m.me && s.msgTimeMe]}>{m.time}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="Message team…"
          placeholderTextColor="#94A3B8"
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={s.send} onPress={() => setText('')}>
          <Text style={s.sendT}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  back: { fontSize: 14, color: C.teal, fontWeight: '600' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 8, marginTop: 2 },
  msgs: { flex: 1 },
  bubble: { maxWidth: '82%', borderRadius: 16, padding: 12, marginBottom: 10 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: C.primary },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: C.card, elevation: 1 },
  from: { fontSize: 11, fontWeight: '700', color: C.teal, marginBottom: 4 },
  msgText: { fontSize: 14, color: C.text, lineHeight: 20 },
  msgTextMe: { color: '#FFF' },
  msgTime: { fontSize: 10, color: C.muted, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: '#BFDBFE' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  input: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  send: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  sendT: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
