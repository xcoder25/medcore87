'use client';

import React, { useState } from 'react';
import {
  FileText, Search, ZoomIn, ZoomOut, RotateCw, Contrast,
  Layers, CheckCircle2, ShieldAlert, Eye, User, Calendar,
  Plus, X, Edit3, Send
} from 'lucide-react';
import type { RadiologyStudy } from '@medcore/types';

const INITIAL_STUDIES: RadiologyStudy[] = [];

export const RadiologyPacsSuite: React.FC = () => {
  const [studies, setStudies] = useState<RadiologyStudy[]>(INITIAL_STUDIES);
  const [selectedId, setSelectedId] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [windowPreset, setWindowPreset] = useState<'lung' | 'bone' | 'soft_tissue'>('lung');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Modal States
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // New Order Form
  const [newPatient, setNewPatient] = useState('');
  const [newModality, setNewModality] = useState<'XR' | 'CT' | 'MRI' | 'US'>('XR');
  const [newBodyPart, setNewBodyPart] = useState('Chest PA View');
  const [newReason, setNewReason] = useState('');

  // Report Form
  const [reportFindings, setReportFindings] = useState('');

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const selectedStudy = studies.find(s => s.id === selectedId) || studies[0];

  const handleSignReport = (id: string, findingsText?: string) => {
    const finalFindings = findingsText || selectedStudy.findings || 'Normal radiological examination. No focal acute pathology.';
    setStudies(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          status: 'reported' as const,
          radiologist: 'Dr. Bassey Ntuen (Consultant Radiologist)',
          findings: finalFindings,
        };
      }
      return s;
    }));
    showNotification(`Radiology report for ${selectedStudy.patientName} signed & dispatched to EHR.`);
  };

  const handleSaveReportForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportFindings.trim()) return;
    handleSignReport(selectedStudy.id, reportFindings.trim());
    setShowReportModal(false);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.trim() || !newReason.trim()) return;

    const nextId = `RAD-2026-0${95 + studies.length}`;
    const newStudy: RadiologyStudy = {
      id: nextId,
      patientId: `PAT-AK-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName: newPatient.trim(),
      modality: newModality,
      bodyPart: newBodyPart,
      reason: newReason.trim(),
      status: 'acquired',
      orderedAt: 'Just Now',
      radiologist: 'Pending Radiologist Reading',
      findings: 'Study acquired. Awaiting radiologist interpretation.',
    };

    setStudies([newStudy, ...studies]);
    setSelectedId(newStudy.id);
    setShowOrderModal(false);
    setNewPatient('');
    setNewReason('');
    showNotification(`Radiology scan ${nextId} ordered for ${newStudy.patientName}!`);
  };

  const filteredStudies = studies.filter(s => {
    if (search && !s.patientName.toLowerCase().includes(search.toLowerCase()) && !s.bodyPart.toLowerCase().includes(search.toLowerCase()) && !s.id.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 99999, background: '#0F2236',
          border: '1px solid #10B981', borderRadius: 10, padding: '14px 20px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          gap: 12, color: '#F1F5F9', fontSize: '0.88rem', fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>PACS Modalities Online</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>5 / 5</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>DICOM 3.0 Ready</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>CT 64-Slice, MRI 1.5T, Digital X-Ray, US 1 & 2</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Radiologist Reports</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>
              {studies.filter(s => s.status !== 'reported').length} Pending
            </span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>STAT Protocol</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Avg Radiologist Turnaround: 22m</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Storage & Archive</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>14.8 TB</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>RAID 6 Secure</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Lossless Compression • 100% Retained</span>
        </div>
      </div>

      {/* PACS Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Left Column: Studies List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
              PACS DICOM Studies
            </span>
            <button
              type="button"
              className="os-action-btn-primary"
              onClick={() => setShowOrderModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 14px' }}
            >
              <Plus size={14} /> Order Scan
            </button>
          </div>

          <div className="os-search-wrap">
            <Search size={14} />
            <input
              className="os-search-input"
              placeholder="Search patient, modality, body part..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredStudies.map(s => {
              const isSelected = s.id === selectedId;
              return (
                <div
                  key={s.id}
                  className="os-card"
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--ak-orange)' : undefined,
                    background: isSelected ? 'rgba(234,88,12,0.08)' : undefined,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: '#0D4F8B', color: '#FFF',
                      }}>
                        {s.modality}
                      </span>
                      <span style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem' }}>{s.patientName}</span>
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: s.status === 'reported' ? 'rgba(5,150,105,0.1)' : 'rgba(234,88,12,0.15)',
                      color: s.status === 'reported' ? '#059669' : '#D97706',
                    }}>
                      {s.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#D97706', marginBottom: 2 }}>
                    {s.bodyPart}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginBottom: 6 }}>
                    {s.reason}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
                    <span>{s.id}</span>
                    <span>{s.orderedAt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: DICOM Viewport & Findings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* DICOM Viewer Box */}
          <div className="os-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #1E293B', background: '#020617' }}>
            {/* Viewport Toolbar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', background: '#0F172A', borderBottom: '1px solid #1E293B', flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8' }}>
                  {selectedStudy.modality}: {selectedStudy.bodyPart}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>• {selectedStudy.id}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#CBD5E1' }}
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                >
                  <ZoomOut size={12} />
                </button>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', minWidth: 36, textAlign: 'center' }}>
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#CBD5E1' }}
                  onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
                >
                  <ZoomIn size={12} />
                </button>
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#CBD5E1' }}
                  onClick={() => setZoomLevel(100)}
                >
                  <RotateCw size={12} /> Reset
                </button>
                <div style={{ width: 1, height: 16, background: '#334155', margin: '0 4px' }} />
                {(['lung', 'bone', 'soft_tissue'] as const).map(w => (
                  <button
                    key={w}
                    type="button"
                    className="os-ghost-btn"
                    onClick={() => setWindowPreset(w)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.68rem',
                      background: windowPreset === w ? 'rgba(234,88,12,0.25)' : undefined,
                      borderColor: windowPreset === w ? '#EA580C' : undefined,
                      color: windowPreset === w ? '#FB923C' : '#94A3B8',
                    }}
                  >
                    {w.toUpperCase().replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewport Canvas Simulation */}
            <div style={{
              height: 360,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'radial-gradient(circle at center, #0F172A 0%, #020617 100%)',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 12, left: 16, fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                <div>PATIENT: {selectedStudy.patientName}</div>
                <div>ID: {selectedStudy.patientId}</div>
                <div>STUDY: {selectedStudy.id}</div>
                <div>W: {windowPreset === 'lung' ? '1500 L: -600' : windowPreset === 'bone' ? '2000 L: 500' : '400 L: 40'}</div>
              </div>

              <div style={{ position: 'absolute', top: 12, right: 16, fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace', textAlign: 'right' }}>
                <div>IBOM SPECIALIST HOSPITAL PACS</div>
                <div>KV: 120 • MA: 250</div>
                <div>SLICE: 1.25mm</div>
                <div>R</div>
              </div>

              <div style={{
                transform: `scale(${zoomLevel / 100})`,
                transition: 'transform 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 140,
                  height: 140,
                  borderRadius: 12,
                  border: '2px solid rgba(59,130,246,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(59,130,246,0.1)',
                  boxShadow: '0 0 40px rgba(59,130,246,0.1)',
                }}>
                  <Layers size={50} style={{ color: '#60A5FA', opacity: 0.8 }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>
                  [DICOM High-Res Series: 124 Slices Loaded]
                </span>
              </div>
            </div>
          </div>

          {/* Radiologist Formal Findings & Report Card */}
          <div className="os-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--os-text-dim)', textTransform: 'uppercase' }}>
                Radiological Interpretation & Formal Report
              </span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: selectedStudy.status === 'reported' ? 'rgba(5,150,105,0.12)' : 'rgba(234,88,12,0.15)',
                color: selectedStudy.status === 'reported' ? '#059669' : '#D97706',
              }}>
                {selectedStudy.status.toUpperCase()}
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--os-text-muted)', marginBottom: 8 }}>
              Reporting Radiologist: <strong style={{ color: '#0A2540' }}>{selectedStudy.radiologist || 'Attending Radiologist On-Call'}</strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.88rem', color: '#0A2540', lineHeight: 1.6 }}>
              {selectedStudy.findings || 'Awaiting image reading by radiologist...'}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => {
                  setReportFindings(selectedStudy.findings || '');
                  setShowReportModal(true);
                }}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit3 size={14} /> Write / Edit Findings
              </button>
              <button
                type="button"
                className="os-action-btn-primary"
                onClick={() => handleSignReport(selectedStudy.id)}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircle2 size={14} /> Electronically Sign & Dispatch Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Order Scan */}
      {showOrderModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 460, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Order Radiology / PACS Imaging Study
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowOrderModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mfoniso Akpabio"
                  value={newPatient}
                  onChange={e => setNewPatient(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Modality *
                  </label>
                  <select
                    value={newModality}
                    onChange={e => setNewModality(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                  >
                    <option value="XR">Digital X-Ray (XR)</option>
                    <option value="CT">Computed Tomography (CT)</option>
                    <option value="MRI">Magnetic Resonance (MRI)</option>
                    <option value="US">Ultrasound Sonography (US)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Anatomical Region / View *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chest PA, Brain NC, Pelvis"
                    value={newBodyPart}
                    onChange={e => setNewBodyPart(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Clinical Indication / Reason for Scan *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Rule out intracranial bleed post head injury..."
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowOrderModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Submit to Modality Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Findings */}
      {showReportModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 520, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Radiologist Interpretation & Findings
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowReportModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveReportForm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                Study: <strong style={{ color: '#0A2540' }}>{selectedStudy.modality} - {selectedStudy.bodyPart}</strong> • Patient: <strong>{selectedStudy.patientName}</strong>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Detailed Diagnostic Findings & Impression *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Enter radiologist impression, anatomical findings, measurements and recommendation..."
                  value={reportFindings}
                  onChange={e => setReportFindings(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Sign & Save Findings</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
