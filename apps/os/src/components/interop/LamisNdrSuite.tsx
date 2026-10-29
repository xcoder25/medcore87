'use client';

/**
 * LAMIS + NDR + RADET + e-CRVS National Interoperability Suite.
 * Built for Akwa Ibom State Ministry of Health & PEPFAR/CDC implementing partners.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Shield, Download, FileText, CheckCircle2, AlertTriangle, Users,
  Pill, FlaskConical, Sparkles, Brain, Baby, ArrowUpRight, Search, Clock, RefreshCw, Filter, Heart
} from 'lucide-react';
import {
  listLamisCohort,
  subscribeLamisCohort,
  generateRadetReport,
  downloadRadetCsv,
  downloadNdrJson,
  type LamisArtPatient,
} from '../../lib/lamisStore';
import {
  listEcrvsBirths,
  listEcrvsDeaths,
  subscribeEcrvs,
  exportNpcVitalStatistics,
  type EcrvsBirthRecord,
  type EcrvsDeathRecord,
} from '../../lib/ecrvsService';

interface Props {
  session?: any;
}

type Tab = 'cohort' | 'pharmacy' | 'lims' | 'ai-risk' | 'radet-ndr' | 'ecrvs';

export const LamisNdrSuite: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Immanuel General Hospital, Eket';

  const [tab, setTab] = useState<Tab>('cohort');
  const [cohort, setCohort] = useState<LamisArtPatient[]>(() => listLamisCohort(facilityId));
  const [births, setBirths] = useState<EcrvsBirthRecord[]>(() => listEcrvsBirths(facilityId));
  const [deaths, setDeaths] = useState<EcrvsDeathRecord[]>(() => listEcrvsDeaths(facilityId));
  const [search, setSearch] = useState('');
  const [filterRegimen, setFilterRegimen] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<LamisArtPatient | null>(null);

  useEffect(() => {
    const unsubL = subscribeLamisCohort(() => setCohort(listLamisCohort(facilityId)));
    const unsubE = subscribeEcrvs(() => {
      setBirths(listEcrvsBirths(facilityId));
      setDeaths(listEcrvsDeaths(facilityId));
    });
    return () => {
      unsubL();
      unsubE();
    };
  }, [facilityId]);

  const stats = useMemo(() => {
    const total = cohort.length || 1;
    const active = cohort.filter((p) => p.currentArtStatus === 'Active').length;
    const mmd = cohort.filter((p) => p.daysOfRefillSupplied >= 90).length;
    const suppressed = cohort.filter((p) => p.viralSuppressed).length;
    const highRisk = cohort.filter((p) => p.iitRiskScore === 'High Risk').length;
    return {
      txCurr: active,
      mmdRate: Math.round((mmd / total) * 100),
      suppressionRate: Math.round((suppressed / total) * 100),
      highRiskIit: highRisk,
      totalBirths: births.length,
      totalDeaths: deaths.length,
    };
  }, [cohort, births, deaths]);

  const filteredCohort = useMemo(() => {
    return cohort.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.artNumber.toLowerCase().includes(q) ||
        p.hospitalNumber.toLowerCase().includes(q) ||
        (p.nin && p.nin.includes(q));
      const matchReg = filterRegimen === 'all' || p.currentRegimen.includes(filterRegimen);
      return matchSearch && matchReg;
    });
  }, [cohort, search, filterRegimen]);

  const pill = (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: 999,
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    background: active ? '#0284C7' : '#F1F5F9',
    color: active ? '#FFF' : '#475569',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', color: '#0F172A', fontFamily: 'inherit' }}>
      {/* ── Top Header Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#0284C7', color: '#FFF', padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.5px' }}>
              LAMIS · NDR · e-CRVS
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>National & State Health Interoperability Hub</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0 2px 0', color: '#0F172A' }}>
            HIV Care, NDR Surveillance & Vital Statistics
          </h1>
          <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
            {facilityName} · Akwa Ibom State Primary & Secondary Health Care Network
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => downloadRadetCsv(facilityId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
              background: '#059669', color: '#FFF', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5,150,105,0.25)'
            }}
          >
            <Download size={16} /> Download RADET (PEPFAR)
          </button>
          <button
            type="button"
            onClick={() => downloadNdrJson(facilityId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
              background: '#0284C7', color: '#FFF', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2,132,199,0.25)'
            }}
          >
            <Download size={16} /> Export NDR Container
          </button>
        </div>
      </div>

      {/* ── Metric KPI Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, borderLeft: '4px solid #0284C7' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>TX_CURR (Active Cohort)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284C7', margin: '4px 0' }}>{stats.txCurr}</div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600 }}>Active on Antiretroviral Therapy</div>
        </div>

        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>MMD Coverage (3M / 6M)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10B981', margin: '4px 0' }}>{stats.mmdRate}%</div>
          <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Multi-month dispensing uptake</div>
        </div>

        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Viral Suppression (TX_PVLS)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8B5CF6', margin: '4px 0' }}>{stats.suppressionRate}%</div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600 }}>&lt; 1,000 copies/mL threshold</div>
        </div>

        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, borderLeft: '4px solid #EF4444' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>AI Default Risk (IIT Alert)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#EF4444', margin: '4px 0' }}>{stats.highRiskIit}</div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>Clients requiring outreach</div>
        </div>

        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>e-CRVS Vital Stats</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B', margin: '4px 0' }}>{stats.totalBirths}B / {stats.totalDeaths}D</div>
          <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>National Pop. Commission synced</div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        <button type="button" style={pill(tab === 'cohort')} onClick={() => setTab('cohort')}>
          🎯 HIV Clinical Care &amp; Cohort
        </button>
        <button type="button" style={pill(tab === 'pharmacy')} onClick={() => setTab('pharmacy')}>
          💊 Pharmacy &amp; MMD Dispensing
        </button>
        <button type="button" style={pill(tab === 'lims')} onClick={() => setTab('lims')}>
          🔬 Viral Load &amp; CD4 LIMS
        </button>
        <button type="button" style={pill(tab === 'ai-risk')} onClick={() => setTab('ai-risk')}>
          🤖 AI Default &amp; IIT Predictor
        </button>
        <button type="button" style={pill(tab === 'radet-ndr')} onClick={() => setTab('radet-ndr')}>
          📊 RADET &amp; NDR Reporting
        </button>
        <button type="button" style={pill(tab === 'ecrvs')} onClick={() => setTab('ecrvs')}>
          👶 e-CRVS Vital Statistics
        </button>
      </div>

      {/* ── Tab 1: HIV Clinical Care & Cohort ── */}
      {tab === 'cohort' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', top: 11, left: 12, color: '#94A3B8' }} />
                <input
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  placeholder="Search by Patient Name, ART Unique ID, Hospital Number or NIN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>Regimen:</span>
              <select
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', background: '#FFF' }}
                value={filterRegimen}
                onChange={(e) => setFilterRegimen(e.target.value)}
              >
                <option value="all">All Regimens</option>
                <option value="TLD">TLD (DTG-based First Line)</option>
                <option value="AZT">AZT/3TC (Second Line)</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>ART Unique ID</th>
                  <th style={{ padding: '10px 12px' }}>Patient Name</th>
                  <th style={{ padding: '10px 12px' }}>Age/Sex</th>
                  <th style={{ padding: '10px 12px' }}>Current Regimen</th>
                  <th style={{ padding: '10px 12px' }}>WHO Stage</th>
                  <th style={{ padding: '10px 12px' }}>TB / TPT Status</th>
                  <th style={{ padding: '10px 12px' }}>PMTCT</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCohort.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px', fontWeight: 800, color: '#0284C7' }}>{p.artNumber}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{p.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Hosp: {p.hospitalNumber} · NIN: {p.nin || 'Unlinked'}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000))}y / {p.sex}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem' }}>
                        {p.currentRegimen}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>Stage {p.whoClinicalStage}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{p.tbScreeningStatus}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>TPT: {p.tbPreventiveTherapy}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {p.isPregnant ? (
                        <span style={{ color: '#BE185D', fontWeight: 700 }}>Pregnant (ANC)</span>
                      ) : p.breastfeeding ? (
                        <span style={{ color: '#0D9488', fontWeight: 700 }}>Breastfeeding</span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: p.currentArtStatus === 'Active' ? '#DCFCE7' : '#FEE2E2',
                          color: p.currentArtStatus === 'Active' ? '#15803D' : '#B91C1C',
                        }}
                      >
                        {p.currentArtStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(p)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        View Card
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Pharmacy & MMD Dispensing ── */}
      {tab === 'pharmacy' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800 }}>Pharmacy Dispensing &amp; Multi-Month Dispensing (MMD) Log</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#64748B' }}>
            Tracks days of medication supplied, appointment refill schedules, and adherence monitoring.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Client</th>
                <th style={{ padding: '10px 12px' }}>Regimen</th>
                <th style={{ padding: '10px 12px' }}>Last Refill Date</th>
                <th style={{ padding: '10px 12px' }}>MMD Supplied</th>
                <th style={{ padding: '10px 12px' }}>Next Appointment</th>
                <th style={{ padding: '10px 12px' }}>Adherence</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cohort.map((p) => {
                const daysUntil = Math.round((new Date(p.nextPickupDate).getTime() - Date.now()) / (24 * 3600 * 1000));
                const isOverdue = daysUntil < 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 700 }}>{p.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{p.artNumber}</div>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{p.currentRegimen}</td>
                    <td style={{ padding: '12px' }}>{p.lastPickupDate}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 800, color: p.daysOfRefillSupplied >= 90 ? '#059669' : '#D97706' }}>
                        {p.daysOfRefillSupplied} Days ({p.daysOfRefillSupplied / 30}M MMD)
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 700, color: isOverdue ? '#DC2626' : '#0F172A' }}>{p.nextPickupDate}</div>
                      <div style={{ fontSize: '0.7rem', color: isOverdue ? '#DC2626' : '#64748B' }}>
                        {isOverdue ? `${Math.abs(daysUntil)} days overdue!` : `In ${daysUntil} days`}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${p.adherencePercentage}%`, height: '100%', background: p.adherencePercentage >= 90 ? '#10B981' : '#EF4444' }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{p.adherencePercentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {isOverdue ? (
                        <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800 }}>
                          MISSED REFILL
                        </span>
                      ) : (
                        <span style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800 }}>
                          ON TIME
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 3: Viral Load & CD4 LIMS ── */}
      {tab === 'lims' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800 }}>Laboratory Diagnostics &amp; Viral Load Cascade</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#64748B' }}>
            Specimen routing to PCR reference laboratories (Uyo / Eket), test logging, and automated viral suppression flags.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Client</th>
                <th style={{ padding: '10px 12px' }}>Viral Load (copies/mL)</th>
                <th style={{ padding: '10px 12px' }}>Suppression Flag</th>
                <th style={{ padding: '10px 12px' }}>Last VL Date</th>
                <th style={{ padding: '10px 12px' }}>CD4 Count</th>
                <th style={{ padding: '10px 12px' }}>Specimen Status</th>
              </tr>
            </thead>
            <tbody>
              {cohort.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700 }}>{p.fullName}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{p.artNumber}</div>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 800, fontSize: '0.95rem', color: p.viralSuppressed ? '#059669' : '#DC2626' }}>
                    {p.lastViralLoadCopies.toLocaleString()} cp/mL
                  </td>
                  <td style={{ padding: '12px' }}>
                    {p.viralSuppressed ? (
                      <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.75rem' }}>
                        SUPPRESSED (&lt;1000)
                      </span>
                    ) : (
                      <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '4px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.75rem' }}>
                        UNSUPPRESSED (EAC Needed)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>{p.lastViralLoadDate}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontWeight: 700 }}>{p.lastCd4Count}</span> <span style={{ fontSize: '0.7rem', color: '#64748B' }}>cells/μL</span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>{p.viralLoadSampleStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 4: AI Default & IIT Predictor ── */}
      {tab === 'ai-risk' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Brain size={20} style={{ color: '#7C3AED' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Celestia AI: 30-Day Interruption-In-Treatment (IIT) Risk Forecast</h3>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#64748B' }}>
            Machine learning algorithm analyzing pickup intervals, adherence history, and viral suppression to stratify patient dropout risk.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {cohort.map((p) => {
              const isHigh = p.iitRiskScore === 'High Risk';
              return (
                <div
                  key={p.id}
                  style={{
                    border: isHigh ? '2px solid #EF4444' : '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: 16,
                    background: isHigh ? '#FFF5F5' : '#FFF',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{p.artNumber} · Tel: {p.phone}</div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: isHigh ? '#FEE2E2' : '#DCFCE7',
                        color: isHigh ? '#B91C1C' : '#15803D',
                      }}
                    >
                      {p.iitRiskScore} ({Math.round(p.iitRiskProbability * 100)}%)
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: 10 }}>
                    <strong>Risk Indicators Identified:</strong>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {p.riskFactors.map((rf, i) => (
                        <li key={i}>{rf}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Next Refill: {p.nextPickupDate}</span>
                    <button
                      type="button"
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: isHigh ? '#DC2626' : '#0284C7',
                        color: '#FFF',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isHigh ? 'Trigger Case Manager Call' : 'Review Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab 5: RADET & NDR Reporting Center ── */}
      {tab === 'radet-ndr' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800 }}>National Data Repository (NDR) &amp; PEPFAR Compliance</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: '#64748B' }}>
            Automated schema packaging compliant with Nigeria MoH guidelines. No manual spreadsheets required.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* RADET Card */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <FileText size={24} style={{ color: '#059669' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>RADET Monthly Dataset (PEPFAR / CDC)</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Retention Audit and Determination Tool</div>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                Export monthly client-level line lists containing current regimen, last refill date, MMD days, next refill date, and latest viral load results.
              </p>
              <button
                type="button"
                onClick={() => downloadRadetCsv(facilityId)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, background: '#059669', color: '#FFF',
                  fontWeight: 800, fontSize: '0.85rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Download size={16} /> Download RADET .CSV File
              </button>
            </div>

            {/* NDR Card */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Shield size={24} style={{ color: '#0284C7' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>NDR Container (Federal Ministry of Health)</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>National Data Repository Standard JSON / XML</div>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                Encrypted and structured container mapping client demographics, HIV encounters, regimen history, and lab reports for state surveillance.
              </p>
              <button
                type="button"
                onClick={() => downloadNdrJson(facilityId)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, background: '#0284C7', color: '#FFF',
                  fontWeight: 800, fontSize: '0.85rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Download size={16} /> Export NDR Container Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 6: e-CRVS Vital Statistics Registry ── */}
      {tab === 'ecrvs' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800 }}>e-CRVS Civil Registration &amp; Vital Statistics</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                National Population Commission (NPC) compliant birth and death certification pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportNpcVitalStatistics(facilityId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8,
                background: '#0284C7', color: '#FFF', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer'
              }}
            >
              <Download size={14} /> Export NPC Vital Stats JSON
            </button>
          </div>

          <h4 style={{ margin: '14px 0 8px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>Registered Live Births (Form B1)</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '8px 10px' }}>Tracking ID</th>
                <th style={{ padding: '8px 10px' }}>Child Name</th>
                <th style={{ padding: '8px 10px' }}>Date / Time</th>
                <th style={{ padding: '8px 10px' }}>Weight</th>
                <th style={{ padding: '8px 10px' }}>Mother (NIN)</th>
                <th style={{ padding: '8px 10px' }}>Attendant</th>
                <th style={{ padding: '8px 10px' }}>NPC Status</th>
              </tr>
            </thead>
            <tbody>
              {births.map((b) => (
                <tr key={b.trackingId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', fontWeight: 800, color: '#0284C7' }}>{b.trackingId}</td>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{b.childFullName} ({b.sex})</td>
                  <td style={{ padding: '10px' }}>{b.dateOfBirth} {b.timeOfBirth}</td>
                  <td style={{ padding: '10px' }}>{b.birthWeightKg} kg</td>
                  <td style={{ padding: '10px' }}>{b.motherFullName} <span style={{ fontSize: '0.7rem', color: '#64748B' }}>({b.motherNin || 'N/A'})</span></td>
                  <td style={{ padding: '10px' }}>{b.attendantName} ({b.attendantRole})</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 7px', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem' }}>
                      {b.registrationStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{ margin: '14px 0 8px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>Registered Deaths &amp; Medical Certification (Form D1)</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '8px 10px' }}>Tracking ID</th>
                <th style={{ padding: '8px 10px' }}>Deceased Name</th>
                <th style={{ padding: '8px 10px' }}>Age / Sex</th>
                <th style={{ padding: '8px 10px' }}>Cause of Death (ICD-10)</th>
                <th style={{ padding: '8px 10px' }}>Certifying Physician</th>
                <th style={{ padding: '8px 10px' }}>NPC Status</th>
              </tr>
            </thead>
            <tbody>
              {deaths.map((d) => (
                <tr key={d.trackingId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', fontWeight: 800, color: '#DC2626' }}>{d.trackingId}</td>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{d.deceasedFullName}</td>
                  <td style={{ padding: '10px' }}>{d.ageAtDeath}y / {d.sex}</td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 600 }}>{d.underlyingCauseOfDeath}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>ICD-10: {d.icd10Code}</div>
                  </td>
                  <td style={{ padding: '10px' }}>{d.certifyingPhysicianName} <span style={{ fontSize: '0.7rem', color: '#64748B' }}>({d.certifyingPhysicianMdcn})</span></td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 7px', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem' }}>
                      {d.registrationStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Patient ART Card ── */}
      {selectedPatient && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
          }}
          onClick={() => setSelectedPatient(null)}
        >
          <div
            style={{ background: '#FFF', borderRadius: 16, maxWidth: 600, width: '100%', padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{ background: '#0284C7', color: '#FFF', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800 }}>
                  ART CARD
                </span>
                <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.25rem', fontWeight: 800 }}>{selectedPatient.fullName}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{selectedPatient.artNumber} · Hosp No: {selectedPatient.hospitalNumber}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 800 }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.82rem', marginBottom: 16 }}>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Enrolment Date</span>
                <strong>{selectedPatient.dateEnrolled}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>ART Initiation Date</span>
                <strong>{selectedPatient.dateArtInitiation}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Current Regimen</span>
                <strong>{selectedPatient.currentRegimen}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Latest Viral Load</span>
                <strong style={{ color: selectedPatient.viralSuppressed ? '#16A34A' : '#DC2626' }}>
                  {selectedPatient.lastViralLoadCopies} cp/mL ({selectedPatient.viralSuppressed ? 'Suppressed' : 'Unsuppressed'})
                </strong>
              </div>
            </div>

            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: 12, borderRadius: 8, fontSize: '0.8rem', color: '#0369A1' }}>
              <strong>AI Adherence Prediction:</strong> Client is classified as <strong>{selectedPatient.iitRiskScore}</strong> with {Math.round(selectedPatient.iitRiskProbability * 100)}% risk probability. Next appointment is {selectedPatient.nextPickupDate}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LamisNdrSuite;
