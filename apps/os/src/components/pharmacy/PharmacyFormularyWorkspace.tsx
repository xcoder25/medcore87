'use client';

/**
 * EMR Formulary & inventory — live stock, batches, reorder, AKS EML reference.
 * Pharmacy desk primary formulary page.
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
  type FormularyDrug,
  type StockBatch,
} from '../../lib/formularyInventory';
import { AksEmlFormularyPanel } from './AksEmlFormularyPanel';
import { emitLiveAction } from '../../lib/liveActions';

const C = {
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  blue: '#2563EB',
  teal: '#0D9488',
  amber: '#D97706',
  red: '#DC2626',
  green: '#059669',
};

type Tab = 'inventory' | 'eml' | 'receive';

export const PharmacyFormularyWorkspace: React.FC = () => {
  const facilityId =
    (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>('inventory');
  const [drugs, setDrugs] = useState<FormularyDrug[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
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
    setDrugs(listFormulary(facilityId));
  }, [facilityId]);

  useEffect(() => {
    reload();
    return subscribeFormulary(reload);
  }, [reload]);

  const stats = useMemo(() => formularyStats(facilityId), [facilityId, drugs]);

  const categories = useMemo(() => {
    const s = new Set(drugs.map((d) => d.category).filter(Boolean));
    return ['all', ...Array.from(s).sort()];
  }, [drugs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return drugs
      .filter((d) => (category === 'all' ? true : d.category === category))
      .filter(
        (d) =>
          !qq ||
          d.name.toLowerCase().includes(qq) ||
          d.genericName.toLowerCase().includes(qq) ||
          d.category.toLowerCase().includes(qq)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drugs, q, category]);

  const selected = drugs.find((d) => d.id === selectedId) || null;
  const batches: StockBatch[] = selected
    ? listBatches(facilityId, selected.id)
    : [];

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
    reload();
    emitLiveAction(`Formulary: added ${form.name.trim()}`, { module: 'pharmacy' });
    showT(`Added ${form.name.trim()} to formulary`);
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
    reload();
    const name = drugs.find((d) => d.id === drugId)?.name || drugId;
    emitLiveAction(`Stock received: ${name}`, { module: 'pharmacy' });
    showT(`Stock received for ${name}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px 24px' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 99999,
            background: '#0F172A',
            color: '#F1F5F9',
            padding: '12px 18px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} color="#34D399" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#0D9488,#2563EB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pill size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.navy }}>
                Formulary & inventory
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
                Live stock · batches · reorder alerts · AKS EML reference
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => reload()}
            style={ghostBtn}
            title="Refresh"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowReceive(true)}
            style={ghostBtn}
          >
            <Boxes size={14} /> Receive stock
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              ...ghostBtn,
              background: 'linear-gradient(135deg,#0D9488,#2563EB)',
              color: '#fff',
              border: 'none',
            }}
          >
            <Plus size={14} /> Add medicine
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {[
          { label: 'Items on formulary', value: stats.items, icon: Package, tone: C.blue },
          { label: 'Units in stock', value: stats.totalUnits, icon: Boxes, tone: C.teal },
          { label: 'Low stock', value: stats.lowStock, icon: AlertTriangle, tone: C.amber },
          { label: 'Expiring ≤90d', value: stats.expiringBatches, icon: Clock, tone: C.red },
          { label: 'Controlled', value: stats.controlled, icon: Shield, tone: '#7C3AED' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: '#fff',
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              boxShadow: '0 4px 14px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 11, fontWeight: 700 }}>
              <k.icon size={13} color={k.tone} />
              {k.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: C.navy }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(
          [
            { id: 'inventory' as Tab, label: 'Facility inventory', icon: Package },
            { id: 'eml' as Tab, label: 'AKS EML reference', icon: Shield },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              border: tab === t.id ? `1px solid ${C.teal}` : `1px solid ${C.border}`,
              background: tab === t.id ? 'rgba(13,148,136,0.1)' : '#fff',
              color: tab === t.id ? C.teal : C.navy,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'eml' && (
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: 8,
            minHeight: 420,
          }}
        >
          <AksEmlFormularyPanel />
        </div>
      )}

      {tab === 'inventory' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
            gap: 14,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
              boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: 11, color: C.muted }}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, generic, category…"
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 32px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    fontSize: 13,
                  }}
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All categories' : c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                    {['Medicine', 'Form', 'Category', 'Price', 'Stock', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          fontSize: 11,
                          fontWeight: 800,
                          color: C.muted,
                          letterSpacing: '0.04em',
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
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        style={{
                          cursor: 'pointer',
                          background: selectedId === d.id ? 'rgba(37,99,235,0.06)' : undefined,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        <td style={{ padding: '11px 12px' }}>
                          <div style={{ fontWeight: 700, color: C.navy }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{d.genericName}</div>
                        </td>
                        <td style={{ padding: '11px 12px', color: '#475569' }}>
                          {d.form} · {d.strength}
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 8,
                              background: '#F1F5F9',
                              color: '#334155',
                            }}
                          >
                            {d.category}
                          </span>
                        </td>
                        <td style={{ padding: '11px 12px', fontWeight: 700 }}>
                          ₦{d.unitPriceNgn.toLocaleString('en-NG')}
                        </td>
                        <td style={{ padding: '11px 12px', fontWeight: 800 }}>{qty}</td>
                        <td style={{ padding: '11px 12px' }}>
                          {d.controlled && (
                            <span style={{ ...chip, background: '#EDE9FE', color: '#6D28D9' }}>
                              Controlled
                            </span>
                          )}
                          {low ? (
                            <span style={{ ...chip, background: '#FEF3C7', color: '#B45309' }}>
                              Low
                            </span>
                          ) : (
                            <span style={{ ...chip, background: '#D1FAE5', color: '#047857' }}>
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                        No medicines match — add to formulary or clear filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 16,
              boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
              minHeight: 280,
            }}
          >
            {!selected ? (
              <div style={{ color: C.muted, fontSize: 13, padding: 12 }}>
                Select a medicine to view batches, expiry, and reorder level.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.navy }}>
                      {selected.name}
                    </h3>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                      {selected.genericName} · {selected.form} {selected.strength}
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} style={{ ...ghostBtn, padding: 6 }}>
                    <X size={14} />
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <div style={detailBox}>
                    <div style={detailLabel}>On hand</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>{stockQty(facilityId, selected.id)}</div>
                  </div>
                  <div style={detailBox}>
                    <div style={detailLabel}>Reorder at</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>{selected.reorderLevel}</div>
                  </div>
                  <div style={detailBox}>
                    <div style={detailLabel}>Unit price</div>
                    <div style={{ fontWeight: 800 }}>₦{selected.unitPriceNgn.toLocaleString('en-NG')}</div>
                  </div>
                  <div style={detailBox}>
                    <div style={detailLabel}>Category</div>
                    <div style={{ fontWeight: 700 }}>{selected.category}</div>
                  </div>
                </div>
                <div style={{ marginTop: 16, fontSize: 12, fontWeight: 800, color: C.muted }}>
                  BATCHES (FEFO)
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {batches.length === 0 && (
                    <div style={{ fontSize: 12, color: C.muted }}>No batches — receive stock</div>
                  )}
                  {batches
                    .slice()
                    .sort((a, b) => a.expiry.localeCompare(b.expiry))
                    .map((b) => (
                      <div
                        key={b.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          background: '#F8FAFC',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{b.batchNo}</div>
                        <div style={{ color: C.muted, marginTop: 2 }}>
                          Qty {b.qty} · Exp {b.expiry}
                          {b.supplier ? ` · ${b.supplier}` : ''}
                        </div>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecv((r) => ({ ...r, drugId: selected.id }));
                    setShowReceive(true);
                  }}
                  style={{
                    ...ghostBtn,
                    marginTop: 14,
                    width: '100%',
                    justifyContent: 'center',
                    background: 'rgba(13,148,136,0.1)',
                    borderColor: C.teal,
                    color: C.teal,
                  }}
                >
                  <Boxes size={14} /> Receive stock for this item
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add medicine modal */}
      {showAdd && (
        <Modal title="Add medicine to formulary" onClose={() => setShowAdd(false)}>
          <form onSubmit={onAddDrug} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(
              [
                ['name', 'Brand / display name', 'text'],
                ['genericName', 'Generic name', 'text'],
                ['strength', 'Strength', 'text'],
                ['category', 'Category', 'text'],
                ['unitPriceNgn', 'Unit price (₦)', 'number'],
                ['reorderLevel', 'Reorder level', 'number'],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key} style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
                {label}
                <input
                  required={key === 'name'}
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={inputStyle}
                />
              </label>
            ))}
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
              Dosage form
              <select
                value={form.form}
                onChange={(e) => setForm({ ...form, form: e.target.value })}
                style={inputStyle}
              >
                {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Other'].map(
                  (f) => (
                    <option key={f}>{f}</option>
                  )
                )}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
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
        </Modal>
      )}

      {showReceive && (
        <Modal title="Receive stock" onClose={() => setShowReceive(false)}>
          <form onSubmit={onReceive} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
              Medicine
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
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
              Batch number
              <input
                required
                value={recv.batchNo}
                onChange={(e) => setRecv({ ...recv, batchNo: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
              Expiry
              <input
                required
                type="date"
                value={recv.expiry}
                onChange={(e) => setRecv({ ...recv, expiry: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
              Quantity
              <input
                required
                type="number"
                min={1}
                value={recv.qty}
                onChange={(e) => setRecv({ ...recv, qty: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
              Supplier
              <input
                value={recv.supplier}
                onChange={(e) => setRecv({ ...recv, supplier: e.target.value })}
                style={inputStyle}
              />
            </label>
            <button type="submit" style={primaryBtn}>
              Post receipt
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

function Modal({
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
        background: 'rgba(15,23,42,0.45)',
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
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 420,
          padding: 20,
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ ...ghostBtn, padding: 6 }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  color: C.navy,
};

const primaryBtn: React.CSSProperties = {
  ...ghostBtn,
  background: 'linear-gradient(135deg,#0D9488,#2563EB)',
  color: '#fff',
  border: 'none',
  justifyContent: 'center',
  padding: '12px 14px',
  marginTop: 6,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '9px 11px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  fontWeight: 500,
};

const chip: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 800,
  padding: '2px 8px',
  borderRadius: 6,
  marginRight: 4,
};

const detailBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: '#F8FAFC',
  border: `1px solid ${C.border}`,
};

const detailLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: C.muted,
  letterSpacing: '0.04em',
  marginBottom: 4,
};

export default PharmacyFormularyWorkspace;
