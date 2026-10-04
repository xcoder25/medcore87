'use client';

/**
 * Full EMR facility setup — identity, capacity, services, diagnostics, pharmacy,
 * emergency/maternity, OPD clinics, operations. Agentic ward/bed layout via M87.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, CheckCircle2, MapPin, Phone, Globe, Save, Shield,
  BedDouble, Sparkles, Plus, Trash2, Loader2, FlaskConical, Pill,
  Ambulance, Stethoscope, Clock, CreditCard, Activity, Baby,
  Hospital, Radar,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { emitLiveAction } from '../../lib/liveActions';
import { listBeds, listWards } from '../../lib/bedBoardStore';
import { geminiGenerate, hasGeminiKey } from '../../lib/geminiClient';
import {
  loadFacilityCatalog,
  saveFacilityCatalog,
  applyCatalogWardsToBedBoard,
  catalogCompleteness,
  newWardRow,
  newTheatre,
  newClinic,
  subscribeFacilityCatalog,
  applyServicePackByTier,
  bulkCreateTheatres,
  bulkCreateStandardClinics,
  applyDiagnosticsStandard,
  applyPharmacyStandard,
  mergeAiFacilityPatch,
  CLINICAL_SERVICE_LABELS,
  LAB_LABELS,
  RADIOLOGY_LABELS,
  PHARMACY_LABELS,
  type FacilityCatalog,
  type ClinicalServiceKey,
  type LabCapabilityKey,
  type RadiologyModalityKey,
  type PharmacyCapabilityKey,
  type WardCapacityRow,
} from '../../lib/facilityCatalogStore';

type Section =
  | 'identity'
  | 'capacity'
  | 'services'
  | 'diagnostics'
  | 'pharmacy'
  | 'emergency'
  | 'clinics'
  | 'operations';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'identity', label: 'Identity & licence', icon: <Building2 size={15} /> },
  { id: 'capacity', label: 'Beds & units', icon: <BedDouble size={15} /> },
  { id: 'services', label: 'Clinical services', icon: <Stethoscope size={15} /> },
  { id: 'diagnostics', label: 'Lab & imaging', icon: <FlaskConical size={15} /> },
  { id: 'pharmacy', label: 'Pharmacy & blood', icon: <Pill size={15} /> },
  { id: 'emergency', label: 'Emergency & maternity', icon: <Ambulance size={15} /> },
  { id: 'clinics', label: 'OPD clinics', icon: <Hospital size={15} /> },
  { id: 'operations', label: 'Hours & payers', icon: <Clock size={15} /> },
];

function fallbackLayout(totalBeds: number, facilityType: string): WardCapacityRow[] {
  const t = (facilityType || '').toLowerCase();
  const isCottage = t.includes('cottage') || t.includes('primary');
  const isChc = t.includes('comprehensive') || t.includes('health care');
  const plans: { ward: string; prefix: string; weight: number; category: WardCapacityRow['category'] }[] =
    isCottage
      ? [
          { ward: 'General Ward', prefix: 'GW', weight: 0.5, category: 'general' },
          { ward: 'Maternity', prefix: 'MT', weight: 0.25, category: 'maternity' },
          { ward: 'Paediatrics', prefix: 'PD', weight: 0.15, category: 'paediatric' },
          { ward: 'Emergency Bay', prefix: 'AE', weight: 0.1, category: 'emergency' },
        ]
      : isChc
        ? [
            { ward: 'Male Medical', prefix: 'MM', weight: 0.25, category: 'general' },
            { ward: 'Female Medical', prefix: 'FM', weight: 0.25, category: 'general' },
            { ward: 'Maternity', prefix: 'MT', weight: 0.2, category: 'maternity' },
            { ward: 'Paediatrics', prefix: 'PD', weight: 0.15, category: 'paediatric' },
            { ward: 'Emergency', prefix: 'AE', weight: 0.1, category: 'emergency' },
            { ward: 'Isolation', prefix: 'ISO', weight: 0.05, category: 'isolation' },
          ]
        : [
            { ward: 'Male Medical', prefix: 'MM', weight: 0.18, category: 'general' },
            { ward: 'Female Medical', prefix: 'FM', weight: 0.18, category: 'general' },
            { ward: 'Surgical', prefix: 'SG', weight: 0.14, category: 'surgical' },
            { ward: 'Paediatrics', prefix: 'PD', weight: 0.1, category: 'paediatric' },
            { ward: 'Maternity', prefix: 'MT', weight: 0.12, category: 'maternity' },
            { ward: 'ICU', prefix: 'ICU', weight: 0.08, category: 'icu' },
            { ward: 'Emergency / A&E', prefix: 'AE', weight: 0.1, category: 'emergency' },
            { ward: 'Isolation', prefix: 'ISO', weight: 0.05, category: 'isolation' },
            { ward: 'PACU', prefix: 'PACU', weight: 0.05, category: 'other' },
          ];

  const target = Math.max(totalBeds || 40, 8);
  let remaining = target;
  return plans.map((p, i) => {
    const n =
      i === plans.length - 1 ? Math.max(1, remaining) : Math.max(1, Math.round(target * p.weight));
    remaining -= n;
    return newWardRow({ ward: p.ward, prefix: p.prefix, count: n, category: p.category });
  });
}

async function suggestWardLayout(catalog: FacilityCatalog): Promise<{
  rows: WardCapacityRow[];
  note: string;
}> {
  const total = Math.max(catalog.targetTotalBeds || 40, 8);
  const system =
    'You are M87, MedCore hospital OS for Nigerian public hospitals. ' +
    'Return ONLY JSON (no markdown): {"wards":[{"ward":"Male Medical","prefix":"MM","count":12,"category":"general"}],' +
    '"icuBeds":4,"hduBeds":2,"nicuCots":2,"isolationBeds":2,"emergencyBays":6,"deliverySuites":2,"theatreCount":2}. ' +
    'Categories: general|maternity|paediatric|icu|hdu|isolation|emergency|surgical|other. Counts ~ totalBeds.';

  const prompt = `Ward layout for EMR facility setup:
Name: ${catalog.name}
Type: ${catalog.type} · Tier: ${catalog.tier}
Target beds: ${total}
Services on: ${Object.entries(catalog.services || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')}`;

  try {
    if (hasGeminiKey()) {
      const res = await geminiGenerate(prompt, system);
      if (res.ok && res.text) {
        const cleaned = res.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned) as {
          wards?: { ward?: string; prefix?: string; count?: number; category?: string }[];
          icuBeds?: number;
          hduBeds?: number;
          nicuCots?: number;
          isolationBeds?: number;
          emergencyBays?: number;
          deliverySuites?: number;
          theatreCount?: number;
        };
        if (Array.isArray(parsed.wards) && parsed.wards.length) {
          const rows = parsed.wards
            .filter((w) => w.ward && w.prefix && Number(w.count) > 0)
            .map((w) =>
              newWardRow({
                ward: String(w.ward),
                prefix: String(w.prefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
                count: Math.max(1, Math.min(200, Number(w.count) || 1)),
                category: (w.category as WardCapacityRow['category']) || 'general',
              })
            );
          if (rows.length) {
            return {
              rows,
              note: `M87 suggested ${rows.length} wards · ${rows.reduce((s, r) => s + r.count, 0)} beds`,
            };
          }
        }
      }
    }
  } catch {
    /* fallback */
  }
  const rows = fallbackLayout(total, catalog.type);
  return {
    rows,
    note: `Offline template · ${rows.length} wards · ${rows.reduce((s, r) => s + r.count, 0)} beds`,
  };
}

