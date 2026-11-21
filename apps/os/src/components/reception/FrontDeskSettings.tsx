'use client';

/**
 * Front Desk operational settings — workflow, queue, intake & printable forms, Health Card AI auto-bind, notifications, hardware, desk.
 */
import React, { useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  getReceptionSettings,
  setReceptionSettings,
  subscribeReceptionSettings,
  defaultReceptionSettings,
  CHECK_IN_FIELD_OPTIONS,
  FORM_OPTIONS,
  type ReceptionSettings,
  type StatusStyle,
} from '../../lib/receptionSettingsStore';
import { getAdminSettings } from '../../lib/adminSettingsStore';
import { printBlankPatientRegForm } from '../../lib/printableRegistrationForm';
import { emitLiveAction } from '../../lib/liveActions';
import {
  Settings, Calendar, FileText, Bell, Printer, Users,
  Save, Loader2, CheckCircle2, RotateCcw, Palette, Sparkles, CreditCard,
} from 'lucide-react';

type Tab = 'workflow' | 'queue' | 'registration' | 'card_ai' | 'notifications' | 'hardware' | 'desk';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'workflow', label: 'Workflow & status', icon: Palette },
  { id: 'queue', label: 'Appointments & queue', icon: Calendar },
  { id: 'registration', label: 'Registration & printable form', icon: FileText },
  { id: 'card_ai', label: 'Health Card AI bind', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'hardware', label: 'Printers & scanners', icon: Printer },
  { id: 'desk', label: 'Staff & desk', icon: Users },
];

const C = { navy: '#0F172A', muted: '#64748B', border: '#E2E8F0', blue: '#0284C7', teal: '#0D9488' };

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%',
      textAlign: 'left', padding: '12px 14px', borderRadius: 12,
      border: `1px solid ${on ? 'rgba(2,132,199,0.35)' : C.border}`, background: on ? '#F0F9FF' : '#fff', cursor: 'pointer',
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{hint}</div>}
      </div>
      <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? C.blue : '#CBD5E1', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>{label}</span>
      <div style={{ marginTop: 6 }}>{children}</div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
  fontSize: 14, fontWeight: 600, color: C.navy, boxSizing: 'border-box',
};

