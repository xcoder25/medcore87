'use client';

/**
 * Official Akwa Ibom State EML browser — Adult (3rd ed. 2026) & Children (1st ed. 2026)
 */
import React, { useMemo, useState } from 'react';
import {
  searchEml,
  listEml,
  EML_META,
  EML_CATEGORIES,
  type EmlAudience,
  type EmlMedicine,
} from '../../lib/aksEmlFormulary';
import { Pill, Search, BookOpen, Baby, User, Shield, AlertTriangle } from 'lucide-react';

const C = {
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  blue: '#0284C7',
  teal: '#0D9488',
  green: '#059669',
};

function AwareBadge({ g }: { g?: string | null }) {
  if (!g) return null;
  const map: Record<string, { bg: string; color: string; label: string }> = {
    access: { bg: '#ECFDF5', color: '#047857', label: 'AWaRe · Access' },
    watch: { bg: '#FFFBEB', color: '#B45309', label: 'AWaRe · Watch' },
    reserve: { bg: '#FEF2F2', color: '#B91C1C', label: 'AWaRe · Reserve' },
  };
  const s = map[g];
  if (!s) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export const AksEmlFormularyPanel: React.FC = () => {
  const [audience, setAudience] = useState<EmlAudience>('adult');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<EmlMedicine | null>(null);

  const rows = useMemo(() => searchEml(audience, q, category), [audience, q, category]);
  const total = listEml(audience).length;
  const meta = EML_META[audience];
  const categories = useMemo(() => {
    const set = new Set(listEml(audience).map((r) => r.category));
    return ['All', ...Array.from(set).sort()];
  }, [audience]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero */}
      <div
        style={{
          borderRadius: 16,
          padding: '16px 18px',
          background: 'linear-gradient(120deg, #0B1220 0%, #0C4A6E 45%, #0F766E 100%)',
          color: '#fff',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9 }}>
            <BookOpen size={14} /> STATE FORMULARY · EML
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: '1.15rem', fontWeight: 800 }}>{meta.title}</h2>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
            {meta.edition} · {meta.authority}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => { setAudience('adult'); setSelected(null); setCategory('All'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
              border: audience === 'adult' ? '2px solid #fff' : '1px solid rgba(255,255,255,0.35)',
              background: audience === 'adult' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}
          >
            <User size={14} /> Adult
          </button>
          <button
            type="button"
            onClick={() => { setAudience('children'); setSelected(null); setCategory('All'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
              border: audience === 'children' ? '2px solid #fff' : '1px solid rgba(255,255,255,0.35)',
              background: audience === 'children' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}
          >
            <Baby size={14} /> Children
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{
          flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.border}`, background: '#F8FAFC',
        }}>
          <Search size={16} color={C.muted} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search medicine, form, category…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontWeight: 600, color: C.navy }}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.border}`,
            fontWeight: 700, fontSize: 13, color: C.navy, background: '#fff',
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
          {rows.length} of {total} items
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.2fr 0.8fr' : '1fr', gap: 14, alignItems: 'start' }}>
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          overflow: 'hidden', maxHeight: 480, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: C.muted, fontSize: 11, fontWeight: 800 }}>MEDICINE</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: C.muted, fontSize: 11, fontWeight: 800 }}>FORMS & STRENGTH</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: C.muted, fontSize: 11, fontWeight: 800 }}>CATEGORY</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = selected?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      style={{
                        cursor: 'pointer',
                        background: on ? '#E0F2FE' : '#fff',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: C.navy, verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Pill size={14} color={C.teal} />
                          {r.name}
                          <AwareBadge g={r.awareGroup} />
                          {r.notes && <AlertTriangle size={12} color="#D97706" />}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155', lineHeight: 1.4, verticalAlign: 'top', maxWidth: 320 }}>
                        {r.dosageForms}
                      </td>
                      <td style={{ padding: '10px 12px', color: C.muted, verticalAlign: 'top', fontSize: 12, fontWeight: 600 }}>
                        {r.subcategory || r.category}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                      No medicines match this search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div style={{
            background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
            padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Shield size={18} color={C.blue} />
              <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.06em' }}>
                ON STATE EML · {audience === 'adult' ? 'ADULT' : 'CHILDREN'}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy }}>{selected.name}</h3>
            <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              {selected.dosageForms}
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div><strong>Category:</strong> {selected.category}</div>
              {selected.subcategory && <div><strong>Subcategory:</strong> {selected.subcategory}</div>}
              {selected.awareGroup && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>Stewardship:</strong> <AwareBadge g={selected.awareGroup} />
                </div>
              )}
              {selected.notes && (
                <div style={{ padding: 10, borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontWeight: 600 }}>
                  {selected.notes}
                </div>
              )}
              {selected.complementary && (
                <div style={{ fontSize: 12, color: C.muted }}>Listed on complementary list</div>
              )}
            </div>
            <div style={{ marginTop: 16, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
              Source: {meta.edition}. Prescribers should prefer EML items; off-list use requires clinical justification per facility policy.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AksEmlFormularyPanel;
