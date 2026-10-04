'use client';

/**
 * Hospital profile + agentic ward/bed setup for the logged-in hospital admin.
 * One admin ↔ one facility — configure beds per ward; M87 AI suggests layouts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, CheckCircle2, MapPin, Phone, Globe, Edit2, Save, X, Shield,
  BedDouble, Sparkles, Plus, Trash2, Loader2,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { emitLiveAction } from '../../lib/liveActions';
import {
  listBeds,
  listWards,
  createBeds,
  ensureDefaultBeds,
} from '../../lib/bedBoardStore';
import { geminiGenerate, hasGeminiKey } from '../../lib/geminiClient';

export interface HospitalProfile {
  id: string;
  name: string;
  type: string;
  lga: string;
  address: string;
  beds: number;
  phone: string;
  email: string;
  licenseNo: string;
  licenseExpiry: string;
  status: 'active' | 'pending' | 'suspended';
  tier: string;
  medicalDirector: string;
}

export interface WardPlanRow {
  id: string;
  ward: string;
  prefix: string;
  count: number;
}

function profileKey(hospitalId: string) {
  return `medcore_hospital_profile_${hospitalId}`;
}

function loadProfile(session?: UserSession): HospitalProfile {
  const id = session?.hospitalId || 'UNKNOWN';
  const name = session?.facility || 'My Hospital';
  const blank: HospitalProfile = {
    id,
    name,
    type: 'General Hospital',
    lga: '',
    address: '',
    beds: 0,
    phone: '',
    email: '',
    licenseNo: '',
    licenseExpiry: '',
    status: 'active',
    tier: 'Secondary Care',
    medicalDirector: session?.name || '',
  };
  if (typeof window === 'undefined') return blank;
  try {
    const raw = localStorage.getItem(profileKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as HospitalProfile;
      return { ...blank, ...parsed, id, name: parsed.name || name };
    }
  } catch {
    /* ignore */
  }
  return blank;
}

