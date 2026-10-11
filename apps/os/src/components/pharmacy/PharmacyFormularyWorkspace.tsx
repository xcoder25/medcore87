'use client';

/**
 * Premium EMR Formulary & Inventory — Cerner / Epic clinical density
 * Command bar · KPI strip · master-detail · FEFO batches · AKS EML
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pill,
  Package,
  Search,
  Plus,
  AlertTriangle,
  RefreshCw,
  Shield,
  Boxes,
  Clock,
  CheckCircle2,
  X,
  Filter,
  Download,
  Layers,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import {
  listFormulary,
  listBatches,
  stockQty,
  seedDefaultFormulary,
  upsertDrug,
  receiveStock,
  formularyStats,
  subscribeFormulary,
  listControlledDispenses,
  listPharmacyLog,
  type FormularyDrug,
  type StockBatch,
} from '../../lib/formularyInventory';
import { AksEmlFormularyPanel } from './AksEmlFormularyPanel';
import { emitLiveAction } from '../../lib/liveActions';

/* ── Epic / Cerner clinical tokens ───────────────────────────────────────── */
const T = {
  bg: '#F0F4F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F7FAFC',
  ink: '#1A2332',
  inkSoft: '#4A5568',
  muted: '#718096',
  line: '#E2E8F0',
  lineStrong: '#CBD5E0',
  primary: '#1B4F72',
  primarySoft: '#EBF5FB',
  accent: '#0E7490',
  accentSoft: '#E6FFFA',
  warn: '#C05621',
  warnSoft: '#FFFAF0',
  danger: '#C53030',
  dangerSoft: '#FFF5F5',
  ok: '#276749',
  okSoft: '#F0FFF4',
  purple: '#553C9A',
  purpleSoft: '#FAF5FF',
  radius: 8,
  shadow: '0 1px 3px rgba(26,35,50,0.06), 0 1px 2px rgba(26,35,50,0.04)',
  shadowMd: '0 4px 16px rgba(26,35,50,0.08)',
  font: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

type Tab = 'inventory' | 'eml' | 'log';

export const PharmacyFormularyWorkspace: React.FC = () => {
  const facilityId =
    (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>('inventory');
  const [drugs, setDrugs] = useState<FormularyDrug[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [form, setForm] = useState({
    name: '',
    genericName: '',
    strength: '',
    form: 'Tablet',
    category: 'General',
    unitPriceNgn: '100',
    reorderLevel: '50',
    controlled: false,
  });
  const [recv, setRecv] = useState({
    drugId: '',
    batchNo: '',
    expiry: '',
    qty: '100',
    supplier: 'CMS Nigeria',
  });

  const reload = useCallback(() => {
    seedDefaultFormulary(facilityId);
    const list = listFormulary(facilityId);
    setDrugs(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [facilityId, selectedId]);

  useEffect(() => {
    reload();
    return subscribeFormulary(() => {
      seedDefaultFormulary(facilityId);
      setDrugs(listFormulary(facilityId));
    });
  }, [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => formularyStats(facilityId), [facilityId, drugs]);
  const categories = useMemo(() => {
    const s = new Set(drugs.map((d) => d.category).filter(Boolean));
    return ['all', ...Array.from(s).sort()];
  }, [drugs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return drugs
      .filter((d) => (category === 'all' ? true : d.category === category))
      .filter((d) => {
        const qty = stockQty(facilityId, d.id);
        if (stockFilter === 'low') return qty <= d.reorderLevel;
        if (stockFilter === 'ok') return qty > d.reorderLevel;
        return true;
      })
      .filter(
        (d) =>
          !qq ||
          d.name.toLowerCase().includes(qq) ||
          d.genericName.toLowerCase().includes(qq) ||
          d.category.toLowerCase().includes(qq)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drugs, q, category, stockFilter, facilityId]);

  const selected = drugs.find((d) => d.id === selectedId) || null;
  const batches: StockBatch[] = selected ? listBatches(facilityId, selected.id) : [];

  const showT = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3200);
  };

  const onAddDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = `DRG-${Date.now().toString(36).toUpperCase()}`;
    upsertDrug({
      id,
      facilityId,
      name: form.name.trim(),
      genericName: form.genericName.trim() || form.name.trim(),
      strength: form.strength.trim() || '—',
      form: form.form,
      category: form.category.trim() || 'General',
      unitPriceNgn: Math.max(0, Number(form.unitPriceNgn) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      controlled: form.controlled,
    });
    setShowAdd(false);
    setSelectedId(id);
    setForm({
      name: '',
      genericName: '',
      strength: '',
      form: 'Tablet',
      category: 'General',
      unitPriceNgn: '100',
      reorderLevel: '50',
      controlled: false,
    });
    setDrugs(listFormulary(facilityId));
    emitLiveAction(`Formulary: added ${form.name.trim()}`, { module: 'pharmacy' });
    showT(`Added to formulary · ${form.name.trim()}`);
  };

  const onReceive = (e: React.FormEvent) => {
    e.preventDefault();
    const drugId = recv.drugId || selectedId;
    if (!drugId || !recv.batchNo.trim() || !recv.expiry) return;
    receiveStock({
      facilityId,
      drugId,
      batchNo: recv.batchNo.trim(),
      expiry: recv.expiry,
      qty: Math.max(0, Number(recv.qty) || 0),
      supplier: recv.supplier.trim() || undefined,
    });
    setShowReceive(false);
    setRecv({ drugId: '', batchNo: '', expiry: '', qty: '100', supplier: 'CMS Nigeria' });
    setDrugs(listFormulary(facilityId));
    const name = drugs.find((d) => d.id === drugId)?.name || drugId;
    emitLiveAction(`Stock received: ${name}`, { module: 'pharmacy' });
    showT(`Stock received · ${name}`);
  };

  return (
    <div
      style={{
        fontFamily: T.font,
        background: T.bg,
        minHeight: '100%',
        margin: '-8px -4px',
        padding: '0 0 32px',
      }}
    >
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 20,
            zIndex: 99999,
            background: T.ink,
            color: '#F7FAFC',
            padding: '12px 18px',
            borderRadius: T.radius,
            fontWeight: 600,
            fontSize: 13,
            boxShadow: T.shadowMd,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderLeft: `3px solid ${T.ok}`,
          }}
        >
          <CheckCircle2 size={16} color="#68D391" />
          {toast}
        </div>
      )}

      {/* ── Workspace header (Epic command chrome) ── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.primary} 0%, #0E3A5C 55%, ${T.accent} 140%)`,
          color: '#fff',
          padding: '18px 22px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pill size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.75, textTransform: 'uppercase' }}>
                Pharmacy · Clinical inventory
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
                Formulary & stock control
              </h1>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                FEFO batches · reorder alerts · AKS essential medicines reference
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <HdrBtn onClick={() => { seedDefaultFormulary(facilityId); setDrugs(listFormulary(facilityId)); }}>
              <RefreshCw size={13} /> Sync
            </HdrBtn>
            <HdrBtn onClick={() => setShowReceive(true)}>
              <Boxes size={13} /> Receive
            </HdrBtn>
            <HdrBtn primary onClick={() => setShowAdd(true)}>
              <Plus size={13} /> Add item
            </HdrBtn>
          </div>
        </div>

        {/* KPI strip on chrome */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 8,
            marginTop: 16,
          }}
        >
          {[
            { label: 'Formulary items', value: stats.items, sub: 'Active catalogue' },
            { label: 'Units on hand', value: stats.totalUnits, sub: 'All batches' },
            { label: 'Low stock', value: stats.lowStock, sub: 'Below reorder', warn: stats.lowStock > 0 },
            { label: 'Expiring ≤90d', value: stats.expiringBatches, sub: 'Batch risk', warn: stats.expiringBatches > 0 },
            { label: 'Controlled', value: stats.controlled, sub: 'Restricted' },
          ].map((k) => (
            <div
              key={k.label}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: T.radius,
                padding: '10px 12px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: k.warn ? '#FBD38D' : '#fff' }}>
                {k.value}
              </div>
              <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Segment control ── */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.line}`,
          padding: '0 16px',
          display: 'flex',
          gap: 0,
          boxShadow: T.shadow,
        }}
      >
        {(
          [
            { id: 'inventory' as Tab, label: 'Facility inventory', icon: Layers },
            { id: 'log' as Tab, label: 'Controlled log', icon: Shield },
            { id: 'eml' as Tab, label: 'AKS EML reference', icon: Shield },
          ] as const
        ).map((t) => {
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
                padding: '12px 16px',
                border: 'none',
                borderBottom: on ? `2px solid ${T.primary}` : '2px solid transparent',
                background: 'transparent',
                color: on ? T.primary : T.muted,
                fontWeight: 650,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: T.font,
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '14px 16px 0', maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'log' && (
          <div
            style={{
              background: T.surface,
              borderRadius: 12,
              border: `1px solid ${T.line}`,
              boxShadow: T.shadow,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${T.line}`,
                background: T.surfaceAlt,
                fontSize: 12,
                fontWeight: 700,
                color: T.inkSoft,
              }}
            >
              Controlled-substance dispenses & stock movements (facility audit)
            </div>
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt, position: 'sticky', top: 0 }}>
                    {['When', 'Type', 'Medicine', 'Batch', 'Qty', 'Actor', 'Detail'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listPharmacyLog(facilityId, { limit: 80 }).map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${T.line}`, background: row.controlled ? T.purpleSoft : undefined }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(row.at).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.type}</td>
                      <td style={{ padding: '8px 10px' }}>{row.drugName}{row.controlled ? ' · CTRL' : ''}</td>
                      <td style={{ padding: '8px 10px', fontFamily: T.mono }}>{row.batchNo || '—'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.qty}</td>
                      <td style={{ padding: '8px 10px' }}>{row.actor}</td>
                      <td style={{ padding: '8px 10px', color: T.muted, maxWidth: 280 }}>{row.detail}</td>
                    </tr>
                  ))}
                  {listPharmacyLog(facilityId, { limit: 1 }).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: T.muted }}>
                        No pharmacy stock events yet — receive or dispense to populate this log
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'eml' && (
          <div
            style={{
              background: T.surface,
              borderRadius: 12,
              border: `1px solid ${T.line}`,
              boxShadow: T.shadow,
              overflow: 'hidden',
              minHeight: 480,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: `1px solid ${T.line}`,
                background: T.surfaceAlt,
                fontSize: 12,
                fontWeight: 700,
                color: T.inkSoft,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Shield size={14} color={T.primary} />
              Official Akwa Ibom Essential Medicines List — reference only (does not alter facility stock)
            </div>
            <div style={{ padding: 8 }}>
              <AksEmlFormularyPanel />
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.55fr) minmax(300px, 0.95fr)',
              gap: 12,
              alignItems: 'start',
            }}
          >
            {/* Master list */}
            <div
              style={{
                background: T.surface,
                borderRadius: 12,
                border: `1px solid ${T.line}`,
                boxShadow: T.shadow,
                overflow: 'hidden',
              }}
            >
              {/* Filter bar */}
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${T.line}`,
                  background: T.surfaceAlt,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: T.muted }} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search medicine, generic, ATC category…"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: T.radius,
                      border: `1px solid ${T.lineStrong}`,
                      fontSize: 13,
                      fontFamily: T.font,
                      background: T.surface,
                      color: T.ink,
                      outline: 'none',
                    }}
                  />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={selectStyle}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'All categories' : c}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 4, background: T.surface, borderRadius: T.radius, border: `1px solid ${T.line}`, padding: 2 }}>
                  {(
                    [
                      { id: 'all' as const, label: 'All' },
                      { id: 'low' as const, label: 'Low' },
                      { id: 'ok' as const, label: 'OK' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStockFilter(f.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: stockFilter === f.id ? T.primarySoft : 'transparent',
                        color: stockFilter === f.id ? T.primary : T.muted,
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: T.font,
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>
                  {filtered.length} shown
                </span>
              </div>

              <div style={{ maxHeight: 560, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: T.surfaceAlt, position: 'sticky', top: 0, zIndex: 2 }}>
                      {['Medicine', 'Form / strength', 'Category', 'Price', 'On hand', 'Status'].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            padding: '9px 12px',
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.muted,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            borderBottom: `1px solid ${T.line}`,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const qty = stockQty(facilityId, d.id);
                      const low = qty <= d.reorderLevel;
                      const on = selectedId === d.id;
                      return (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedId(d.id)}
                          style={{
                            cursor: 'pointer',
                            background: on ? T.primarySoft : T.surface,
                            borderBottom: `1px solid ${T.line}`,
                            boxShadow: on ? `inset 3px 0 0 ${T.primary}` : undefined,
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!on) e.currentTarget.style.background = T.surfaceAlt;
                          }}
                          onMouseLeave={(e) => {
                            if (!on) e.currentTarget.style.background = T.surface;
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 650, color: T.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {d.name}
                              {on && <ChevronRight size={12} color={T.primary} />}
                            </div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{d.genericName}</div>
                          </td>
                          <td style={{ padding: '10px 12px', color: T.inkSoft, fontSize: 12 }}>
                            {d.form}
                            <span style={{ color: T.muted }}> · </span>
                            {d.strength}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: T.surfaceAlt,
                                border: `1px solid ${T.line}`,
                                color: T.inkSoft,
                              }}
                            >
                              {d.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: T.mono, fontWeight: 600, fontSize: 12 }}>
                            ₦{d.unitPriceNgn.toLocaleString('en-NG')}
                          </td>
                          <td
                            style={{
                              padding: '10px 12px',
                              fontWeight: 700,
                              fontFamily: T.mono,
                              color: low ? T.warn : T.ink,
                            }}
                          >
                            {qty}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {d.controlled && <PillBadge tone="purple">CTRL</PillBadge>}
                              {low ? (
                                <PillBadge tone="warn">LOW</PillBadge>
                              ) : (
                                <PillBadge tone="ok">OK</PillBadge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: T.muted }}>
                          <Package size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
                          <div style={{ fontWeight: 600 }}>No medicines match filters</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>Clear search or add to formulary</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail rail */}
            <div
              style={{
                background: T.surface,
                borderRadius: 12,
                border: `1px solid ${T.line}`,
                boxShadow: T.shadow,
                overflow: 'hidden',
                position: 'sticky',
                top: 8,
              }}
            >
              {!selected ? (
                <div style={{ padding: 28, textAlign: 'center', color: T.muted }}>
                  <Activity size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Select a formulary item</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Batches, FEFO, and reorder details</div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${T.line}`,
                      background: `linear-gradient(180deg, ${T.primarySoft}, ${T.surface})`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.primary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Item detail
                        </div>
                        <h3 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>
                          {selected.name}
                        </h3>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                          {selected.genericName} · {selected.form} {selected.strength}
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedId(null)} style={iconBtn}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Metric label="On hand" value={String(stockQty(facilityId, selected.id))} />
                    <Metric label="Reorder at" value={String(selected.reorderLevel)} />
                    <Metric label="Unit price" value={`₦${selected.unitPriceNgn.toLocaleString('en-NG')}`} />
                    <Metric label="Category" value={selected.category} />
                  </div>

                  {selected.controlled && (
                    <div
                      style={{
                        margin: '0 14px 12px',
                        padding: '8px 10px',
                        borderRadius: T.radius,
                        background: T.purpleSoft,
                        border: '1px solid #E9D8FD',
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.purple,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Shield size={13} /> Controlled substance — dispense with dual verification policy
                    </div>
                  )}

                  <div style={{ padding: '0 14px 6px', fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.06em' }}>
                    BATCHES · FEFO ORDER
                  </div>
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
                    {batches.length === 0 && (
                      <div style={{ fontSize: 12, color: T.muted, padding: '8px 0' }}>No batches on hand — receive stock</div>
                    )}
                    {batches
                      .slice()
                      .sort((a, b) => a.expiry.localeCompare(b.expiry))
                      .map((b) => {
                        const soon = new Date(b.expiry).getTime() < Date.now() + 90 * 864e5;
                        return (
                          <div
                            key={b.id}
                            style={{
                              padding: '9px 11px',
                              borderRadius: T.radius,
                              border: `1px solid ${soon ? '#FBD38D' : T.line}`,
                              background: soon ? T.warnSoft : T.surfaceAlt,
                              fontSize: 12,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: T.ink }}>
                              <span style={{ fontFamily: T.mono }}>{b.batchNo}</span>
                              <span>Qty {b.qty}</span>
                            </div>
                            <div style={{ color: T.muted, marginTop: 3, fontSize: 11 }}>
                              Exp {b.expiry}
                              {b.supplier ? ` · ${b.supplier}` : ''}
                              {soon && (
                                <span style={{ color: T.warn, fontWeight: 700 }}> · near expiry</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div style={{ padding: '0 14px 16px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRecv((r) => ({ ...r, drugId: selected.id }));
                        setShowReceive(true);
                      }}
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '11px 14px',
                        borderRadius: T.radius,
                        border: `1px solid ${T.accent}`,
                        background: T.accentSoft,
                        color: T.accent,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: T.font,
                      }}
                    >
                      <Boxes size={15} /> Receive stock for this item
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <PremiumModal title="Add medicine to formulary" onClose={() => setShowAdd(false)}>
          <form onSubmit={onAddDrug} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {(
              [
                ['name', 'Display / brand name', 'text'],
                ['genericName', 'Generic name', 'text'],
                ['strength', 'Strength', 'text'],
                ['category', 'Category', 'text'],
                ['unitPriceNgn', 'Unit price (₦)', 'number'],
                ['reorderLevel', 'Reorder level', 'number'],
              ] as const
            ).map(([key, label, type]) => (
              <Field key={key} label={label}>
                <input
                  required={key === 'name'}
                  type={type}
                  value={(form as Record<string, string | boolean>)[key] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            ))}
            <Field label="Dosage form">
              <select value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} style={inputStyle}>
                {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Other'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: T.ink }}>
              <input
                type="checkbox"
                checked={form.controlled}
                onChange={(e) => setForm({ ...form, controlled: e.target.checked })}
              />
              Controlled substance
            </label>
            <button type="submit" style={primaryBtn}>
              Save to formulary
            </button>
          </form>
        </PremiumModal>
      )}

      {showReceive && (
        <PremiumModal title="Receive stock (goods inward)" onClose={() => setShowReceive(false)}>
          <form onSubmit={onReceive} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Field label="Medicine">
              <select
                required
                value={recv.drugId || selectedId || ''}
                onChange={(e) => setRecv({ ...recv, drugId: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select…</option>
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Batch number">
              <input required value={recv.batchNo} onChange={(e) => setRecv({ ...recv, batchNo: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Expiry date">
              <input required type="date" value={recv.expiry} onChange={(e) => setRecv({ ...recv, expiry: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Quantity">
              <input required type="number" min={1} value={recv.qty} onChange={(e) => setRecv({ ...recv, qty: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Supplier">
              <input value={recv.supplier} onChange={(e) => setRecv({ ...recv, supplier: e.target.value })} style={inputStyle} />
            </Field>
            <button type="submit" style={primaryBtn}>
              Post goods receipt
            </button>
          </form>
        </PremiumModal>
      )}
    </div>
  );
};

function HdrBtn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 7,
        border: primary ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.22)',
        background: primary ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
        color: '#fff',
        fontWeight: 650,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: T.font,
      }}
    >
      {children}
    </button>
  );
}

function PillBadge({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'warn' | 'purple' }) {
  const map = {
    ok: { bg: T.okSoft, color: T.ok, border: '#C6F6D5' },
    warn: { bg: T.warnSoft, color: T.warn, border: '#FBD38D' },
    purple: { bg: T.purpleSoft, color: T.purple, border: '#E9D8FD' },
  }[tone];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.04em',
        padding: '2px 6px',
        borderRadius: 4,
        background: map.bg,
        color: map.color,
        border: `1px solid ${map.border}`,
      }}
    >
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 11px',
        borderRadius: T.radius,
        background: T.surfaceAlt,
        border: `1px solid ${T.line}`,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.03em' }}>
      {label}
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

function PremiumModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(26,35,50,0.48)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          borderRadius: 12,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 24px 48px rgba(26,35,50,0.28)',
          overflow: 'hidden',
          border: `1px solid ${T.line}`,
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${T.line}`,
            background: T.surfaceAlt,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.font }}>{title}</h3>
          <button type="button" onClick={onClose} style={iconBtn}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: T.radius,
  border: `1px solid ${T.lineStrong}`,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: T.font,
  background: T.surface,
  color: T.ink,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 11px',
  borderRadius: T.radius,
  border: `1px solid ${T.lineStrong}`,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: T.font,
  color: T.ink,
  background: T.surface,
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 14px',
  borderRadius: T.radius,
  border: 'none',
  background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: T.font,
  marginTop: 4,
  boxShadow: '0 4px 12px rgba(27,79,114,0.25)',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  border: `1px solid ${T.line}`,
  background: T.surface,
  cursor: 'pointer',
  color: T.muted,
};

export default PharmacyFormularyWorkspace;
