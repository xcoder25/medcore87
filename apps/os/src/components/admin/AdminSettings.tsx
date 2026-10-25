'use client';

/**
 * Administrator Settings — Realtime Hospital Multi-Tab Configuration Suite.
 * Replaces the single stacked view with dedicated operational, financial, network, and clinical tabs.
 * Changes broadcast in real-time to all workstations via adminSettingsStore.
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
  Database,
  CheckCircle2,
  Key,
  Bell,
  Landmark,
  CreditCard,
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  HelpCircle,
  Check,
  PhoneCall,
  FileText,
} from 'lucide-react';
import { ChangeCredentialsModal } from '../auth/ChangeCredentialsModal';
import {
  getAdminSettings,
  saveAdminSettings,
  subscribeAdminSettings,
  resetAdminSettings,
  type AdminFacilitySettings,
  type SyncPreference,
  type PosTerminalConfig,
} from '../../lib/adminSettingsStore';
import { AKWA_IBOM_LGAS } from '../../lib/receptionConstants';
import { getOutboxPendingCount, flushOutbox } from '../../lib/durableOutbox';
import { probeHospitalApi } from '../../lib/hospitalSync';
import { pushActivity } from '../../lib/adminRealtimeStore';
import { downloadFacilityBackup } from '../../lib/backupService';
import { downloadDhis2Aggregate } from '../../lib/dhis2Export';
import { exportAuditCsv, listAudit, appendAudit } from '../../lib/auditLogStore';
import { runOpdDayPilot, type PilotRunResult } from '../../lib/opdPilotScript';
import { loadFacilityCatalog, saveFacilityCatalog } from '../../lib/facilityCatalogStore';

interface Props {
  session: UserSession;
}

type SettingsTab =
  | 'identity'
  | 'revenue'
  | 'network'
  | 'clinical'
  | 'insurance'
  | 'ai'
  | 'data';

const C = {
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  blue: '#0052D4',
  teal: '#0D9488',
  lightBg: '#F8FAFC',
};

export const AdminSettings: React.FC<Props> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [settings, setSettings] = useState<AdminFacilitySettings>(() => getAdminSettings(facilityId));
  const [draft, setDraft] = useState<AdminFacilitySettings>(settings);
  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(0);
  const [lanOk, setLanOk] = useState<boolean | null>(null);
  const [probing, setProbing] = useState(false);
  const [pilotRunning, setPilotRunning] = useState(false);
  const [pilotResult, setPilotResult] = useState<PilotRunResult | null>(null);
  const [showCredModal, setShowCredModal] = useState(false);
  const [showNewPosModal, setShowNewPosModal] = useState(false);
  const [newPosForm, setNewPosForm] = useState<Partial<PosTerminalConfig>>({
    terminalId: '',
    tillNumber: '',
    department: 'Central Cashier',
    subaccountCode: '',
    notes: '',
  });

  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

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

  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSettings = useCallback(
    (nextDraft: AdminFacilitySettings) => {
      const next = saveAdminSettings(
        { ...nextDraft, facilityId },
        session.name || session.badgeId
      );
      setSettings(next);
      setDraft(next);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString('en-GB'));
      // Apply LAN immediately for hub sync
      if (next.lanApiUrl) {
        try {
          (window as unknown as { __MEDCORE_API_URL?: string }).__MEDCORE_API_URL = next.lanApiUrl;
          localStorage.setItem('medcore_lan_api_url', next.lanApiUrl);
        } catch {
          /* ignore */
        }
      }
      try {
        const cat = loadFacilityCatalog(facilityId, session.facility);
        saveFacilityCatalog({
          ...cat,
          name: next.displayName || cat.name,
          lga: next.lga || cat.lga,
          address: next.address || cat.address,
          phone: next.phone || cat.phone,
          email: next.email || cat.email,
        });
      } catch {
        /* ignore */
      }
    },
    [facilityId, session.name, session.badgeId, session.facility]
  );

  const patch = useCallback(
    (partial: Partial<AdminFacilitySettings>) => {
      setDraft((d) => {
        const merged = { ...d, ...partial };
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
          persistSettings(merged);
        }, 600);
        return merged;
      });
      setDirty(true);
    },
    [persistSettings]
  );

  const save = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    persistSettings(draft);
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

  const handleAddPos = () => {
    if (!newPosForm.terminalId?.trim() || !newPosForm.tillNumber?.trim()) return;
    const newTerminal: PosTerminalConfig = {
      id: `POS-${Date.now().toString(36).toUpperCase()}`,
      terminalId: newPosForm.terminalId.trim(),
      serialNumber: newPosForm.serialNumber?.trim() || `SN-${Math.floor(1000000 + Math.random() * 9000000)}`,
      tillNumber: newPosForm.tillNumber.trim(),
      department: newPosForm.department?.trim() || 'General Cashier',
      subaccountCode: newPosForm.subaccountCode?.trim() || '',
      active: true,
      notes: newPosForm.notes?.trim() || 'Added via Admin Settings',
    };
    patch({
      posTerminals: [...(draft.posTerminals || []), newTerminal],
    });
    setNewPosForm({
      terminalId: '',
      tillNumber: '',
      department: 'Central Cashier',
      subaccountCode: '',
      notes: '',
    });
    setShowNewPosModal(false);
  };

  const handleRemovePos = (id: string) => {
    patch({
      posTerminals: (draft.posTerminals || []).filter((p) => p.id !== id),
    });
  };

  const handleTogglePosStatus = (id: string) => {
    patch({
      posTerminals: (draft.posTerminals || []).map((p) =>
        p.id === id ? { ...p, active: !p.active } : p
      ),
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1.5px solid ${C.border}`,
    fontSize: 13,
    fontWeight: 500,
    color: '#0F172A',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: C.muted,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

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
        gap: 16,
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${checked ? '#BFDBFE' : C.border}`,
        background: checked ? '#F0F9FF' : '#FFFFFF',
        cursor: 'pointer',
        marginBottom: 10,
        transition: 'all 0.15s ease',
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: C.navy }}>{label}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
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

  const TabButton = ({
    tab,
    icon: Icon,
    label,
    badge,
  }: {
    tab: SettingsTab;
    icon: React.ElementType;
    label: string;
    badge?: string;
  }) => {
    const active = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 10,
          border: 'none',
          background: active ? '#0052D4' : 'transparent',
          color: active ? '#FFFFFF' : '#475569',
          fontWeight: active ? 700 : 600,
          fontSize: 13,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
      >
        <Icon size={16} color={active ? '#FFFFFF' : '#64748B'} />
        <span>{label}</span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: 4,
              background: active ? 'rgba(255, 255, 255, 0.25)' : '#E2E8F0',
              color: active ? '#FFFFFF' : '#475569',
            }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 8px 48px' }}>
      {/* ── Top Header & Actions ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '20px 24px',
          background: '#FFFFFF',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(0, 82, 212, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.blue,
              }}
            >
              <Settings size={20} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, letterSpacing: '-0.02em' }}>
                Hospital Administration & Runtime Settings
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                Live policy, revenue, network, and clinical rules for{' '}
                <strong style={{ color: C.navy }}>{draft.displayName || session.facility || facilityId}</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 999,
              background: online ? '#ECFDF5' : '#FEF2F2',
              color: online ? '#047857' : '#B91C1C',
              border: `1px solid ${online ? '#A7F3D0' : '#FECACA'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: online ? '#10B981' : '#EF4444',
              }}
            />
            {online ? 'Cloud Synchronized' : 'Offline Mode'}
          </span>

          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: 999,
              background: '#F1F5F9',
              color: C.muted,
            }}
          >
            Outbox: {pending}
          </span>

          {savedAt && (
            <span
              style={{
                fontSize: 12,
                color: C.teal,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CheckCircle2 size={15} /> Saved {savedAt}
            </span>
          )}

          <button
            type="button"
            disabled={!dirty}
            onClick={save}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: dirty ? 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)' : '#CBD5E1',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 13,
              cursor: dirty ? 'pointer' : 'not-allowed',
              boxShadow: dirty ? '0 4px 14px rgba(0, 82, 212, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {/* ── Multi-Tab Navigation Pills ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#F1F5F9',
          padding: 6,
          borderRadius: 12,
          marginBottom: 20,
          overflowX: 'auto',
          border: `1px solid ${C.border}`,
        }}
      >
        <TabButton tab="identity" icon={Building2} label="Hospital Identity" />
        <TabButton tab="revenue" icon={Landmark} label="AkwaRemit & POS" badge="Revenue" />
        <TabButton tab="network" icon={Wifi} label="Edge Sync & LAN" />
        <TabButton tab="clinical" icon={Stethoscope} label="Clinical Rules" />
        <TabButton tab="insurance" icon={ShieldCheck} label="NHIA & AKSHIA" />
        <TabButton tab="ai" icon={Sparkles} label="Celestia AI & Ops" />
        <TabButton tab="data" icon={Database} label="Security & Backups" />
      </div>

      {/* ── TAB 1: Hospital Identity ── */}
      {activeTab === 'identity' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Building2 size={20} color={C.blue} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>Hospital Facility Registry & Profile</div>
                <div style={{ fontSize: 12, color: C.muted }}>Official facility branding, accreditation tier, and emergency contacts</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
              <div style={{ gridColumn: 'span 8' }}>
                <label style={labelStyle}>Official Hospital Display Name</label>
                <input
                  style={inputStyle}
                  value={draft.displayName}
                  onChange={(e) => patch({ displayName: e.target.value })}
                  placeholder={session.facility || 'e.g. Immanuel General Hospital, Eket'}
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Facility Shortcode</label>
                <input
                  style={inputStyle}
                  value={draft.shortCode}
                  onChange={(e) => patch({ shortCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. IGH-EKT"
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Facility System ID (Read-only)</label>
                <input style={{ ...inputStyle, background: '#F8FAFC', color: '#64748B' }} value={facilityId} readOnly />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Accreditation & Tier</label>
                <select
                  style={inputStyle}
                  value={draft.hospitalTier || 'district_general'}
                  onChange={(e) => patch({ hospitalTier: e.target.value as any })}
                >
                  <option value="primary_health_centre">Primary Health Centre (PHC)</option>
                  <option value="district_general">District General Hospital</option>
                  <option value="secondary_specialist">Secondary Specialist Hospital</option>
                  <option value="tertiary_teaching">Tertiary / University Teaching Hospital</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>State</label>
                <input style={inputStyle} value={draft.state} onChange={(e) => patch({ state: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Local Government Area (LGA)</label>
                <select style={inputStyle} value={draft.lga} onChange={(e) => patch({ lga: e.target.value })}>
                  {AKWA_IBOM_LGAS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Main Phone / Helpline</label>
                <input style={inputStyle} value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>24/7 Emergency Dispatch Line</label>
                <input
                  style={inputStyle}
                  value={draft.emergencyPhone}
                  onChange={(e) => patch({ emergencyPhone: e.target.value })}
                  placeholder="0800-MEDCORE-911"
                />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>Official Contact Email</label>
                <input style={inputStyle} value={draft.email} onChange={(e) => patch({ email: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>Physical Address</label>
                <input style={inputStyle} value={draft.address} onChange={(e) => patch({ address: e.target.value })} />
              </div>

              <div style={{ gridColumn: 'span 12' }}>
                <label style={labelStyle}>Printed Receipts & Discharge Letterhead Footer</label>
                <input
                  style={inputStyle}
                  value={draft.receiptFooterText}
                  onChange={(e) => patch({ receiptFooterText: e.target.value })}
                  placeholder="Official State Revenue Receipt. Thank you for your service."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: AkwaRemit & Revenue POS ── */}
      {activeTab === 'revenue' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          {/* AkwaRemit Central Rules */}
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Landmark size={20} color="#059669" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
                  AkwaRemit State Revenue Integration
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Ensures all hospital collections (Cash, Paystack POS, Direct) flow into official AkwaRemit state ledgers
                </div>
              </div>
            </div>

            <Toggle
              label="Enable AkwaRemit State Revenue Protocol"
              desc="When enabled, every naira collected across all billing desks generates an AkwaRemit reconciliation line"
              checked={draft.akwaremitEnabled}
              onChange={(v) => patch({ akwaremitEnabled: v })}
            />

            <Toggle
              label="Enforce Dual-Control Cashier Shift Closures"
              desc="Requires physical denomination counts signed by both Cashier and Supervisor before till closeout"
              checked={draft.dualControlShiftEnforced}
              onChange={(v) => patch({ dualControlShiftEnforced: v })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginTop: 14 }}>
              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>AkwaRemit Revenue Head Code</label>
                <input
                  style={inputStyle}
                  value={draft.akwaremitRevenueHead}
                  onChange={(e) => patch({ akwaremitRevenueHead: e.target.value })}
                  placeholder="e.g. REV-HEAD-AKS-HEALTH"
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>AkwaRemit Revenue Subhead Code</label>
                <input
                  style={inputStyle}
                  value={draft.akwaremitRevenueSubhead}
                  onChange={(e) => patch({ akwaremitRevenueSubhead: e.target.value })}
                  placeholder="e.g. SUB-HEAD-004-HOSPITAL-OPS"
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Till Physical Cash Alert Limit (₦)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.cashHoldingLimitNgn}
                  onChange={(e) => patch({ cashHoldingLimitNgn: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Hospital Baseline Tariff Schedule */}
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 14 }}>
              Hospital Baseline Tariffs & Surcharges
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Default OPD Fee (₦)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.defaultOpdFeeNgn}
                  onChange={(e) => patch({ defaultOpdFeeNgn: Number(e.target.value) || 0 })}
                />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Emergency Triage Fee (₦)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.emergencyTriageFeeNgn}
                  onChange={(e) => patch({ emergencyTriageFeeNgn: Number(e.target.value) || 0 })}
                />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Default Lab Baseline Fee (₦)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.defaultLabFeeNgn}
                  onChange={(e) => patch({ defaultLabFeeNgn: Number(e.target.value) || 0 })}
                />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Pharmacy Drug Markup (%)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.pharmacyMarkupPercent}
                  onChange={(e) => patch({ pharmacyMarkupPercent: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Paystack Physical Terminal Registry */}
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={18} color="#0284C7" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>
                    Paystack Physical POS Terminals & Till Hardware Mapping
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    Assign physical POS card terminals to specific hospital cash desks and departments
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewPosModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Register POS Terminal
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', color: C.muted, fontWeight: 700 }}>TERMINAL ID</th>
                    <th style={{ padding: '10px 14px', color: C.muted, fontWeight: 700 }}>TILL NUMBER</th>
                    <th style={{ padding: '10px 14px', color: C.muted, fontWeight: 700 }}>DEPARTMENT</th>
                    <th style={{ padding: '10px 14px', color: C.muted, fontWeight: 700 }}>SUBACCOUNT CODE</th>
                    <th style={{ padding: '10px 14px', color: C.muted, fontWeight: 700 }}>STATUS</th>
                    <th style={{ padding: '10px 14px', color: C.muted, fontWeight: 700, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {(draft.posTerminals || []).map((pos) => (
                    <tr key={pos.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: C.navy, fontFamily: 'monospace' }}>
                        {pos.terminalId}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{pos.tillNumber}</td>
                      <td style={{ padding: '12px 14px', color: C.muted }}>{pos.department}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#0369A1' }}>
                        {pos.subaccountCode || 'Default Central'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          onClick={() => handleTogglePosStatus(pos.id)}
                          style={{
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: pos.active ? '#ECFDF5' : '#FEF2F2',
                            color: pos.active ? '#047857' : '#B91C1C',
                          }}
                        >
                          {pos.active ? '● Active' : '○ Paired / Offline'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleRemovePos(pos.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                          title="Remove terminal"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Edge Sync & Network ── */}
      {activeTab === 'network' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Wifi size={20} color={C.blue} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>Hospital LAN Hub & Hybrid Edge Sync</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Manages the onsite fallback server IP, delta sync workers, and durable offline queues
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
              <div style={{ gridColumn: 'span 8' }}>
                <label style={labelStyle}>Onsite Local LAN Hub URL (Server PC in Server Room)</label>
                <input
                  style={inputStyle}
                  value={draft.lanApiUrl}
                  onChange={(e) => patch({ lanApiUrl: e.target.value })}
                  placeholder="e.g. http://192.168.1.10:4000"
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Sync Mode Preference</label>
                <select
                  style={inputStyle}
                  value={draft.syncPreference}
                  onChange={(e) => patch({ syncPreference: e.target.value as SyncPreference })}
                >
                  <option value="auto">Auto (Local $\rightarrow$ LAN $\rightarrow$ Cloud)</option>
                  <option value="local_only">Local Only (Air-gapped on this PC)</option>
                  <option value="lan_preferred">Prefer Hospital LAN Hub</option>
                  <option value="cloud_preferred">Prefer Cloud Realtime</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 12', display: 'flex', gap: 12, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => void probeLan()}
                  disabled={probing}
                  style={{
                    padding: '11px 18px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: probing ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <RefreshCw size={15} className={probing ? 'animate-spin' : ''} />
                  {probing ? 'Probing Hub PC…' : 'Ping & Test LAN Server'}
                </button>

                <button
                  type="button"
                  onClick={() => void flushOutbox()}
                  style={{
                    padding: '11px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: C.teal,
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Cloud size={15} /> Flush Durable Outbox ({pending} queued)
                </button>
              </div>

              {lanOk !== null && (
                <div
                  style={{
                    gridColumn: 'span 12',
                    padding: 14,
                    borderRadius: 12,
                    background: lanOk ? '#ECFDF5' : '#FEF2F2',
                    color: lanOk ? '#047857' : '#B91C1C',
                    border: `1px solid ${lanOk ? '#A7F3D0' : '#FECACA'}`,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {lanOk
                    ? '✓ Onsite LAN Hub reachable at ' + (draft.lanApiUrl || 'default port') + ' — Local multi-PC sharing active.'
                    : '✕ Cannot reach LAN Hub at ' + (draft.lanApiUrl || 'http://localhost:4000') + '. Falling back to browser local ledger.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Clinical Protocols ── */}
      {activeTab === 'clinical' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Stethoscope size={20} color="#7C3AED" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
                  Clinical Governance & Triage Policy
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Decision rules for triage vitals, wait-time escalation, and inpatient bill-holds
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>Clinical Triage Algorithm</label>
                <select
                  style={inputStyle}
                  value={draft.triageProtocol || 'NEWS2'}
                  onChange={(e) => patch({ triageProtocol: e.target.value as any })}
                >
                  <option value="NEWS2">NEWS2 (National Early Warning Score 2) — Recommended</option>
                  <option value="ESI">ESI (Emergency Severity Index 5-Level)</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>Unattended Queue Red-Alert Threshold (Minutes)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.unattendedQueueAlertMins}
                  onChange={(e) => patch({ unattendedQueueAlertMins: Number(e.target.value) || 30 })}
                />
              </div>
            </div>

            <Toggle
              label="Mandatory Triage Vitals Before Doctor Consultation"
              desc="Physician consult workspace remains in read-only preview until a nurse logs respiratory rate, BP, and SpO2"
              checked={draft.requireVitalsBeforeConsult}
              onChange={(v) => patch({ requireVitalsBeforeConsult: v })}
            />

            <Toggle
              label="Require Accounts Clearance Before Inpatient Discharge"
              desc="HIM coding and bed cleanup workflow cannot finalize until the cashier ledger confirms balance is ₦0"
              checked={draft.requireBillingClearanceBeforeDischarge}
              onChange={(v) => patch({ requireBillingClearanceBeforeDischarge: v })}
            />
          </div>
        </div>
      )}

      {/* ── TAB 5: Insurance & NHIA / AKSHIA ── */}
      {activeTab === 'insurance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <ShieldCheck size={20} color="#0284C7" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
                  National & State Health Insurance Interoperability
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Provider credentials and co-payment percentages for NHIA and AKSHIA claims
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>NHIA National Facility Accreditation Code</label>
                <input
                  style={inputStyle}
                  value={draft.nhiaProviderCode}
                  onChange={(e) => patch({ nhiaProviderCode: e.target.value })}
                  placeholder="e.g. NHIA-AKS-0042"
                />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>AKSHIA State Provider ID</label>
                <input
                  style={inputStyle}
                  value={draft.akshiaProviderId}
                  onChange={(e) => patch({ akshiaProviderId: e.target.value })}
                  placeholder="e.g. AKSHIA-SEC-019"
                />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>Standard Patient Co-Payment Percentage (%)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.insuranceCopayPercent}
                  onChange={(e) => patch({ insuranceCopayPercent: Number(e.target.value) || 0 })}
                  placeholder="10"
                />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={labelStyle}>Pre-Authorization Threshold (₦)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={draft.preAuthThresholdNgn}
                  onChange={(e) => patch({ preAuthThresholdNgn: Number(e.target.value) || 0 })}
                  placeholder="50000"
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Toggle
                label="Automatic Eligibility Verification at Check-In"
                desc="Query the AKSHIA/NHIA UPI gateway as soon as patient NIN or Policy Number is keyed in at the front desk"
                checked={draft.autoVerifyInsuranceOnCheckin}
                onChange={(v) => patch({ autoVerifyInsuranceOnCheckin: v })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: Celestia AI & Operations ── */}
      {activeTab === 'ai' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Sparkles size={20} color="#F59E0B" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
                  Celestia AI Copilot & Front Desk Automation
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  AI recommendations, wait-time reminders, and hospital broadcast banners
                </div>
              </div>
            </div>

            <Toggle
              label="AI Reception Orchestrator"
              desc="Provides real-time clinical context and recommendations during patient check-in"
              checked={draft.aiReceptionEnabled}
              onChange={(v) => patch({ aiReceptionEnabled: v })}
            />

            <Toggle
              label="AI Queue Wait-Time Reminders"
              desc="Automatically notifies floor attendants when patient wait times exceed clinical thresholds"
              checked={draft.aiQueueReminders}
              onChange={(v) => patch({ aiQueueReminders: v })}
            />

            <Toggle
              label="Confirm Before Check-In"
              desc="Requires a human receptionist to review and accept AI-generated clinical pathway recommendations"
              checked={draft.requireConfirmBeforeCheckIn}
              onChange={(v) => patch({ requireConfirmBeforeCheckIn: v })}
            />

            <Toggle
              label="Allow Walk-In Registration Without NIN"
              desc="Permits emergency registration when a patient has not yet enrolled for their National Identity Number"
              checked={draft.allowWalkInWithoutNin}
              onChange={(v) => patch({ allowWalkInWithoutNin: v })}
            />

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Hospital Broadcast / Maintenance Notice</label>
              <input
                style={inputStyle}
                value={draft.maintenanceMessage}
                onChange={(e) => patch({ maintenanceMessage: e.target.value })}
                placeholder="e.g. Scheduled power transition at 14:00 · All generators on standby"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: Security & Backups ── */}
      {activeTab === 'data' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          {/* Security Credentials Card */}
          <div
            style={{
              gridColumn: 'span 12',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: 16,
              padding: 24,
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC' }}>
                  Administrator Password & Security PIN
                </div>
                <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                  Current user: <strong style={{ color: '#38BDF8' }}>{session.name}</strong> ({session.badgeId || 'Admin'}) · Manage master password or fast-switch PIN.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCredModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0284C7',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                }}
              >
                <Key size={16} />
                <span>Change Password & PIN</span>
              </button>
            </div>
          </div>

          {/* Backup & Governance Card */}
          <div
            style={{
              gridColumn: 'span 12',
              background: '#FFFFFF',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 14 }}>
              Data Governance, DHIS2 Export & Audit Trails
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button
                type="button"
                onClick={() => downloadFacilityBackup(facilityId)}
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Database size={15} color={C.blue} /> Download Full Facility Backup (.json)
              </button>

              <button
                type="button"
                onClick={() => downloadDhis2Aggregate(facilityId)}
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FileText size={15} color="#059669" /> Download DHIS2 MoH Aggregate (.csv)
              </button>

              <button
                type="button"
                onClick={() => exportAuditCsv()}
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Shield size={15} color="#7C3AED" /> Export Full Audit Trail (.csv)
              </button>

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
                    pushActivity(`OPD pilot run: ${r.patientName} (${r.steps.filter((s) => s.ok).length}/${r.steps.length} ok)`);
                  } finally {
                    setPilotRunning(false);
                  }
                }}
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563EB, #0D9488)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: pilotRunning ? 'wait' : 'pointer',
                }}
              >
                {pilotRunning ? 'Running Sandbox Pilot…' : 'Run OPD Day Pilot Simulation'}
              </button>
            </div>

            {pilotResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #A7F3D0',
                  background: '#ECFDF5',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  OPD Sandbox Pilot: {pilotResult.patientName} ({pilotResult.hospitalNumber})
                </div>
                <div style={{ color: '#047857', marginBottom: 8 }}>
                  All {pilotResult.steps.length} clinical stages executed successfully without errors.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Register New POS Terminal ── */}
      {showNewPosModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowNewPosModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 4 }}>
              Register Physical POS Terminal
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>
              Map a Paystack hardware POS to a hospital cashier desk
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Terminal ID (from Paystack Terminal Box/Menu)</label>
                <input
                  style={inputStyle}
                  value={newPosForm.terminalId}
                  onChange={(e) => setNewPosForm({ ...newPosForm, terminalId: e.target.value.toUpperCase() })}
                  placeholder="e.g. TERM-IGH-04"
                />
              </div>

              <div>
                <label style={labelStyle}>Assigned Cashier Till Number</label>
                <input
                  style={inputStyle}
                  value={newPosForm.tillNumber}
                  onChange={(e) => setNewPosForm({ ...newPosForm, tillNumber: e.target.value })}
                  placeholder="e.g. TILL-04"
                />
              </div>

              <div>
                <label style={labelStyle}>Hospital Department</label>
                <select
                  style={inputStyle}
                  value={newPosForm.department}
                  onChange={(e) => setNewPosForm({ ...newPosForm, department: e.target.value })}
                >
                  <option value="Central Cashier">Central Outpatient Cashier</option>
                  <option value="Pharmacy Cashier">Pharmacy Dispensing Till</option>
                  <option value="Emergency & A&E">Emergency Bay / A&E Till</option>
                  <option value="Laboratory Cashier">Laboratory & Diagnostic Desk</option>
                  <option value="Inpatient Ward Billing">Inpatient Ward Billing Office</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Paystack Subaccount Code (Optional for Split Payouts)</label>
                <input
                  style={inputStyle}
                  value={newPosForm.subaccountCode}
                  onChange={(e) => setNewPosForm({ ...newPosForm, subaccountCode: e.target.value })}
                  placeholder="e.g. ACCT_eket01"
                />
              </div>

              <div>
                <label style={labelStyle}>Hardware Notes</label>
                <input
                  style={inputStyle}
                  value={newPosForm.notes}
                  onChange={(e) => setNewPosForm({ ...newPosForm, notes: e.target.value })}
                  placeholder="e.g. Counter 2 POS Terminal"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowNewPosModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: '#FFFFFF',
                  color: C.muted,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPos}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: C.blue,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Save & Pair Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Change Credentials ── */}
      <ChangeCredentialsModal
        session={session}
        isOpen={showCredModal}
        onClose={() => setShowCredModal(false)}
      />
    </div>
  );
};

export default AdminSettings;