interface Props {
  session?: UserSession;
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: '0.88rem',
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  color: '#0A2540',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#334155',
};

function ToggleChip({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 12px',
        borderRadius: 999,
        border: on ? '1px solid #0052D4' : '1px solid #E2E8F0',
        background: on ? 'rgba(0,82,212,0.1)' : '#F8FAFC',
        color: on ? '#0052D4' : '#64748B',
        fontWeight: 600,
        fontSize: '0.78rem',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {on ? '✓ ' : ''}
      {label}
    </button>
  );
}

export const FacilityOnboarding: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'UNKNOWN';
  const [section, setSection] = useState<Section>('identity');
  const [catalog, setCatalog] = useState<FacilityCatalog>(() =>
    loadFacilityCatalog(facilityId, session?.facility)
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bedTick, setBedTick] = useState(0);
  const [live, setLive] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(true);

  useEffect(() => {
    setCatalog(loadFacilityCatalog(facilityId, session?.facility));
  }, [facilityId, session?.facility]);

  // Realtime: other workstations / tabs update this admin's catalog live
  useEffect(() => {
    if (!facilityId || facilityId === 'UNKNOWN') return;
    const unsub = subscribeFacilityCatalog(facilityId, (remote) => {
      setCatalog(remote);
      setLive(true);
      setBedTick((t) => t + 1);
    });
    setLive(true);
    return unsub;
  }, [facilityId]);

  const existingBeds = useMemo(() => {
    void bedTick;
    return listBeds(facilityId);
  }, [facilityId, bedTick]);
  const existingWards = useMemo(() => listWards(facilityId), [facilityId, existingBeds]);
  const completeness = useMemo(() => catalogCompleteness(catalog), [catalog]);
  const planTotal = (catalog.wards || []).reduce((s, r) => s + (Number(r.count) || 0), 0);

  const patch = (partial: Partial<FacilityCatalog>) =>
    setCatalog((c) => ({ ...c, ...partial }));

  const saveAll = (markComplete = false) => {
    setBusy(true);
    try {
      const next = saveFacilityCatalog(
        {
          ...catalog,
          name: catalog.name || session?.facility || '',
          setupComplete: markComplete || catalog.setupComplete,
          targetTotalBeds: catalog.targetTotalBeds || planTotal || existingBeds.length,
        },
        session?.name
      );
      setCatalog(next);
      setMsg('Facility catalog saved');
      emitLiveAction(`Facility catalog saved · ${next.name}`, { module: 'facility-catalog' });
    } finally {
      setBusy(false);
    }
  };

  const runAiSuggest = async () => {
    setAiLoading(true);
    setAiNote(null);
    try {
      const result = await suggestWardLayout(catalog);
      setCatalog((c) => ({
        ...c,
        wards: result.rows,
        targetTotalBeds: c.targetTotalBeds || result.rows.reduce((s, r) => s + r.count, 0),
      }));
      setAiNote(result.note);
    } finally {
      setAiLoading(false);
    }
  };

  /** Single or bulk AI automation from natural language / quick actions */
  const runAiAutomate = async (mode: 'prompt' | 'full' | 'wards' | 'services' | 'clinics' | 'theatres' | 'diagnostics' | 'pharmacy') => {
    setAiLoading(true);
    setAiNote(null);
    setMsg(null);
    try {
      if (mode === 'services') {
        const next = applyServicePackByTier(catalog, 'auto');
        setCatalog(next);
        setAiNote('Service pack applied from facility type/tier (bulk)');
        return;
      }
      if (mode === 'clinics') {
        const clinics = bulkCreateStandardClinics(catalog.type);
        setCatalog((c) => ({ ...c, clinics }));
        setAiNote(`Bulk clinics: ${clinics.length} OPD clinics generated`);
        return;
      }
      if (mode === 'theatres') {
        const n = Math.max(catalog.theatreCount || 2, 2);
        const theatres = bulkCreateTheatres(n);
        setCatalog((c) => ({ ...c, theatres, theatreCount: theatres.length }));
        setAiNote(`Bulk theatres: ${theatres.length} theatres generated`);
        return;
      }
      if (mode === 'diagnostics') {
        setCatalog(applyDiagnosticsStandard(catalog, 'standard'));
        setAiNote('Standard lab + imaging pack applied (bulk)');
        return;
      }
      if (mode === 'pharmacy') {
        setCatalog(applyPharmacyStandard(catalog, 'standard'));
        setAiNote('Standard pharmacy pack applied (bulk)');
        return;
      }
      if (mode === 'wards') {
        await runAiSuggest();
        return;
      }

      // full or prompt — try Gemini, then offline cascade
      const system =
        'You are M87, MedCore hospital OS for Nigerian public hospitals. ' +
        'Return ONLY JSON (no markdown) matching FacilityCatalog partial fields: ' +
        '{"name","type","tier","targetTotalBeds","icuBeds","hduBeds","nicuCots","isolationBeds","emergencyBays","deliverySuites","theatreCount","ambulanceCount",' +
        '"wards":[{"ward","prefix","count","category"}],"theatres":[{"name","type","hasLaminarFlow"}],' +
        '"clinics":[{"name","specialty","days","slotsPerDay"}],' +
        '"services":{"general_medicine":true},' +
        '"labCapabilities":{"haematology":true},"radiologyModalities":{"xray":true},"pharmacyCapabilities":{"outpatient_dispensary":true},' +
        '"hasBloodBank":true,"operates24x7":true,"emergency24x7":true,"acceptsNhis":true}. Use realistic Akwa Ibom secondary hospital defaults.';

      const userPrompt =
        mode === 'prompt' && aiPrompt.trim()
          ? aiPrompt.trim()
          : `Fully set up EMR facility catalog for: ${catalog.name || session?.facility || 'General Hospital'} (${catalog.type}, ${catalog.tier}). Target ~${catalog.targetTotalBeds || 80} beds. Include wards, theatres, clinics, services, lab, radiology, pharmacy.`;

      let applied = false;
      if (hasGeminiKey()) {
        const res = await geminiGenerate(userPrompt, system);
        if (res.ok && res.text) {
          try {
            const cleaned = res.text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            setCatalog((c) => mergeAiFacilityPatch(c, parsed));
            setAiNote('M87 AI applied full catalog patch (realtime-ready — Save to sync peers)');
            applied = true;
          } catch {
            /* fall through */
          }
        }
      }
      if (!applied) {
        // Offline full cascade
        let next = applyServicePackByTier(catalog, 'auto');
        next = applyDiagnosticsStandard(next, 'standard');
        next = applyPharmacyStandard(next, 'standard');
        const wardResult = await suggestWardLayout(next);
        next = {
          ...next,
          wards: wardResult.rows,
          targetTotalBeds: next.targetTotalBeds || wardResult.rows.reduce((s, r) => s + r.count, 0),
          clinics: bulkCreateStandardClinics(next.type),
          theatres: bulkCreateTheatres(Math.max(next.theatreCount || 2, 2)),
          theatreCount: Math.max(next.theatreCount || 2, 2),
        };
        setCatalog(next);
        setAiNote('Offline automation: services + diagnostics + pharmacy + wards + clinics + theatres (bulk)');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const applyBeds = () => {
    setBusy(true);
    setMsg(null);
    try {
      const saved = saveFacilityCatalog(catalog, session?.name);
      const result = applyCatalogWardsToBedBoard(saved, session?.name);
      setCatalog({
        ...saved,
        targetTotalBeds: result.total || saved.targetTotalBeds,
      });
      setBedTick((t) => t + 1);
      setMsg(
        `Created ${result.created} bed(s). Board now ${result.total} beds across ${result.wards} wards.`
      );
    } catch (e: unknown) {
      setMsg((e as Error)?.message || 'Failed to apply beds');
    } finally {
      setBusy(false);
    }
  };

  const toggleService = (key: ClinicalServiceKey) =>
    setCatalog((c) => ({
      ...c,
      services: { ...c.services, [key]: !c.services?.[key] },
    }));
  const toggleLab = (key: LabCapabilityKey) =>
    setCatalog((c) => ({
      ...c,
      labCapabilities: { ...c.labCapabilities, [key]: !c.labCapabilities?.[key] },
    }));
  const toggleRad = (key: RadiologyModalityKey) =>
    setCatalog((c) => ({
      ...c,
      radiologyModalities: { ...c.radiologyModalities, [key]: !c.radiologyModalities?.[key] },
    }));
  const togglePharm = (key: PharmacyCapabilityKey) =>
    setCatalog((c) => ({
      ...c,
      pharmacyCapabilities: {
        ...c.pharmacyCapabilities,
        [key]: !c.pharmacyCapabilities?.[key],
      },
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1040 }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #E0F2FE 0%, #ECFDF5 100%)',
          borderRadius: 16,
          padding: 18,
          border: '1px solid #BAE6FD',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Building2 size={22} color="#0052D4" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: '#0A2540' }}>
              Hospital facility setup (EMR)
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: '#475569' }}>
              Configure everything an EMR needs for <strong>{catalog.name || session?.facility}</strong> (
              {facilityId}) — capacity, services, diagnostics, pharmacy, emergency, clinics, and operations.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                background: completeness.score >= 80 ? 'rgba(5,150,105,0.12)' : 'rgba(217,119,6,0.12)',
                color: completeness.score >= 80 ? '#047857' : '#B45309',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Setup {completeness.score}%
            </span>
            {completeness.missing.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Missing: {completeness.missing.slice(0, 3).join(', ')}
                {completeness.missing.length > 3 ? '…' : ''}
              </span>
            )}
          </div>
          {live && (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                background: 'rgba(16,185,129,0.12)',
                color: '#047857',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}
              title="Changes sync across workstations via local + Firestore"
            >
              ● Live
            </span>
          )}
        </div>
      </div>

      {/* AI Assist — single + bulk */}
      {showAiPanel && (
        <div
          style={{
            background: 'linear-gradient(135deg, #F5F3FF 0%, #EFF6FF 100%)',
            borderRadius: 16,
            border: '1px solid #DDD6FE',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Sparkles size={18} color="#7C3AED" />
            <strong style={{ color: '#0A2540', fontSize: '0.9rem' }}>M87 AI Assist</strong>
            <span style={{ fontSize: '0.78rem', color: '#64748B', flex: 1 }}>
              Automate one section or the whole facility catalog (single + bulk). Save publishes realtime to all workstations.
            </span>
            <button
              type="button"
              onClick={() => setShowAiPanel(false)}
              style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              Hide
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='e.g. "80-bed general hospital in Eket with 2 theatres, full maternity, NHIS…"'
              style={{
                flex: 1,
                minWidth: 220,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #C4B5FD',
                fontSize: '0.85rem',
              }}
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => runAiAutomate(aiPrompt.trim() ? 'prompt' : 'full')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #7C3AED, #0052D4)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: aiLoading ? 'wait' : 'pointer',
              }}
            >
              {aiLoading ? <Loader2 size={15} /> : <Sparkles size={15} />}
              {aiLoading ? 'Working…' : 'Run AI setup'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['full', 'Full catalog'],
                ['wards', 'Wards (bulk)'],
                ['services', 'Services pack'],
                ['clinics', 'Clinics (bulk)'],
                ['theatres', 'Theatres (bulk)'],
                ['diagnostics', 'Lab + imaging'],
                ['pharmacy', 'Pharmacy pack'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                disabled={aiLoading}
                onClick={() => runAiAutomate(mode)}
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: '1px solid #C4B5FD',
                  background: '#fff',
                  color: '#5B21B6',
                  fontWeight: 650,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {aiNote && (
            <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#5B21B6', fontWeight: 600 }}>{aiNote}</p>
          )}
        </div>
      )}
      {!showAiPanel && (
        <button
          type="button"
          onClick={() => setShowAiPanel(true)}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #DDD6FE',
            background: '#F5F3FF',
            color: '#7C3AED',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={14} /> Show M87 AI Assist
        </button>
      )}

      {/* Section nav */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: section === s.id ? '1px solid #0052D4' : '1px solid #E2E8F0',
              background: section === s.id ? 'rgba(0,82,212,0.08)' : '#fff',
              color: section === s.id ? '#0052D4' : '#475569',
              fontWeight: 650,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: 20,
        }}
      >
        {/* ── Identity ─────────────────────────────────────────── */}
        {section === 'identity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
              Identity & licensing
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <label style={labelStyle}>
                Hospital name
                <input style={inputStyle} value={catalog.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Type
                <input style={inputStyle} value={catalog.type} onChange={(e) => patch({ type: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Tier
                <input style={inputStyle} value={catalog.tier} onChange={(e) => patch({ tier: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Ownership
                <select
                  style={inputStyle}
                  value={catalog.ownership}
                  onChange={(e) => patch({ ownership: e.target.value as FacilityCatalog['ownership'] })}
                >
                  <option value="public_state">Public (State)</option>
                  <option value="public_federal">Public (Federal)</option>
                  <option value="mission">Mission / Faith-based</option>
                  <option value="private">Private</option>
                  <option value="ppp">PPP</option>
                </select>
              </label>
              <label style={labelStyle}>
                LGA
                <input style={inputStyle} value={catalog.lga} onChange={(e) => patch({ lga: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Phone
                <input style={inputStyle} value={catalog.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Email
                <input style={inputStyle} value={catalog.email} onChange={(e) => patch({ email: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Licence No.
                <input style={inputStyle} value={catalog.licenseNo} onChange={(e) => patch({ licenseNo: e.target.value })} />
              </label>
              <label style={labelStyle}>
                Licence expiry
                <input
                  type="date"
                  style={inputStyle}
                  value={catalog.licenseExpiry}
                  onChange={(e) => patch({ licenseExpiry: e.target.value })}
                />
              </label>
              <label style={labelStyle}>
                Registration / HFR No.
                <input
                  style={inputStyle}
                  value={catalog.registrationNo || ''}
                  onChange={(e) => patch({ registrationNo: e.target.value })}
                />
              </label>
              <label style={labelStyle}>
                Medical Director
                <input
                  style={inputStyle}
                  value={catalog.medicalDirector}
                  onChange={(e) => patch({ medicalDirector: e.target.value })}
                />
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Address
                <input style={inputStyle} value={catalog.address} onChange={(e) => patch({ address: e.target.value })} />
              </label>
            </div>
            {(catalog.address || catalog.phone || catalog.email) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: '#475569' }}>
                {catalog.address && (
                  <span>
                    <MapPin size={14} color="#0052D4" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {catalog.address}
                  </span>
                )}
                {catalog.phone && (
                  <span>
                    <Phone size={14} color="#0052D4" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {catalog.phone}
                  </span>
                )}
                {catalog.email && (
                  <span>
                    <Globe size={14} color="#0052D4" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {catalog.email}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Capacity ─────────────────────────────────────────── */}
        {section === 'capacity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540', flex: 1 }}>
                Beds, wards & critical units
              </h3>
              <button
                type="button"
                onClick={runAiSuggest}
                disabled={aiLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #7C3AED, #0052D4)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: aiLoading ? 'wait' : 'pointer',
                }}
              >
                {aiLoading ? <Loader2 size={14} /> : <Sparkles size={14} />}
                {aiLoading ? 'Suggesting…' : 'M87 suggest layout'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {(
                [
                  ['Target beds', 'targetTotalBeds'],
                  ['ICU beds', 'icuBeds'],
                  ['HDU beds', 'hduBeds'],
                  ['NICU cots', 'nicuCots'],
                  ['Isolation', 'isolationBeds'],
                  ['A&E bays', 'emergencyBays'],
                  ['Delivery suites', 'deliverySuites'],
                  ['Theatres', 'theatreCount'],
                  ['Ambulances', 'ambulanceCount'],
                ] as const
              ).map(([label, key]) => (
                <label key={key} style={labelStyle}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    style={inputStyle}
                    value={catalog[key] as number}
                    onChange={(e) => patch({ [key]: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              <div style={{ background: '#F0F9FF', borderRadius: 12, padding: 12, border: '1px solid #BAE6FD' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369A1' }}>ON BOARD</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{existingBeds.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{existingWards.length} wards</div>
              </div>
              <div style={{ background: '#F5F3FF', borderRadius: 12, padding: 12, border: '1px solid #DDD6FE' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6D28D9' }}>PLAN</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{planTotal}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{catalog.wards.length} planned</div>
              </div>
              <div style={{ background: '#ECFDF5', borderRadius: 12, padding: 12, border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857' }}>TARGET</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{catalog.targetTotalBeds || '—'}</div>
              </div>
            </div>

            {aiNote && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#5B21B6', fontWeight: 600 }}>
                <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {aiNote}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 0.6fr 0.5fr 0.7fr auto',
                  gap: 8,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#64748B',
                }}
              >
                <span>Ward</span>
                <span>Prefix</span>
                <span>Beds</span>
                <span>Category</span>
                <span />
              </div>
              {catalog.wards.map((row) => (
                <div
                  key={row.id}
                  style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.6fr 0.5fr 0.7fr auto', gap: 8 }}
                >
                  <input
                    style={inputStyle}
                    value={row.ward}
                    placeholder="Ward name"
                    onChange={(e) =>
                      setCatalog((c) => ({
                        ...c,
                        wards: c.wards.map((w) => (w.id === row.id ? { ...w, ward: e.target.value } : w)),
                      }))
                    }
                  />
                  <input
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                    value={row.prefix}
                    placeholder="MM"
                    onChange={(e) =>
                      setCatalog((c) => ({
                        ...c,
                        wards: c.wards.map((w) =>
                          w.id === row.id
                            ? {
                                ...w,
                                prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
                              }
                            : w
                        ),
                      }))
                    }
                  />
                  <input
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={row.count}
                    onChange={(e) =>
                      setCatalog((c) => ({
                        ...c,
                        wards: c.wards.map((w) =>
                          w.id === row.id ? { ...w, count: Math.max(1, Number(e.target.value) || 1) } : w
                        ),
                      }))
                    }
                  />
                  <select
                    style={inputStyle}
                    value={row.category}
                    onChange={(e) =>
                      setCatalog((c) => ({
                        ...c,
                        wards: c.wards.map((w) =>
                          w.id === row.id
                            ? { ...w, category: e.target.value as WardCapacityRow['category'] }
                            : w
                        ),
                      }))
                    }
                  >
                    {['general', 'maternity', 'paediatric', 'icu', 'hdu', 'isolation', 'emergency', 'surgical', 'other'].map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      )
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setCatalog((c) => ({ ...c, wards: c.wards.filter((w) => w.id !== row.id) }))
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setCatalog((c) => ({ ...c, wards: [...c.wards, newWardRow()] }))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px dashed #94A3B8',
                  background: '#fff',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add ward
              </button>
              <button
                type="button"
                onClick={applyBeds}
                disabled={busy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#059669',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={14} /> Apply wards to bed board
              </button>
            </div>

            {/* Theatres list */}
            <div style={{ marginTop: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 750, color: '#0A2540' }}>
                <Activity size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Operating theatres
              </h4>
              {(catalog.theatres || []).map((th) => (
                <div
                  key={th.id}
                  style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr auto auto', gap: 8, marginBottom: 6 }}
                >
                  <input
                    style={inputStyle}
                    value={th.name}
                    onChange={(e) =>
                      setCatalog((c) => ({
                        ...c,
                        theatres: c.theatres.map((t) => (t.id === th.id ? { ...t, name: e.target.value } : t)),
                      }))
                    }
                  />
                  <select
                    style={inputStyle}
                    value={th.type}
                    onChange={(e) =>
                      setCatalog((c) => ({
                        ...c,
                        theatres: c.theatres.map((t) =>
                          t.id === th.id ? { ...t, type: e.target.value as typeof th.type } : t
                        ),
                      }))
                    }
                  >
                    <option value="main">Main</option>
                    <option value="emergency">Emergency</option>
                    <option value="obstetric">Obstetric</option>
                    <option value="day_case">Day case</option>
                    <option value="minor">Minor</option>
                  </select>
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={th.hasLaminarFlow}
                      onChange={(e) =>
                        setCatalog((c) => ({
                          ...c,
                          theatres: c.theatres.map((t) =>
                            t.id === th.id ? { ...t, hasLaminarFlow: e.target.checked } : t
                          ),
                        }))
                      }
                    />
                    Laminar
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setCatalog((c) => ({ ...c, theatres: c.theatres.filter((t) => t.id !== th.id) }))
                    }
                    style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCatalog((c) => ({
                    ...c,
                    theatres: [...c.theatres, newTheatre({ name: `Theatre ${c.theatres.length + 1}` })],
                    theatreCount: Math.max(c.theatreCount, c.theatres.length + 1),
                  }))
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px dashed #94A3B8',
                  background: '#fff',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Add theatre
              </button>
            </div>
          </div>
        )}

        {/* ── Services ─────────────────────────────────────────── */}
        {section === 'services' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
              Clinical service lines
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              Toggle every service this facility offers. EMR modules and referral routing use this catalog.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(CLINICAL_SERVICE_LABELS) as ClinicalServiceKey[]).map((key) => (
                <ToggleChip
                  key={key}
                  on={!!catalog.services?.[key]}
                  label={CLINICAL_SERVICE_LABELS[key]}
                  onClick={() => toggleService(key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Diagnostics ──────────────────────────────────────── */}
        {section === 'diagnostics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
                <FlaskConical size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Laboratory
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(LAB_LABELS) as LabCapabilityKey[]).map((key) => (
                  <ToggleChip
                    key={key}
                    on={!!catalog.labCapabilities?.[key]}
                    label={LAB_LABELS[key]}
                    onClick={() => toggleLab(key)}
                  />
                ))}
              </div>
              <label style={{ ...labelStyle, marginTop: 12, maxWidth: 200 }}>
                Typical TAT (hours)
                <input
                  type="number"
                  min={1}
                  style={inputStyle}
                  value={catalog.labTurnsAroundHours}
                  onChange={(e) => patch({ labTurnsAroundHours: Math.max(1, Number(e.target.value) || 24) })}
                />
              </label>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
                <Radar size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Radiology & cardiac diagnostics
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(RADIOLOGY_LABELS) as RadiologyModalityKey[]).map((key) => (
                  <ToggleChip
                    key={key}
                    on={!!catalog.radiologyModalities?.[key]}
                    label={RADIOLOGY_LABELS[key]}
                    onClick={() => toggleRad(key)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Pharmacy ─────────────────────────────────────────── */}
        {section === 'pharmacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
              Pharmacy capabilities
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(PHARMACY_LABELS) as PharmacyCapabilityKey[]).map((key) => (
                <ToggleChip
                  key={key}
                  on={!!catalog.pharmacyCapabilities?.[key]}
                  label={PHARMACY_LABELS[key]}
                  onClick={() => togglePharm(key)}
                />
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={catalog.hasBloodBank}
                onChange={(e) => patch({ hasBloodBank: e.target.checked })}
              />
              On-site blood bank
            </label>
            {catalog.hasBloodBank && (
              <label style={labelStyle}>
                Blood groups stocked
                <input
                  style={inputStyle}
                  value={catalog.bloodBankGroups}
                  onChange={(e) => patch({ bloodBankGroups: e.target.value })}
                />
              </label>
            )}
          </div>
        )}

        {/* ── Emergency & maternity ────────────────────────────── */}
        {section === 'emergency' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
              <Ambulance size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Emergency & maternity readiness
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <label style={labelStyle}>
                A&E bays
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={catalog.emergencyBays}
                  onChange={(e) => patch({ emergencyBays: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              <label style={labelStyle}>
                Delivery suites
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={catalog.deliverySuites}
                  onChange={(e) => patch({ deliverySuites: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              <label style={labelStyle}>
                Ambulances
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={catalog.ambulanceCount}
                  onChange={(e) => patch({ ambulanceCount: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              <label style={labelStyle}>
                NICU cots
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={catalog.nicuCots}
                  onChange={(e) => patch({ nicuCots: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={catalog.emergency24x7}
                onChange={(e) => patch({ emergency24x7: e.target.checked })}
              />
              24/7 emergency services
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={!!catalog.services?.obstetrics_gynaecology}
                onChange={() => toggleService('obstetrics_gynaecology')}
              />
              <Baby size={14} /> Obstetrics & labour ward active
            </label>
          </div>
        )}

        {/* ── Clinics ──────────────────────────────────────────── */}
        {section === 'clinics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
              Outpatient clinics
            </h3>
            {(catalog.clinics || []).map((cl) => (
              <div
                key={cl.id}
                style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr 0.5fr auto', gap: 8 }}
              >
                <input
                  style={inputStyle}
                  value={cl.name}
                  placeholder="Clinic name"
                  onChange={(e) =>
                    setCatalog((c) => ({
                      ...c,
                      clinics: c.clinics.map((x) => (x.id === cl.id ? { ...x, name: e.target.value } : x)),
                    }))
                  }
                />
                <input
                  style={inputStyle}
                  value={cl.specialty}
                  placeholder="Specialty"
                  onChange={(e) =>
                    setCatalog((c) => ({
                      ...c,
                      clinics: c.clinics.map((x) =>
                        x.id === cl.id ? { ...x, specialty: e.target.value } : x
                      ),
                    }))
                  }
                />
                <input
                  style={inputStyle}
                  value={cl.days}
                  placeholder="Days"
                  onChange={(e) =>
                    setCatalog((c) => ({
                      ...c,
                      clinics: c.clinics.map((x) => (x.id === cl.id ? { ...x, days: e.target.value } : x)),
                    }))
                  }
                />
                <input
                  type="number"
                  min={1}
                  style={inputStyle}
                  value={cl.slotsPerDay}
                  title="Slots / day"
                  onChange={(e) =>
                    setCatalog((c) => ({
                      ...c,
                      clinics: c.clinics.map((x) =>
                        x.id === cl.id ? { ...x, slotsPerDay: Math.max(1, Number(e.target.value) || 1) } : x
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setCatalog((c) => ({ ...c, clinics: c.clinics.filter((x) => x.id !== cl.id) }))
                  }
                  style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCatalog((c) => ({ ...c, clinics: [...c.clinics, newClinic()] }))}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 10,
                border: '1px dashed #94A3B8',
                background: '#fff',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Add clinic
            </button>
          </div>
        )}

        {/* ── Operations ───────────────────────────────────────── */}
        {section === 'operations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>
              <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Hours, fees & payers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <label style={labelStyle}>
                OPD opens
                <input
                  type="time"
                  style={inputStyle}
                  value={catalog.workingHoursStart}
                  onChange={(e) => patch({ workingHoursStart: e.target.value })}
                />
              </label>
              <label style={labelStyle}>
                OPD closes
                <input
                  type="time"
                  style={inputStyle}
                  value={catalog.workingHoursEnd}
                  onChange={(e) => patch({ workingHoursEnd: e.target.value })}
                />
              </label>
              <label style={labelStyle}>
                Default OPD fee (₦)
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={catalog.defaultOpdFeeNgn}
                  onChange={(e) => patch({ defaultOpdFeeNgn: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={catalog.operates24x7}
                onChange={(e) => patch({ operates24x7: e.target.checked })}
              />
              Facility operates 24×7 (inpatient)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={catalog.emergency24x7}
                onChange={(e) => patch({ emergency24x7: e.target.checked })}
              />
              Emergency department 24×7
            </label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={catalog.acceptsNhis}
                  onChange={(e) => patch({ acceptsNhis: e.target.checked })}
                />
                <CreditCard size={14} /> Accepts NHIS
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={catalog.acceptsHmo}
                  onChange={(e) => patch({ acceptsHmo: e.target.checked })}
                />
                Accepts HMO / private insurance
              </label>
            </div>
            {catalog.acceptsHmo && (
              <label style={labelStyle}>
                Accepted HMOs (comma-separated)
                <input
                  style={inputStyle}
                  value={catalog.acceptedHmoList}
                  onChange={(e) => patch({ acceptedHmoList: e.target.value })}
                  placeholder="e.g. Hygeia, AXA Mansard, Leadway"
                />
              </label>
            )}
            <label style={labelStyle}>
              Notes (inspectors / AI context)
              <textarea
                value={catalog.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Referral partners, known gaps, generator capacity…"
              />
            </label>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          position: 'sticky',
          bottom: 8,
          background: 'rgba(255,255,255,0.95)',
          padding: '10px 0',
          borderTop: '1px solid #E2E8F0',
        }}
      >
        <button
          type="button"
          onClick={() => saveAll(false)}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#0052D4',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          <Save size={15} /> Save facility catalog
        </button>
        <button
          type="button"
          onClick={() => {
            saveAll(true);
            setMsg('Marked setup complete');
          }}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #059669',
            background: '#ECFDF5',
            color: '#047857',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          <CheckCircle2 size={15} /> Mark setup complete
        </button>
        {msg && (
          <span style={{ fontSize: '0.84rem', color: '#047857', fontWeight: 600 }}>{msg}</span>
        )}
      </div>
    </div>
  );
};

export default FacilityOnboarding;
