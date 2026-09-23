'use client';

import React, { useState } from 'react';
import { ReferralItem, INITIAL_REFERRALS } from '../../data/hospitalData';
import {
  Send, Plus, Search, Building2, AlertTriangle, CheckCircle2,
  Clock, X, ArrowUpRight, ArrowDownLeft, ShieldAlert
} from 'lucide-react';

interface ReferralsManagerProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const ReferralsManager: React.FC<ReferralsManagerProps> = ({ onNavigate }) => {
  const [referrals, setReferrals] = useState<ReferralItem[]>(INITIAL_REFERRALS);
  const [activeTab, setActiveTab] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // New referral form state
  const [formName, setFormName] = useState('');
  const [formMrn, setFormMrn] = useState('');
  const [formDirection, setFormDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [formFacility, setFormFacility] = useState('University of Uyo Teaching Hospital (UUTH)');
  const [formSpecialty, setFormSpecialty] = useState('Neurosurgery');
  const [formPriority, setFormPriority] = useState<'routine' | 'urgent' | 'emergency'>('urgent');
  const [formSummary, setFormSummary] = useState('');

  const triggerNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newRef: ReferralItem = {
      id: `REF-${Date.now().toString().slice(-4)}`,
      patientName: formName.trim(),
      mrn: formMrn || `MRN-26-${Math.floor(10000 + Math.random() * 90000)}`,
      direction: formDirection,
      referringFacility: formDirection === 'outbound' ? 'Ibom Specialist Hospital, Uyo' : formFacility,
      destinationFacility: formDirection === 'outbound' ? formFacility : 'Ibom Specialist Hospital, Uyo',
      specialty: formSpecialty,
      priority: formPriority,
      clinicalSummary: formSummary || 'Urgent specialist management transfer.',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    };

    setReferrals([newRef, ...referrals]);
    setShowModal(false);
    setFormName('');
    setFormSummary('');
    triggerNotice(`Referral for ${formName} submitted.`);
  };

  const handleUpdateStatus = (id: string, newStatus: ReferralItem['status']) => {
    setReferrals(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    triggerNotice(`Referral status updated to ${newStatus}.`);
  };

  const filteredReferrals = referrals.filter(r => {
    const q = searchQuery.toLowerCase();
    const match = r.patientName.toLowerCase().includes(q) || r.mrn.toLowerCase().includes(q) || r.specialty.toLowerCase().includes(q);
    if (!match) return false;
    if (activeTab === 'all') return true;
    return r.direction === activeTab;
  });

  const getPriorityBadge = (p: ReferralItem['priority']) => {
    switch (p) {
      case 'emergency':
        return <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '0.72rem', fontWeight: 800 }}>EMERGENCY STAT</span>;
      case 'urgent':
        return <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.2)', color: '#F59E0B', fontSize: '0.72rem', fontWeight: 800 }}>URGENT 24H</span>;
      default:
        return <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.2)', color: '#10B981', fontSize: '0.72rem', fontWeight: 800 }}>ROUTINE</span>;
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

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '18px 22px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Send size={24} color="#00B4A6" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Clinical Referral & Transfer Network</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Statewide tertiary referral coordination, inbound emergency reception & inter-hospital specialist transfers
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#1A6EB5', color: '#0A2540',
              border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Plus size={16} /> New Referral Request
          </button>
        </div>
      </div>

      {/* Tabs and Search */}
      <div style={{
        background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search by patient name, MRN, or specialty..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: `All Referrals (${referrals.length})` },
            { key: 'inbound', label: `Inbound (${referrals.filter(r => r.direction === 'inbound').length})` },
            { key: 'outbound', label: `Outbound (${referrals.filter(r => r.direction === 'outbound').length})` },
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

      {/* Referrals List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredReferrals.map(ref => (
          <div
            key={ref.id}
            style={{
              background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: ref.direction === 'inbound' ? 'rgba(0,180,166,0.2)' : 'rgba(26,110,181,0.2)',
                  color: ref.direction === 'inbound' ? '#00B4A6' : '#38BDF8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {ref.direction === 'inbound' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A2540' }}>{ref.patientName}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94A8BE', fontFamily: 'monospace' }}>{ref.mrn}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(26,110,181,0.25)', color: '#0052D4', fontSize: '0.72rem', fontWeight: 700 }}>
                      {ref.specialty}
                    </span>
                    {getPriorityBadge(ref.priority)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A8BE', marginTop: 4 }}>
                    From: <strong>{ref.referringFacility}</strong> → To: <strong>{ref.destinationFacility}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                  background: ref.status === 'accepted' ? 'rgba(16,185,129,0.2)' : ref.status === 'in-transit' ? 'rgba(56,189,248,0.2)' : 'rgba(245,158,11,0.2)',
                  color: ref.status === 'accepted' ? '#10B981' : ref.status === 'in-transit' ? '#38BDF8' : '#F59E0B'
                }}>
                  {ref.status.toUpperCase()}
                </span>
                {ref.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(ref.id, 'accepted')}
                    style={{ background: '#00B4A6', color: '#0A2540', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Accept Case
                  </button>
                )}
                {ref.status === 'accepted' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(ref.id, 'in-transit')}
                    style={{ background: '#1A6EB5', color: '#0A2540', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Dispatch EMS
                  </button>
                )}
              </div>
            </div>

            <div style={{
              background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8, padding: 12,
              fontSize: '0.82rem', color: '#334155', lineHeight: 1.5
            }}>
              <strong style={{ color: '#0052D4' }}>Clinical Transfer Summary: </strong>
              {ref.clinicalSummary}
            </div>
          </div>
        ))}
      </div>

      {/* New Referral Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,25,41,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0D223A', border: '1px solid #1E446B', borderRadius: 16,
            width: '100%', maxWidth: 500, padding: 24, color: '#0A2540'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Create Referral Transfer Order</h2>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94A8BE', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PATIENT FULL NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Kufre Akpan"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>DIRECTION</label>
                  <select
                    value={formDirection}
                    onChange={e => setFormDirection(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option value="outbound">Outbound (Transfer Out)</option>
                    <option value="inbound">Inbound (Receiving)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PRIORITY</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option value="emergency">Emergency Stat</option>
                    <option value="urgent">Urgent 24h</option>
                    <option value="routine">Routine</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>TARGET / REFERRING HOSPITAL</label>
                <select
                  value={formFacility}
                  onChange={e => setFormFacility(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                >
                  <option>University of Uyo Teaching Hospital (UUTH)</option>
                  <option>Immanuel General Hospital, Eket</option>
                  <option>General Hospital, Ikot Ekpene</option>
                  <option>National Hospital, Abuja</option>
                  <option>Cottage Hospital, Asong</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>CLINICAL SUMMARY & INDICATION</label>
                <textarea
                  rows={4}
                  required
                  placeholder="State primary clinical indication, vital signs at handover, diagnosis and reasons for tertiary transfer..."
                  value={formSummary}
                  onChange={e => setFormSummary(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: '#FFFFFF', border: '1px solid #1E446B', color: '#94A8BE', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none', color: '#0A2540', fontWeight: 700, cursor: 'pointer' }}
                >
                  Authorize Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
