'use client';

import React, { useState } from 'react';
import { UserSession } from '../auth/AuthScreen';
import {
  Settings, User, ShieldCheck, Bell, Lock, Key,
  CheckCircle2, Building2, Save
} from 'lucide-react';

interface SettingsHubProps {
  session?: UserSession | null;
  onNavigate?: (module: string, param?: any) => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({ session, onNavigate }) => {
  const [savedNotice, setSavedNotice] = useState(false);
  const [sigPin, setSigPin] = useState('****');
  const [criticalSmsAlerts, setCriticalSmsAlerts] = useState(true);
  const [autoSaveNotes, setAutoSaveNotes] = useState(true);
  const [emlAutoPrompt, setEmlAutoPrompt] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540', maxWidth: 900 }}>
      {/* Toast Notice */}
      {savedNotice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#0D223A', color: '#10B981', border: '1px solid #10B981',
          borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontWeight: 700, fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>Clinical workspace preferences saved successfully.</span>
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
            <Settings size={24} color="#1A6EB5" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Clinical Settings & Preferences</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Clinician credentials, electronic signature authorization & automated decision support controls
          </p>
        </div>
      </div>

      {/* Staff Identity Card */}
      <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0052D4', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={16} /> Clinician Profile & Hospital Credential
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A8BE' }}>FULL NAME & TITLE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 3 }}>{session?.name || 'Dr. Adewale Bello'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A8BE' }}>OFFICIAL ROLE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 3 }}>{session?.role || 'Consultant Physician'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A8BE' }}>SECURITY CLEARANCE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10B981', marginTop: 3 }}>
              {session?.clearanceLabel || 'L4 Senior Clinical'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A8BE' }}>HEALTH FACILITY</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 3 }}>
              {session?.facility || 'Ibom Specialist Hospital, Uyo'}
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Workspace Preferences Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#00B4A6', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} /> Electronic Clinical Signature & Security
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #FFFFFF' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Auto-Prompt AKS-EML Formulary</div>
                <div style={{ fontSize: '0.75rem', color: '#94A8BE' }}>Show recommended dosing and AWaRe classification when typing medication names</div>
              </div>
              <input
                type="checkbox"
                checked={emlAutoPrompt}
                onChange={e => setEmlAutoPrompt(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #FFFFFF' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Critical Laboratory Value SMS Escalation</div>
                <div style={{ fontSize: '0.75rem', color: '#94A8BE' }}>Send high-priority SMS notifications when a patient under your care triggers a panic lab value</div>
              </div>
              <input
                type="checkbox"
                checked={criticalSmsAlerts}
                onChange={e => setCriticalSmsAlerts(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Auto-Save Draft Notes</div>
                <div style={{ fontSize: '0.75rem', color: '#94A8BE' }}>Automatically save SOAP note drafts every 30 seconds to prevent accidental loss</div>
              </div>
              <input
                type="checkbox"
                checked={autoSaveNotes}
                onChange={e => setAutoSaveNotes(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none',
              color: '#0A2540', padding: '11px 24px', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Save size={16} /> Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
