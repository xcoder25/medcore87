'use client';

import React, { useState } from 'react';
import { HospitalAppointment, INITIAL_APPOINTMENTS } from '../../data/hospitalData';
import {
  Calendar, Clock, User, Plus, Search, CheckCircle2,
  AlertCircle, X, ChevronRight, Stethoscope, UserCheck
} from 'lucide-react';

interface AppointmentsManagerProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const AppointmentsManager: React.FC<AppointmentsManagerProps> = ({ onNavigate }) => {
  const [appointments, setAppointments] = useState<HospitalAppointment[]>(INITIAL_APPOINTMENTS);
  const [activeFilter, setActiveFilter] = useState<'all' | 'waiting' | 'in-progress' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBookModal, setShowBookModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // New appointment form state
  const [formName, setFormName] = useState('');
  const [formTime, setFormTime] = useState('11:30');
  const [formType, setFormType] = useState('Consultation');
  const [formNotes, setFormNotes] = useState('');

  const triggerNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleCheckIn = (aptId: string) => {
    setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: 'in-progress' } : a));
    triggerNotice('Patient checked in and marked In-Consultation.');
  };

  const handleComplete = (aptId: string) => {
    setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: 'completed' } : a));
    triggerNotice('Appointment marked as completed.');
  };

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newApt: HospitalAppointment = {
      id: `APT-${Date.now().toString().slice(-4)}`,
      time: formTime,
      patientId: null,
      name: formName.trim(),
      type: formType,
      status: 'upcoming',
      notes: formNotes || 'Standard clinic booking',
    };

    setAppointments([...appointments, newApt]);
    setShowBookModal(false);
    setFormName('');
    setFormNotes('');
    triggerNotice(`Appointment booked for ${formName} at ${formTime}.`);
  };

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.type.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    return a.status === activeFilter;
  });

  const getStatusBadge = (status: HospitalAppointment['status']) => {
    switch (status) {
      case 'waiting':
        return <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.2)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)' }}>WAITING</span>;
      case 'in-progress':
        return <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(56,189,248,0.2)', color: '#0052D4', border: '1px solid rgba(56,189,248,0.4)' }}>IN CLINIC</span>;
      case 'completed':
        return <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.4)' }}>COMPLETED</span>;
      case 'upcoming':
        return <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(148,163,184,0.15)', color: '#94A8BE' }}>UPCOMING</span>;
      default:
        return <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}>NO SHOW</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Toast Notice */}
      {notice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#0D223A', color: '#0052D4', border: '1px solid #1A6EB5',
          borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontWeight: 700, fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} color="#38BDF8" />
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
            <Calendar size={24} color="#00B4A6" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Clinic Appointments & Schedule</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Daily outpatient consultation clinic, review slots, specialist referrals & check-in management
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowBookModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#1A6EB5', color: '#0A2540',
              border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Plus size={16} /> Book Appointment
          </button>
        </div>
      </div>

      {/* Search and Tabs */}
      <div style={{
        background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search appointment by patient name or type..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: `All (${appointments.length})` },
            { key: 'waiting', label: `Waiting (${appointments.filter(a => a.status === 'waiting').length})` },
            { key: 'in-progress', label: `In Clinic (${appointments.filter(a => a.status === 'in-progress').length})` },
            { key: 'upcoming', label: `Upcoming (${appointments.filter(a => a.status === 'upcoming').length})` },
            { key: 'completed', label: `Completed (${appointments.filter(a => a.status === 'completed').length})` },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as any)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: activeFilter === tab.key ? '#1A6EB5' : '#FFFFFF',
                color: activeFilter === tab.key ? '#FFFFFF' : '#94A8BE',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredAppointments.length === 0 ? (
          <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94A8BE' }}>
            No appointments match this filter.
          </div>
        ) : (
          filteredAppointments.map(apt => (
            <div
              key={apt.id}
              style={{
                background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  padding: '8px 12px', borderRadius: 8, background: '#0A1929', border: '1px solid #1E446B',
                  textAlign: 'center', minWidth: 70
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A8BE', fontWeight: 700 }}>TIME</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0052D4', marginTop: 2 }}>{apt.time}</div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>{apt.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(26,110,181,0.25)', color: '#0052D4', fontSize: '0.72rem', fontWeight: 700 }}>
                      {apt.type}
                    </span>
                    {getStatusBadge(apt.status)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: 4 }}>
                    {apt.notes}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {apt.status === 'waiting' && (
                  <button
                    type="button"
                    onClick={() => handleCheckIn(apt.id)}
                    style={{
                      background: 'rgba(56,189,248,0.2)', border: '1px solid rgba(56,189,248,0.4)',
                      color: '#0052D4', padding: '7px 14px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <UserCheck size={14} /> Call In Patient
                  </button>
                )}

                {apt.status === 'in-progress' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('consultations', { patientId: apt.patientId })}
                      style={{
                        background: '#00B4A6', border: 'none',
                        color: '#0A2540', padding: '7px 14px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Stethoscope size={14} /> Open Consult
                    </button>
                    <button
                      type="button"
                      onClick={() => handleComplete(apt.id)}
                      style={{
                        background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
                        color: '#10B981', padding: '7px 14px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <CheckCircle2 size={14} /> Complete
                    </button>
                  </>
                )}

                {apt.status === 'upcoming' && (
                  <button
                    type="button"
                    onClick={() => handleCheckIn(apt.id)}
                    style={{
                      background: '#FFFFFF', border: '1px solid #1E446B',
                      color: '#0A2540', padding: '7px 14px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Mark Arrived
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,25,41,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0D223A', border: '1px solid #1E446B', borderRadius: 16,
            width: '100%', maxWidth: 480, padding: 24, color: '#0A2540'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Schedule Clinic Appointment</h2>
              <button type="button" onClick={() => setShowBookModal(false)} style={{ background: 'none', border: 'none', color: '#94A8BE', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PATIENT FULL NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Uche"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>TIME SLOT</label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>CLINIC TYPE</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option>Consultation</option>
                    <option>Follow-up</option>
                    <option>Review</option>
                    <option>New Patient</option>
                    <option>Specialist Referral</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>CLINICAL REASON / NOTES</label>
                <textarea
                  rows={3}
                  placeholder="Reason for consultation, relevant symptoms, previous visit reference..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: '#FFFFFF', border: '1px solid #1E446B', color: '#94A8BE', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none', color: '#0A2540', fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
