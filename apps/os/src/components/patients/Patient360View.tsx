'use client';

/**
 * Patient 360 — Epic Storyboard / Cerner PowerChart–density chart.
 * Role-scoped: midwives see maternity clinical data, not billing.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import { setPatientContext } from '../../lib/patientContextStore';
import {
  Search, RefreshCw, User, Calendar, Pill, FlaskConical, FileText, Wallet,
  AlertTriangle, Phone, MapPin, Shield, Activity, Baby, Heart, ChevronRight,
  Stethoscope, Clock,
} from 'lucide-react';
import { buildPatient360, searchPatients360, type Patient360Bundle } from '../../lib/patient360';
import { roleCanSeePatientData } from '../../lib/rolePermissionsStore';
import { inferRoleKey } from '../../lib/staffCardStore';
import { scanEarlyWarnings } from '../../lib/clinicalEarlyWarning';
import { listMaternity } from '../../lib/maternityStore';
import { getAncPlanByPhone, getAncPlanForPatient, nextAncVisit, listAncPlans } from '../../lib/ancNpiSms';
import { buildMaternityChartIntel } from '../../lib/maternityChartIntelligence';

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
  initialPatientId?: string;
}

type ChartTab = 'overview' | 'timeline' | 'orders' | 'pregnancy';

function ageFromDob(dob?: string): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const y = Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
  return `${y}y`;
}

const kindMeta: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  registration: { color: '#2563EB', bg: '#EFF6FF', icon: User },
  visit: { color: '#0D9488', bg: '#F0FDFA', icon: Calendar },
  appointment: { color: '#7C3AED', bg: '#F5F3FF', icon: Calendar },
  lab: { color: '#D97706', bg: '#FFFBEB', icon: FlaskConical },
  rx: { color: '#059669', bg: '#ECFDF5', icon: Pill },
  imaging: { color: '#0284C7', bg: '#F0F9FF', icon: FileText },
  payment: { color: '#64748B', bg: '#F8FAFC', icon: Wallet },
  bill: { color: '#64748B', bg: '#F8FAFC', icon: Wallet },
  note: { color: '#BE185D', bg: '#FDF2F8', icon: FileText },
};

export const Patient360View: React.FC<Props> = ({ session, onNavigate, initialPatientId }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const roleKey = inferRoleKey(session?.roleKey || session?.role || session?.title, session?.badgeId);
  const isMidwife = roleKey === 'midwife';
  const canBills =
    roleCanSeePatientData(roleKey, 'patient.full_chart') ||
    roleKey === 'hospital_admin' ||
    roleKey === 'accountant' ||
    roleKey === 'reception';
  const canLabs = roleCanSeePatientData(roleKey, 'patient.labs') || roleKey === 'doctor' || roleKey === 'lab';

  const [q, setQ] = useState(initialPatientId || '');
  const [bundle, setBundle] = useState<Patient360Bundle | null>(null);
  const [hits, setHits] = useState(() => searchPatients360(facilityId, ''));
  const [warnings, setWarnings] = useState(scanEarlyWarnings(facilityId));
  const [tab, setTab] = useState<ChartTab>(isMidwife ? 'pregnancy' : 'overview');
  const [searchOpen, setSearchOpen] = useState(false);

  const load = (key: string) => {
    const b = buildPatient360(facilityId, key);
    setBundle(b);
    if (b?.patient) setPatientContext(b.patient);
    setWarnings(scanEarlyWarnings(facilityId));
    setSearchOpen(false);
  };

  useEffect(() => {
    if (initialPatientId) load(initialPatientId);
  }, [initialPatientId, facilityId]);

  useEffect(() => {
    setHits(searchPatients360(facilityId, q));
  }, [q, facilityId]);

  const p = bundle?.patient;
  const events = (bundle?.events || []).filter((ev) => {
    if (isMidwife || roleKey === 'nurse') return !['payment', 'bill'].includes(ev.kind);
    return true;
  });
  const unpaidBills = canBills ? bundle?.unpaidBills || [] : [];
  const openOrders = (bundle?.openOrders || []).filter((o) => {
    if (isMidwife) return o.type === 'lab' || o.type === 'rx' || o.type === 'imaging';
    return true;
  });

  const matRecords = useMemo(() => {
    if (!p) return [];
    return listMaternity(facilityId).filter(
      (m) =>
        m.patientName.toLowerCase().includes(`${p.firstName} ${p.lastName}`.toLowerCase()) ||
        (p.phone && m.phone && m.phone.replace(/\\D/g, '').endsWith(p.phone.replace(/\\D/g, '').slice(-10))) ||
        m.hospitalNumber === p.hospitalNumber
    );
  }, [p, facilityId, bundle]);

  const ancPlan = useMemo(() => {
    if (!p) return null;
    return (
      getAncPlanForPatient(p.id, facilityId) ||
      getAncPlanByPhone(p.phone || '', facilityId) ||
      listAncPlans(facilityId).find(
        (x) => x.patientName.toLowerCase() === `${p.firstName} ${p.lastName}`.toLowerCase()
      ) ||
      null
    );
  }, [p, facilityId, bundle]);

  const nextVisit = nextAncVisit(ancPlan);
  const matIntel = useMemo(() => {
    if (!p) return null;
    return buildMaternityChartIntel({ patient: p, matRecords, ancPlan });
  }, [p, matRecords, ancPlan]);
  const patientWarnings = warnings.filter(
    (w) => w.patientId === p?.id || (p && w.patientName?.includes(p.lastName))
  );

  const accent = isMidwife ? '#BE185D' : '#1D4ED8';
  const accentSoft = isMidwife ? '#FDF2F8' : '#EFF6FF';
  const headerGrad = isMidwife
    ? 'linear-gradient(105deg, #831843 0%, #9D174D 40%, #DB2777 100%)'
    : 'linear-gradient(105deg, #0F172A 0%, #1E3A8A 55%, #2563EB 100%)';

  const tabs: { key: ChartTab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'pregnancy', label: 'Pregnancy / ANC', show: isMidwife || matRecords.length > 0 || !!ancPlan },
    { key: 'timeline', label: 'Storyboard', show: true },
    { key: 'orders', label: 'Orders', show: true },
  ];

  const fullName = p ? `${p.firstName}${p.middleName ? ` ${p.middleName}` : ''} ${p.lastName}` : '';
  const initials = p ? `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase() : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 'calc(100vh - 120px)' }}>
      {/* Command header */}
      <div style={{ background: headerGrad, color: '#fff', borderRadius: '16px 16px 0 0', padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85, textTransform: 'uppercase' }}>
              {isMidwife ? 'Maternity chart · role-scoped' : 'Patient 360° · source of truth'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
              {p ? fullName : 'Open a patient chart'}
            </div>
            {p && (
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{p.hospitalNumber}</span>
                <span>·</span>
                <span>{p.sex} · {ageFromDob(p.dob)}</span>
                {p.phone && (
                  <>
                    <span>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={11} /> {p.phone}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'rgba(255,255,255,0.7)' }} />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Name, folder no, phone…"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
              {searchOpen && hits.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 6,
                    background: '#fff',
                    color: '#0F172A',
                    borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(15,23,42,0.2)',
                    zIndex: 40,
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}
                >
                  {hits.slice(0, 12).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => { setQ(h.hospitalNumber); load(h.id); }}
                      style={{
                        display: 'flex',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid #F1F5F9',
                        background: 'transparent',
                        cursor: 'pointer',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: accentSoft,
                          color: accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        {(h.firstName[0] || '') + (h.lastName[0] || '')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {h.firstName} {h.lastName}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>
                          {h.hospitalNumber} · {h.phone || 'no phone'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => p && load(p.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                padding: '8px 12px',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Sync
            </button>
          </div>
        </div>

        {/* Segment tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14, overflowX: 'auto' }}>
          {tabs.filter((t) => t.show).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  border: 'none',
                  borderRadius: '10px 10px 0 0',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: active ? '#F8FAFC' : 'transparent',
                  color: active ? (isMidwife ? '#9D174D' : '#1E3A8A') : 'rgba(255,255,255,0.9)',
                  fontWeight: active ? 800 : 600,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: 16,
          flex: 1,
        }}
      >
        {!p && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
            <User size={36} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Search to open a chart</div>
            <div style={{ fontSize: 13, marginTop: 6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Use folder number, name, or phone. Data comes from registry, visits, orders
              {isMidwife ? ', and maternity / ANC — not AI invention.' : ', and bills — not AI invention.'}
            </div>
            {hits.slice(0, 6).length > 0 && (
              <div style={{ marginTop: 20, display: 'grid', gap: 8, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', textAlign: 'left' }}>
                {hits.slice(0, 6).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => load(h.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{h.firstName} {h.lastName}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{h.hospitalNumber}</div>
                    </div>
                    <ChevronRight size={16} color="#94A3B8" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {p && (
          <>
            {/* Alert strip */}
            {(patientWarnings.length > 0 || (p.allergies && p.allergies.length > 0)) && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {(p.allergies || []).length > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#FEF2F2',
                      color: '#B91C1C',
                      border: '1px solid #FECACA',
                      borderRadius: 999,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <AlertTriangle size={12} /> ALLERGY · {(p.allergies || []).join(', ')}
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#ECFDF5',
                      color: '#047857',
                      border: '1px solid #A7F3D0',
                      borderRadius: 999,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    NKDA · no allergies on file
                  </span>
                )}
                {patientWarnings.map((w) => (
                  <span
                    key={w.patientId + w.message}
                    style={{
                      background: '#FFF7ED',
                      color: '#C2410C',
                      border: '1px solid #FED7AA',
                      borderRadius: 999,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {w.message}
                  </span>
                ))}
              </div>
            )}

            {/* Clinical intelligence rail */}
            {matIntel && (isMidwife || matRecords.length > 0 || ancPlan) && (
              <div
                style={{
                  marginBottom: 14,
                  borderRadius: 16,
                  border: `1px solid ${
                    matIntel.riskBanner === 'critical'
                      ? '#FECACA'
                      : matIntel.riskBanner === 'warn'
                        ? '#FED7AA'
                        : '#E2E8F0'
                  }`,
                  background:
                    matIntel.riskBanner === 'critical'
                      ? 'linear-gradient(135deg,#FEF2F2 0%,#fff 50%)'
                      : matIntel.riskBanner === 'warn'
                        ? 'linear-gradient(135deg,#FFF7ED 0%,#fff 55%)'
                        : 'linear-gradient(135deg,#FDF2F8 0%,#fff 60%)',
                  padding: 14,
                  boxShadow: '0 8px 28px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: isMidwife
                          ? 'linear-gradient(135deg,#BE185D,#DB2777)'
                          : 'linear-gradient(135deg,#1D4ED8,#2563EB)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      AI
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>Chart intelligence</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Rule-based maternity decision support · midwife remains final clinical authority
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {matIntel.gaNow != null && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#9D174D', background: '#FDF2F8', padding: '4px 10px', borderRadius: 999 }}>
                        GA ~{matIntel.gaNow}w
                      </span>
                    )}
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                        Chart completeness · {matIntel.completeness}%
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${matIntel.completeness}%`,
                            height: '100%',
                            borderRadius: 99,
                            background:
                              matIntel.completeness >= 80
                                ? '#10B981'
                                : matIntel.completeness >= 50
                                  ? '#F59E0B'
                                  : '#EF4444',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {matIntel.missing.length > 0 && (
                  <div style={{ fontSize: 11, color: '#B45309', marginBottom: 8, fontWeight: 600 }}>
                    Missing for department chart: {matIntel.missing.join(' · ')}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                  {matIntel.insights.slice(0, 4).map((ins) => (
                    <div
                      key={ins.id}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        border: '1px solid #F1F5F9',
                        padding: '10px 12px',
                        borderLeft: `3px solid ${
                          ins.level === 'critical'
                            ? '#DC2626'
                            : ins.level === 'warn'
                              ? '#D97706'
                              : ins.level === 'ok'
                                ? '#10B981'
                                : '#2563EB'
                        }`,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 12, color: '#0F172A' }}>{ins.title}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, lineHeight: 1.45 }}>{ins.detail}</div>
                      {ins.action && onNavigate && ins.module && (
                        <button
                          type="button"
                          onClick={() => onNavigate(ins.module!)}
                          style={{
                            marginTop: 8,
                            border: 'none',
                            background: 'transparent',
                            color: isMidwife ? '#BE185D' : '#2563EB',
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {ins.action} →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

                        {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 14 }}>
                {/* Identity rail */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      border: '1px solid #E2E8F0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px 16px 14px',
                        background: accentSoft,
                        borderBottom: '1px solid #E2E8F0',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          background: headerGrad,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{fullName}</div>
                        <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'ui-monospace, monospace' }}>
                          {p.hospitalNumber}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          {p.status === 'active' ? 'Active chart' : p.status} · {p.facilityName || facilityId}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: 14 }}>
                      {[
                        { icon: User, label: 'Sex / DOB', value: `${p.sex} · ${p.dob || '—'} (${ageFromDob(p.dob)})` },
                        { icon: Phone, label: 'Phone', value: p.phone || '—' },
                        { icon: Shield, label: 'NIN / NHIA', value: `${p.nin || '—'} / ${p.nhiaNumber || '—'}` },
                        { icon: Activity, label: 'Blood / Genotype', value: `${p.bloodGroup || '—'} / ${p.genotype || '—'}` },
                        { icon: MapPin, label: 'Address', value: p.address || '—' },
                        { icon: MapPin, label: 'LGA / State', value: `${p.lga || '—'}, ${p.state || '—'}` },
                        { icon: Heart, label: 'Emergency', value: p.emergencyContact || '—' },
                      ].map((row) => {
                        const Icon = row.icon;
                        return (
                          <div
                            key={row.label}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '20px 1fr',
                              gap: 8,
                              padding: '8px 0',
                              borderBottom: '1px solid #F8FAFC',
                            }}
                          >
                            <Icon size={14} color="#94A3B8" style={{ marginTop: 2 }} />
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                                {row.label}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 1 }}>
                                {row.value}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clinical flags */}
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: '#0F172A' }}>Clinical flags</div>
                    <FlagBlock label="Allergies" value={(p.allergies || []).join(', ') || 'NKDA'} danger={(p.allergies || []).length > 0} />
                    <FlagBlock label="Problems" value={(p.problems || []).join(', ') || 'None on file'} />
                    <FlagBlock label="Chronic" value={(p.chronicConditions || []).join(', ') || 'None on file'} />
                    <FlagBlock label="Current meds" value={(p.currentMedications || []).join(', ') || 'None on file'} />
                  </div>

                  {canBills && (
                    <div
                      style={{
                        background: bundle.balanceNgn > 0 ? '#FFFBEB' : '#ECFDF5',
                        border: `1px solid ${bundle.balanceNgn > 0 ? '#FDE68A' : '#A7F3D0'}`,
                        borderRadius: 14,
                        padding: 14,
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      Account balance · ₦{(bundle.balanceNgn || 0).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Right: snapshot + recent */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    {[
                      { l: 'Open orders', v: openOrders.length, c: '#D97706' },
                      { l: 'Timeline events', v: events.length, c: accent },
                      { l: 'Visits on file', v: bundle.recentVisits?.length || 0, c: '#0D9488' },
                      ...(isMidwife
                        ? [{ l: 'ANC / OB records', v: matRecords.length + (ancPlan ? 1 : 0), c: '#BE185D' }]
                        : canBills
                          ? [{ l: 'Unpaid lines', v: unpaidBills.length, c: '#DC2626' }]
                          : []),
                    ].map((k) => (
                      <div
                        key={k.l}
                        style={{
                          background: '#fff',
                          borderRadius: 12,
                          border: '1px solid #E2E8F0',
                          padding: '12px 14px',
                          borderLeft: `3px solid ${k.c}`,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{k.l}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>Recent activity</div>
                      <button
                        type="button"
                        onClick={() => setTab('timeline')}
                        style={{ border: 'none', background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        Full storyboard →
                      </button>
                    </div>
                    {events.slice(0, 6).length === 0 ? (
                      <div style={{ fontSize: 13, color: '#94A3B8', padding: 12 }}>No clinical events yet.</div>
                    ) : (
                      events.slice(0, 6).map((ev) => {
                        const meta = kindMeta[ev.kind] || kindMeta.note;
                        const Icon = meta.icon;
                        return (
                          <div
                            key={ev.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '36px 1fr auto',
                              gap: 10,
                              padding: '10px 0',
                              borderBottom: '1px solid #F8FAFC',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: meta.bg,
                                color: meta.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon size={14} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{ev.title}</div>
                              <div style={{ fontSize: 12, color: '#64748B' }}>{ev.detail}</div>
                            </div>
                            <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                              {(ev.at || '').slice(0, 16).replace('T', ' ')}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {openOrders.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Open work</div>
                      {openOrders.map((o) => (
                        <div
                          key={o.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #F8FAFC',
                            fontSize: 12,
                          }}
                        >
                          <span>
                            <strong style={{ textTransform: 'uppercase' }}>{o.type}</strong> · {o.name}
                          </span>
                          <span style={{ fontWeight: 700, color: '#D97706' }}>{o.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'pregnancy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Department summary strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 8,
                  }}
                >
                  {[
                    { l: 'Folder', v: p.hospitalNumber },
                    { l: 'Age / Sex', v: `${ageFromDob(p.dob)} · ${p.sex}` },
                    { l: 'Phone', v: p.phone || '—' },
                    { l: 'Blood', v: p.bloodGroup || matRecords[0]?.bloodGroup || '—' },
                    { l: 'Allergies', v: (p.allergies || []).join(', ') || matRecords[0]?.allergies || 'NKDA' },
                    { l: 'Emergency', v: p.emergencyContact || '—' },
                  ].map((k) => (
                    <div
                      key={k.l}
                      style={{
                        background: '#fff',
                        borderRadius: 10,
                        border: '1px solid #FCE7F3',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9D174D', textTransform: 'uppercase' }}>{k.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>{k.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #FBCFE8', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#9D174D', marginBottom: 12 }}>
                      <Baby size={16} /> Antenatal plan (department)
                    </div>
                    {!ancPlan ? (
                      <div style={{ fontSize: 13, color: '#64748B' }}>
                        No ANC calendar linked. Register under Maternity EMR with this patient&apos;s phone to attach LMP, EDD and contact weeks.
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('maternity')}
                            style={{
                              display: 'block',
                              marginTop: 12,
                              border: 'none',
                              background: 'linear-gradient(135deg,#BE185D,#DB2777)',
                              color: '#fff',
                              borderRadius: 10,
                              padding: '10px 14px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Open Maternity EMR
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <MiniKpi label="LMP" value={ancPlan.lmp || '—'} />
                          <MiniKpi label="EDD" value={ancPlan.edd} />
                          <MiniKpi label="GA @ reg" value={`${ancPlan.gaWeeksAtReg}w`} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <MiniKpi label="Next visit" value={nextVisit?.dueDate || '—'} />
                          <MiniKpi label="Contacts left" value={String(ancPlan.visits.filter((v) => v.dueDate >= new Date().toISOString().slice(0, 10)).length)} />
                        </div>
                        {nextVisit && (
                          <div style={{ background: '#FDF2F8', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 600, color: '#9D174D', marginBottom: 10 }}>
                            Next: {nextVisit.label}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                          SMS: {ancPlan.smsOptIn === false ? 'Opted out' : `On · ${ancPlan.smsLang || 'en'}`}
                          {ancPlan.phone ? ` · ${ancPlan.phone}` : ''}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 12, marginTop: 8, marginBottom: 4 }}>ANC contact schedule</div>
                        {ancPlan.visits.map((v) => (
                          <div
                            key={v.week}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '8px 0',
                              borderTop: '1px solid #FCE7F3',
                              fontSize: 12,
                            }}
                          >
                            <span style={{ fontWeight: 700 }}>{v.dueDate}</span>
                            <span style={{ color: '#64748B' }}>{v.label}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
                      <Stethoscope size={16} color="#BE185D" /> OB encounter (live maternity record)
                    </div>
                    {matRecords.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#64748B' }}>
                        No maternity encounter linked to this name/phone/folder yet. Open Maternity EMR to triage, admit labour, or book ANC.
                      </div>
                    ) : (
                      matRecords.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid #FCE7F3',
                            marginBottom: 10,
                            background: '#FFFBFD',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 800, fontSize: 14, textTransform: 'capitalize' }}>
                              {m.stage.replace(/_/g, ' ')}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                background: m.risk === 'critical' || m.risk === 'high' ? '#FEF2F2' : '#FDF2F8',
                                color: m.risk === 'critical' || m.risk === 'high' ? '#B91C1C' : '#9D174D',
                                borderRadius: 999,
                                padding: '3px 10px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {m.risk} risk
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '8px 12px',
                              marginTop: 12,
                              fontSize: 12,
                            }}
                          >
                            <Detail label="G / P" value={m.gravidaPara} />
                            <Detail label="GA" value={m.gaWeeks != null ? `${m.gaWeeks}w${m.gaDays != null ? `+${m.gaDays}` : ''}` : '—'} />
                            <Detail label="LMP" value={m.lmp || '—'} />
                            <Detail label="EDD" value={m.edd || ancPlan?.edd || '—'} />
                            <Detail label="Blood / Rh" value={`${m.bloodGroup || p.bloodGroup || '—'} / ${m.rhesus || '—'}`} />
                            <Detail label="GBS" value={m.gbs || '—'} />
                            <Detail label="HIV" value={m.hivStatus || '—'} />
                            <Detail label="MFTI" value={m.mfti != null ? String(m.mfti) : '—'} />
                            <Detail label="Bed" value={m.bedNo || '—'} />
                            <Detail label="Midwife" value={m.midwifeOnDuty || '—'} />
                            <Detail label="Presentation" value={m.presentation || '—'} />
                            <Detail label="ROM" value={m.romStatus || '—'} />
                          </div>

                          {['admitted_labour', 'active_labour', 'second_stage', 'triage'].includes(m.stage) && (
                            <div
                              style={{
                                marginTop: 12,
                                padding: 10,
                                borderRadius: 10,
                                background: '#FDF2F8',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                                gap: 8,
                              }}
                            >
                              <Detail label="Dilatation" value={m.cervicalDilationCm != null ? `${m.cervicalDilationCm} cm` : '—'} />
                              <Detail label="Effacement" value={m.effacementPct != null ? `${m.effacementPct}%` : '—'} />
                              <Detail label="Station" value={m.station != null ? String(m.station) : '—'} />
                              <Detail label="FHR" value={m.fetalHeartRateBpm != null ? `${m.fetalHeartRateBpm}` : '—'} />
                              <Detail label="Ctx / 10min" value={m.contractionsPer10Min != null ? String(m.contractionsPer10Min) : '—'} />
                            </div>
                          )}

                          {m.delivered && (
                            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: '#ECFDF5', fontSize: 12 }}>
                              <div style={{ fontWeight: 800, color: '#047857', marginBottom: 6 }}>Delivery</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <Detail label="Mode" value={m.deliveryMode || '—'} />
                                <Detail label="At" value={(m.deliveryAt || '').slice(0, 16).replace('T', ' ') || '—'} />
                                <Detail label="Baby" value={`${m.babyGender || '—'} · ${m.birthWeightG || (m.birthWeightKg ? Math.round(m.birthWeightKg * 1000) : '—')}g`} />
                                <Detail label="APGAR 1/5" value={`${m.apgar1 ?? '—'} / ${m.apgar5 ?? '—'}`} />
                                <Detail label="EBL" value={m.eblMl != null ? `${m.eblMl} ml` : '—'} />
                                <Detail label="PPH risk" value={m.pphRisk || '—'} />
                              </div>
                            </div>
                          )}

                          {(m.riskFactors || []).length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#B91C1C' }}>
                              Risk factors: {(m.riskFactors || []).join(', ')}
                            </div>
                          )}
                          {m.notes && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>Notes: {m.notes}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Meds / problems for maternity context */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Medications (chart)</div>
                    <div style={{ fontSize: 13, color: '#0F172A' }}>
                      {(p.currentMedications || []).join(', ') || 'None on file'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Problems / chronic</div>
                    <div style={{ fontSize: 13, color: '#0F172A' }}>
                      {[...(p.problems || []), ...(p.chronicConditions || [])].join(', ') || 'None on file'}
                    </div>
                  </div>
                  {openOrders.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Open lab / Rx / imaging</div>
                      {openOrders.map((o) => (
                        <div key={o.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #F8FAFC' }}>
                          <strong>{o.type}</strong> · {o.name} · {o.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'timeline' && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color={accent} /> Clinical storyboard
                </div>
                {events.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 13, padding: 24, textAlign: 'center' }}>No events on timeline.</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 8 }}>
                    {events.map((ev, idx) => {
                      const meta = kindMeta[ev.kind] || kindMeta.note;
                      const Icon = meta.icon;
                      return (
                        <div
                          key={ev.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '40px 1fr',
                            gap: 12,
                            paddingBottom: idx === events.length - 1 ? 0 : 16,
                            position: 'relative',
                          }}
                        >
                          {idx < events.length - 1 && (
                            <div
                              style={{
                                position: 'absolute',
                                left: 19,
                                top: 36,
                                bottom: 0,
                                width: 2,
                                background: '#E2E8F0',
                              }}
                            />
                          )}
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: meta.bg,
                              color: meta.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1,
                            }}
                          >
                            <Icon size={15} />
                          </div>
                          <div
                            style={{
                              background: '#F8FAFC',
                              borderRadius: 12,
                              padding: '12px 14px',
                              border: '1px solid #F1F5F9',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 13 }}>{ev.title}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                                {(ev.at || '').slice(0, 16).replace('T', ' ')}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{ev.detail}</div>
                            {ev.status && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginTop: 8,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  background: '#fff',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: 999,
                                  padding: '2px 8px',
                                  color: '#64748B',
                                }}
                              >
                                {ev.status}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'orders' && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Clinical orders</div>
                {openOrders.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>No open orders for this role scope.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748B', background: '#F8FAFC' }}>
                        {'Type|Name|Status|Ordered'.split('|').map((h) => (
                          <th key={h} style={{ padding: '8px 10px', fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.map((o) => (
                        <tr key={o.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{o.type}</td>
                          <td style={{ padding: '10px' }}>{o.name}</td>
                          <td style={{ padding: '10px', fontWeight: 700, color: '#D97706' }}>{o.status}</td>
                          <td style={{ padding: '10px', color: '#94A3B8', fontSize: 12 }}>
                            {(o.createdAt || '').slice(0, 16).replace('T', ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {canBills && unpaidBills.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Unpaid bill lines</div>
                    {unpaidBills.map((b) => (
                      <div key={b.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                        {b.description} · ₦{(b.amountNgn || 0).toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function FlagBlock({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: danger ? '#B91C1C' : '#0F172A', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#FDF2F8', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#9D174D', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default Patient360View;
