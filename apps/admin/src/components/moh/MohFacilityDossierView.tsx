'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BedDouble,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FlaskConical,
  HeartPulse,
  Lock,
  Pill,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  fetchMohFacilityDossier,
  sendMohFacilityNotice,
} from '../../lib/mohRealtime';
import type {
  MohAuditRecord,
  MohDirective,
  MohFacilityDossier,
  MohFacilityTelemetry,
  MohTransferRecord,
} from '../../lib/mohTypes';

interface MohFacilityDossierViewProps {
  facilityId: string;
  officerName: string;
  onUpdateOversight: (payload: {
    facilityId: string;
    emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
    accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
    notes: string;
  }) => Promise<void>;
  onScheduleAudit: (facilityId: string) => void;
  onUpdateAuditStatus: (
    id: string,
    patch: Partial<Pick<MohAuditRecord, 'status' | 'findingsCount' | 'criticalViolations' | 'notes'>>
  ) => Promise<void>;
  onOpenTransferModal: () => void;
  onDecideTransfer: (id: string, status: MohTransferRecord['status']) => Promise<void>;
  onUpdateDirectiveStatus: (id: string, status: MohDirective['status']) => Promise<void>;
  onNotify?: (text: string, type?: 'success' | 'error') => void;
}

type DossierTab = 'overview' | 'beds' | 'clinical' | 'workforce' | 'finance' | 'compliance';

