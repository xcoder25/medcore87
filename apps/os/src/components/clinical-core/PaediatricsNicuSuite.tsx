'use client';

/**
 * Newborn / NICU desk — Epic Stork newborn + Cerner PowerChart neonatal style.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Baby, Activity, Plus, RefreshCw, Thermometer, Heart, Wind, Droplets,
  Syringe, Calculator, BedDouble, AlertTriangle, CheckCircle2, X,
} from 'lucide-react';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import {
  listNewborns, listBays, admitNewborn, upsertNewborn, assignBay,
  newbornKpis, subscribeNewborn, paediatricDose,
  type NewbornRecord, type FeedingMode, type NicuLevel,
} from '../../lib/newbornNicuStore';

type Tab = 'board' | 'census' | 'admit' | 'dose' | 'care';

const LEVEL_META: Record<NicuLevel, { label: string; color: string; bg: string }> = {
  well: { label: 'Well baby', color: '#059669', bg: '#ECFDF5' },
  level1: { label: 'Level 1', color: '#2563EB', bg: '#EFF6FF' },
  level2: { label: 'Level 2', color: '#D97706', bg: '#FFFBEB' },
  level3: { label: 'Level 3 NICU', color: '#DC2626', bg: '#FEF2F2' },
};

const inp: React.CSSProperties = {
  padding: '9px 11px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 500,
};

export const PaediatricsNicuSuite: React.FC = () => {
  const facilityId = getActiveFacilityId() || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>('board');
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const toast = (m: string) => { setNotice(m); setTimeout(() => setNotice(null), 3200); };
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => subscribeNewborn(refresh), [refresh]);

  const newborns = useMemo(() => listNewborns(facilityId, 'active'), [facilityId, tick]);
  const bays = useMemo(() => listBays(facilityId), [facilityId, tick]);
  const kpis = useMemo(() => newbornKpis(facilityId), [facilityId, tick]);

  const [form, setForm] = useState({
    motherName: '', babyName: '', sex: 'U' as 'M' | 'F' | 'U',
    gestationalWeeks: '38', birthWeightG: '3000', apgar1: '8', apgar5: '9',
    nicuLevel: 'well' as NicuLevel, feeding: 'breast' as FeedingMode,
    vitaminK: true, hepB: true, phototherapy: false, oxygenLpm: '0', diagnosis: '',
  });
  const [doseWeight, setDoseWeight] = useState('3.2');
  const [doseDrug, setDoseDrug] = useState('paracetamol');
  const [selectedId, setSelectedId] = useState('');
  const selected = newborns.find((n) => n.id === selectedId);

  const submitAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.motherName.trim()) { toast('Mother name required'); return; }
    const row = admitNewborn({
      facilityId,
      motherName: form.motherName.trim(),
      babyName: form.babyName.trim() || `Baby of ${form.motherName.trim()}`,
      sex: form.sex,
      dob: new Date().toISOString().slice(0, 10),
      timeOfBirth: new Date().toISOString(),
      gestationalWeeks: Number(form.gestationalWeeks) || 40,
      birthWeightG: Number(form.birthWeightG) || 0,
      currentWeightG: Number(form.birthWeightG) || 0,
      apgar1: Number(form.apgar1) || undefined,
      apgar5: Number(form.apgar5) || undefined,
      nicuLevel: form.nicuLevel,
      feeding: form.feeding,
      phototherapy: form.phototherapy,
      oxygenLpm: Number(form.oxygenLpm) || 0,
      vitaminK: form.vitaminK,
      hepB: form.hepB,
      diagnosis: form.diagnosis || undefined,
    });
    const free = bays.find((b) => b.status === 'available');
    if (free && (form.nicuLevel !== 'well' || form.phototherapy)) assignBay(facilityId, free.id, row.id);
    toast(`Admitted ${row.babyName}`);
    setTab('board');
    refresh();
    setForm((f) => ({ ...f, motherName: '', babyName: '', diagnosis: '' }));
  };

  const updateObs = (patch: Partial<NewbornRecord>) => {
    if (!selected) return;
    upsertNewborn({ ...selected, ...patch });
    toast('Care chart updated');
    refresh();
  };

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'board', label: 'Incubator board', icon: BedDouble },
    { key: 'census', label: 'Newborn census', icon: Baby },
    { key: 'admit', label: 'Admit newborn', icon: Plus },
    { key: 'care', label: 'Care chart', icon: Heart },
    { key: 'dose', label: 'Dose calculator', icon: Calculator },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)', borderRadius: 16, overflow: 'hidden', border: '1px solid #DBEAFE', background: 'linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 40%)' }}>
      {notice && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#0F172A', color: '#93C5FD', padding: '12px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{notice}</div>
      )}
      <div style={{ background: 'linear-gradient(90deg, #1E3A8A 0%, #1D4ED8 45%, #2563EB 100%)', color: '#fff', padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Baby size={18} /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Newborn · NICU</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Epic Stork newborn / Cerner neonatal · live census</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 999, padding: '4px 10px' }}>{kpis.active} active · {kpis.baysOccupied}/{kpis.baysTotal} bays</span>
            <button type="button" onClick={() => { refresh(); toast('Board synced'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <RefreshCw size={13} /> Sync
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, border: 'none', borderRadius: '10px 10px 0 0', padding: '10px 14px', cursor: 'pointer', background: active ? '#EFF6FF' : 'transparent', color: active ? '#1E3A8A' : 'rgba(255,255,255,0.9)', fontWeight: active ? 800 : 600, fontSize: 13 }}>
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { l: 'Active newborns', v: kpis.active, c: '#2563EB' },
            { l: 'Phototherapy', v: kpis.phototherapy, c: '#D97706' },
            { l: 'ELBW <1000g', v: kpis.elbw, c: '#DC2626' },
            { l: 'Preterm <37w', v: kpis.preterm, c: '#7C3AED' },
            { l: 'On O2', v: kpis.onOxygen, c: '#0891B2' },
            { l: 'Bays free', v: kpis.baysTotal - kpis.baysOccupied, c: '#059669' },
          ].map((k) => (
            <div key={k.l} style={{ ...card, padding: '12px 14px', borderLeft: `3px solid ${k.c}` }}>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {tab === 'board' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#1E3A8A' }}>Incubator / bay board</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {bays.map((bay) => {
                const baby = newborns.find((n) => n.id === bay.occupiedBy);
                return (
                  <div key={bay.id} style={{ ...card, padding: 14, borderTop: `4px solid ${bay.status === 'occupied' ? '#2563EB' : '#34D399'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                      <span>{bay.label}</span><span>{bay.status}</span>
                    </div>
                    {baby ? (
                      <>
                        <div style={{ fontWeight: 800, marginTop: 8 }}>{baby.babyName}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{baby.gestationalWeeks}w · {baby.birthWeightG}g</div>
                        <button type="button" onClick={() => { setSelectedId(baby.id); setTab('care'); }} style={{ marginTop: 10, width: '100%', border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: 8, padding: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#1D4ED8' }}>Open care chart</button>
                      </>
                    ) : (
                      <div style={{ marginTop: 16, color: '#94A3B8', fontSize: 13 }}>Available · {bay.targetTempC}°C</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'census' && (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: 800 }}>Active newborn census</div>
            {newborns.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: '#64748B' }}>
                <Baby size={32} color="#93C5FD" style={{ marginBottom: 8 }} />
                <div>No active newborns — use Admit newborn</div>
                <button type="button" onClick={() => setTab('admit')} style={{ marginTop: 12, background: 'linear-gradient(135deg,#1D4ED8,#2563EB)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>+ Admit newborn</button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F8FAFC', textAlign: 'left' }}>{['Baby', 'Mother', 'GA / Wt', 'Level', 'Bay', ''].map((h) => <th key={h} style={{ padding: '10px 12px', fontSize: 11, color: '#64748B' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {newborns.map((n) => (
                    <tr key={n.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{n.babyName}</td>
                      <td style={{ padding: '10px 12px' }}>{n.motherName}</td>
                      <td style={{ padding: '10px 12px' }}>{n.gestationalWeeks}w · {n.birthWeightG}g</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, fontWeight: 700, background: LEVEL_META[n.nicuLevel].bg, color: LEVEL_META[n.nicuLevel].color, padding: '2px 8px', borderRadius: 6 }}>{LEVEL_META[n.nicuLevel].label}</span></td>
                      <td style={{ padding: '10px 12px' }}>{n.bedLabel || '—'}</td>
                      <td style={{ padding: '10px 12px' }}><button type="button" onClick={() => { setSelectedId(n.id); setTab('care'); }} style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Chart</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'admit' && (
          <form onSubmit={submitAdmit} style={{ ...card, padding: 20, maxWidth: 640 }}>
            <h3 style={{ margin: '0 0 14px', fontWeight: 800, color: '#1E3A8A' }}>Admit newborn</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={lab}>Mother name *<input required value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} style={inp} /></label>
              <label style={lab}>Baby name<input value={form.babyName} onChange={(e) => setForm({ ...form, babyName: e.target.value })} placeholder="Auto: Baby of …" style={inp} /></label>
              <label style={lab}>Sex<select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as 'M' | 'F' | 'U' })} style={inp}><option value="U">Unknown</option><option value="M">Male</option><option value="F">Female</option></select></label>
              <label style={lab}>GA (weeks)<input type="number" min={22} max={44} value={form.gestationalWeeks} onChange={(e) => setForm({ ...form, gestationalWeeks: e.target.value })} style={inp} /></label>
              <label style={lab}>Birth weight (g)<input type="number" min={400} value={form.birthWeightG} onChange={(e) => setForm({ ...form, birthWeightG: e.target.value })} style={inp} /></label>
              <label style={lab}>NICU level<select value={form.nicuLevel} onChange={(e) => setForm({ ...form, nicuLevel: e.target.value as NicuLevel })} style={inp}><option value="well">Well baby</option><option value="level1">Level 1</option><option value="level2">Level 2</option><option value="level3">Level 3</option></select></label>
              <label style={lab}>APGAR 1<input type="number" min={0} max={10} value={form.apgar1} onChange={(e) => setForm({ ...form, apgar1: e.target.value })} style={inp} /></label>
              <label style={lab}>APGAR 5<input type="number" min={0} max={10} value={form.apgar5} onChange={(e) => setForm({ ...form, apgar5: e.target.value })} style={inp} /></label>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={form.vitaminK} onChange={(e) => setForm({ ...form, vitaminK: e.target.checked })} /> Vitamin K</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={form.hepB} onChange={(e) => setForm({ ...form, hepB: e.target.checked })} /> Hep B</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={form.phototherapy} onChange={(e) => setForm({ ...form, phototherapy: e.target.checked })} /> Phototherapy</label>
            </div>
            <button type="submit" style={{ marginTop: 16, background: 'linear-gradient(135deg,#1D4ED8,#2563EB)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 800, cursor: 'pointer' }}>Admit to newborn / NICU</button>
          </form>
        )}

        {tab === 'care' && (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
            <div style={{ ...card, padding: 12, maxHeight: 480, overflow: 'auto' }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Select baby</div>
              {newborns.map((n) => (
                <button key={n.id} type="button" onClick={() => setSelectedId(n.id)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: 10, marginBottom: 4, cursor: 'pointer', background: selectedId === n.id ? '#DBEAFE' : 'transparent', fontWeight: selectedId === n.id ? 800 : 600, fontSize: 13 }}>
                  {n.babyName}<div style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{n.bedLabel || 'No bay'}</div>
                </button>
              ))}
              {!newborns.length && <div style={{ color: '#94A3B8', fontSize: 13 }}>No active babies</div>}
            </div>
            <div style={{ ...card, padding: 18 }}>
              {!selected ? <div style={{ color: '#64748B' }}>Select a newborn for observations.</div> : (
                <>
                  <h3 style={{ margin: 0, fontWeight: 800 }}>{selected.babyName}</h3>
                  <div style={{ fontSize: 13, color: '#64748B' }}>Mother: {selected.motherName} · {selected.gestationalWeeks}w · {selected.birthWeightG}g</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
                    <ObsField label="Temp °C" value={selected.tempC ?? ''} onChange={(v) => updateObs({ tempC: Number(v) || undefined })} />
                    <ObsField label="HR" value={selected.hr ?? ''} onChange={(v) => updateObs({ hr: Number(v) || undefined })} />
                    <ObsField label="SpO2 %" value={selected.spo2 ?? ''} onChange={(v) => updateObs({ spo2: Number(v) || undefined })} />
                    <ObsField label="O2 L/min" value={selected.oxygenLpm} onChange={(v) => updateObs({ oxygenLpm: Number(v) || 0 })} />
                    <ObsField label="Weight g" value={selected.currentWeightG ?? selected.birthWeightG} onChange={(v) => updateObs({ currentWeightG: Number(v) || undefined })} />
                    <ObsField label="Bilirubin" value={selected.bilirubin ?? ''} onChange={(v) => updateObs({ bilirubin: Number(v) || undefined })} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <ToggleChip on={selected.phototherapy} label="Phototherapy" onClick={() => updateObs({ phototherapy: !selected.phototherapy })} />
                    <ToggleChip on={selected.vitaminK} label="Vit K" onClick={() => updateObs({ vitaminK: !selected.vitaminK })} />
                    <ToggleChip on={selected.hepB} label="Hep B" onClick={() => updateObs({ hepB: !selected.hepB })} />
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Assign bay</label>
                    <select value={selected.incubatorId || ''} onChange={(e) => { if (e.target.value) assignBay(facilityId, e.target.value, selected.id); else if (selected.incubatorId) assignBay(facilityId, selected.incubatorId, undefined); refresh(); toast('Bay updated'); }} style={{ ...inp, marginTop: 4, width: '100%' }}>
                      <option value="">— Unassigned —</option>
                      {bays.map((b) => <option key={b.id} value={b.id} disabled={b.status === 'occupied' && b.occupiedBy !== selected.id}>{b.label} ({b.status})</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => { upsertNewborn({ ...selected, status: 'discharged' }); if (selected.incubatorId) assignBay(facilityId, selected.incubatorId, undefined); setSelectedId(''); refresh(); toast('Discharged'); }} style={{ marginTop: 12, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Discharge from NICU</button>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'dose' && (
          <div style={{ ...card, padding: 20, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, color: '#1E3A8A' }}><Syringe size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Dose calculator</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748B' }}>Reference only — verify against local formulary before administration.</p>
            <label style={lab}>Weight (kg)<input type="number" step={0.1} min={0.5} value={doseWeight} onChange={(e) => setDoseWeight(e.target.value)} style={inp} /></label>
            <label style={{ ...lab, marginTop: 10 }}>Drug<select value={doseDrug} onChange={(e) => setDoseDrug(e.target.value)} style={inp}><option value="paracetamol">Paracetamol</option><option value="amoxicillin">Amoxicillin</option><option value="gentamicin">Gentamicin</option><option value="caffeine">Caffeine citrate</option></select></label>
            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', fontWeight: 700, color: '#1E3A8A', fontSize: 14 }}>{paediatricDose(doseDrug, Number(doseWeight) || 3)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const lab: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 };

function ObsField({ label, value, onChange }: { label: string; value: string | number; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(String(value ?? ''));
  useEffect(() => setLocal(String(value ?? '')), [value]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748B' }}>
      {label}
      <input value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} style={inp} />
    </label>
  );
}

function ToggleChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ border: on ? '1px solid #86EFAC' : '1px solid #E2E8F0', background: on ? '#ECFDF5' : '#F8FAFC', color: on ? '#047857' : '#64748B', borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {on ? <CheckCircle2 size={12} /> : <X size={12} />}{label}
    </button>
  );
}

export default PaediatricsNicuSuite;
