'use client';

/**
 * Administrator Settings — realtime facility configuration.
 * Changes broadcast to other admin tabs / workstations via adminSettingsStore.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Settings,
  Building2,
  Wifi,
  Cloud,
  Sparkles,
  Clock,
  Save,
  RefreshCw,
  Shield,
  Bell,
  Database,
  CheckCircle2,
} from 'lucide-react';
import {
  getAdminSettings,
  saveAdminSettings,
  subscribeAdminSettings,
  resetAdminSettings,
  type AdminFacilitySettings,
  type SyncPreference,
} from '../../lib/adminSettingsStore';
import { AKWA_IBOM_LGAS } from '../../lib/receptionConstants';
import { getOutboxPendingCount, flushOutbox } from '../../lib/durableOutbox';
import { probeHospitalApi } from '../../lib/hospitalSync';
import { pushActivity, resetAllPilotData } from '../../lib/adminRealtimeStore';
import { downloadFacilityBackup } from '../../lib/backupService';
import { downloadDhis2Aggregate } from '../../lib/dhis2Export';
import { exportAuditCsv, listAudit, appendAudit } from '../../lib/auditLogStore';
import { runOpdDayPilot, type PilotRunResult } from '../../lib/opdPilotScript';

interface Props {
  session: UserSession;
}

const C = {
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  blue: '#0052D4',
  teal: '#0D9488',
};

export const AdminSettings: React.FC<Props> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [settings, setSettings] = useState<AdminFacilitySettings>(() =>
    getAdminSettings(facilityId)
  );
  const [draft, setDraft] = useState<AdminFacilitySettings>(settings);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(0);
  const [lanOk, setLanOk] = useState<boolean | null>(null);
  const [probing, setProbing] = useState(false);
  const [pilotResult, setPilotResult] = useState<PilotRunResult | null>(null);
  const [pilotRunning, setPilotRunning] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const s = getAdminSettings(facilityId);
    setSettings(s);
    setDraft(s);
    const unsub = subscribeAdminSettings((next) => {
      if (next.facilityId === facilityId || !next.facilityId) {
        setSettings(next);
        if (!dirty) setDraft(next);
      }
    });
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    const iv = setInterval(() => setPending(getOutboxPendingCount()), 2000);
    setPending(getOutboxPendingCount());
    return () => {
      unsub();
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
      clearInterval(iv);
    };
  }, [facilityId, dirty]);

  const patch = useCallback((partial: Partial<AdminFacilitySettings>) => {
    setDraft((d) => ({ ...d, ...partial }));
    setDirty(true);
  }, []);

  const save = () => {
    const next = saveAdminSettings(
      { ...draft, facilityId },
      session.name || session.badgeId
    );
    setSettings(next);
    setDraft(next);
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString('en-GB'));
    try {
      pushActivity(`Settings updated · ${session.name || 'Admin'}`);
    } catch {
      /* ignore */
    }
  };

  const probeLan = async () => {
    setProbing(true);
    if (draft.lanApiUrl) {
      try {
        localStorage.setItem('medcore_lan_api_url', draft.lanApiUrl);
      } catch {
        /* ignore */
      }
    }
    const ok = await probeHospitalApi();
    setLanOk(ok);
    setProbing(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: C.muted,
    marginBottom: 4,
    letterSpacing: 0.3,
  };

  const Section = ({
    icon: Icon,
    title,
    children,
  }: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
  }) => (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          fontWeight: 800,
          color: C.navy,
          fontSize: 15,
        }}
      >
        <Icon size={18} color={C.blue} />
        {title}
      </div>
      {children}
    </div>
  );

  const Toggle = ({
    label,
    desc,
    checked,
    onChange,
  }: {
    label: string;
    desc: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: checked ? '#F0F9FF' : '#F8FAFC',
        cursor: 'pointer',
        marginBottom: 8,
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{label}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{desc}</div>
      </div>
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? C.blue : '#CBD5E1',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.15s',
          }}
        />
      </div>
    </button>
  );

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 4px 40px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 22,
              fontWeight: 800,
              color: C.navy,
            }}
          >
            <Settings size={24} color={C.blue} />
            Hospital settings
          </div>
          <p style={{ margin: '6px 0 0', color: C.muted, fontSize: 13 }}>
            Realtime configuration for {session.facility || facilityId}. Changes sync to other
            admin workstations when online.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 8,
              background: online ? '#ECFDF5' : '#FEF2F2',
              color: online ? '#047857' : '#B91C1C',
            }}
          >
            {online ? 'Online' : 'Offline'}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: 8,
              background: '#F1F5F9',
              color: C.muted,
            }}
          >
            Pending sync: {pending}
          </span>
          {savedAt && (
            <span style={{ fontSize: 12, color: C.teal, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={14} /> Saved {savedAt}
            </span>
          )}
          <button
            type="button"
            disabled={!dirty}
            onClick={save}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: dirty ? C.blue : '#94A3B8',
              color: '#fff',
              fontWeight: 800,
              cursor: dirty ? 'pointer' : 'not-allowed',
            }}
          >
            <Save size={16} /> Save changes
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Section icon={Building2} title="Hospital identity">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Display name</label>
                <input
                  style={inputStyle}
                  value={draft.displayName}
                  onChange={(e) => patch({ displayName: e.target.value })}
                  placeholder={session.facility || 'Hospital name'}
                />
              </div>
              <div>
                <label style={labelStyle}>Short code</label>
                <input
                  style={inputStyle}
                  value={draft.shortCode}
                  onChange={(e) => patch({ shortCode: e.target.value.toUpperCase() })}
                  placeholder={facilityId}
                />
              </div>
              <div>
                <label style={labelStyle}>Facility ID (read-only)</label>
                <input style={{ ...inputStyle, background: '#F8FAFC' }} value={facilityId} readOnly />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input
                  style={inputStyle}
                  value={draft.state}
                  onChange={(e) => patch({ state: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>LGA</label>
                <select
                  style={inputStyle}
                  value={draft.lga}
                  onChange={(e) => patch({ lga: e.target.value })}
                >
                  {AKWA_IBOM_LGAS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Address</label>
                <input
                  style={inputStyle}
                  value={draft.address}
                  onChange={(e) => patch({ address: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  style={inputStyle}
                  value={draft.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  value={draft.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </div>
            </div>
          </Section>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Section icon={Wifi} title="Realtime sync & hospital hub">
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
              Data is written locally first, then to the LAN hub (if configured), then Firestore when
              online. Prefer hub + UPS for power cuts.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>LAN API URL (hub PC)</label>
                <input
                  style={inputStyle}
                  value={draft.lanApiUrl}
                  onChange={(e) => patch({ lanApiUrl: e.target.value })}
                  placeholder="http://192.168.1.10:4000"
                />
              </div>
              <div>
                <label style={labelStyle}>Sync preference</label>
                <select
                  style={inputStyle}
                  value={draft.syncPreference}
                  onChange={(e) => patch({ syncPreference: e.target.value as SyncPreference })}
                >
                  <option value="auto">Auto (local → LAN → cloud)</option>
                  <option value="local_only">Local only (this PC)</option>
                  <option value="lan_preferred">Prefer hospital LAN hub</option>
                  <option value="cloud_preferred">Prefer cloud when online</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void probeLan()}
                  disabled={probing}
                  style={{
                    flex: 1,
                    padding: 11,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <RefreshCw size={14} /> {probing ? 'Probing…' : 'Test LAN hub'}
                </button>
                <button
                  type="button"
                  onClick={() => void flushOutbox()}
                  style={{
                    flex: 1,
                    padding: 11,
                    borderRadius: 10,
                    border: 'none',
                    background: C.teal,
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Cloud size={14} /> Flush outbox
                </button>
              </div>
            </div>
            {lanOk !== null && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: lanOk ? '#ECFDF5' : '#FEF2F2',
                  color: lanOk ? '#047857' : '#B91C1C',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {lanOk
                  ? 'LAN hub reachable — multi-PC share available'
                  : 'LAN hub not reachable — using local + cloud when online'}
              </div>
            )}
          </Section>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Section icon={Clock} title="Operations defaults">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Default OPD fee (₦)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.defaultOpdFeeNgn}
                  onChange={(e) => patch({ defaultOpdFeeNgn: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Open</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={draft.workingHoursStart}
                  onChange={(e) => patch({ workingHoursStart: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Close</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={draft.workingHoursEnd}
                  onChange={(e) => patch({ workingHoursEnd: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Maintenance / desk notice (shown to staff)</label>
                <input
                  style={inputStyle}
                  value={draft.maintenanceMessage}
                  onChange={(e) => patch({ maintenanceMessage: e.target.value })}
                  placeholder="Optional message e.g. Generator maintenance 2–4pm"
                />
              </div>
            </div>
          </Section>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Section icon={Sparkles} title="AI & reception behaviour">
            <Toggle
              label="AI reception orchestrator"
              desc="Contextual check-in cards and desk narrative"
              checked={draft.aiReceptionEnabled}
              onChange={(v) => patch({ aiReceptionEnabled: v })}
            />
            <Toggle
              label="AI queue reminders"
              desc="Remind patients who exceed estimated wait"
              checked={draft.aiQueueReminders}
              onChange={(v) => patch({ aiQueueReminders: v })}
            />
            <Toggle
              label="Confirm before check-in"
              desc="Human must confirm AI recommend admit"
              checked={draft.requireConfirmBeforeCheckIn}
              onChange={(v) => patch({ requireConfirmBeforeCheckIn: v })}
            />
            <Toggle
              label="Allow walk-in without NIN"
              desc="Registration can complete without national ID"
              checked={draft.allowWalkInWithoutNin}
              onChange={(v) => patch({ allowWalkInWithoutNin: v })}
            />
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>
                Gemini API key (Celestia / all AI assistants)
              </label>
              <input
                type="password"
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  fontFamily: 'ui-monospace, monospace',
                }}
                value={draft.geminiApiKey || ''}
                onChange={(e) => patch({ geminiApiKey: e.target.value })}
                placeholder="Facility fallback only — prefer GEMINI_API_KEY on Vercel (server)"
              />
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 10,
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  fontSize: 12,
                  color: '#0C4A6E',
                  lineHeight: 1.5,
                }}
              >
                <Bell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Facility key is stored in hospital settings (local + sync). Prefer{' '}
                <code>GEMINI_API_KEY</code> on Vercel (server-only, not NEXT_PUBLIC). EMR remains source of
                truth — AI only recommends.
                {draft.geminiApiKey?.trim() ? ' · Key saved in draft — click Save.' : ' · No facility key yet.'}
              </div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginTop: 14, marginBottom: 6 }}>
                Paystack public key (reception payments)
              </label>
              <input
                type="password"
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  fontFamily: 'ui-monospace, monospace',
                }}
                value={draft.paystackPublicKey || ''}
                onChange={(e) => patch({ paystackPublicKey: e.target.value })}
                placeholder="pk_test_… or pk_live_…"
              />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, lineHeight: 1.45 }}>
                Card / bank transfer / USSD at reception. Prefer{' '}
                Keys come from environment only: <code>NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</code> (public) and <code>PAYSTACK_SECRET_KEY</code> (server). Do not paste secret keys here.
                {draft.paystackPublicKey?.trim() ? ' · Key saved in draft — click Save.' : ' · No Paystack key yet.'}
              </div>
            </div>
          </Section>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Section icon={Database} title="Data & safety">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                disabled={pilotRunning}
                onClick={() => {
                  setPilotRunning(true);
                  try {
                    const r = runOpdDayPilot({
                      facilityId,
                      actorName: session.name || 'Admin',
                      actorBadge: session.badgeId,
                      facilityName: draft.displayName || session.facility || facilityId,
                    });
                    setPilotResult(r);
                    pushActivity(
                      `OPD pilot: ${r.patientName} · ${r.steps.filter((s) => s.ok).length}/${r.steps.length} steps ok`
                    );
                  } finally {
                    setPilotRunning(false);
                  }
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563EB, #0D9488)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: pilotRunning ? 'wait' : 'pointer',
                }}
              >
                {pilotRunning ? 'Running OPD pilot…' : 'Run OPD day pilot'}
              </button>
            {pilotResult && (
              <div
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #A7F3D0',
                  background: '#ECFDF5',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  OPD pilot · {pilotResult.patientName} · {pilotResult.hospitalNumber}
                </div>
                <div style={{ color: '#64748B', marginBottom: 8 }}>
                  Balance ₦{pilotResult.balanceNgn.toLocaleString()} · open orders {pilotResult.openOrders}
                </div>
                {pilotResult.steps.map((s) => (
                  <div key={s.step} style={{ padding: '4px 0', borderTop: '1px solid #D1FAE5' }}>
                    <strong style={{ color: s.ok ? '#059669' : '#DC2626' }}>
                      {s.ok ? '✓' : '✗'} {s.step}. {s.name}
                    </strong>
                    <div style={{ color: '#475569', fontSize: 12 }}>{s.detail}</div>
                  </div>
                ))}
              </div>
            )}

              <button
                type="button"
                onClick={() => {
                  downloadFacilityBackup(facilityId);
                  appendAudit({
                    facilityId,
                    actor: session.name,
                    actorBadge: session.badgeId,
                    action: 'facility_backup_exported',
                    entity: 'backup',
                  });
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  color: '#0F172A',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Download facility backup
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadDhis2Aggregate(facilityId);
                  appendAudit({
                    facilityId,
                    actor: session.name,
                    actorBadge: session.badgeId,
                    action: 'dhis2_export',
                    entity: 'dhis2',
                  });
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  color: '#0F172A',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                DHIS2 daily aggregate
              </button>
              <button
                type="button"
                onClick={() => {
                  const csv = exportAuditCsv(facilityId);
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `audit-${facilityId}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  color: '#0F172A',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Export audit CSV ({listAudit(facilityId, 500).length})
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok1 = window.confirm(
                    'Reset ALL hospital data on this browser?\n\nThis clears staff, patients, queue, payments, clinical orders, audit log, transfers, and settings for every admin page.\n\nYou will stay logged in. Download a backup first if needed.'
                  );
                  if (!ok1) return;
                  const ok2 = window.confirm(
                    'Final confirmation: wipe all module data now? This cannot be undone on this device.'
                  );
                  if (!ok2) return;
                  try {
                    appendAudit({
                      facilityId,
                      actor: session.name,
                      actorBadge: session.badgeId,
                      action: 'admin_full_data_reset',
                      entity: 'facility',
                      detail: 'All local module data wiped',
                    });
                  } catch { /* ignore */ }
                  resetAllPilotData({ keepSession: true });
                  const next = resetAdminSettings(facilityId, session.name);
                  setDraft(next);
                  setSettings(next);
                  setDirty(false);
                  setSavedAt(new Date().toLocaleTimeString('en-GB'));
                  pushActivity(`Full data reset by ${session.name || 'Admin'}`);
                  window.setTimeout(() => window.location.reload(), 600);
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #B91C1C',
                  background: '#B91C1C',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Reset all hospital data
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Reset facility settings to defaults? Staff and patient records are not deleted.'
                    )
                  ) {
                    const next = resetAdminSettings(facilityId, session.name);
                    setDraft(next);
                    setSettings(next);
                    setDirty(false);
                    setSavedAt(new Date().toLocaleTimeString('en-GB'));
                  }
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset settings defaults only
              </button>
              <div style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>
                Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
                {settings.updatedBy ? ` · ${settings.updatedBy}` : ''}
              </div>
            </div>
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              <Shield size={16} color={C.blue} style={{ flexShrink: 0, marginTop: 2 }} />
              Only hospital administrators should change these values. Sync writes go through the same
              durable outbox used for clinical data so offline edits are not lost.
            </div>
          </Section>
        </div>
      </div>

      {dirty && (
        <div
          style={{
            position: 'sticky',
            bottom: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: 12,
            background: 'rgba(15,23,42,0.92)',
            borderRadius: 12,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setDraft(settings);
              setDirty(false);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid #475569',
              background: 'transparent',
              color: '#E2E8F0',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: C.blue,
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Save size={16} /> Save &amp; sync
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