export const FrontDeskSettings: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'DEFAULT';
  const [tab, setTab] = useState<Tab>('workflow');
  const [draft, setDraft] = useState<ReceptionSettings>(() => getReceptionSettings(facilityId));
  const [savedAt, setSavedAt] = useState(draft.updatedAt);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [formCopies, setFormCopies] = useState<number>(1);
  const [printStatus, setPrintStatus] = useState<string>('');

  useEffect(() => {
    const s = getReceptionSettings(facilityId);
    setDraft(s);
    setSavedAt(s.updatedAt);
    return subscribeReceptionSettings((next) => { setDraft(next); setSavedAt(next.updatedAt); });
  }, [facilityId]);

  const savedSnap = JSON.stringify({ ...getReceptionSettings(facilityId), updatedAt: '' });
  const dirty = JSON.stringify({ ...draft, updatedAt: '' }) !== savedSnap;

  const patch = (partial: Partial<ReceptionSettings>) => setDraft((d) => ({ ...d, ...partial }));
  const updateStatus = (id: string, partial: Partial<StatusStyle>) => {
    setDraft((d) => ({ ...d, statuses: d.statuses.map((s) => (s.id === id ? { ...s, ...partial } : s)) }));
  };
  const toggleList = (key: 'checkInRequiredFields' | 'requiredForms', id: string) => {
    setDraft((d) => {
      const list = [...(d[key] || [])];
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1); else list.push(id);
      return { ...d, [key]: list };
    });
  };

  const handlePrintBlankForm = () => {
    const admin = getAdminSettings(facilityId);
    const ok = printBlankPatientRegForm({
      facilityName: admin.displayName || session?.facility || 'MedCore Hospital Facility',
      facilityId: admin.facilityId || facilityId,
      hfrCode: admin.hfrCode,
      facilityPhone: admin.phone || admin.emergencyPhone,
      facilityAddress: [admin.ward, admin.lga].filter(Boolean).join(', '),
      logoUrl: admin.logoUrl,
      copies: formCopies,
      includeConsentBlock: draft.printableFormIncludeConsent !== false,
    });
    setPrintStatus(ok ? `Opened printable A4 form (${formCopies} ${formCopies === 1 ? 'copy' : 'copies'})` : 'Enable popups or retry printing.');
    if (ok) emitLiveAction(`Printed ${formCopies} blank AI-scannable registration form(s)`, { module: 'desk-settings' });
    window.setTimeout(() => setPrintStatus(''), 3500);
  };

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 320));
    const next = setReceptionSettings({ ...draft, facilityId });
    setDraft(next);
    setSavedAt(next.updatedAt);
    emitLiveAction('Front desk settings saved', { module: 'desk-settings' });
    setSaving(false);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, paddingBottom: 96 }}>
      {/* Clean, low-noise header card (Hick's Law — Billing & POS cleanly owned by Accounts) */}
      <div style={{ borderRadius: 18, padding: '18px 22px', background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 4px 18px rgba(15,23,42,0.04)', display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', color: C.blue, textTransform: 'uppercase' }}>
            <Settings size={13} /> Front Desk Operations Settings
          </div>
          <h1 style={{ margin: '4px 0 2px', fontSize: '1.3rem', fontWeight: 800, color: C.navy }}>
            Intake, Printable Forms &amp; Station Rules
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {session?.facility || 'Hospital'} · Status colours, appointment check-in rules, printable AI intake forms, and printer configuration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(defaultReceptionSettings(facilityId))}
          style={{ color: C.navy, border: `1px solid ${C.border}`, background: '#F8FAFC', borderRadius: 10, padding: '8px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}
        >
          <RotateCcw size={14} /> Reset defaults
        </button>
      </div>

      {/* Single clean category segmented rail */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 6, background: '#F8FAFC', borderRadius: 14, border: `1px solid ${C.border}` }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 13px',
                borderRadius: 10,
                border: `1px solid ${on ? '#BAE6FD' : 'transparent'}`,
                background: on ? '#fff' : 'transparent',
                color: on ? C.blue : C.muted,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                boxShadow: on ? '0 2px 6px rgba(15,23,42,0.06)' : 'none',
              }}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`, padding: 20, boxShadow: '0 6px 24px rgba(15,23,42,0.04)' }}>
        {tab === 'workflow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15.5, color: C.navy }}>Patient flow statuses &amp; wait alerts</h3>
            {draft.statuses.slice().sort((a, b) => a.order - b.order).map((s) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: s.enabled ? s.bg : '#F8FAFC' }}>
                <div>
                  <input value={s.label} onChange={(e) => updateStatus(s.id, { label: e.target.value })} style={{ ...inputStyle, background: 'transparent', border: 'none', fontWeight: 800, padding: 0 }} />
                  <div style={{ fontSize: 11, color: C.muted }}>{s.id}</div>
                </div>
                <input type="color" value={s.bg} onChange={(e) => updateStatus(s.id, { bg: e.target.value })} title="Background" />
                <input type="color" value={s.text} onChange={(e) => updateStatus(s.id, { text: e.target.value })} title="Text" />
                <button type="button" onClick={() => updateStatus(s.id, { enabled: !s.enabled })} style={{ fontSize: 11, fontWeight: 800, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: s.enabled ? '#0D9488' : '#CBD5E1', color: s.enabled ? '#fff' : C.navy }}>{s.enabled ? 'On' : 'Off'}</button>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="TARGET WAIT (MIN)"><input type="number" value={draft.waitTargetMinutes} onChange={(e) => patch({ waitTargetMinutes: Number(e.target.value) || 20 })} style={inputStyle} /></Field>
              <Field label="ESCALATE AFTER (MIN)"><input type="number" value={draft.waitAlertEscalateMinutes} onChange={(e) => patch({ waitAlertEscalateMinutes: Number(e.target.value) || 30 })} style={inputStyle} /></Field>
              <Toggle on={draft.waitAlertEnabled} onChange={(v) => patch({ waitAlertEnabled: v })} label="Wait-time alerts" hint="Flag over-target waits" />
            </div>
          </div>
        )}

        {tab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15.5, color: C.navy }}>Check-in defaults &amp; arrival rules</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
              {CHECK_IN_FIELD_OPTIONS.map((f) => {
                const on = draft.checkInRequiredFields.includes(f.id);
                return (
                  <button key={f.id} type="button" onClick={() => toggleList('checkInRequiredFields', f.id)} style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${on ? C.blue : C.border}`, background: on ? '#E0F2FE' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    {on ? '✓ ' : ''}{f.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="EARLY ARRIVAL (MIN)"><input type="number" value={draft.earlyArrivalMinutes} onChange={(e) => patch({ earlyArrivalMinutes: Number(e.target.value) || 0 })} style={inputStyle} /></Field>
              <Field label="LATE AFTER (MIN)"><input type="number" value={draft.lateArrivalMinutes} onChange={(e) => patch({ lateArrivalMinutes: Number(e.target.value) || 15 })} style={inputStyle} /></Field>
              <Toggle on={draft.autoMarkLate} onChange={(v) => patch({ autoMarkLate: v })} label="Auto-mark Late" />
            </div>
            <Toggle on={draft.walkInQueueEnabled} onChange={(v) => patch({ walkInQueueEnabled: v })} label="Walk-in / urgent care queue" />
            <Field label="WALK-IN TRIAGE PRIORITIES"><input value={draft.walkInTriagePriorities.join(', ')} onChange={(e) => patch({ walkInTriagePriorities: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} style={inputStyle} /></Field>
          </div>
        )}

        {tab === 'registration' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Printable Blank Paper Form Card for AI Scanner */}
            <div style={{ borderRadius: 14, padding: 16, border: '1px solid #BAE6FD', background: '#F0F9FF', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ flex: '1 1 320px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Printer size={13} /> Paper Backup &amp; AI Form Scanning
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginTop: 4 }}>
                  Print Blank Patient Registration Form (A4)
                </div>
                <div style={{ fontSize: 12.5, color: '#334155', marginTop: 4, lineHeight: 1.45 }}>
                  Print clean paper intake sheets with corner camera alignment guides matching MedCore&apos;s{' '}
                  <strong>AI Paper Form Scanner</strong> (Name, DOB, Sex, NIN, NHIA, Allergies, Next of Kin, NDPR Signature) so completed forms auto-fill patient registration in seconds.
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.navy, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Copies:
                  <select
                    value={formCopies}
                    onChange={(e) => setFormCopies(Number(e.target.value) || 1)}
                    style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700 }}
                  >
                    <option value={1}>1 sheet</option>
                    <option value={5}>5 sheets</option>
                    <option value={10}>10 sheets</option>
                    <option value={25}>25 sheets</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handlePrintBlankForm}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0052D4 0%, #0D9488 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2,132,199,0.22)',
                  }}
                >
                  <Printer size={15} /> Print Blank Registration Form
                </button>
              </div>
              {printStatus && (
                <div style={{ width: '100%', fontSize: 12, fontWeight: 700, color: '#047857' }}>
                  {printStatus}
                </div>
              )}
            </div>

            <Toggle
              on={draft.printableFormIncludeConsent !== false}
              onChange={(v) => patch({ printableFormIncludeConsent: v })}
              label="Include NDPR patient privacy & consent signature section on printed form"
              hint="Recommended for paper-first triage or walk-in clipboard intake"
            />

            <h3 style={{ margin: '4px 0 0', fontSize: 15.5, color: C.navy }}>Digital intake &amp; scanning</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <Toggle on={draft.kioskSelfCheckIn} onChange={(v) => patch({ kioskSelfCheckIn: v })} label="Self-check-in kiosk" />
              <Toggle on={draft.tabletMode} onChange={(v) => patch({ tabletMode: v })} label="Tablet intake mode" />
              <Toggle on={draft.qrCheckIn} onChange={(v) => patch({ qrCheckIn: v })} label="QR code check-in" />
              <Toggle on={draft.mandatoryPhoto} onChange={(v) => patch({ mandatoryPhoto: v })} label="Mandatory photo" />
              <Toggle on={draft.scanDriversLicense} onChange={(v) => patch({ scanDriversLicense: v })} label="Scan driver's license" />
              <Toggle on={draft.scanInsuranceFront} onChange={(v) => patch({ scanInsuranceFront: v })} label="Scan insurance front" />
              <Toggle on={draft.scanInsuranceBack} onChange={(v) => patch({ scanInsuranceBack: v })} label="Scan insurance back" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
              {FORM_OPTIONS.map((f) => {
                const on = draft.requiredForms.includes(f.id);
                return (
                  <button key={f.id} type="button" onClick={() => toggleList('requiredForms', f.id)} style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${on ? C.blue : C.border}`, background: on ? '#E0F2FE' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    {on ? '✓ ' : ''}{f.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'card_ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CreditCard size={18} color={C.teal} />
              <h3 style={{ margin: 0, fontSize: 15.5, color: C.navy }}>Digital Health Card AI Auto-Binding</h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              When doctors or front desk schedule an appointment or start a visit, MedCore automatically binds that encounter to the patient&apos;s Digital Health Card so scanning the card confirms and checks in appointments immediately.
            </p>
            <Toggle
              on={draft.autoBindAppointmentsToHealthCard !== false}
              onChange={(v) => patch({ autoBindAppointmentsToHealthCard: v })}
              label="Auto-bind Doctor & Reception appointments to Digital Health Card"
              hint="New bookings immediately link to the patient SHID & QR pass for instant arrival confirmation"
            />
            <Toggle
              on={draft.autoBindVisitsToHealthCard !== false}
              onChange={(v) => patch({ autoBindVisitsToHealthCard: v })}
              label="Auto-bind live OPD & inpatient visits to Health Card"
              hint="Displays live queue status and recent clinic encounters when scanned"
            />
            <Toggle
              on={draft.aiCareBriefOnCardScan !== false}
              onChange={(v) => patch({ aiCareBriefOnCardScan: v })}
              label="Show AI arrival brief & clinical safety flags upon QR scan"
              hint="Surfaces allergies, chronic flags, and recommended check-in action when scanning cards"
            />
          </div>
        )}

        {tab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15.5, color: C.navy }}>Alerts &amp; messaging</h3>
            <Toggle on={draft.notifyNurseOnCheckIn} onChange={(v) => patch({ notifyNurseOnCheckIn: v })} label="Notify nurse on check-in" />
            <Toggle on={draft.notifyMaOnCheckIn} onChange={(v) => patch({ notifyMaOnCheckIn: v })} label="Notify MA on check-in" />
            <Toggle on={draft.smsCheckInInstructions} onChange={(v) => patch({ smsCheckInInstructions: v })} label="SMS check-in instructions" />
            <Toggle on={draft.smsParkingInfo} onChange={(v) => patch({ smsParkingInfo: v })} label="SMS parking info" />
            <Toggle on={draft.smsRoomAssignment} onChange={(v) => patch({ smsRoomAssignment: v })} label="SMS room assignment" />
            <Toggle on={draft.recordVisitorEscort} onChange={(v) => patch({ recordVisitorEscort: v })} label="Record visitor / escort" />
          </div>
        )}

        {tab === 'hardware' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <h3 style={{ gridColumn: '1 / -1', margin: 0, fontSize: 15.5, color: C.navy }}>Printers &amp; scanners</h3>
            <Field label="LABEL PRINTER"><input value={draft.labelPrinter} onChange={(e) => patch({ labelPrinter: e.target.value })} style={inputStyle} /></Field>
            <Field label="WRISTBAND PRINTER"><input value={draft.wristbandPrinter} onChange={(e) => patch({ wristbandPrinter: e.target.value })} style={inputStyle} /></Field>
            <Field label="CHART LABEL"><input value={draft.chartLabelPrinter} onChange={(e) => patch({ chartLabelPrinter: e.target.value })} style={inputStyle} /></Field>
            <Field label="SPECIMEN LABEL"><input value={draft.specimenLabelPrinter} onChange={(e) => patch({ specimenLabelPrinter: e.target.value })} style={inputStyle} /></Field>
            <Field label="SCANNER PROFILE">
              <select value={draft.scannerProfile} onChange={(e) => patch({ scannerProfile: e.target.value })} style={inputStyle}>
                <option>Document ADF</option><option>Flatbed</option><option>High-speed duplex</option><option>Mobile camera</option>
              </select>
            </Field>
          </div>
        )}

        {tab === 'desk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15.5, color: C.navy }}>Shift &amp; station</h3>
            <Toggle on={draft.allowStationSwitch} onChange={(v) => patch({ allowStationSwitch: v })} label="Allow station switching" />
            <Toggle on={draft.allowFacilitySwitch} onChange={(v) => patch({ allowFacilitySwitch: v })} label="Allow facility switching" />
            <Field label="DEFAULT STATION"><input value={draft.defaultStation} onChange={(e) => patch({ defaultStation: e.target.value })} style={inputStyle} /></Field>
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 12, zIndex: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.96)', border: `1px solid ${C.border}`, boxShadow: '0 -6px 24px rgba(15,23,42,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
          {flash ? <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} /> Settings saved</span>
            : <>Last saved {savedAt ? new Date(savedAt).toLocaleString() : '—'} · {dirty ? 'Unsaved changes' : 'Up to date'}</>}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            fontWeight: 800,
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(90deg,#0284C7,#0D9488)',
            boxShadow: '0 8px 22px rgba(2,132,199,.25)',
          }}
        >
          {saving ? <><Loader2 size={16} /> Saving…</> : <><Save size={16} /> Save front desk settings</>}
        </button>
      </div>
    </div>
  );
};

export default FrontDeskSettings;
