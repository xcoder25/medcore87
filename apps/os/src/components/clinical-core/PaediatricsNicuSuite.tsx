'use client';

/**
 * Newborn / NICU — Epic Stork + Cerner PowerChart neonatal density.
 * All tools are live: admit, bay assign, care chart, feeding, discharge, dose calc.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Baby, Activity, Plus, RefreshCw, Thermometer, Heart, Wind,
  Syringe, Calculator, BedDouble, AlertTriangle, CheckCircle2, X,
  Stethoscope, FileText, Clock, User,
} from 'lucide-react';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import {
  listNewborns, listBays, admitNewborn, upsertNewborn, assignBay,
  newbornKpis, subscribeNewborn, paediatricDose,
  type NewbornRecord, type FeedingMode, type NicuLevel,
} from '../../lib/newbornNicuStore';
import { pushNotification } from '../../lib/notificationEngine';

type Tab = 'board' | 'census' | 'admit' | 'dose' | 'care';

const LEVEL_META: Record<NicuLevel, { label: string; color: string; bg: string; border: string }> = {
  well: { label: 'Well baby', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  level1: { label: 'Level 1', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  level2: { label: 'Level 2', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  level3: { label: 'Level 3 NICU', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
};

const FEED_LABEL: Record<FeedingMode, string> = {
  breast: 'Breast',
  cup: 'Cup',
  ng: 'NGT',
  iv: 'IV fluids',
  mixed: 'Mixed',
};

const inp: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
  fontWeight: 500,
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

const lab: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

export const PaediatricsNicuSuite: React.FC = () => {
  const facilityId = getActiveFacilityId() || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>('board');
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const toast = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3200);
  };
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => subscribeNewborn(refresh), [refresh]);

  const newborns = useMemo(() => listNewborns(facilityId, 'active'), [facilityId, tick]);
  const bays = useMemo(() => listBays(facilityId), [facilityId, tick]);
  const kpis = useMemo(() => newbornKpis(facilityId), [facilityId, tick]);

  const [form, setForm] = useState({
    motherName: '',
    babyName: '',
    sex: 'U' as 'M' | 'F' | 'U',
    gestationalWeeks: '38',
    birthWeightG: '3000',
    apgar1: '8',
    apgar5: '9',
    nicuLevel: 'well' as NicuLevel,
    feeding: 'breast' as FeedingMode,
    vitaminK: true,
    hepB: true,
    bcg: false,
    phototherapy: false,
    oxygenLpm: '0',
    diagnosis: '',
    notes: '',
  });
  const [doseWeight, setDoseWeight] = useState('3.2');
  const [doseDrug, setDoseDrug] = useState('paracetamol');
  const [selectedId, setSelectedId] = useState('');
  const [careNotes, setCareNotes] = useState('');
  const selected = newborns.find((n) => n.id === selectedId);

  useEffect(() => {
    if (selected) setCareNotes(selected.notes || '');
  }, [selectedId, selected?.notes]);

  const submitAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.motherName.trim()) {
      toast('Mother name required');
      return;
    }
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
      bcg: form.bcg,
      diagnosis: form.diagnosis || undefined,
      notes: form.notes || undefined,
    });
    const free = bays.find((b) => b.status === 'available');
    if (free && (form.nicuLevel !== 'well' || form.phototherapy || form.oxygenLpm !== '0')) {
      assignBay(facilityId, free.id, row.id);
    }
    if (form.nicuLevel === 'level3' || Number(form.birthWeightG) < 1500) {
      pushNotification({
        facilityId,
        level: 'critical',
        title: 'Level 3 / ELBW admission',
        body: `${row.babyName} · ${row.gestationalWeeks}w · ${row.birthWeightG}g · ${LEVEL_META[row.nicuLevel].label}`,
        module: 'paediatrics',
        roleHint: 'midwife',
      });
    }
    toast(`Admitted ${row.babyName}`);
    setTab('board');
    refresh();
    setForm((f) => ({ ...f, motherName: '', babyName: '', diagnosis: '', notes: '' }));
  };

  const updateObs = (patch: Partial<NewbornRecord>) => {
    if (!selected) return;
    upsertNewborn({ ...selected, ...patch });
    toast('Care chart saved');
    refresh();
  };

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 120px)',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid #CBD5E1',
        background: '#F1F5F9',
      }}
    >
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 9999,
            background: '#0F172A',
            color: '#93C5FD',
            padding: '12px 16px',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          background: 'linear-gradient(90deg, #0F172A 0%, #1E3A8A 55%, #1D4ED8 100%)',
          color: '#fff',
          padding: '10px 14px 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <Baby size={17} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.01em' }}>
                Newborn · NICU
              </div>
              <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 500 }}>
                Stork / PowerChart neonatal · live census
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 999,
                padding: '4px 10px',
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {kpis.active} active · {kpis.baysOccupied}/{kpis.baysTotal} bays
            </span>
            <button
              type="button"
              onClick={() => setTab('admit')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                border: 'none',
                background: '#fff',
                color: '#1E3A8A',
                borderRadius: 7,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Admit
            </button>
            <button
              type="button"
              onClick={() => {
                refresh();
                toast('Board synced');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                borderRadius: 7,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Sync
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                  border: 'none',
                  borderRadius: '8px 8px 0 0',
                  padding: '9px 13px',
                  cursor: 'pointer',
                  background: active ? '#F1F5F9' : 'transparent',
                  color: active ? '#0F172A' : 'rgba(255,255,255,0.88)',
                  fontWeight: active ? 800 : 600,
                  fontSize: 12,
                }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
            gap: 8,
          }}
        >
          {[
            { l: 'Active', v: kpis.active, c: '#2563EB', icon: Baby },
            { l: 'Phototherapy', v: kpis.phototherapy, c: '#D97706', icon: Activity },
            { l: 'ELBW <1000g', v: kpis.elbw, c: '#DC2626', icon: AlertTriangle },
            { l: 'Preterm <37w', v: kpis.preterm, c: '#7C3AED', icon: Clock },
            { l: 'On O2', v: kpis.onOxygen, c: '#0891B2', icon: Wind },
            { l: 'Bays free', v: kpis.baysTotal - kpis.baysOccupied, c: '#059669', icon: BedDouble },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div
                key={k.l}
                style={{
                  ...card,
                  padding: '10px 12px',
                  borderLeft: `3px solid ${k.c}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: '#64748B',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Icon size={11} color={k.c} />
                  {k.l}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
                  {k.v}
                </div>
              </div>
            );
          })}
        </div>

        {tab === 'board' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                Incubator / bay board
              </h3>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                Click occupied bay for care chart
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 10,
              }}
            >
              {bays.map((bay) => {
                const baby = newborns.find((n) => n.id === bay.occupiedBy);
                const occupied = bay.status === 'occupied' && !!baby;
                const levelColor = baby ? LEVEL_META[baby.nicuLevel].color : '#34D399';
                return (
                  <div
                    key={bay.id}
                    style={{
                      ...card,
                      padding: 12,
                      borderTop: `3px solid ${levelColor}`,
                      cursor: occupied ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (baby) {
                        setSelectedId(baby.id);
                        setTab('care');
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <span>{bay.label}</span>
                      <span
                        style={{
                          color: occupied ? '#1D4ED8' : '#059669',
                          background: occupied ? '#EFF6FF' : '#ECFDF5',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {bay.status}
                      </span>
                    </div>
                    {baby ? (
                      <>
                        <div style={{ fontWeight: 800, marginTop: 8, fontSize: 14, color: '#0F172A' }}>
                          {baby.babyName}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {baby.gestationalWeeks}w · {baby.birthWeightG}g ·{' '}
                          {LEVEL_META[baby.nicuLevel].label}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            marginTop: 8,
                            flexWrap: 'wrap',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {baby.tempC != null && (
                            <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4 }}>
                              <Thermometer size={9} style={{ verticalAlign: 'middle' }} /> {baby.tempC}C
                            </span>
                          )}
                          {baby.hr != null && (
                            <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: 4 }}>
                              <Heart size={9} style={{ verticalAlign: 'middle' }} /> {baby.hr}
                            </span>
                          )}
                          {baby.spo2 != null && (
                            <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 6px', borderRadius: 4 }}>
                              SpO2 {baby.spo2}%
                            </span>
                          )}
                          {baby.oxygenLpm > 0 && (
                            <span style={{ background: '#CFFAFE', color: '#0E7490', padding: '2px 6px', borderRadius: 4 }}>
                              O2 {baby.oxygenLpm}L
                            </span>
                          )}
                          {baby.phototherapy && (
                            <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4 }}>
                              PhotoRx
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
                          Mother: {baby.motherName}
                        </div>
                      </>
                    ) : (
                      <div style={{ marginTop: 18, color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>
                        Available · target {bay.targetTempC}C
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'census' && (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid #E2E8F0',
                fontWeight: 800,
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F8FAFC',
              }}
            >
              <span>Active newborn census</span>
              <button
                type="button"
                onClick={() => setTab('admit')}
                style={{
                  border: 'none',
                  background: '#1D4ED8',
                  color: '#fff',
                  borderRadius: 7,
                  padding: '5px 10px',
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                + Admit
              </button>
            </div>
            {newborns.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: '#64748B' }}>
                <Baby size={32} color="#93C5FD" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>No active newborns</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Use Admit newborn to register a delivery</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                      {['Baby', 'Sex', 'Mother', 'GA / Wt', 'APGAR', 'Level', 'Feeding', 'Bay', 'Flags', ''].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: '8px 10px',
                              fontSize: 10,
                              color: '#64748B',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {newborns.map((n) => (
                      <tr key={n.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{n.babyName}</td>
                        <td style={{ padding: '8px 10px' }}>{n.sex}</td>
                        <td style={{ padding: '8px 10px' }}>{n.motherName}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {n.gestationalWeeks}w · {n.birthWeightG}g
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {n.apgar1 ?? '—'}/{n.apgar5 ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: LEVEL_META[n.nicuLevel].bg,
                              color: LEVEL_META[n.nicuLevel].color,
                              padding: '2px 7px',
                              borderRadius: 5,
                              border: `1px solid ${LEVEL_META[n.nicuLevel].border}`,
                            }}
                          >
                            {LEVEL_META[n.nicuLevel].label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>{FEED_LABEL[n.feeding]}</td>
                        <td style={{ padding: '8px 10px' }}>{n.bedLabel || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {n.phototherapy && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF3C7', color: '#B45309', padding: '1px 5px', borderRadius: 3 }}>
                                Photo
                              </span>
                            )}
                            {n.oxygenLpm > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: '#CFFAFE', color: '#0E7490', padding: '1px 5px', borderRadius: 3 }}>
                                O2
                              </span>
                            )}
                            {n.vitaminK && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: '#ECFDF5', color: '#047857', padding: '1px 5px', borderRadius: 3 }}>
                                VitK
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(n.id);
                              setTab('care');
                            }}
                            style={{
                              border: '1px solid #CBD5E1',
                              background: '#fff',
                              borderRadius: 6,
                              padding: '3px 8px',
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: 'pointer',
                              color: '#1D4ED8',
                            }}
                          >
                            Chart
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'admit' && (
          <form onSubmit={submitAdmit} style={{ ...card, padding: 18, maxWidth: 720 }}>
            <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#0F172A', fontSize: 15 }}>
              Admit newborn
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748B' }}>
              Live registration — auto-assigns bay for Level 2/3, phototherapy, or oxygen.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={lab}>
                Mother name *
                <input
                  required
                  value={form.motherName}
                  onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                  style={inp}
                  placeholder="Full name"
                />
              </label>
              <label style={lab}>
                Baby name
                <input
                  value={form.babyName}
                  onChange={(e) => setForm({ ...form, babyName: e.target.value })}
                  placeholder="Auto: Baby of …"
                  style={inp}
                />
              </label>
              <label style={lab}>
                Sex
                <select
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as 'M' | 'F' | 'U' })}
                  style={inp}
                >
                  <option value="U">Unknown</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </label>
              <label style={lab}>
                GA (weeks)
                <input
                  type="number"
                  min={22}
                  max={44}
                  value={form.gestationalWeeks}
                  onChange={(e) => setForm({ ...form, gestationalWeeks: e.target.value })}
                  style={inp}
                />
              </label>
              <label style={lab}>
                Birth weight (g)
                <input
                  type="number"
                  min={400}
                  value={form.birthWeightG}
                  onChange={(e) => setForm({ ...form, birthWeightG: e.target.value })}
                  style={inp}
                />
              </label>
              <label style={lab}>
                NICU level
                <select
                  value={form.nicuLevel}
                  onChange={(e) => setForm({ ...form, nicuLevel: e.target.value as NicuLevel })}
                  style={inp}
                >
                  <option value="well">Well baby</option>
                  <option value="level1">Level 1</option>
                  <option value="level2">Level 2</option>
                  <option value="level3">Level 3 NICU</option>
                </select>
              </label>
              <label style={lab}>
                APGAR 1 min
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.apgar1}
                  onChange={(e) => setForm({ ...form, apgar1: e.target.value })}
                  style={inp}
                />
              </label>
              <label style={lab}>
                APGAR 5 min
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.apgar5}
                  onChange={(e) => setForm({ ...form, apgar5: e.target.value })}
                  style={inp}
                />
              </label>
              <label style={lab}>
                Feeding
                <select
                  value={form.feeding}
                  onChange={(e) => setForm({ ...form, feeding: e.target.value as FeedingMode })}
                  style={inp}
                >
                  <option value="breast">Breast</option>
                  <option value="cup">Cup</option>
                  <option value="ng">NGT</option>
                  <option value="iv">IV fluids</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <label style={lab}>
                O2 L/min
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.oxygenLpm}
                  onChange={(e) => setForm({ ...form, oxygenLpm: e.target.value })}
                  style={inp}
                />
              </label>
              <label style={{ ...lab, gridColumn: '1 / -1' }}>
                Diagnosis / indication
                <input
                  value={form.diagnosis}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  style={inp}
                  placeholder="e.g. Prematurity, RDS, jaundice"
                />
              </label>
              <label style={{ ...lab, gridColumn: '1 / -1' }}>
                Notes
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={inp}
                  placeholder="Delivery notes, cord, resuscitation…"
                />
              </label>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 14,
                marginTop: 14,
                flexWrap: 'wrap',
                padding: '10px 12px',
                background: '#F8FAFC',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
              }}
            >
              {(
                [
                  ['vitaminK', 'Vitamin K'],
                  ['hepB', 'Hep B'],
                  ['bcg', 'BCG'],
                  ['phototherapy', 'Phototherapy'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="submit"
              style={{
                marginTop: 16,
                background: 'linear-gradient(135deg,#0F172A,#1D4ED8)',
                color: '#fff',
                border: 'none',
                borderRadius: 9,
                padding: '11px 20px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Admit to newborn / NICU
            </button>
          </form>
        )}

        {tab === 'care' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 12 }}>
            <div style={{ ...card, padding: 10, maxHeight: 560, overflow: 'auto' }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 11,
                  marginBottom: 8,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Select baby
              </div>
              {newborns.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedId(n.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: selectedId === n.id ? '1px solid #93C5FD' : '1px solid transparent',
                    borderRadius: 8,
                    padding: 9,
                    marginBottom: 4,
                    cursor: 'pointer',
                    background: selectedId === n.id ? '#DBEAFE' : '#F8FAFC',
                    fontWeight: selectedId === n.id ? 800 : 600,
                    fontSize: 12,
                  }}
                >
                  {n.babyName}
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 500, marginTop: 2 }}>
                    {n.bedLabel || 'No bay'} · {LEVEL_META[n.nicuLevel].label}
                  </div>
                </button>
              ))}
              {!newborns.length && (
                <div style={{ color: '#94A3B8', fontSize: 12, padding: 8 }}>No active babies</div>
              )}
            </div>
            <div style={{ ...card, padding: 16 }}>
              {!selected ? (
                <div style={{ color: '#64748B', padding: 24, textAlign: 'center' }}>
                  <Stethoscope size={28} color="#93C5FD" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 600 }}>Select a newborn for observations</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Or admit a new baby from the Admit tab</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{selected.babyName}</h3>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        <User size={11} style={{ verticalAlign: 'middle' }} /> {selected.motherName} ·{' '}
                        {selected.gestationalWeeks}w · {selected.birthWeightG}g · {selected.sex} · APGAR{' '}
                        {selected.apgar1 ?? '—'}/{selected.apgar5 ?? '—'}
                      </div>
                      {selected.diagnosis && (
                        <div style={{ fontSize: 12, color: '#B45309', marginTop: 4, fontWeight: 600 }}>
                          {selected.diagnosis}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: LEVEL_META[selected.nicuLevel].bg,
                        color: LEVEL_META[selected.nicuLevel].color,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${LEVEL_META[selected.nicuLevel].border}`,
                      }}
                    >
                      {LEVEL_META[selected.nicuLevel].label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <ObsField
                      label="Temp C"
                      value={selected.tempC ?? ''}
                      onChange={(v) => updateObs({ tempC: Number(v) || undefined })}
                    />
                    <ObsField
                      label="HR"
                      value={selected.hr ?? ''}
                      onChange={(v) => updateObs({ hr: Number(v) || undefined })}
                    />
                    <ObsField
                      label="SpO2 %"
                      value={selected.spo2 ?? ''}
                      onChange={(v) => updateObs({ spo2: Number(v) || undefined })}
                    />
                    <ObsField
                      label="O2 L/min"
                      value={selected.oxygenLpm}
                      onChange={(v) => updateObs({ oxygenLpm: Number(v) || 0 })}
                    />
                    <ObsField
                      label="Weight g"
                      value={selected.currentWeightG ?? selected.birthWeightG}
                      onChange={(v) => updateObs({ currentWeightG: Number(v) || undefined })}
                    />
                    <ObsField
                      label="Bilirubin"
                      value={selected.bilirubin ?? ''}
                      onChange={(v) => updateObs({ bilirubin: Number(v) || undefined })}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <label style={lab}>
                      NICU level
                      <select
                        value={selected.nicuLevel}
                        onChange={(e) => updateObs({ nicuLevel: e.target.value as NicuLevel })}
                        style={inp}
                      >
                        <option value="well">Well baby</option>
                        <option value="level1">Level 1</option>
                        <option value="level2">Level 2</option>
                        <option value="level3">Level 3 NICU</option>
                      </select>
                    </label>
                    <label style={lab}>
                      Feeding
                      <select
                        value={selected.feeding}
                        onChange={(e) => updateObs({ feeding: e.target.value as FeedingMode })}
                        style={inp}
                      >
                        <option value="breast">Breast</option>
                        <option value="cup">Cup</option>
                        <option value="ng">NGT</option>
                        <option value="iv">IV fluids</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <ToggleChip
                      on={selected.phototherapy}
                      label="Phototherapy"
                      onClick={() => updateObs({ phototherapy: !selected.phototherapy })}
                    />
                    <ToggleChip
                      on={selected.vitaminK}
                      label="Vit K"
                      onClick={() => updateObs({ vitaminK: !selected.vitaminK })}
                    />
                    <ToggleChip
                      on={selected.hepB}
                      label="Hep B"
                      onClick={() => updateObs({ hepB: !selected.hepB })}
                    />
                    <ToggleChip
                      on={!!selected.bcg}
                      label="BCG"
                      onClick={() => updateObs({ bcg: !selected.bcg })}
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={lab}>Assign incubator / bay</label>
                    <select
                      value={selected.incubatorId || ''}
                      onChange={(e) => {
                        if (e.target.value) assignBay(facilityId, e.target.value, selected.id);
                        else if (selected.incubatorId) assignBay(facilityId, selected.incubatorId, undefined);
                        refresh();
                        toast('Bay updated');
                      }}
                      style={{ ...inp, marginTop: 4 }}
                    >
                      <option value="">— Unassigned —</option>
                      {bays.map((b) => (
                        <option
                          key={b.id}
                          value={b.id}
                          disabled={b.status === 'occupied' && b.occupiedBy !== selected.id}
                        >
                          {b.label} ({b.status}
                          {b.occupiedBy && b.occupiedBy !== selected.id ? ' · occupied' : ''})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={lab}>Care notes</label>
                    <textarea
                      value={careNotes}
                      onChange={(e) => setCareNotes(e.target.value)}
                      onBlur={() => {
                        if (careNotes !== (selected.notes || '')) updateObs({ notes: careNotes });
                      }}
                      rows={3}
                      style={{
                        ...inp,
                        marginTop: 4,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                      placeholder="Observations, feeding, interventions…"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        updateObs({ notes: careNotes });
                        toast('Chart saved');
                      }}
                      style={{
                        border: 'none',
                        background: 'linear-gradient(135deg,#0F172A,#1D4ED8)',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '9px 14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      <FileText size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Save chart
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        upsertNewborn({ ...selected, status: 'discharged' });
                        if (selected.incubatorId) assignBay(facilityId, selected.incubatorId, undefined);
                        pushNotification({
                          facilityId,
                          level: 'info',
                          title: 'Newborn discharged',
                          body: `${selected.babyName} · mother ${selected.motherName}`,
                          module: 'paediatrics',
                          roleHint: 'midwife',
                        });
                        setSelectedId('');
                        refresh();
                        toast('Discharged from NICU');
                      }}
                      style={{
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        borderRadius: 8,
                        padding: '9px 14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Discharge from NICU
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'dose' && (
          <div style={{ ...card, padding: 18, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#0F172A', fontSize: 15 }}>
              <Syringe size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Neonatal dose calculator
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748B' }}>
              Reference only — verify against local formulary before administration.
            </p>
            <label style={lab}>
              Weight (kg)
              <input
                type="number"
                step={0.1}
                min={0.5}
                value={doseWeight}
                onChange={(e) => setDoseWeight(e.target.value)}
                style={inp}
              />
            </label>
            <label style={{ ...lab, marginTop: 10 }}>
              Drug
              <select value={doseDrug} onChange={(e) => setDoseDrug(e.target.value)} style={inp}>
                <option value="paracetamol">Paracetamol</option>
                <option value="amoxicillin">Amoxicillin</option>
                <option value="gentamicin">Gentamicin</option>
                <option value="caffeine">Caffeine citrate</option>
              </select>
            </label>
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 10,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                fontWeight: 700,
                color: '#1E3A8A',
                fontSize: 14,
              }}
            >
              {paediatricDose(doseDrug, Number(doseWeight) || 3)}
            </div>
            {selected && (
              <button
                type="button"
                onClick={() =>
                  setDoseWeight(
                    String(
                      ((selected.currentWeightG ?? selected.birthWeightG) / 1000).toFixed(2)
                    )
                  )
                }
                style={{
                  marginTop: 10,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  borderRadius: 7,
                  padding: '6px 10px',
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Use selected baby weight ({selected.babyName})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function ObsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(String(value ?? ''));
  useEffect(() => setLocal(String(value ?? '')), [value]);
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        fontSize: 10,
        fontWeight: 700,
        color: '#64748B',
        textTransform: 'uppercase',
      }}
    >
      {label}
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        style={inp}
      />
    </label>
  );
}

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
        border: on ? '1px solid #86EFAC' : '1px solid #E2E8F0',
        background: on ? '#ECFDF5' : '#F8FAFC',
        color: on ? '#047857' : '#64748B',
        borderRadius: 999,
        padding: '5px 11px',
        fontWeight: 700,
        fontSize: 11,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {on ? <CheckCircle2 size={11} /> : <X size={11} />}
      {label}
    </button>
  );
}

export default PaediatricsNicuSuite;
