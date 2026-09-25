'use client';

import React, { useState } from 'react';
import { RadiologyStudy, INITIAL_RADIOLOGY } from '../../data/hospitalData';
import {
  Layers, ZoomIn, ZoomOut, RotateCw, Contrast, Maximize2,
  CheckCircle2, FileText, Check, ShieldCheck, Eye, Sparkles
} from 'lucide-react';

interface RadiologyPacsManagerProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const RadiologyPacsManager: React.FC<RadiologyPacsManagerProps> = ({ onNavigate }) => {
  const [studies, setStudies] = useState<RadiologyStudy[]>(INITIAL_RADIOLOGY);
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(false);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [reportImpression, setReportImpression] = useState('');
  const [reportSaved, setReportSaved] = useState(false);

  const currentStudy = studies.find(s => s.id === selectedStudyId) || studies[0];

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleToggleInvert = () => setInvert(i => !i);
  const handleReset = () => {
    setZoom(1);
    setInvert(false);
    setContrast(100);
    setRotation(0);
  };

  const handleSignReport = () => {
    setStudies(prev => prev.map(s => s.id === currentStudy.id ? { ...s, status: 'reported', impression: reportImpression || s.impression } : s));
    setReportSaved(true);
    setTimeout(() => setReportSaved(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Toast Notice */}
      {reportSaved && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#0D223A', color: '#10B981', border: '1px solid #10B981',
          borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontWeight: 700, fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>Radiology report signed and transmitted to Hospital EMR.</span>
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
            <Layers size={24} color="#38BDF8" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Radiology PACS & DICOM Diagnostic Station</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Multi-modality imaging archive (X-Ray, CT, MRI, Ultrasound) with interactive DICOM viewer & reporting
          </p>
        </div>
      </div>

      {/* Main Workspace: Left Study Worklist, Middle PACS Viewer, Right Radiologist Report */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: 16 }}>
        {/* Left: Study Worklist */}
        <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0052D4', textTransform: 'uppercase' }}>
            Diagnostic Studies Queue
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 600 }}>
            {studies.map(study => {
              const isSelected = study.id === currentStudy.id;
              return (
                <div
                  key={study.id}
                  onClick={() => {
                    setSelectedStudyId(study.id);
                    setReportImpression(study.impression || '');
                    handleReset();
                  }}
                  style={{
                    background: isSelected ? 'rgba(26,110,181,0.3)' : '#0D223A',
                    border: isSelected ? '1px solid #1A6EB5' : '1px solid #1E446B',
                    borderRadius: 8, padding: 12, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ padding: '2px 6px', background: '#1A6EB5', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                      {study.modality}
                    </span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: study.status === 'reported' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                      color: study.status === 'reported' ? '#10B981' : '#F59E0B'
                    }}>
                      {study.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0A2540' }}>{study.patientName}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A8BE', marginTop: 2 }}>{study.bodyPart}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 4 }}>{study.studyDate} • {study.mrn}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Interactive DICOM Viewer */}
        <div style={{ background: '#0A1929', border: '1px solid #1E446B', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{
            background: '#0D223A', padding: '10px 16px', borderBottom: '1px solid #1E446B',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#0052D4', fontWeight: 700 }}>
              <span>{currentStudy.modality} — {currentStudy.bodyPart}</span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                style={{ background: '#132F4C', border: '1px solid #1E446B', color: '#0A2540', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                style={{ background: '#132F4C', border: '1px solid #1E446B', color: '#0A2540', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90°"
                style={{ background: '#132F4C', border: '1px solid #1E446B', color: '#0A2540', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                <RotateCw size={14} />
              </button>
              <button
                type="button"
                onClick={handleToggleInvert}
                title="Invert Window (Negative/Positive)"
                style={{ background: invert ? '#1A6EB5' : '#132F4C', border: '1px solid #1E446B', color: '#0A2540', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                <Contrast size={14} />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset View"
                style={{ background: '#132F4C', border: '1px solid #1E446B', color: '#94A8BE', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Viewport Canvas Simulation */}
          <div style={{
            flex: 1, minHeight: 440, display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden', background: '#050B14'
          }}>
            {/* DICOM HUD Overlay */}
            <div style={{ position: 'absolute', top: 12, left: 14, fontSize: '0.72rem', color: '#0052D4', fontFamily: 'monospace', zIndex: 10, lineHeight: 1.4 }}>
              <div>PATIENT: {currentStudy.patientName}</div>
              <div>MRN: {currentStudy.mrn}</div>
              <div>STUDY DATE: {currentStudy.studyDate}</div>
              <div>ZOOM: {Math.round(zoom * 100)}% | ROT: {rotation}°</div>
            </div>

            <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: '0.72rem', color: '#0052D4', fontFamily: 'monospace', zIndex: 10, textAlign: 'right', lineHeight: 1.4 }}>
              <div>MODALITY: {currentStudy.modality}</div>
              <div>WINDOW: L: 40 W: 400</div>
              <div>HL7 / DICOM 3.0</div>
            </div>

            {/* Diagnostic Image Display */}
            <div
              style={{
                width: 320, height: 320,
                borderRadius: currentStudy.modality === 'CT' || currentStudy.modality === 'MRI' ? '50%' : 12,
                border: '2px solid rgba(56,189,248,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                filter: `${invert ? 'invert(1)' : 'none'} contrast(${contrast}%)`,
                transition: 'transform 0.15s ease, filter 0.15s ease',
                background: currentStudy.modality === 'XR'
                  ? 'radial-gradient(ellipse at center, rgba(148,163,184,0.4) 0%, rgba(15,23,42,0.95) 75%)'
                  : 'radial-gradient(circle at center, rgba(203,213,225,0.45) 0%, rgba(30,41,59,0.85) 60%, #000 100%)',
                boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                position: 'relative'
              }}
            >
              {/* Internal Anatomical Simulation Markings */}
              <div style={{ opacity: 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Layers size={64} color="#38BDF8" />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0A2540', letterSpacing: '0.05em' }}>
                  {currentStudy.bodyPart.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94A8BE' }}>Diagnostic Quality Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Radiologist Findings & Impression */}
        <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#00B4A6', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={16} /> Radiologist Official Report
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>RADIOLOGIC FINDINGS</div>
            <div style={{
              background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8, padding: 12,
              fontSize: '0.8rem', color: '#334155', lineHeight: 1.5, minHeight: 100
            }}>
              {currentStudy.findings || 'Pending detailed radiological analysis.'}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0052D4', marginBottom: 4 }}>DIAGNOSTIC IMPRESSION & CONCLUSION</div>
            <textarea
              rows={6}
              value={reportImpression || currentStudy.impression || ''}
              onChange={e => setReportImpression(e.target.value)}
              placeholder="Type formal radiologist impression, conclusion, or critical findings notification..."
              style={{
                width: '100%', flex: 1, background: '#0D223A', border: '1px solid #1E446B',
                borderRadius: 8, padding: 12, color: '#0A2540', fontSize: '0.82rem', lineHeight: 1.5, outline: 'none'
              }}
            />
          </div>

          <div style={{ paddingTop: 8, borderTop: '1px solid #FFFFFF' }}>
            <div style={{ fontSize: '0.7rem', color: '#94A8BE', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={14} color="#10B981" />
              <span>Signed by Consultant Radiologist</span>
            </div>
            <button
              type="button"
              onClick={handleSignReport}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none',
                color: '#0A2540', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Check size={16} /> Authorize & Sign Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