function fmtNaira(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function fmtExactNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function fmtDt(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const MohFacilityDossierView: React.FC<MohFacilityDossierViewProps> = ({
  facilityId,
  officerName,
  onUpdateOversight,
  onScheduleAudit,
  onUpdateAuditStatus,
  onOpenTransferModal,
  onDecideTransfer,
  onUpdateDirectiveStatus,
  onNotify,
}) => {
  const [dossier, setDossier] = useState<MohFacilityDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DossierTab>('overview');

  const [bedSearch, setBedSearch] = useState('');
  const [bedStatusFilter, setBedStatusFilter] = useState('all');
  const [staffSearch, setStaffSearch] = useState('');

  const [emergencyStatus, setEmergencyStatus] =
    useState<MohFacilityTelemetry['emergencyStatus']>('normal');
  const [accreditationStatus, setAccreditationStatus] =
    useState<MohFacilityTelemetry['accreditationStatus']>('pending');
  const [notes, setNotes] = useState('');
  const [savingOversight, setSavingOversight] = useState(false);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeLevel, setNoticeLevel] = useState<'info' | 'warning' | 'alert'>('warning');
  const [noticeAttempted, setNoticeAttempted] = useState(false);
  const [sendingNotice, setSendingNotice] = useState(false);

  const loadDossier = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const res = await fetchMohFacilityDossier(facilityId);
      if (!res.ok || !res.dossier) {
        setError(res.error || 'Could not load facility dossier.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setDossier(res.dossier);
      setEmergencyStatus(res.dossier.facility.emergencyStatus);
      setAccreditationStatus(res.dossier.facility.accreditationStatus);
      setNotes(res.dossier.facility.notes || '');
      setError(null);
      setLoading(false);
      setRefreshing(false);
    },
    [facilityId]
  );

  useEffect(() => {
    void loadDossier(false);
  }, [loadDossier]);

  const filteredBeds = useMemo(() => {
    if (!dossier) return [];
    return dossier.beds.bedList.filter((b) => {
      if (bedStatusFilter !== 'all' && b.status.toLowerCase() !== bedStatusFilter) return false;
      if (bedSearch.trim()) {
        const q = bedSearch.toLowerCase();
        return (
          b.ward.toLowerCase().includes(q) ||
          b.bedNo.toLowerCase().includes(q) ||
          b.doctor.toLowerCase().includes(q) ||
          b.diagnosis.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dossier, bedSearch, bedStatusFilter]);

  const filteredStaff = useMemo(() => {
    if (!dossier) return [];
    if (!staffSearch.trim()) return dossier.workforce.staffRoster;
    const q = staffSearch.toLowerCase();
    return dossier.workforce.staffRoster.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.badgeId.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [dossier, staffSearch]);

  const exportDossierJson = () => {
    if (!dossier) return;
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dossier.facility.facilityId.toLowerCase()}-360-dossier-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFinanceCsv = () => {
    if (!dossier) return;
    const header = ['Invoice ID', 'Department/Source', 'Description', 'Amount (NGN)', 'Status', 'Channel', 'Timestamp'];
    const rows = dossier.finance.recentInvoices.map((inv) => [
      inv.id,
      inv.source,
      inv.description,
      String(Math.round(inv.amountNgn)),
      inv.status,
      inv.paidVia,
      inv.createdAt,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dossier.facility.facilityId.toLowerCase()}-finance-ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveOversight = async () => {
    if (!dossier) return;
    setSavingOversight(true);
    try {
      await onUpdateOversight({
        facilityId: dossier.facility.facilityId,
        emergencyStatus,
        accreditationStatus,
        notes,
      });
      await loadDossier(true);
    } finally {
      setSavingOversight(false);
    }
  };

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeAttempted(true);
    if (!dossier || !noticeTitle.trim() || !noticeBody.trim()) return;
    setSendingNotice(true);
    try {
      const res = await sendMohFacilityNotice({
        facilityId: dossier.facility.facilityId,
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
        level: noticeLevel,
        sentBy: officerName,
      });
      if (!res.ok) {
        onNotify?.(res.error || 'Could not dispatch notice.', 'error');
        return;
      }
      onNotify?.(`Direct Ministerial Notice delivered to ${dossier.facility.facilityName}.`, 'success');
      setNoticeTitle('');
      setNoticeBody('');
      setNoticeAttempted(false);
      await loadDossier(true);
    } finally {
      setSendingNotice(false);
    }
  };

  if (loading && !dossier) {
    return (
      <div className="moh-panel" style={{ padding: 36, textAlign: 'center', color: '#64748B' }}>
        Compiling complete 360° command dossier for {facilityId}…
      </div>
    );
  }

  if (error && !dossier) {
    return (
      <div className="moh-panel" style={{ padding: 32, textAlign: 'center' }}>
        <AlertTriangle size={28} color="#DC2626" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
          Unable to load facility dossier ({facilityId})
        </div>
        <div style={{ fontSize: '0.84rem', color: '#64748B', marginBottom: 14 }}>{error}</div>
        <button type="button" className="moh-btn-primary" onClick={() => void loadDossier(false)}>
          Retry Loading
        </button>
      </div>
    );
  }

  if (!dossier) return null;

  const { facility, governance, security, demographics, beds, clinical, workforce, finance, compliance } =
    dossier;
  const bedPct = beds.total > 0 ? Math.round((beds.occupied / beds.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Executive Facility Banner */}
      <div className="moh-panel">
        <div className="moh-view-header">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span className="moh-pill slate" style={{ fontFamily: 'monospace' }}>{facility.facilityId}</span>
                <span className={`moh-pill ${facility.enrollmentStatus === 'active' ? 'emerald' : 'slate'}`}>
                  {facility.enrollmentStatus === 'active' ? 'Connected Live' : 'Pending Enrollment'}
                </span>
                <span
                  className={`moh-pill ${
                    facility.emergencyStatus === 'normal'
                      ? 'emerald'
                      : facility.emergencyStatus === 'surge_code_yellow'
                      ? 'amber'
                      : 'danger'
                  }`}
                >
                  {facility.emergencyStatus.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="moh-pill slate">Compliance {facility.complianceScore}%</span>
              </div>
              <h1 className="moh-view-title" style={{ fontSize: '1.35rem' }}>{facility.facilityName}</h1>
              <p className="moh-view-sub">
                {facility.district} Senatorial District · {facility.lga} LGA · {governance.supervisoryBoard} · Federal HFR:{' '}
                <strong style={{ fontFamily: 'monospace', color: '#0F172A' }}>
                  {governance.hfrCode || 'Pending Submission'}
                </strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="moh-btn-outline"
              onClick={() => void loadDossier(true)}
              disabled={refreshing}
            >
              <RefreshCw size={14} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <button type="button" className="moh-btn-outline" onClick={() => window.print()}>
              <Printer size={14} />
              <span>Print Sheet</span>
            </button>
            <button type="button" className="moh-btn-outline" onClick={exportDossierJson}>
              <Download size={14} />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              className="moh-btn-primary"
              onClick={() => onScheduleAudit(facility.facilityId)}
            >
              <ClipboardCheck size={14} />
              <span>Schedule Inspection</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation across all domains */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
          {(
            [
              ['overview', 'Governance, Security & Demographics'],
              ['beds', `Wards & Beds (${beds.occupied}/${beds.total})`],
              ['clinical', `Clinical, Labs, Pharm & Vitals`],
              ['workforce', `Workforce & Transfers (${workforce.total})`],
              ['finance', `Finance & Treasury (${fmtNaira(finance.totalCollectedNgn)})`],
              ['compliance', `Directives, Audits & Logs`],
            ] as [DossierTab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={tab === k ? { padding: '8px 13px', fontSize: '0.79rem' } : { fontSize: '0.79rem' }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: GOVERNANCE, SECURITY & DEMOGRAPHICS */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-kpi-grid">
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Registered Patients</span>
              <span className="moh-kpi-val">{demographics.totalRegistered.toLocaleString('en-NG')}</span>
              <span className="moh-kpi-sub">{demographics.newRegistrations30d} new in last 30 days</span>
            </div>
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Bed Utilization</span>
              <span className="moh-kpi-val">{bedPct}%</span>
              <span className="moh-kpi-sub">{beds.occupied} occupied of {beds.total} total beds</span>
            </div>
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Face ID 2FA Adoption</span>
              <span className="moh-kpi-val">{security.faceIdCompliancePct}%</span>
              <span className="moh-kpi-sub">{security.faceIdEnrolledCount}/{security.totalStaff} staff enrolled</span>
            </div>
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Collections YTD</span>
              <span className="moh-kpi-val">{fmtNaira(finance.totalCollectedNgn)}</span>
              <span className="moh-kpi-sub">{fmtNaira(finance.totalPendingNgn)} pending settlement</span>
            </div>
          </div>

          <div className="moh-two-col">
            {/* Statutory Governance */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <ShieldCheck size={17} color="#065F46" />
                  <span>Statutory Governance &amp; Leadership</span>
                </h2>
                <span className="moh-pill emerald">{governance.ownership.replace(/_/g, ' ')}</span>
              </div>
              <div className="moh-two-col" style={{ gap: 12, fontSize: '0.81rem' }}>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Chief Medical Director (CMD)</div>
                  <strong>{governance.medicalDirector || 'Unassigned'}</strong>
                  {governance.cmdApprovalRef && (
                    <div style={{ fontSize: '0.71rem', color: '#64748B' }}>Ref: {governance.cmdApprovalRef}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>EMR Focal Officer</div>
                  <strong>{governance.emrFocalPersonName || 'Not specified'}</strong>
                  {governance.emrFocalPersonTitle && (
                    <div style={{ fontSize: '0.71rem', color: '#64748B' }}>{governance.emrFocalPersonTitle}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Board Authorization Circular</div>
                  <strong>{governance.boardAuthCircularRef || 'Pending'}</strong>
                  {governance.boardAuthDate && (
                    <div style={{ fontSize: '0.71rem', color: '#64748B' }}>Issued: {governance.boardAuthDate}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>State / Facility License</div>
                  <strong>{governance.licenseNo || governance.registrationNo || 'Pending'}</strong>
                  {governance.licenseExpiry && (
                    <div style={{ fontSize: '0.71rem', color: '#64748B' }}>Expires: {governance.licenseExpiry}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Location &amp; Ward</div>
                  <strong>{governance.streetLocation || facility.location}</strong>
                  <div style={{ fontSize: '0.71rem', color: '#64748B' }}>
                    {governance.ward ? `${governance.ward} · ` : ''}
                    {governance.gpsLatitude && governance.gpsLongitude
                      ? `GPS ${governance.gpsLatitude}, ${governance.gpsLongitude}`
                      : 'GPS coordinates pending'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Operating Hours &amp; Triage</div>
                  <strong>{governance.workingHours}</strong>
                  <div style={{ fontSize: '0.71rem', color: '#64748B' }}>
                    Protocol: {governance.triageProtocol} · Emergency 24/7: {governance.emergency24x7 ? 'Yes' : 'No'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Official Facility Desk</div>
                  <strong>{governance.facilityLine || governance.officialDeskContact || 'Unregistered'}</strong>
                  {governance.emergencyLine && (
                    <div style={{ fontSize: '0.71rem', color: '#64748B' }}>ER Line: {governance.emergencyLine}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Insurance &amp; AkwaRemit</div>
                  <strong>
                    {[
                      governance.acceptsAkshia ? `AKSHIA (${governance.akshiaProviderId || 'Active'})` : '',
                      governance.participatesInBhcpf ? `BHCPF (${governance.bhcpfCode || 'Active'})` : '',
                      governance.acceptsNhis ? `NHIA (${governance.nhiaProviderCode || 'Active'})` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No scheme codes recorded'}
                  </strong>
                  <div style={{ fontSize: '0.71rem', color: '#64748B' }}>
                    AkwaRemit: {governance.akwaremitEnabled ? `Head ${governance.akwaremitRevenueHead || 'Enabled'}` : 'Disabled'} · POS Terminals: {governance.posTerminalsActive}/{governance.posTerminalsTotal}
                  </div>
                </div>
              </div>
            </div>

            {/* Security Posture + Ministerial Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="moh-panel">
                <div className="moh-panel-head">
                  <h2 className="moh-panel-title">
                    <Lock size={17} color="#065F46" />
                    <span>Security, Access &amp; Compliance Posture</span>
                  </h2>
                  <span className={`moh-pill ${security.mfaEnforced ? 'emerald' : 'amber'}`}>
                    {security.mfaEnforced ? '2FA Enforced' : '2FA Optional'}
                  </span>
                </div>
                <div className="moh-three-col" style={{ gap: 10, fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ color: '#64748B', fontSize: '0.71rem' }}>Staff Accounts</div>
                    <strong>{security.activeStaff} active / {security.suspendedStaff} suspended</strong>
                  </div>
                  <div>
                    <div style={{ color: '#64748B', fontSize: '0.71rem' }}>Pre-Issuance Face ID</div>
                    <strong>{governance.requireFaceIdOnStaffEnrol ? 'Mandatory Gate' : 'Optional'}</strong>
                  </div>
                  <div>
                    <div style={{ color: '#64748B', fontSize: '0.71rem' }}>Custom Roles / Drafts</div>
                    <strong>{security.customRolesCount} roles · {security.activeFormDraftsCount} drafts</strong>
                  </div>
                </div>
              </div>

              <div className="moh-panel">
                <div className="moh-panel-head">
                  <h2 className="moh-panel-title">
                    <AlertTriangle size={16} color="#D97706" />
                    <span>Ministerial Oversight Status</span>
                  </h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="moh-two-col" style={{ gap: 10 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      Emergency Status
                      <select
                        className="moh-input"
                        style={{ marginTop: 4 }}
                        value={emergencyStatus}
                        onChange={(e) => setEmergencyStatus(e.target.value as MohFacilityTelemetry['emergencyStatus'])}
                      >
                        <option value="normal">Normal Operations</option>
                        <option value="surge_code_yellow">Surge Advisory (Code Yellow)</option>
                        <option value="surge_code_red">Critical Diversion (Code Red)</option>
                        <option value="critical">System Critical</option>
                      </select>
                    </label>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      Accreditation Status
                      <select
                        className="moh-input"
                        style={{ marginTop: 4 }}
                        value={accreditationStatus}
                        onChange={(e) =>
                          setAccreditationStatus(e.target.value as MohFacilityTelemetry['accreditationStatus'])
                        }
                      >
                        <option value="accredited">Accredited</option>
                        <option value="provisional">Provisional</option>
                        <option value="pending">Pending Verification</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </label>
                  </div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    Inspector Note
                    <textarea
                      rows={2}
                      className="moh-textarea"
                      style={{ marginTop: 4 }}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Record official MOH oversight remarks..."
                    />
                  </label>
                  <button
                    type="button"
                    className="moh-btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={savingOversight}
                    onClick={() => void handleSaveOversight()}
                  >
                    {savingOversight ? 'Saving Status…' : 'Save Oversight Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Patient Population Demographics (Safe Harbor Aggregate Counts Only) */}
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <Users size={17} color="#065F46" />
                <span>De-identified Patient Population Demographics</span>
              </h2>
              <span className="moh-pill emerald">Aggregate Safe Harbor Counts Only</span>
            </div>
            <div className="moh-two-col">
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B', marginBottom: 8 }}>BY SEX</div>
                {demographics.bySex.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: '#64748B' }}>No registered patient demographics yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {demographics.bySex.map((s) => (
                      <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '6px 10px', background: '#F8FAFC', borderRadius: 8 }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <strong>{s.count.toLocaleString('en-NG')}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B', marginBottom: 8 }}>BY AGE COHORT</div>
                {demographics.byAgeBand.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: '#64748B' }}>No registered age-cohort data yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {demographics.byAgeBand.map((a) => (
                      <div key={a.band} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '6px 10px', background: '#F8FAFC', borderRadius: 8 }}>
                        <span style={{ fontWeight: 600 }}>{a.band}</span>
                        <strong>{a.count.toLocaleString('en-NG')}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WARDS & BEDS */}
      {tab === 'beds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-two-col">
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <BedDouble size={17} color="#065F46" />
                  <span>Ward-by-Ward Census ({beds.wards.length})</span>
                </h2>
                <span className="moh-pill slate">
                  ICU {beds.icuOccupied}/{beds.icuTotal}
                </span>
              </div>
              {beds.wards.length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: '#64748B' }}>No inpatient wards initialized yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {beds.wards.map((w) => {
                    const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                    return (
                      <div key={w.ward}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                          <strong>{w.ward}</strong>
                          <span style={{ color: '#64748B' }}>
                            {w.occupied}/{w.total} occupied · {w.available} free ({pct}%)
                          </span>
                        </div>
                        <div className="moh-meter">
                          <div className={`moh-meter-fill ${pct >= 90 ? 'danger' : pct >= 75 ? 'amber' : ''}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <HeartPulse size={17} color="#065F46" />
                  <span>Top Active Inpatient Diagnoses</span>
                </h2>
              </div>
              {beds.topDiagnoses.length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: '#64748B' }}>No active inpatient diagnoses recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {beds.topDiagnoses.map((d) => (
                    <div key={d.diagnosis} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '7px 10px', background: '#F8FAFC', borderRadius: 8 }}>
                      <span>{d.diagnosis}</span>
                      <strong>{d.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">Live Bed-by-Bed Board ({filteredBeds.length})</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="moh-input"
                    style={{ paddingLeft: 32, height: 34 }}
                    value={bedSearch}
                    onChange={(e) => setBedSearch(e.target.value)}
                    placeholder="Filter ward, doctor, dx..."
                  />
                </div>
                <select className="moh-select" value={bedStatusFilter} onChange={(e) => setBedStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="occupied">Occupied</option>
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Ward</th>
                    <th>Bed #</th>
                    <th>Status</th>
                    <th>Attending Physician</th>
                    <th>Sanitized Clinical Diagnosis</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBeds.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 700 }}>{b.ward}</td>
                      <td style={{ fontFamily: 'monospace' }}>{b.bedNo}</td>
                      <td>
                        <span className={`moh-pill ${b.status === 'occupied' ? 'amber' : b.status === 'available' ? 'emerald' : 'slate'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>{b.doctor}</td>
                      <td>{b.diagnosis || '—'}</td>
                      <td style={{ fontSize: '0.76rem', color: '#64748B' }}>{fmtDt(b.updatedAt)}</td>
                    </tr>
                  ))}
                  {filteredBeds.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                        No inpatient bed records found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLINICAL, LABS, PHARMACY, VITALS & SPECIALTY */}
      {tab === 'clinical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-kpi-grid">
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">OPD Encounters</span>
              <span className="moh-kpi-val">{clinical.opd.total}</span>
              <span className="moh-kpi-sub">
                {clinical.opd.waiting} waiting · {clinical.opd.withProvider} with doctor · {clinical.opd.completed} done
              </span>
            </div>
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Clinical Orders</span>
              <span className="moh-kpi-val">{clinical.orders.total}</span>
              <span className="moh-kpi-sub">{clinical.orders.pending} pending · {clinical.orders.statCount} STAT priority</span>
            </div>
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Lab Critical Alerts</span>
              <span className="moh-kpi-val">{clinical.laboratory.criticalFlags}</span>
              <span className="moh-kpi-sub">
                {clinical.laboratory.totalResults} total · {clinical.laboratory.pendingResults} pending
              </span>
            </div>
            <div className="moh-kpi-card">
              <span className="moh-kpi-label">Prescriptions</span>
              <span className="moh-kpi-val">{clinical.pharmacy.totalPrescriptions}</span>
              <span className="moh-kpi-sub">
                {clinical.pharmacy.dispensedPrescriptions} dispensed · {clinical.pharmacy.pendingPrescriptions} pending
              </span>
            </div>
          </div>

          <div className="moh-two-col">
            {/* Laboratory Feed */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <FlaskConical size={17} color="#065F46" />
                  <span>Laboratory Results ({clinical.laboratory.recentResults.length})</span>
                </h2>
              </div>
              <div className="moh-table-wrap">
                <table className="moh-table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Flag</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinical.laboratory.recentResults.slice(0, 15).map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.testName}</td>
                        <td>
                          <span className={`moh-pill ${l.flag === 'CRITICAL' ? 'danger' : l.flag === 'NORMAL' ? 'emerald' : 'amber'}`}>
                            {l.flag}
                          </span>
                        </td>
                        <td>{l.status}</td>
                        <td style={{ fontSize: '0.74rem', color: '#64748B' }}>{fmtDt(l.createdAt)}</td>
                      </tr>
                    ))}
                    {clinical.laboratory.recentResults.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748B', padding: 18 }}>No lab results recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pharmacy & Top Drugs */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <Pill size={17} color="#065F46" />
                  <span>Pharmacy Utilization &amp; Top Medications</span>
                </h2>
              </div>
              <div className="moh-table-wrap">
                <table className="moh-table">
                  <thead>
                    <tr>
                      <th>Medication</th>
                      <th>Rx Count</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinical.pharmacy.topDrugs.map((d) => (
                      <tr key={d.drugName}>
                        <td style={{ fontWeight: 600 }}>{d.drugName}</td>
                        <td><strong>{d.count}</strong></td>
                        <td>{d.pending}</td>
                      </tr>
                    ))}
                    {clinical.pharmacy.topDrugs.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748B', padding: 18 }}>No prescriptions recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="moh-two-col">
            {/* Critical Vitals Feed */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <Activity size={17} color="#065F46" />
                  <span>Vitals &amp; Early Warning Feed ({clinical.vitals.totalRecorded})</span>
                </h2>
                <span className={`moh-pill ${clinical.vitals.criticalUrgencyCount > 0 ? 'danger' : 'emerald'}`}>
                  {clinical.vitals.criticalUrgencyCount} Critical
                </span>
              </div>
              <div className="moh-table-wrap">
                <table className="moh-table">
                  <thead>
                    <tr>
                      <th>Urgency</th>
                      <th>BP / Pulse</th>
                      <th>Temp / SpO2</th>
                      <th>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinical.vitals.recentAlerts.slice(0, 12).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <span className={`moh-pill ${v.urgency === 'critical' || v.urgency === 'emergency' ? 'danger' : v.urgency === 'urgent' ? 'amber' : 'slate'}`}>
                            {v.urgency}
                          </span>
                        </td>
                        <td>{v.bp || '—'} · {v.pulse ?? '—'} bpm</td>
                        <td>{v.temp ?? '—'}°C · {v.spo2 ?? '—'}%</td>
                        <td>{v.recordedBy}</td>
                      </tr>
                    ))}
                    {clinical.vitals.recentAlerts.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748B', padding: 18 }}>No vitals logs recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Specialty Modules & Cloud Sync Domains */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">Specialty Suites &amp; Synced Modules</h2>
              </div>
              <div className="moh-two-col" style={{ gap: 8, marginBottom: 12 }}>
                <div style={{ padding: 10, borderRadius: 8, background: '#F8FAFC', fontSize: '0.8rem' }}>
                  <div style={{ color: '#64748B', fontSize: '0.71rem' }}>Surgical Theatre Cases</div>
                  <strong>{clinical.specialtyOperations.theatreCasesCount}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: '#F8FAFC', fontSize: '0.8rem' }}>
                  <div style={{ color: '#64748B', fontSize: '0.71rem' }}>ANC Maternity Plans</div>
                  <strong>{clinical.specialtyOperations.ancPlansCount}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: '#F8FAFC', fontSize: '0.8rem' }}>
                  <div style={{ color: '#64748B', fontSize: '0.71rem' }}>ICU Step-Down Cases</div>
                  <strong>{clinical.specialtyOperations.icuStepDownCount}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: '#F8FAFC', fontSize: '0.8rem' }}>
                  <div style={{ color: '#64748B', fontSize: '0.71rem' }}>Ward Med Requisitions</div>
                  <strong>{clinical.specialtyOperations.wardMedRequestsCount}</strong>
                </div>
              </div>
              {clinical.specialtyOperations.syncedDomains.length > 0 && (
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <strong>Active Synced Keystores ({clinical.specialtyOperations.syncedDomains.length}):</strong>{' '}
                  {clinical.specialtyOperations.syncedDomains.map((d) => `${d.label} (${d.itemCount})`).join(' · ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WORKFORCE & TRANSFERS */}
      {tab === 'workforce' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <Users size={17} color="#065F46" />
                <span>Complete Hospital Staff Roster ({filteredStaff.length})</span>
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 240 }}>
                  <Search size={14} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="moh-input"
                    style={{ paddingLeft: 32, height: 34 }}
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="Search staff, badge, cadre..."
                  />
                </div>
                <button type="button" className="moh-btn-primary" onClick={onOpenTransferModal}>
                  <ArrowRightLeft size={14} />
                  <span>Order Staff Transfer</span>
                </button>
              </div>
            </div>

            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Badge ID</th>
                    <th>Full Name</th>
                    <th>Role / Cadre</th>
                    <th>Department</th>
                    <th>Face ID 2FA</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => (
                    <tr key={s.badgeId}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.badgeId}</td>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>{s.fullName}</td>
                      <td>{s.role}</td>
                      <td>{s.department}</td>
                      <td>
                        <span className={`moh-pill ${s.faceIdEnrolled ? 'emerald' : 'slate'}`}>
                          {s.faceIdEnrolled ? 'Enrolled' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className={`moh-pill ${s.status === 'active' ? 'emerald' : 'danger'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748B', padding: 24 }}>No staff records match filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {workforce.transfers.length > 0 && (
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">Facility Staff Transfers ({workforce.transfers.length})</h2>
              </div>
              <div className="moh-table-wrap">
                <table className="moh-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Route</th>
                      <th>Urgency</th>
                      <th>Status</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workforce.transfers.map((tr) => (
                      <tr key={tr.id}>
                        <td>
                          <strong>{tr.staffName}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{tr.cadre}</div>
                        </td>
                        <td>{tr.fromFacilityName} → {tr.toFacilityName}</td>
                        <td>{tr.urgency.replace(/_/g, ' ')}</td>
                        <td>
                          <span className={`moh-pill ${tr.status === 'approved' || tr.status === 'completed' ? 'emerald' : tr.status === 'declined' ? 'danger' : 'amber'}`}>
                            {tr.status}
                          </span>
                        </td>
                        <td>
                          {tr.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', fontSize: '0.74rem' }} onClick={() => void onDecideTransfer(tr.id, 'approved')}>
                                Approve
                              </button>
                              <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#DC2626' }} onClick={() => void onDecideTransfer(tr.id, 'declined')}>
                                Decline
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FINANCE & TREASURY */}
      {tab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <Wallet size={17} color="#065F46" />
                <span>Hospital Revenue by Channel &amp; Department</span>
              </h2>
              <button type="button" className="moh-btn-primary" onClick={exportFinanceCsv}>
                <Download size={14} />
                <span>Export Hospital CSV</span>
              </button>
            </div>
            <div className="moh-kpi-grid" style={{ marginBottom: 14 }}>
              <div className="moh-kpi-card">
                <span className="moh-kpi-label">AkwaRemit TSA</span>
                <span className="moh-kpi-val" style={{ fontSize: '1.25rem' }}>{fmtNaira(finance.byChannel.akwaremit)}</span>
              </div>
              <div className="moh-kpi-card">
                <span className="moh-kpi-label">Paystack / Card / POS</span>
                <span className="moh-kpi-val" style={{ fontSize: '1.25rem' }}>{fmtNaira(finance.byChannel.paystack)}</span>
              </div>
              <div className="moh-kpi-card">
                <span className="moh-kpi-label">AKSHIA / NHIA / HMO</span>
                <span className="moh-kpi-val" style={{ fontSize: '1.25rem' }}>{fmtNaira(finance.byChannel.hmo)}</span>
              </div>
              <div className="moh-kpi-card">
                <span className="moh-kpi-label">Cash &amp; Pending</span>
                <span className="moh-kpi-val" style={{ fontSize: '1.25rem' }}>{fmtNaira(finance.byChannel.cash)}</span>
                <span className="moh-kpi-sub">{fmtExactNaira(finance.totalPendingNgn)} unsettled</span>
              </div>
            </div>

            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Receipt ID</th>
                    <th>Department / Source</th>
                    <th>Description (Sanitized)</th>
                    <th>Amount</th>
                    <th>Channel</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.recentInvoices.slice(0, 25).map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{inv.id}</td>
                      <td>{inv.source}</td>
                      <td>{inv.description}</td>
                      <td style={{ fontWeight: 700 }}>{fmtExactNaira(inv.amountNgn)}</td>
                      <td>{inv.paidVia}</td>
                      <td>
                        <span className={`moh-pill ${inv.status === 'paid' || inv.status === 'settled' ? 'emerald' : 'amber'}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {finance.recentInvoices.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748B', padding: 22 }}>No hospital billing invoices posted yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DIRECTIVES, AUDITS, NOTIFICATIONS & AUDIT LEDGER */}
      {tab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Direct Notice Form */}
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <Send size={17} color="#065F46" />
                <span>Send Direct Ministerial Notice to {facility.facilityName}</span>
              </h2>
            </div>
            <form onSubmit={handleSendNotice} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.77rem', fontWeight: 700 }}>
                  Notice Subject *
                  <input
                    className={`moh-input ${noticeAttempted && !noticeTitle.trim() ? 'moh-input-error' : ''}`}
                    style={{ marginTop: 4 }}
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="e.g. Immediate ICU Oxygen Audit Required"
                  />
                </label>
                <label style={{ fontSize: '0.77rem', fontWeight: 700 }}>
                  Priority Level
                  <select className="moh-input" style={{ marginTop: 4 }} value={noticeLevel} onChange={(e) => setNoticeLevel(e.target.value as 'info' | 'warning' | 'alert')}>
                    <option value="info">Official Notice</option>
                    <option value="warning">Compliance Warning</option>
                    <option value="alert">Critical Alert</option>
                  </select>
                </label>
              </div>
              <label style={{ fontSize: '0.77rem', fontWeight: 700 }}>
                Instruction Message *
                <textarea
                  rows={2}
                  className={`moh-textarea ${noticeAttempted && !noticeBody.trim() ? 'moh-input-error' : ''}`}
                  style={{ marginTop: 4 }}
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  placeholder="Delivers directly to the Hospital Admin inbox inside MedCore OS..."
                />
              </label>
              <div>
                <button type="submit" className="moh-btn-primary" disabled={sendingNotice}>
                  <Send size={14} />
                  <span>{sendingNotice ? 'Delivering Notice…' : 'Send Direct Notice to Hospital Admin'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="moh-two-col">
            {/* Audits + Directives Ack */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">
                  <ClipboardCheck size={17} color="#065F46" />
                  <span>Inspections ({compliance.audits.length}) &amp; Directives</span>
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {compliance.audits.map((aud) => (
                  <div key={aud.id} style={{ padding: 11, border: '1px solid #E2E8F0', borderRadius: 10, fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong>{aud.auditDate} · {aud.auditorName}</strong>
                      <span className={`moh-pill ${aud.status === 'passed' ? 'emerald' : aud.status === 'remediation_required' ? 'danger' : 'amber'}`}>
                        {aud.status}
                      </span>
                    </div>
                    <div style={{ color: '#64748B', marginBottom: 6 }}>{aud.notes || aud.category}</div>
                    {aud.status !== 'passed' && (
                      <button type="button" className="moh-btn-outline" style={{ padding: '4px 9px', fontSize: '0.74rem' }} onClick={() => void onUpdateAuditStatus(aud.id, { status: 'passed' }).then(() => loadDossier(true))}>
                        <CheckCircle2 size={12} /> Mark Passed
                      </button>
                    )}
                  </div>
                ))}
                {compliance.directives.slice(0, 6).map((dir) => (
                  <div key={dir.id} style={{ padding: 10, border: '1px solid #E2E8F0', borderRadius: 10, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{dir.code}: {dir.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        Acknowledged: {dir.acknowledged ? 'Yes' : 'Pending'}
                      </div>
                    </div>
                    {dir.status === 'active' && (
                      <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', fontSize: '0.73rem' }} onClick={() => void onUpdateDirectiveStatus(dir.id, 'completed').then(() => loadDossier(true))}>
                        Complete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Facility Notifications + Audit Ledger */}
            <div className="moh-panel">
              <div className="moh-panel-head">
                <h2 className="moh-panel-title">Hospital Alerts &amp; SHA-256 Ledger ({compliance.auditLedger.length})</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                {compliance.notifications.slice(0, 10).map((n) => (
                  <div key={n.id} style={{ padding: 10, background: '#F8FAFC', borderRadius: 8, fontSize: '0.79rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{n.title}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{fmtDt(n.createdAt)}</span>
                    </div>
                    <div style={{ color: '#475569', marginTop: 2 }}>{n.body}</div>
                  </div>
                ))}
                {compliance.auditLedger.slice(0, 15).map((ev) => (
                  <div key={ev.id} style={{ padding: 9, borderBottom: '1px solid #F1F5F9', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{ev.action}</strong>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748B' }}>
                        {ev.rowHash ? `${ev.rowHash.slice(0, 10)}…` : ''}
                      </span>
                    </div>
                    <div style={{ color: '#475569' }}>{ev.actor} · {ev.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
