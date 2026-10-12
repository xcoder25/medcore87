'use client';

/**
 * Laboratory LIS desk — Epic Beaker / Cerner PathNet aligned.
 * Worklist · Accession · Results · Critical · Patient lookup · Analyzers · Gateway settings.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Search, Barcode, Clock, ShieldAlert,
  FlaskConical, Plus, X, Edit3, Send, RefreshCw, ClipboardList, Radio,
  Settings, Cpu, User, Zap, Filter,
} from 'lucide-react';
import type { LabOrder } from '@medcore/types';
import {
  listOrders,
  postLabResult,
  canReleaseOrder,
  updateOrderStatus,
  subscribeOrders,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { liveAlert } from '../../lib/manualActions';
import {
  loadGatewayConfig,
  saveGatewayConfig,
  appendGatewayLog,
  listGatewayLogs,
  subscribeDeviceGateway,
  type DeviceGatewayConfig,
  type GatewayLogEntry,
} from '../../lib/deviceGatewayStore';
import { pushNotification } from '../../lib/notificationEngine';

type LabPage = 'worklist' | 'results' | 'critical' | 'patients' | 'analyzers' | 'gateway';

const NAV: { key: LabPage; label: string; icon: React.ElementType; badge?: string }[] = [
  { key: 'worklist', label: 'Specimen worklist', icon: ClipboardList, badge: 'LIS' },
  { key: 'results', label: 'Results & verify', icon: FlaskConical },
  { key: 'critical', label: 'Critical / panic', icon: ShieldAlert },
  { key: 'patients', label: 'Patient lookup', icon: User },
  { key: 'analyzers', label: 'Analyzers & IoT', icon: Cpu, badge: 'Live' },
  { key: 'gateway', label: 'Gateway settings', icon: Settings },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ordered: { label: 'Ordered', color: '#2563EB', bg: '#EFF6FF' },
  collected: { label: 'Collected', color: '#D97706', bg: '#FFFBEB' },
  analyzing: { label: 'Analyzing', color: '#7C3AED', bg: '#F5F3FF' },
  completed: { label: 'Final', color: '#059669', bg: '#ECFDF5' },
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
};

const LIS_KEY = 'medcore_os_lab_orders_v1';

function loadLab(): LabOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIS_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveLab(orders: LabOrder[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIS_KEY, JSON.stringify(orders.slice(0, 300)));
  } catch { /* */ }
}

function seedLab(existing: LabOrder[]): LabOrder[] {
  if (existing.length) return existing;
  const now = Date.now();
  return [
    {
      id: 'LAB-2026-501',
      patientId: 'IGH-PT-2CKAR3',
      patientName: 'Michael James',
      testName: 'FBC (CBC)',
      specimenType: 'Blood',
      barcode: 'BC-501-A1',
      status: 'analyzing',
      orderedAt: new Date(now - 3600e3).toISOString(),
      referenceRange: 'WBC 4.0–11.0',
    },
    {
      id: 'LAB-2026-502',
      patientId: 'IGH-PT-40OLLG',
      patientName: 'Chioma Etim',
      testName: 'Malaria parasite (RDT + film)',
      specimenType: 'Blood',
      barcode: 'BC-502-B2',
      status: 'collected',
      orderedAt: new Date(now - 2 * 3600e3).toISOString(),
    },
    {
      id: 'LAB-2026-503',
      patientId: 'IGH-PT-YB13KN',
      patientName: 'Dahlia nen Arcade',
      testName: 'Blood glucose (random)',
      specimenType: 'Blood',
      barcode: 'BC-503-C3',
      status: 'critical',
      orderedAt: new Date(now - 45 * 60e3).toISOString(),
      result: '28.4 mmol/L',
      referenceRange: '3.9–7.8 mmol/L fasting',
      isPanicValue: true,
    },
    {
      id: 'LAB-2026-498',
      patientId: 'IGH-PT-2CKAR3',
      patientName: 'Michael James',
      testName: 'Urea & Electrolytes',
      specimenType: 'Blood',
      barcode: 'BC-498-D4',
      status: 'completed',
      orderedAt: new Date(now - 26 * 3600e3).toISOString(),
      result: 'Na 138 · K 4.1 · Urea 5.2 · Cr 78',
      referenceRange: 'Within reference',
    },
    {
      id: 'LAB-2026-490',
      patientId: 'IGH-PT-40OLLG',
      patientName: 'Chioma Etim',
      testName: 'Urinalysis',
      specimenType: 'Urine',
      barcode: 'BC-490-E5',
      status: 'completed',
      orderedAt: new Date(now - 3 * 864e5).toISOString(),
      result: 'Clear · SG 1.015 · No protein/glucose',
      referenceRange: 'Normal',
    },
  ];
}

