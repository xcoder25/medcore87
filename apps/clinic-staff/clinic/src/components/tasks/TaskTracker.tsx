import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { C } from '../../theme';
import { TASKS, subscribe, completeTask, type Task } from '../../services/clinicData';

export const TaskTracker: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [filter, setFilter] = useState<'open' | 'all' | 'done'>('open');
  useEffect(() => subscribe(() => setTasks([...TASKS])), []);
  const list = tasks.filter((t) =>
    filter === 'open' ? t.status === 'open' : filter === 'done' ? t.status === 'done' : true
  );
  const priColor = (p: Task['priority']) =>
    p === 'stat' ? C.danger : p === 'urgent' ? C.warning : C.teal;

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={s.pageTitle}>Tasks</Text>
      <Text style={s.pageSub}>Prioritized clinical to-do queue</Text>
      <View style={s.filters}>
        {(['open', 'all', 'done'] as const).map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterOn]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextOn]}>
              {f === 'open' ? 'Open' : f === 'done' ? 'Done' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {list.length === 0 && <View style={s.empty}><Text style={s.emptyT}>No tasks in this view</Text></View>}
      {list.map((t) => (
        <View key={t.id} style={s.card}>
          <View style={s.top}>
            <View style={[s.pri, { backgroundColor: priColor(t.priority) + '22' }]}>
              <Text style={[s.priT, { color: priColor(t.priority) }]}>{t.priority.toUpperCase()}</Text>
            </View>
            <Text style={s.due}>{t.due}</Text>
          </View>
          <Text style={s.title}>{t.title}</Text>
          <Text style={s.meta}>{t.patient} · Bed {t.bed} · {t.type}</Text>
          {t.status === 'open' ? (
            <TouchableOpacity style={s.doneBtn} onPress={() => completeTask(t.id)} activeOpacity={0.85}>
              <Text style={s.doneBtnT}>Mark Complete</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.doneLabel}>✓ Completed</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 14, marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterOn: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: C.muted },
  filterTextOn: { color: '#FFF' },
  empty: { padding: 32, alignItems: 'center' },
  emptyT: { color: C.muted, fontSize: 14 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  pri: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priT: { fontSize: 10, fontWeight: '800' },
  due: { fontSize: 12, color: C.muted, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
  doneBtn: { marginTop: 12, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  doneBtnT: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  doneLabel: { marginTop: 10, fontSize: 13, color: C.success, fontWeight: '700' },
});