function saveProfile(p: HospitalProfile) {
  try {
    localStorage.setItem(profileKey(p.id), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function newRow(partial?: Partial<WardPlanRow>): WardPlanRow {
  return {
    id: `wr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ward: partial?.ward || '',
    prefix: partial?.prefix || '',
    count: partial?.count ?? 4,
  };
}

/** Deterministic fallback layout when Gemini is offline */
function fallbackLayout(totalBeds: number, facilityType: string): WardPlanRow[] {
  const t = (facilityType || '').toLowerCase();
  const isCottage = t.includes('cottage') || t.includes('primary');
  const isChc = t.includes('comprehensive') || t.includes('health care centre');
  const plans: { ward: string; prefix: string; weight: number }[] = isCottage
    ? [
        { ward: 'General Ward', prefix: 'GW', weight: 0.5 },
        { ward: 'Maternity', prefix: 'MT', weight: 0.25 },
        { ward: 'Paediatrics', prefix: 'PD', weight: 0.15 },
        { ward: 'Emergency Bay', prefix: 'AE', weight: 0.1 },
      ]
    : isChc
      ? [
          { ward: 'Male Medical', prefix: 'MM', weight: 0.25 },
          { ward: 'Female Medical', prefix: 'FM', weight: 0.25 },
          { ward: 'Maternity', prefix: 'MT', weight: 0.2 },
          { ward: 'Paediatrics', prefix: 'PD', weight: 0.15 },
          { ward: 'Emergency', prefix: 'AE', weight: 0.1 },
          { ward: 'Isolation', prefix: 'ISO', weight: 0.05 },
        ]
      : [
          { ward: 'Male Medical', prefix: 'MM', weight: 0.18 },
          { ward: 'Female Medical', prefix: 'FM', weight: 0.18 },
          { ward: 'Surgical', prefix: 'SG', weight: 0.14 },
          { ward: 'Paediatrics', prefix: 'PD', weight: 0.1 },
          { ward: 'Maternity', prefix: 'MT', weight: 0.12 },
          { ward: 'ICU', prefix: 'ICU', weight: 0.08 },
          { ward: 'Emergency / A&E', prefix: 'AE', weight: 0.1 },
          { ward: 'Isolation', prefix: 'ISO', weight: 0.05 },
          { ward: 'PACU', prefix: 'PACU', weight: 0.05 },
        ];

  const target = Math.max(totalBeds || 40, 8);
  let remaining = target;
  return plans.map((p, i) => {
    const n =
      i === plans.length - 1
        ? Math.max(1, remaining)
        : Math.max(1, Math.round(target * p.weight));
    remaining -= n;
    return newRow({ ward: p.ward, prefix: p.prefix, count: n });
  });
}

async function suggestWardLayout(args: {
  facilityName: string;
  facilityType: string;
  tier: string;
  totalBeds: number;
}): Promise<{ rows: WardPlanRow[]; source: 'gemini' | 'fallback'; note: string }> {
  const total = Math.max(args.totalBeds || 40, 8);
  const system =
    'You are M87, MedCore hospital OS copilot for Nigerian public hospitals (Akwa Ibom). ' +
    'Return ONLY valid JSON (no markdown) with shape: {"wards":[{"ward":"Male Medical","prefix":"MM","count":12},...]}. ' +
    'Prefixes: 2–5 uppercase letters/numbers. Counts must sum approximately to totalBeds. ' +
    'Use realistic Nigerian secondary/cottage ward names. Include Maternity and Emergency when appropriate.';

  const prompt = `Suggest a ward and bed layout for:
Facility: ${args.facilityName}
Type: ${args.facilityType}
Tier: ${args.tier}
Target total beds: ${total}

Respond with JSON only: {"wards":[{"ward":"...","prefix":"...","count":N},...]}`;

  try {
    if (hasGeminiKey()) {
      const res = await geminiGenerate(prompt, system);
      if (res.ok && res.text) {
        const cleaned = res.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned) as { wards?: { ward?: string; prefix?: string; count?: number }[] };
        if (Array.isArray(parsed.wards) && parsed.wards.length > 0) {
          const rows = parsed.wards
            .filter((w) => w.ward && w.prefix && Number(w.count) > 0)
            .map((w) =>
              newRow({
                ward: String(w.ward),
                prefix: String(w.prefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
                count: Math.max(1, Math.min(200, Number(w.count) || 1)),
              })
            );
          if (rows.length) {
            return {
              rows,
              source: 'gemini',
              note: `M87 suggested ${rows.length} wards · ${rows.reduce((s, r) => s + r.count, 0)} beds`,
            };
          }
        }
      }
    }
  } catch {
    /* fall through */
  }

  const rows = fallbackLayout(total, args.facilityType);
  return {
    rows,
    source: 'fallback',
    note: `Offline template · ${rows.length} wards · ${rows.reduce((s, r) => s + r.count, 0)} beds (enable Gemini for AI suggestions)`,
  };
}

interface Props {
  session?: UserSession;
}

export const FacilityOnboarding: React.FC<Props> = ({ session }) => {
  const [profile, setProfile] = useState<HospitalProfile>(() => loadProfile(session));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HospitalProfile>(profile);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [wardPlan, setWardPlan] = useState<WardPlanRow[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [bedTick, setBedTick] = useState(0);

  useEffect(() => {
    const p = loadProfile(session);
    setProfile(p);
    setDraft(p);
  }, [session?.hospitalId, session?.facility]);

  const facilityId = profile.id;
  const existingBeds = useMemo(() => {
    void bedTick;
    return listBeds(facilityId);
  }, [facilityId, bedTick]);
  const existingWards = useMemo(() => listWards(facilityId), [facilityId, existingBeds]);
  const existingTotal = existingBeds.length;
  const planTotal = wardPlan.reduce((s, r) => s + (Number(r.count) || 0), 0);

  const startEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(profile);
    setEditing(false);
  };

  const save = () => {
    const next = { ...draft, id: profile.id, beds: draft.beds || planTotal || existingTotal };
    setProfile(next);
    saveProfile(next);
    setEditing(false);
    setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    emitLiveAction(`Hospital profile saved · ${next.name}`, { module: 'hospital-profile' });
  };

  const runAiSuggest = async () => {
    setAiLoading(true);
    setAiNote(null);
    try {
      const target =
        Number(draft.beds) || Number(profile.beds) || existingTotal || 48;
      const result = await suggestWardLayout({
        facilityName: profile.name,
        facilityType: draft.type || profile.type,
        tier: draft.tier || profile.tier,
        totalBeds: target,
      });
      setWardPlan(result.rows);
      setAiNote(result.note);
      if (!draft.beds) {
        setDraft((d) => ({ ...d, beds: result.rows.reduce((s, r) => s + r.count, 0) }));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const applyWardPlan = () => {
    if (!facilityId || facilityId === 'UNKNOWN') {
      setApplyMsg('Sign in to a facility first.');
      return;
    }
    const valid = wardPlan.filter((r) => r.ward.trim() && r.prefix.trim() && r.count > 0);
    if (!valid.length) {
      setApplyMsg('Add at least one ward with a prefix and bed count.');
      return;
    }
    setApplyBusy(true);
    setApplyMsg(null);
    try {
      let created = 0;
      for (const row of valid) {
        const beds = createBeds({
          facilityId,
          ward: row.ward.trim(),
          prefix: row.prefix.trim().toUpperCase(),
          count: Math.max(1, Math.min(200, Number(row.count) || 1)),
          actor: session?.name || 'Hospital Administrator',
        });
        created += beds.length;
      }
      const total = listBeds(facilityId).length;
      const next = { ...profile, beds: total };
      setProfile(next);
      setDraft((d) => ({ ...d, beds: total }));
      saveProfile(next);
      setBedTick((t) => t + 1);
      setApplyMsg(
        created
          ? `Created ${created} new bed(s). Facility now has ${total} beds across ${listWards(facilityId).length} wards.`
          : `No new beds created (may already exist). Facility has ${total} beds.`
      );
      emitLiveAction(`Ward/bed layout applied · ${total} beds`, { module: 'bed-board' });
    } catch (e: unknown) {
      setApplyMsg((e as Error)?.message || 'Failed to create beds');
    } finally {
      setApplyBusy(false);
    }
  };

  const seedDefaults = () => {
    if (!facilityId || facilityId === 'UNKNOWN') return;
    ensureDefaultBeds(facilityId);
    const total = listBeds(facilityId).length;
    const next = { ...profile, beds: total };
    setProfile(next);
    setDraft((d) => ({ ...d, beds: total }));
    saveProfile(next);
    setBedTick((t) => t + 1);
    setApplyMsg(`Seeded default layout · ${total} beds`);
    emitLiveAction(`Default beds seeded · ${total}`, { module: 'bed-board' });
  };

  const field = (
    label: string,
    key: keyof HospitalProfile,
    opts?: { type?: string; readOnly?: boolean }
  ) => {
    const value = String(draft[key] ?? '');
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
        {label}
        <input
          type={opts?.type || 'text'}
          value={value}
          readOnly={!editing || opts?.readOnly}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              [key]: key === 'beds' ? Number(e.target.value) || 0 : e.target.value,
            }))
          }
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#0A2540',
            background: editing && !opts?.readOnly ? '#fff' : '#F8FAFC',
          }}
        />
      </label>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 960 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #E0F2FE 0%, #ECFDF5 100%)',
          borderRadius: 16,
          padding: 20,
          border: '1px solid #BAE6FD',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Building2 size={22} color="#0052D4" />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
              My hospital
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#475569' }}>
              You administer <strong>one facility only</strong>. This profile is for{' '}
              <strong>{profile.name}</strong> ({profile.id}) — not a statewide hospital list.
            </p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(5, 150, 105, 0.12)',
              color: '#047857',
              fontSize: '0.75rem',
              fontWeight: 800,
            }}
          >
            <Shield size={13} /> 1 admin · 1 hospital
          </span>
        </div>
      </div>

      {/* Profile card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>Hospital profile</h3>
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, border: '1px solid #CBD5E1',
                background: '#F8FAFC', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', color: '#0A2540',
              }}
            >
              <Edit2 size={14} /> Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  background: '#fff', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', color: '#64748B',
                }}
              >
                <X size={14} /> Cancel
              </button>
              <button
                type="button"
                onClick={save}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: '#0052D4', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', color: '#fff',
                }}
              >
                <Save size={14} /> Save
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {field('Hospital name', 'name')}
          {field('Type', 'type')}
          {field('Tier', 'tier')}
          {field('LGA', 'lga')}
          {field('Total beds (target)', 'beds', { type: 'number' })}
          {field('Phone', 'phone')}
          {field('Email', 'email')}
          {field('License No.', 'licenseNo')}
          {field('License expiry', 'licenseExpiry', { type: 'date' })}
          {field('Medical Director', 'medicalDirector')}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155', gridColumn: '1 / -1' }}>
            Address
            <input
              value={draft.address}
              readOnly={!editing}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                fontSize: '0.9rem',
                background: editing ? '#fff' : '#F8FAFC',
              }}
            />
          </label>
        </div>

        {!editing && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem', color: '#475569' }}>
            {profile.address && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <MapPin size={15} color="#0052D4" /> {profile.address}
              </div>
            )}
            {profile.phone && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Phone size={15} color="#0052D4" /> {profile.phone}
              </div>
            )}
            {profile.email && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Globe size={15} color="#0052D4" /> {profile.email}
              </div>
            )}
          </div>
        )}

        {savedAt && (
          <p style={{ margin: '14px 0 0', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
            Saved at {savedAt}
          </p>
        )}
      </div>

      {/* Agentic ward & bed setup */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #0052D4, #00C6FB)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <BedDouble size={20} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>
              Ward & bed setup
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
              Enter how many beds you have per ward, or let <strong>M87 AI</strong> propose a layout from your facility type and target bed count. Then create the bed board.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={runAiSuggest}
              disabled={aiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #7C3AED, #0052D4)',
                color: '#fff', fontWeight: 700, fontSize: '0.84rem',
                cursor: aiLoading ? 'wait' : 'pointer', opacity: aiLoading ? 0.8 : 1,
              }}
            >
              {aiLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {aiLoading ? 'Thinking…' : 'Suggest with M87 AI'}
            </button>
            <button
              type="button"
              onClick={seedDefaults}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 10, border: '1px solid #CBD5E1',
                background: '#F8FAFC', color: '#334155', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
              }}
            >
              Use default template
            </button>
          </div>
        </div>

        {/* Live board summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ background: '#F0F9FF', borderRadius: 12, padding: '12px 14px', border: '1px solid #BAE6FD' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369A1', textTransform: 'uppercase' }}>On board</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0A2540' }}>{existingTotal}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{existingWards.length} wards</div>
          </div>
          <div style={{ background: '#F5F3FF', borderRadius: 12, padding: '12px 14px', border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase' }}>Plan total</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0A2540' }}>{planTotal}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{wardPlan.length} planned wards</div>
          </div>
          <div style={{ background: '#ECFDF5', borderRadius: 12, padding: '12px 14px', border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Target</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0A2540' }}>{draft.beds || profile.beds || '—'}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>from profile</div>
          </div>
        </div>

        {existingWards.length > 0 && (
          <div style={{ marginBottom: 14, fontSize: '0.82rem', color: '#475569' }}>
            <strong style={{ color: '#0A2540' }}>Current wards:</strong>{' '}
            {existingWards.map((w) => `${w} (${listBeds(facilityId).filter((b) => b.ward === w).length})`).join(' · ')}
          </div>
        )}

        {aiNote && (
          <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#5B21B6', fontWeight: 600 }}>
            <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {aiNote}
          </p>
        )}

        {/* Editable plan rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wardPlan.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8' }}>
              No plan yet. Click <strong>Suggest with M87 AI</strong> or add wards manually.
            </p>
          )}
          {wardPlan.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 0.7fr 0.55fr auto',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <input
                placeholder="Ward name (e.g. Male Medical)"
                value={row.ward}
                onChange={(e) =>
                  setWardPlan((rows) =>
                    rows.map((r) => (r.id === row.id ? { ...r, ward: e.target.value } : r))
                  )
                }
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.88rem' }}
              />
              <input
                placeholder="Prefix"
                value={row.prefix}
                onChange={(e) =>
                  setWardPlan((rows) =>
                    rows.map((r) =>
                      r.id === row.id
                        ? { ...r, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }
                        : r
                    )
                  )
                }
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.88rem', fontFamily: 'monospace' }}
              />
              <input
                type="number"
                min={1}
                max={200}
                value={row.count}
                onChange={(e) =>
                  setWardPlan((rows) =>
                    rows.map((r) =>
                      r.id === row.id ? { ...r, count: Math.max(1, Number(e.target.value) || 1) } : r
                    )
                  )
                }
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.88rem' }}
              />
              <button
                type="button"
                title="Remove ward"
                onClick={() => setWardPlan((rows) => rows.filter((r) => r.id !== row.id))}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: '1px solid #FECACA',
                  background: '#FEF2F2', color: '#DC2626', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setWardPlan((rows) => [...rows, newRow({ ward: '', prefix: '', count: 4 })])}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10, border: '1px dashed #94A3B8',
              background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Add ward
          </button>
          <button
            type="button"
            onClick={applyWardPlan}
            disabled={applyBusy || wardPlan.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 10, border: 'none',
              background: wardPlan.length ? '#059669' : '#94A3B8',
              color: '#fff', fontWeight: 700, fontSize: '0.88rem',
              cursor: wardPlan.length && !applyBusy ? 'pointer' : 'not-allowed',
            }}
          >
            {applyBusy ? <Loader2 size={15} /> : <CheckCircle2 size={15} />}
            Apply & create beds
          </button>
        </div>

        {applyMsg && (
          <p style={{ margin: '12px 0 0', fontSize: '0.84rem', color: '#047857', fontWeight: 600 }}>
            {applyMsg}
          </p>
        )}
      </div>
    </div>
  );
};

export default FacilityOnboarding;