const DEFAULT_ANALYZERS = [
  { id: 'sysmex', name: 'Sysmex XN-1000', section: 'Hematology', status: 'ONLINE' as const, throughput: '100/hr', lastCal: 'Today 06:00' },
  { id: 'cobas', name: 'Roche Cobas 6000', section: 'Chemistry', status: 'ONLINE' as const, throughput: '200/hr', lastCal: 'Today 05:30' },
  { id: 'vitros', name: 'Ortho Vitros 5600', section: 'Chemistry', status: 'STANDBY' as const, throughput: '150/hr', lastCal: 'Yesterday' },
  { id: 'bactec', name: 'BD BACTEC FX', section: 'Microbiology', status: 'ONLINE' as const, throughput: 'Continuous', lastCal: 'Weekly QC OK' },
];

export const LaboratorySuite: React.FC = () => {
  const facilityId = getActiveFacilityId?.() || (typeof window !== 'undefined' ? localStorage.getItem('medcore_active_facility_id') || 'IGH-EKT' : 'IGH-EKT');
  const [page, setPage] = useState<LabPage>('worklist');
  const [orders, setOrders] = useState<LabOrder[]>(() => seedLab(loadLab()));
  const [bus, setBus] = useState<ClinicalOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [resultDraft, setResultDraft] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [patientQ, setPatientQ] = useState('');
  const [gw, setGw] = useState<DeviceGatewayConfig>(() => loadGatewayConfig(facilityId));
  const [logs, setLogs] = useState<GatewayLogEntry[]>([]);
  const [pulse, setPulse] = useState(0);
  const [analyzers, setAnalyzers] = useState(DEFAULT_ANALYZERS);

  const toast = useCallback((m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3000);
  }, []);

  useEffect(() => { saveLab(orders); }, [orders]);

  const refreshBus = useCallback(() => {
    setBus(listOrders(facilityId).filter((o) => o.type === 'lab'));
  }, [facilityId]);

  useEffect(() => {
    refreshBus();
    return subscribeOrders(() => refreshBus());
  }, [refreshBus]);

  useEffect(() => {
    setGw(loadGatewayConfig(facilityId));
    setLogs(listGatewayLogs(40).slice(0, 40));
    return subscribeDeviceGateway(() => {
      setGw(loadGatewayConfig(facilityId));
      setLogs(listGatewayLogs(40).slice(0, 40));
    });
  }, [facilityId]);

  // Realtime analyzer pulse
  useEffect(() => {
    if (!gw.analyzerEnabled) return;
    const ms = Math.max(2000, gw.analyzerPollMs || 5000);
    const t = setInterval(() => {
      setPulse((p) => p + 1);
      setAnalyzers((prev) =>
        prev.map((a) =>
          a.status === 'ONLINE'
            ? { ...a, lastCal: a.lastCal.includes('Live') ? a.lastCal : `${a.lastCal} · Live` }
            : a
        )
      );
    }, ms);
    return () => clearInterval(t);
  }, [gw.analyzerEnabled, gw.analyzerPollMs]);

  const filtered = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.patientName.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.barcode.toLowerCase().includes(q) ||
          o.testName.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  }, [orders, search, statusFilter]);

  const criticals = useMemo(
    () => orders.filter((o) => o.status === 'critical' || o.isPanicValue),
    [orders]
  );

  const patientHits = useMemo(() => {
    if (!patientQ.trim()) return [];
    const q = patientQ.toLowerCase();
    // Lab-scoped: only patients with lab orders (not full clinical chart dump)
    const map = new Map<string, { id: string; name: string; tests: LabOrder[] }>();
    orders.forEach((o) => {
      if (
        o.patientName.toLowerCase().includes(q) ||
        o.patientId.toLowerCase().includes(q) ||
        o.barcode.toLowerCase().includes(q)
      ) {
        const cur = map.get(o.patientId) || { id: o.patientId, name: o.patientName, tests: [] };
        cur.tests.push(o);
        map.set(o.patientId, cur);
      }
    });
    return Array.from(map.values());
  }, [orders, patientQ]);

  const kpis = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === 'ordered' || o.status === 'collected').length,
      analyzing: orders.filter((o) => o.status === 'analyzing').length,
      critical: criticals.length,
      final: orders.filter((o) => o.status === 'completed').length,
      bus: bus.filter((o) => o.status === 'ordered' || o.status === 'in_progress').length,
    }),
    [orders, criticals, bus]
  );

  const selected = orders.find((o) => o.id === selectedId);

  const openResult = (id: string) => {
    setSelectedId(id);
    const o = orders.find((x) => x.id === id);
    setResultDraft(o?.result || '');
    setShowResultModal(true);
  };

  const verifyRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const text = resultDraft.trim() || 'Within reference ranges';
    const panic = /critical|panic|high|low|28\.|alert/i.test(text) || selected.isPanicValue;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selected.id
          ? {
              ...o,
              result: text,
              status: panic ? 'critical' : 'completed',
              isPanicValue: panic,
            }
          : o
      )
    );
    try {
      const match = bus.find((b) => b.patientId === selected.patientId || b.patientName === selected.patientName);
      if (match) {
        try { postLabResult(match.id, text, 'Lab · AMC-2026-1010'); } catch { /* payment gate */ }
      }
    } catch { /* */ }
    if (panic && gw.criticalNotify) {
      try {
        try {
          pushNotification({
            title: `Critical lab · ${selected.testName}`,
            body: `${selected.patientName}: ${text}`,
            severity: 'critical',
            module: 'laboratory',
          } as any);
        } catch { /* */ }
        liveAlert?.(`Critical lab result: ${selected.patientName} · ${selected.testName}`);
      } catch { /* */ }
    }
    setShowResultModal(false);
    toast(panic ? 'Critical released · clinicians notified' : 'Result verified & released');
  };

  const advanceStatus = (id: string, status: LabOrder['status']) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    toast(`Status → ${STATUS_META[status]?.label || status}`);
  };

  const ingestFromBus = (o: ClinicalOrder) => {
    const id = `LAB-${Date.now().toString(36).toUpperCase()}`;
    const row: LabOrder = {
      id,
      patientId: o.patientId || 'UNK',
      patientName: o.patientName || 'Unknown',
      testName: o.name || o.code || 'Lab test',
      specimenType: 'Blood',
      barcode: `BC-${id.slice(-6)}`,
      status: 'ordered',
      orderedAt: o.createdAt || new Date().toISOString(),
    };
    setOrders((prev) => [row, ...prev]);
    try {
      updateOrderStatus(o.id, 'in_progress');
    } catch { /* */ }
    toast(`Accessioned · ${id}`);
  };

  const saveGw = () => {
    const next = saveGatewayConfig({ ...gw, facilityId, updatedAt: new Date().toISOString() }, 'lab');
    setGw(next);
    appendGatewayLog({
      id: `GW-LAB-${Date.now()}`,
      at: new Date().toISOString(),
      level: 'ok',
      source: 'system',
      message: 'Lab gateway settings saved',
      detail: `analyzer=${next.analyzerEnabled} poll=${next.analyzerPollMs}ms`,
    });
    toast('Gateway configuration saved');
  };

  const simulateAnalyzer = () => {
    appendGatewayLog({
      id: `GW-SIM-${Date.now()}`,
      at: new Date().toISOString(),
      level: 'info',
      source: 'hl7',
      message: 'Simulated analyzer ORU result batch',
      detail: 'Sysmex XN-1000 → LIS middleware',
    });
    setOrders((prev) => {
      const analyzing = prev.find((o) => o.status === 'analyzing');
      if (!analyzing) return prev;
      return prev.map((o) =>
        o.id === analyzing.id
          ? {
              ...o,
              status: 'completed' as const,
              result: o.testName.includes('FBC') ? 'WBC 7.2 · Hb 13.1 · Plt 245' : 'Within reference ranges',
              referenceRange: o.referenceRange || 'See method sheet',
            }
          : o
      );
    });
    setLogs(listGatewayLogs(40).slice(0, 40));
    toast('Analyzer result ingested (simulate)');
  };

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.03)',
  };

  return (
    <div className="lis-shell">
      {/* Horizontal LIS nav — visible on ≤900px */}
      <div className="lis-mobile-nav" role="navigation" aria-label="LIS pages">
        {NAV.map((item) => (
          <button
            key={`m-${item.key}`}
            type="button"
            className={page === item.key ? 'active' : undefined}
            onClick={() => setPage(item.key)}
          >
            {item.label}
            {item.key === 'critical' && criticals.length > 0 ? ` (${criticals.length})` : ''}
          </button>
        ))}
      </div>
      <aside className="lis-aside">
        <div style={{ padding: '2px 8px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,rgba(45,212,191,0.35),rgba(13,148,136,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 1px rgba(94,234,212,0.2)' }}>
              <FlaskConical size={18} color="#5EEAD4" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.02em' }}>LIS / Beaker</div>
              <div style={{ fontSize: '0.62rem', opacity: 0.65, fontWeight: 600 }}>Laboratory only</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.68rem', background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={11} color={gw.analyzerEnabled ? '#34D399' : '#FBBF24'} />
            {gw.analyzerEnabled ? `Analyzers live · ${pulse}` : 'Gateway idle'}
          </div>
        </div>
        {NAV.map((item) => {
          const active = page === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setPage(item.key)}
              className={`lis-nav-btn${active ? ' active' : ''}`}
            >
              <Icon size={15} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.key === 'critical' && criticals.length > 0 && (
                <span style={{ background: '#F59E0B', color: '#111', fontSize: '0.65rem', fontWeight: 800, borderRadius: 999, padding: '2px 7px' }}>
                  {criticals.length}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      <main className="lis-main">
        <div className="lis-kpi-row">
          {[
            { l: 'Pending', v: kpis.pending, c: '#2563EB' },
            { l: 'Analyzing', v: kpis.analyzing, c: '#7C3AED' },
            { l: 'Critical', v: kpis.critical, c: '#DC2626' },
            { l: 'Final', v: kpis.final, c: '#059669' },
            { l: 'Bus orders', v: kpis.bus, c: '#D97706' },
          ].map((k) => (
            <div key={k.l} style={{ ...card, padding: '12px 14px', borderTop: `3px solid ${k.c}` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {page === 'worklist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, flex: 1 }}>Specimen worklist</h2>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient, barcode, test…"
                  style={{ padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid #E2E8F0', minWidth: 200, fontSize: '0.84rem' }} />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.84rem' }}>
                <option value="all">All statuses</option>
                {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              <button type="button" onClick={() => { refreshBus(); toast('Worklist synced'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                <RefreshCw size={14} /> Sync
              </button>
            </div>

            {bus.length > 0 && (
              <div style={{ ...card, padding: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#0D9488', marginBottom: 8 }}>Clinical bus · lab orders</div>
                {bus.slice(0, 8).map((o) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: '0.86rem' }}>{o.patientName}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{o.name || o.code} · {o.status}</div>
                    </div>
                    <button type="button" onClick={() => ingestFromBus(o)}
                      style={{ background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                      Accession
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ ...card, overflow: 'hidden' }} className="lis-table-wrap">
              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No specimens in queue</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F0FDFA', color: '#0F766E', textAlign: 'left' }}>
                      {['Barcode', 'Patient', 'Test', 'Specimen', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => {
                      const st = STATUS_META[o.status] || STATUS_META.ordered;
                      return (
                        <tr key={o.id} style={{ borderTop: '1px solid #F1F5F9', background: o.isPanicValue ? '#FEF2F2' : undefined }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.02em' }}>
                            <Barcode size={12} style={{ verticalAlign: 'middle', marginRight: 4, opacity: 0.7 }} />{o.barcode}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                            {o.patientName}
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>{o.patientId}</div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>{o.testName}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>{o.specimenType}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: '0.7rem', padding: '3px 8px', borderRadius: 999 }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {o.status === 'ordered' && (
                                <button type="button" onClick={() => advanceStatus(o.id, 'collected')} style={btnSm}>Collect</button>
                              )}
                              {o.status === 'collected' && (
                                <button type="button" onClick={() => advanceStatus(o.id, 'analyzing')} style={btnSm}>To analyzer</button>
                              )}
                              {(o.status === 'analyzing' || o.status === 'collected') && (
                                <button type="button" onClick={() => openResult(o.id)} style={{ ...btnSm, background: '#0D9488', color: '#fff', border: 'none' }}>Enter result</button>
                              )}
                              {(o.status === 'completed' || o.status === 'critical') && (
                                <button type="button" onClick={() => openResult(o.id)} style={btnSm}>View / amend</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {page === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Results & verification</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>Beaker-style verify → release · auto-verify normals when enabled in gateway</p>
            {orders.filter((o) => o.result || o.status === 'analyzing').map((o) => (
              <div key={o.id} style={{ ...card, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{o.patientName} · {o.testName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{o.barcode} · {STATUS_META[o.status]?.label}</div>
                  {o.result && <div style={{ marginTop: 6, fontSize: '0.88rem', color: o.isPanicValue ? '#DC2626' : '#0F172A', fontWeight: o.isPanicValue ? 700 : 500 }}>{o.result}</div>}
                  {o.referenceRange && <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Ref: {o.referenceRange}</div>}
                </div>
                <button type="button" onClick={() => openResult(o.id)} style={{ ...btnSm, background: '#0D9488', color: '#fff', border: 'none', alignSelf: 'flex-start' }}>
                  Verify
                </button>
              </div>
            ))}
          </div>
        )}

        {page === 'critical' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Critical / panic values</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>Closed-loop notify ordering clinician (Epic Beaker critical workflow)</p>
            {criticals.length === 0 ? (
              <div style={{ ...card, padding: 32, textAlign: 'center' }}>
                <CheckCircle2 size={28} color="#10B981" />
                <div style={{ fontWeight: 700, color: '#059669', marginTop: 8 }}>No open critical results</div>
              </div>
            ) : (
              criticals.map((o) => (
                <div key={o.id} style={{ ...card, padding: 14, borderLeft: '4px solid #DC2626' }}>
                  <div style={{ fontWeight: 800, color: '#B91C1C' }}>{o.patientName} · {o.testName}</div>
                  <div style={{ fontSize: '0.88rem', marginTop: 4 }}>{o.result}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>{o.barcode} · Ref {o.referenceRange}</div>
                  <button type="button" onClick={() => openResult(o.id)} style={{ marginTop: 10, ...btnSm, background: '#DC2626', color: '#fff', border: 'none' }}>
                    Review & re-notify
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {page === 'patients' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Patient lookup · lab scope</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              Shows only patients with lab activity — not full clinical chart (role-appropriate)
            </p>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
              <input
                value={patientQ}
                onChange={(e) => setPatientQ(e.target.value)}
                placeholder="Name, hospital number, or barcode…"
                style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.84rem' }}
              />
            </div>
            {!patientQ.trim() && (
              <div style={{ ...card, padding: 24, color: '#94A3B8', fontSize: '0.86rem' }}>Type to search patients with lab orders</div>
            )}
            {patientHits.map((p) => (
              <div key={p.id} style={{ ...card, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: 8 }}>{p.id} · {p.tests.length} lab order(s)</div>
                {p.tests.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #F1F5F9', fontSize: '0.82rem' }}>
                    <span>{t.testName} · {t.barcode}</span>
                    <span style={{ color: STATUS_META[t.status]?.color, fontWeight: 700 }}>{STATUS_META[t.status]?.label}</span>
                  </div>
                ))}
              </div>
            ))}
            {patientQ.trim() && patientHits.length === 0 && (
              <div style={{ ...card, padding: 20, color: '#94A3B8' }}>No lab patients match “{patientQ}”</div>
            )}
          </div>
        )}

        {page === 'analyzers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Laboratory analyzers & IoT</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                  Realtime instrument status · pulse every {gw.analyzerPollMs || 5000}ms
                </p>
              </div>
              <button type="button" onClick={simulateAnalyzer}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                <Zap size={14} /> Simulate result ingest
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
              {analyzers.map((a) => (
                <div key={a.id} style={{ ...card, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{a.name}</div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                      background: a.status === 'ONLINE' ? '#ECFDF5' : '#FFFBEB',
                      color: a.status === 'ONLINE' ? '#059669' : '#D97706',
                    }}>{a.status}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>{a.section}</div>
                  <div style={{ fontSize: '0.75rem', marginTop: 8, color: '#475569' }}>Throughput {a.throughput}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{a.lastCal}</div>
                  {a.status === 'ONLINE' && gw.analyzerEnabled && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#0D9488', fontWeight: 700 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 0 3px rgba(52,211,153,0.25)' }} />
                      Telemetry live
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 8 }}>Gateway event log</div>
              {logs.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '0.82rem' }}>No events yet — save settings or simulate ingest</div>
              ) : (
                logs.slice(0, 12).map((l) => (
                  <div key={l.id} style={{ fontSize: '0.78rem', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#94A3B8' }}>{new Date(l.at).toLocaleTimeString()}</span>
                    {' · '}
                    <strong>{l.source}</strong> · {l.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {page === 'gateway' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Lab instrument gateway</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              Realtime configuration for analyzers, HL7 ORU, and critical notify (built into MedCore OS)
            </p>
            <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labLabel}>
                <span>Analyzer interface enabled</span>
                <input type="checkbox" checked={!!gw.analyzerEnabled} onChange={(e) => setGw({ ...gw, analyzerEnabled: e.target.checked })} />
              </label>
              <label style={labLabel}>
                <span>Poll interval (ms)</span>
                <input type="number" min={2000} step={1000} value={gw.analyzerPollMs || 5000}
                  onChange={(e) => setGw({ ...gw, analyzerPollMs: Number(e.target.value) || 5000 })}
                  style={inp} />
              </label>
              <label style={labLabel}>
                <span>Analyzer endpoint</span>
                <input value={gw.analyzerEndpoint || ''} onChange={(e) => setGw({ ...gw, analyzerEndpoint: e.target.value })} style={inp} />
              </label>
              <label style={labLabel}>
                <span>HL7 host : port</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={gw.hl7Host} onChange={(e) => setGw({ ...gw, hl7Host: e.target.value })} style={{ ...inp, flex: 1 }} />
                  <input type="number" value={gw.hl7Port} onChange={(e) => setGw({ ...gw, hl7Port: Number(e.target.value) })} style={{ ...inp, width: 90 }} />
                </div>
              </label>
              <label style={labLabel}>
                <span>HL7 enabled</span>
                <input type="checkbox" checked={gw.hl7Enabled} onChange={(e) => setGw({ ...gw, hl7Enabled: e.target.checked })} />
              </label>
              <label style={labLabel}>
                <span>Auto-verify normal results</span>
                <input type="checkbox" checked={!!gw.autoVerifyNormals} onChange={(e) => setGw({ ...gw, autoVerifyNormals: e.target.checked })} />
              </label>
              <label style={labLabel}>
                <span>Critical result notify</span>
                <input type="checkbox" checked={!!gw.criticalNotify} onChange={(e) => setGw({ ...gw, criticalNotify: e.target.checked })} />
              </label>
              <label style={labLabel}>
                <span>Hub base URL</span>
                <input value={gw.hubBaseUrl} onChange={(e) => setGw({ ...gw, hubBaseUrl: e.target.value })} style={inp} />
              </label>
              <label style={labLabel}>
                <span>Notes</span>
                <textarea value={gw.notes} onChange={(e) => setGw({ ...gw, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </label>
              <button type="button" onClick={saveGw}
                style={{ background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontWeight: 700, cursor: 'pointer' }}>
                Save gateway settings
              </button>
            </div>
          </div>
        )}
      </main>

      {notice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#0F766E', color: '#fff',
          padding: '12px 16px', borderRadius: 12, fontWeight: 600, fontSize: '0.86rem',
          boxShadow: '0 12px 32px rgba(15,118,110,0.35)',
        }}>{notice}</div>
      )}

      {showResultModal && selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowResultModal(false)}>
          <form onSubmit={verifyRelease} onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 22, border: '1px solid #99F6E4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0F766E' }}>Verify result · {selected.id}</h3>
              <button type="button" onClick={() => setShowResultModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: 10 }}>
              {selected.patientName} · {selected.testName} · {selected.barcode}
            </div>
            <textarea value={resultDraft} onChange={(e) => setResultDraft(e.target.value)} rows={5}
              placeholder="Result / interpretation…"
              style={{ width: '100%', borderRadius: 10, border: '1px solid #E2E8F0', padding: 12, fontSize: '0.88rem' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setShowResultModal(false)} style={{ ...btnSm, padding: '9px 14px' }}>Cancel</button>
              <button type="submit" style={{ background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}>
                Verify & release
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const btnSm: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 10px',
  fontWeight: 700,
  fontSize: '0.72rem',
  cursor: 'pointer',
  color: '#334155',
};

const labLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#334155',
};

const inp: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: '0.84rem',
  fontWeight: 500,
};

export default LaboratorySuite;
