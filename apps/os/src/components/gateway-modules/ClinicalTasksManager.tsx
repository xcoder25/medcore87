'use client';

import React, { useState } from 'react';
import { HospitalTaskItem, INITIAL_TASKS } from '../../data/hospitalData';
import {
  ClipboardList, CheckCircle2, Clock, Plus, Search,
  AlertTriangle, Check, X, Filter
} from 'lucide-react';

interface ClinicalTasksManagerProps {
  userRole?: string;
  onNavigate?: (module: string, param?: any) => void;
}

export const ClinicalTasksManager: React.FC<ClinicalTasksManagerProps> = ({ userRole, onNavigate }) => {
  const [tasks, setTasks] = useState<HospitalTaskItem[]>(INITIAL_TASKS);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'urgent' | 'completed'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // New task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPatient, setTaskPatient] = useState('');
  const [taskRole, setTaskRole] = useState<'doctor' | 'nurse' | 'pharmacist' | 'lab' | 'reception' | 'admin'>('doctor');
  const [taskPriority, setTaskPriority] = useState<'urgent' | 'high' | 'normal' | 'routine'>('high');
  const [taskDue, setTaskDue] = useState('12:00');

  const triggerNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextState = !t.done;
        triggerNotice(nextState ? 'Task marked as completed.' : 'Task re-opened.');
        return { ...t, done: nextState };
      }
      return t;
    }));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTask: HospitalTaskItem = {
      id: `TSK-${Date.now().toString().slice(-4)}`,
      task: taskTitle.trim(),
      patient: taskPatient.trim() || undefined,
      role: taskRole,
      priority: taskPriority,
      due: taskDue,
      done: false,
    };

    setTasks([newTask, ...tasks]);
    setShowAddModal(false);
    setTaskTitle('');
    setTaskPatient('');
    triggerNotice('New clinical task added.');
  };

  const filteredTasks = tasks.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = t.task.toLowerCase().includes(q) || (t.patient && t.patient.toLowerCase().includes(q));
    if (!matchesSearch) return false;

    if (roleFilter !== 'all' && t.role !== roleFilter) return false;

    if (activeTab === 'pending') return !t.done;
    if (activeTab === 'urgent') return (t.priority === 'urgent' || t.priority === 'high') && !t.done;
    if (activeTab === 'completed') return t.done;
    return true;
  });

  const getPriorityBadge = (p: HospitalTaskItem['priority']) => {
    switch (p) {
      case 'urgent':
        return <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '0.7rem', fontWeight: 800 }}>URGENT</span>;
      case 'high':
        return <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.2)', color: '#F59E0B', fontSize: '0.7rem', fontWeight: 800 }}>HIGH</span>;
      default:
        return <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.2)', color: '#10B981', fontSize: '0.7rem', fontWeight: 800 }}>ROUTINE</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Toast Notice */}
      {notice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#0D223A', color: '#10B981', border: '1px solid #10B981',
          borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontWeight: 700, fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '18px 22px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={24} color="#1A6EB5" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Clinical Task & Worklist Board</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Role-specific workflow queues, medication administration (eMAR), lab orders & administrative sign-offs
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#1A6EB5', color: '#0A2540',
              border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search tasks or patient..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        {/* Role Cadre Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={15} color="#94A8BE" />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{
              background: '#0A1929', border: '1px solid #1E446B', color: '#0A2540',
              borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, outline: 'none'
            }}
          >
            <option value="all">All Cadres</option>
            <option value="doctor">Doctors</option>
            <option value="nurse">Nurses</option>
            <option value="pharmacist">Pharmacists</option>
            <option value="lab">Laboratory</option>
            <option value="reception">Reception / Front Desk</option>
            <option value="admin">Operations / Admin</option>
          </select>
        </div>

        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: `All (${tasks.length})` },
            { key: 'pending', label: `Pending (${tasks.filter(t => !t.done).length})` },
            { key: 'urgent', label: `Urgent (${tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && !t.done).length})` },
            { key: 'completed', label: `Completed (${tasks.filter(t => t.done).length})` },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? '#1A6EB5' : '#FFFFFF',
                color: activeTab === tab.key ? '#FFFFFF' : '#94A8BE',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredTasks.map(task => (
          <div
            key={task.id}
            onClick={() => handleToggleTask(task.id)}
            style={{
              background: '#132F4C', border: '1px solid #1E446B', borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              cursor: 'pointer', opacity: task.done ? 0.6 : 1, transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                border: task.done ? '2px solid #10B981' : '2px solid #94A8BE',
                background: task.done ? '#10B981' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0A2540', flexShrink: 0
              }}>
                {task.done && <Check size={16} />}
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem', fontWeight: 700, color: '#0A2540',
                  textDecoration: task.done ? 'line-through' : 'none'
                }}>
                  {task.task}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.75rem', color: '#94A8BE' }}>
                  {task.patient && <span style={{ color: '#0052D4', fontWeight: 600 }}>{task.patient}</span>}
                  {task.ward && <span>• {task.ward}</span>}
                  <span>• Due: {task.due}</span>
                  <span style={{ padding: '1px 6px', borderRadius: 4, background: '#E2E8F0', textTransform: 'capitalize' }}>
                    {task.role}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {getPriorityBadge(task.priority)}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleToggleTask(task.id);
                }}
                style={{
                  background: task.done ? 'rgba(16,185,129,0.2)' : '#1A6EB5',
                  color: task.done ? '#10B981' : '#FFFFFF',
                  border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {task.done ? 'Completed ✓' : 'Mark Done'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,25,41,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0D223A', border: '1px solid #1E446B', borderRadius: 16,
            width: '100%', maxWidth: 480, padding: 24, color: '#0A2540'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Create New Clinical Task</h2>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94A8BE', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>TASK DESCRIPTION</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Review fasting lipid profile & adjust statin"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PATIENT (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. Mrs. Amaka Okafor (FMW-12)"
                  value={taskPatient}
                  onChange={e => setTaskPatient(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>ASSIGNED CADRE</label>
                  <select
                    value={taskRole}
                    onChange={e => setTaskRole(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="lab">Laboratory</option>
                    <option value="reception">Reception</option>
                    <option value="admin">Operations</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PRIORITY</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="routine">Routine</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>DUE TIME</label>
                <input
                  type="text"
                  value={taskDue}
                  onChange={e => setTaskDue(e.target.value)}
                  placeholder="e.g. 14:00 or Now"
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: '#FFFFFF', border: '1px solid #1E446B', color: '#94A8BE', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none', color: '#0A2540', fontWeight: 700, cursor: 'pointer' }}
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
