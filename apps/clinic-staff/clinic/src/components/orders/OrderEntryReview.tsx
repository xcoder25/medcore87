import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { C } from '../../theme';
import { ORDERS, subscribe, acknowledgeOrder, type Order } from '../../services/clinicData';

export const OrderEntryReview: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(ORDERS);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'critical'>('all');
  useEffect(() => subscribe(() => setOrders([...ORDERS])), []);

  const list = orders.filter((o) => {
    if (filter === 'pending') return o.status === 'pending' || o.status === 'in-progress';
    if (filter === 'critical') return !!o.critical;
    return true;
  });

  const statusStyle = (st: Order['status']) => {
    if (st === 'resulted') return { bg: C.dangerSoft, fg: C.danger };
    if (st === 'acknowledged') return { bg: C.successSoft, fg: C.success };
    if (st === 'in-progress') return { bg: C.primarySoft, fg: C.primary };
    return { bg: C.warningSoft, fg: C.warning };
  };

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={s.head}>
        <View>
          <Text style={s.pageTitle}>Orders (CPOE)</Text>
          <Text style={s.pageSub}>Labs · Imaging · Pharmacy</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(!showNew)}>
          <Text style={s.newBtnT}>{showNew ? 'Cancel' : '+ Order'}</Text>
        </TouchableOpacity>
      </View>
      {showNew && (
        <View style={s.newCard}>
          <TextInput style={s.input} placeholder="Order name (e.g. CBC, CXR)" placeholderTextColor="#94A3B8" />
          <TextInput style={s.input} placeholder="Patient / Bed" placeholderTextColor="#94A3B8" />
          <View style={s.typeRow}>
            {['Lab', 'Imaging', 'Pharmacy', 'Nursing'].map((t) => (
              <View key={t} style={s.chip}><Text style={s.chipT}>{t}</Text></View>
            ))}
          </View>
          <TouchableOpacity style={s.submit} onPress={() => setShowNew(false)}>
            <Text style={s.submitT}>Submit Order</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={s.filters}>
        {(['all', 'pending', 'critical'] as const).map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterOn]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextOn]}>
              {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Critical'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {list.map((o) => {
        const st = statusStyle(o.status);
        return (
          <View key={o.id} style={[s.card, o.critical && s.cardCrit]}>
            <View style={s.top}>
              <View style={[s.typeBadge, { backgroundColor: C.primarySoft }]}>
                <Text style={[s.typeT, { color: C.primary }]}>{o.type}</Text>
              </View>
              <View style={[s.status, { backgroundColor: st.bg }]}>
                <Text style={[s.statusT, { color: st.fg }]}>{o.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={s.name}>{o.name}</Text>
            <Text style={s.meta}>{o.patient} · Bed {o.bed} · Ordered {o.orderedAt}</Text>
            {o.critical && o.status === 'resulted' && (
              <TouchableOpacity style={s.ackBtn} onPress={() => acknowledgeOrder(o.id)}>
                <Text style={s.ackT}>Acknowledge Critical Result</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  newBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnT: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  newCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10, color: C.text },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipT: { fontSize: 12, fontWeight: '600', color: '#0369A1' },
  submit: { backgroundColor: C.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitT: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterOn: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: C.muted },
  filterTextOn: { color: '#FFF' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  cardCrit: { borderWidth: 1.5, borderColor: '#FECACA' },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeT: { fontSize: 10, fontWeight: '800' },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusT: { fontSize: 10, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
  ackBtn: { marginTop: 12, backgroundColor: C.danger, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  ackT: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
