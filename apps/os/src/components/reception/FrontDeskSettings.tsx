'use client';

/**
 * Front Desk operational settings — workflow, queue, intake, billing, alerts, hardware, desk.
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
import { emitLiveAction } from '../../lib/liveActions';
import {
  Settings, Calendar, FileText, Wallet, Bell, Printer, Users,
  Save, Loader2, CheckCircle2, RotateCcw, Palette,
} from 'lucide-react';

type Tab = 'workflow' | 'queue' | 'registration' | 'billing' | 'notifications' | 'hardware' | 'desk';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'workflow', label: 'Workflow & status', icon: Palette },
  { id: 'queue', label: 'Appointments & queue', icon: Calendar },
  { id: 'registration', label: 'Registration & forms', icon: FileText },
  { id: 'billing', label: 'Billing & POS', icon: Wallet },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'hardware', label: 'Hardware & printing', icon: Printer },
  { id: 'desk', label: 'Staff & desk', icon: Users },
];

const C = { navy: '#0F172A', muted: '#64748B', border: '#E2E8F0', blue: '#0284C7' };

interface Props { session?: UserSession }

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

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 420));
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
      <style>{`.fd-save-btn{position:relative;overflow:hidden;border:none;cursor:pointer;font-weight:800;color:#fff;padding:14px 26px;border-radius:14px;display:inline-flex;align-items:center;gap:10px;background:linear-gradient(90deg,#0284C7,#0D9488);box-shadow:0 10px 28px rgba(2,132,199,.3)}.fd-save-btn:hover{transform:translateY(-2px)}`}</style>

      <div style={{ borderRadius: 18, padding: '20px 22px', background: 'linear-gradient(120deg,#0B1220,#0C4A6E 50%,#0F766E)', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9 }}>
            <Settings size={14} /> FRONT DESK SETTINGS
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: '1.35rem', fontWeight: 800 }}>Daily workflow & station controls</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 520 }}>
            {session?.facility || 'Hospital'} · Status colours, queue rules, intake forms, copay prompts, printers, desk assignment.
          </p>
        </div>
        <button type="button" onClick={() => setDraft(defaultReceptionSettings(facilityId))} style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
          <RotateCcw size={14} /> Reset defaults
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999,
              border: `1.5px solid ${on ? C.blue : C.border}`, background: on ? '#E0F2FE' : '#fff',
              color: on ? C.blue : C.navy, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`, padding: 20, boxShadow: '0 8px 28px rgba(15,23,42,0.04)' }}>
        {tab === 'workflow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: C.navy }}>Patient flow statuses & wait alerts</h3>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="TARGET WAIT (MIN)"><input type="number" value={draft.waitTargetMinutes} onChange={(e) => patch({ waitTargetMinutes: Number(e.target.value) || 20 })} style={inputStyle} /></Field>
              <Field label="ESCALATE AFTER (MIN)"><input type="number" value={draft.waitAlertEscalateMinutes} onChange={(e) => patch({ waitAlertEscalateMinutes: Number(e.target.value) || 30 })} style={inputStyle} /></Field>
              <Toggle on={draft.waitAlertEnabled} onChange={(v) => patch({ waitAlertEnabled: v })} label="Wait-time alerts" hint="Flag over-target waits" />
            </div>
          </div>
        )}

        {tab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: C.navy }}>Check-in defaults & arrival rules</h3>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="EARLY ARRIVAL (MIN)"><input type="number" value={draft.earlyArrivalMinutes} onChange={(e) => patch({ earlyArrivalMinutes: Number(e.target.value) || 0 })} style={inputStyle} /></Field>
              <Field label="LATE AFTER (MIN)"><input type="number" value={draft.lateArrivalMinutes} onChange={(e) => patch({ lateArrivalMinutes: Number(e.target.value) || 15 })} style={inputStyle} /></Field>
              <Toggle on={draft.autoMarkLate} onChange={(v) => patch({ autoMarkLate: v })} label="Auto-mark Late" />
            </div>
            <Toggle on={draft.walkInQueueEnabled} onChange={(v) => patch({ walkInQueueEnabled: v })} label="Walk-in / urgent care queue" />
            <Field label="WALK-IN TRIAGE PRIORITIES"><input value={draft.walkInTriagePriorities.join(', ')} onChange={(e) => patch({ walkInTriagePriorities: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} style={inputStyle} /></Field>
          </div>
        )}

        {tab === 'registration' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: C.navy }}>Digital intake & scanning</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

        {tab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: C.navy }}>Copay prompts & receipt</h3>
            <Toggle on={draft.promptCopayOnCheckIn} onChange={(v) => patch({ promptCopayOnCheckIn: v })} label="Prompt co-pay on check-in" />
            <Toggle on={draft.promptPastDueBalance} onChange={(v) => patch({ promptPastDueBalance: v })} label="Prompt past-due balance" />
            <Toggle on={draft.promptDeductibleEstimate} onChange={(v) => patch({ promptDeductibleEstimate: v })} label="Prompt deductible estimate" />
            <Field label="PAYSTACK TERMINAL DEVICE ID"><input value={draft.posTerminalId} onChange={(e) => patch({ posTerminalId: e.target.value })} style={inputStyle} placeholder="Paystack device_id for Card — Terminal" /></Field>
            <Field label="RECEIPT HEADER"><input value={draft.receiptHeader} onChange={(e) => patch({ receiptHeader: e.target.value })} style={inputStyle} /></Field>
            <Field label="RECEIPT FOOTER"><input value={draft.receiptFooter} onChange={(e) => patch({ receiptFooter: e.target.value })} style={inputStyle} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="TAX ID"><input value={draft.receiptTaxId} onChange={(e) => patch({ receiptTaxId: e.target.value })} style={inputStyle} /></Field>
              <Field label="RETURN POLICY"><input value={draft.receiptReturnPolicy} onChange={(e) => patch({ receiptReturnPolicy: e.target.value })} style={inputStyle} /></Field>
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: C.navy }}>Alerts & messaging</h3>
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
            <h3 style={{ gridColumn: '1 / -1', margin: 0, fontSize: 16, color: C.navy }}>Printers & scanners</h3>
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
            <h3 style={{ margin: 0, fontSize: 16, color: C.navy }}>Shift & location</h3>
            <Toggle on={draft.allowStationSwitch} onChange={(v) => patch({ allowStationSwitch: v })} label="Allow station switching" />
            <Toggle on={draft.allowFacilitySwitch} onChange={(v) => patch({ allowFacilitySwitch: v })} label="Allow facility switching" />
            <Field label="DEFAULT STATION"><input value={draft.defaultStation} onChange={(e) => patch({ defaultStation: e.target.value })} style={inputStyle} /></Field>
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 12, zIndex: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.94)', border: `1px solid ${C.border}`, boxShadow: '0 -8px 28px rgba(15,23,42,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
          {flash ? <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} /> Settings saved · desk rules live</span>
            : <>Last saved {savedAt ? new Date(savedAt).toLocaleString() : '—'} · {dirty ? 'Unsaved changes' : 'In sync'}</>}
        </div>
        <button type="button" className="fd-save-btn" onClick={save} disabled={saving}>
          {saving ? <><Loader2 size={18} /> Saving…</> : <><Save size={18} /> Save front desk settings</>}
        </button>
      </div>
    </div>
  );
};

export default FrontDeskSettings;
