import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StaffSession } from '../auth/StaffAuthScreen';
import { fetchFacilityState, saveFacilityState } from '../../services/emrSyncClient';
import { GlowButton, LiquidGlassCard } from '../ui/LiquidGlass';
import { MedIcon } from '../ui/PremiumIcons';
import { C } from '../../theme';

interface ClinicalTask {
  id: string;
  title: string;
  bed: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  done: boolean;
  createdAt: string;
}

const DEFAULT_TASKS: ClinicalTask[] = [
  { id: 'TSK-1', title: 'STAT IV Artesunate 12h dose review', bed: 'Bed 4A', priority: 'STAT', done: false, createdAt: '09:00' },
  { id: 'TSK-2', title: 'Draw repeat FBC + serum electrolytes', bed: 'Bed 4B', priority: 'URGENT', done: false, createdAt: '09:20' },
  { id: 'TSK-3', title: 'Complete discharge summary & follow-up slot', bed: 'Bed 2C', priority: 'ROUTINE', done: true, createdAt: '08:15' },
];

export const TaskTracker: React.FC<{ session?: StaffSession }> = ({ session }) => {
  const facilityId = session?.facilityId || 'IGH-EKT';
  const [tasks, setTasks] = useState<ClinicalTask[]>(DEFAULT_TASKS);
  const [newTitle, setNewTitle] = useState('');
  const [newBed, setNewBed] = useState('Bed 4A');
  const [priority, setPriority] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('URGENT');
  const [syncedBanner, setSyncedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.sessionToken) return;
    void fetchFacilityState<ClinicalTask[]>(facilityId, 'medcore_mobile_tasks_v1', session.sessionToken).then((res) => {
      if (res.ok && Array.isArray(res.value) && res.value.length > 0) {
        setTasks(res.value);
      }
    });
  }, [facilityId, session?.sessionToken]);

  const persist = async (next: ClinicalTask[]) => {
    setTasks(next);
    const res = await saveFacilityState(facilityId, 'medcore_mobile_tasks_v1', next, session?.sessionToken);
    setSyncedBanner(res.synced ? 'Tasks synced live to MedCore OS.' : 'Saved locally & queued for EMR sync.');
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    const item: ClinicalTask = {
      id: `TSK-${Date.now().toString(36).toUpperCase()}`,
      title: newTitle.trim(),
      bed: newBed.trim() || 'Ward',
      priority,
      done: false,
      createdAt: new Date().toTimeString().slice(0, 5),
    };
    setNewTitle('');
    await persist([item, ...tasks]);
  };

  const toggleTask = async (id: string) => {
    await persist(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 112 }}
      showsVerticalScrollIndicator={false}
    >
      <LiquidGlassCard glowColor={C.glowCyan} intensity="strong" style={{ marginBottom: 12 }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>SHIFT CLINICAL TASKS</Text>
            <Text style={styles.title}>Task Assignment &amp; Tracking</Text>
          </View>
          <MedIcon name="check" size={18} color="#FFFFFF" glowColor={C.glowEmerald} />
        </View>

        <TextInput
          style={styles.input}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Add bedside task (e.g. Repeat BP q30m, blood draw)…"
          placeholderTextColor="#64748B"
        />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TextInput
            style={[styles.input, { flex: 1, marginTop: 0 }]}
            value={newBed}
            onChangeText={setNewBed}
            placeholder="Bed / Ward"
            placeholderTextColor="#64748B"
          />
          {(['STAT', 'URGENT', 'ROUTINE'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPriority(p)}
              style={[styles.prioBtn, priority === p && styles.prioBtnOn]}
            >
              <Text style={[styles.prioText, priority === p && { color: '#FFFFFF' }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <GlowButton label="Add & Sync Clinical Task" icon="check" variant="primary" onPress={addTask} />
        {syncedBanner && <Text style={styles.syncText}>{syncedBanner}</Text>}
      </LiquidGlassCard>

      {tasks.map((t) => (
        <TouchableOpacity key={t.id} onPress={() => void toggleTask(t.id)} activeOpacity={0.85} style={{ marginBottom: 8 }}>
          <LiquidGlassCard glowColor={t.priority === 'STAT' ? C.glowRose : C.glowBlue}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskTitle, t.done && styles.taskDone]}>{t.title}</Text>
                <Text style={styles.taskMeta}>{t.bed} · {t.priority} · {t.createdAt}</Text>
              </View>
              <View style={[styles.statusBadge, t.done && styles.statusDone]}>
                <Text style={styles.statusText}>{t.done ? 'DONE' : 'OPEN'}</Text>
              </View>
            </View>
          </LiquidGlassCard>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eyebrow: { color: C.glowCyan, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', marginTop: 2 },
  input: {
    marginTop: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 8,
  },
  prioBtn: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  prioBtnOn: {
    borderColor: C.glowCyan,
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  prioText: { color: C.muted, fontSize: 10.5, fontWeight: '800' },
  syncText: { color: '#6EE7B7', fontSize: 11.5, fontWeight: '700', marginTop: 8 },
  taskTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  taskDone: { textDecorationLine: 'line-through', color: C.muted },
  taskMeta: { color: C.muted, fontSize: 11.5, marginTop: 3 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  statusDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  statusText: { color: '#F8FAFC', fontSize: 10, fontWeight: '900' },
});
