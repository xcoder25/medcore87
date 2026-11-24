'use client';

import React, { useMemo, useState } from 'react';
import { Sparkles, Send, ClipboardCheck, Building2, Activity, ArrowRight } from 'lucide-react';
import type { MohLiveSnapshot, MohTabKey } from '../../lib/mohTypes';

interface MohIntelligenceViewProps {
  snapshot: MohLiveSnapshot;
  onNavigateTab: (tab: MohTabKey) => void;
  onBroadcastDirective: () => void;
  onScheduleAudit: () => void;
}

interface IntelligenceReport {
  id: string;
  question: string;
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  bullets: string[];
  generatedAt: string;
}

function fmtNaira(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function buildReport(query: string, snapshot: MohLiveSnapshot): IntelligenceReport {
  const q = query.toLowerCase();
  const { summary, facilities, regionalRollup, finance, transfers, audits, surveillance, supplyChain, enforcement, idsr, grievances } = snapshot;

  const topOccupied = [...facilities]
    .filter((f) => f.totalBeds > 0)
    .sort((a, b) => b.occupiedBeds / b.totalBeds - a.occupiedBeds / a.totalBeds)
    .slice(0, 5);

  const pendingTransfers = transfers.filter((t) => t.status === 'pending');
  const openRemediations = audits.filter((a) => a.status === 'remediation_required');
  const surgeFacilities = facilities.filter((f) => f.emergencyStatus !== 'normal');

  if (q.includes('supply') || q.includes('vaccine') || q.includes('equipment') || q.includes('cold')) {
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'Supply Chain, Cold-Chain & Equipment Readiness Brief',
      summary: `Tracking ${supplyChain.items.length} inventory, biomedical equipment, and infrastructure records across Akwa Ibom. Currently flagging ${supplyChain.stockOutCount} stock-out(s), ${supplyChain.lowStockCount} low-stock commodities, and ${supplyChain.faultyEquipmentCount} faulty major assets.`,
      metrics: [
        { label: 'Critical Stock-Outs', value: String(supplyChain.stockOutCount) },
        { label: 'Low Stock Items', value: String(supplyChain.lowStockCount) },
        { label: 'Faulty Equipment', value: String(supplyChain.faultyEquipmentCount) },
        { label: 'Active Renovations', value: String(supplyChain.activeRenovationsCount) },
      ],
      bullets:
        supplyChain.items.slice(0, 6).map(
          (i) =>
            `${i.facilityName}: ${i.itemName} (${i.functionalStatus.replace(/_/g, ' ').toUpperCase()}, ${i.quantity} ${i.unit}${i.coldChainTempC !== null ? `, ${i.coldChainTempC}°C` : ''})`
        ),
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (q.includes('quackery') || q.includes('license') || q.includes('enforcement') || q.includes('seal')) {
    const expiredCount = facilities.filter((f) => f.licenseAlert === 'expired' || f.licenseAlert === 'expiring_soon').length;
    const sealedCount = facilities.filter((f) => f.operationalStatus === 'sealed').length;
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'Licensing Renewal & Anti-Quackery Enforcement Brief',
      summary: `${sealedCount} facility site(s) are actively sealed, ${expiredCount} facilities require license renewal action, and ${enforcement.length} field enforcement docket(s) are on record.`,
      metrics: [
        { label: 'Sealed Facilities', value: String(sealedCount) },
        { label: 'License Alerts', value: String(expiredCount) },
        { label: 'Enforcement Actions', value: String(enforcement.length) },
        { label: 'Audit Remediations', value: String(openRemediations.length) },
      ],
      bullets:
        enforcement.slice(0, 5).map(
          (e) => `${e.facilityName} (${e.actionType.replace(/_/g, ' ').toUpperCase()}): ${e.reason}`
        ),
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (q.includes('grievance') || q.includes('citizen') || q.includes('rmnch') || q.includes('maternal')) {
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'Citizen Feedback, SLA & RMNCH Utilization Brief',
      summary: `Public accountability logs ${grievances.openCount} open and ${grievances.resolvedCount} resolved citizen reports (avg SLA ${grievances.avgTurnaroundHours}h). Service utilization reports ${idsr.ancVisitsTotal.toLocaleString()} ANC visits, ${idsr.skilledDeliveriesTotal.toLocaleString()} skilled deliveries, and ${idsr.maternalDeathsTotal} maternal / ${idsr.under5DeathsTotal} under-5 deaths.`,
      metrics: [
        { label: 'Open Grievances', value: String(grievances.openCount) },
        { label: 'Avg Turnaround SLA', value: `${grievances.avgTurnaroundHours}h` },
        { label: 'Skilled Deliveries', value: String(idsr.skilledDeliveriesTotal) },
        { label: 'Maternal / U-5 Deaths', value: `${idsr.maternalDeathsTotal} / ${idsr.under5DeathsTotal}` },
      ],
      bullets: [
        `Routine immunization doses delivered: ${idsr.immunizationDosesTotal.toLocaleString()}`,
        `Emergency obstetric/acute referrals: ${idsr.emergencyReferralsTotal.toLocaleString()}`,
        `Average citizen satisfaction score: ${grievances.avgRating || '—'} / 5`,
      ],
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (q.includes('bed') || q.includes('icu') || q.includes('surge') || q.includes('capacity')) {
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'Inpatient Capacity & ICU Utilization Briefing',
      summary: `Across ${summary.connectedFacilities} connected facilities, ${summary.occupiedBeds} of ${summary.totalBeds} general beds (${summary.bedOccupancyPct}%) and ${summary.icuBedsOccupied} of ${summary.icuBedsTotal} ICU beds (${summary.icuOccupancyPct}%) are currently occupied.`,
      metrics: [
        { label: 'Bed Occupancy', value: `${summary.bedOccupancyPct}%` },
        { label: 'ICU Occupancy', value: `${summary.icuOccupancyPct}%` },
        { label: 'Active OPD Visits', value: String(summary.activeOpdVisits) },
        { label: 'Surge Facilities', value: String(summary.surgeFacilitiesCount) },
      ],
      bullets:
        topOccupied.length > 0
          ? topOccupied.map(
              (f) =>
                `${f.facilityName} (${f.district}): ${f.occupiedBeds}/${f.totalBeds} beds occupied · ICU ${f.icuBedsOccupied}/${f.icuBedsTotal} · Status: ${f.emergencyStatus.replace(/_/g, ' ')}`
            )
          : ['No active inpatient bed census reported yet across the connected facilities.'],
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (q.includes('revenue') || q.includes('finance') || q.includes('akwaremit') || q.includes('money')) {
    const topRev = [...finance.byFacility].sort((a, b) => b.collectedNgn - a.collectedNgn).slice(0, 5);
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'State Health Treasury & Revenue Summary',
      summary: `Total verified public hospital collections stand at ${fmtNaira(finance.totalCollectedNgn)} across ${finance.paidReceiptsCount} paid receipts, with ${fmtNaira(finance.totalPendingNgn)} pending settlement and ${finance.openRequestsCount} open accounts requisitions.`,
      metrics: [
        { label: 'Collected YTD', value: fmtNaira(finance.totalCollectedNgn) },
        { label: 'AkwaRemit', value: fmtNaira(finance.byChannel.akwaremit) },
        { label: 'HMO / AKSHIA', value: fmtNaira(finance.byChannel.hmo) },
        { label: 'Pending Settlement', value: fmtNaira(finance.totalPendingNgn) },
      ],
      bullets:
        topRev.length > 0
          ? topRev.map(
              (r) =>
                `${r.facilityName} (${r.district}): Collected ${fmtNaira(r.collectedNgn)} · Pending ${fmtNaira(r.pendingNgn)} (${r.receiptsCount} receipts)`
            )
          : ['No hospital billing receipts have been synced yet in the current ledger window.'],
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (q.includes('pending') || q.includes('action') || q.includes('audit') || q.includes('transfer')) {
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'Ministerial Action & Exception Queue',
      summary: `There are ${pendingTransfers.length} pending staff transfer(s), ${openRemediations.length} facility audit remediation item(s), ${surgeFacilities.length} surge declaration(s), and ${summary.activeAlertsCount} active disease containment alert(s).`,
      metrics: [
        { label: 'Pending Transfers', value: String(pendingTransfers.length) },
        { label: 'Audit Remediations', value: String(openRemediations.length) },
        { label: 'Active Alerts', value: String(summary.activeAlertsCount) },
        { label: 'Active Directives', value: String(summary.activeDirectivesCount) },
      ],
      bullets: [
        ...pendingTransfers.map(
          (t) => `Transfer order pending: ${t.staffName} (${t.cadre}) — ${t.fromFacilityName} → ${t.toFacilityName}`
        ),
        ...openRemediations.map(
          (a) => `Audit remediation open: ${a.facilityName} (${a.findingsCount} finding(s), deadline ${a.resolutionDeadline || 'Pending'})`
        ),
        ...surgeFacilities.map(
          (f) => `Surge posture active: ${f.facilityName} (${f.emergencyStatus.replace(/_/g, ' ').toUpperCase()})`
        ),
        ...(pendingTransfers.length === 0 && openRemediations.length === 0 && surgeFacilities.length === 0
          ? ['All connected hospitals are operating within normal capacity and compliance thresholds.']
          : []),
      ],
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (q.includes('district') || q.includes('uyo') || q.includes('eket') || q.includes('ikot')) {
    return {
      id: `rep-${Date.now()}`,
      question: query,
      headline: 'Senatorial District Network Comparison',
      summary: `Live comparison across Akwa Ibom State's 3 Senatorial Districts covering ${summary.totalOfficialFacilities} official hospitals.`,
      metrics: regionalRollup.map((r) => ({
        label: `${r.district} District`,
        value: `${r.connectedFacilities}/${r.totalFacilities} live`,
      })),
      bullets: regionalRollup.map(
        (r) =>
          `${r.district}: ${r.connectedFacilities}/${r.totalFacilities} connected · ${r.occupiedBeds}/${r.totalBeds} beds occupied · ${r.staffCount} staff · Avg compliance ${r.avgComplianceScore}%`
      ),
      generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  // Default: Statewide Situation Report
  return {
    id: `rep-${Date.now()}`,
    question: query,
    headline: 'Akwa Ibom State Health System Situation Report',
    summary: `${summary.connectedFacilities} of ${summary.totalOfficialFacilities} official MOH facilities are actively enrolled. State hospitals currently record ${summary.activeStaffCount} active clinical staff, ${summary.registeredPatientsCount.toLocaleString('en-NG')} de-identified patient registrations, and ${surveillance.criticalLabAlerts + surveillance.criticalVitalsAlerts} critical clinical signals.`,
    metrics: [
      { label: 'Connected Hospitals', value: `${summary.connectedFacilities}/${summary.totalOfficialFacilities}` },
      { label: 'Bed Utilization', value: `${summary.bedOccupancyPct}%` },
      { label: 'Active Workforce', value: String(summary.activeStaffCount) },
      { label: 'Critical Signals', value: String(surveillance.criticalLabAlerts + surveillance.criticalVitalsAlerts) },
    ],
    bullets: [
      `Outpatient throughput: ${surveillance.activeOpdVisits} active OPD encounters (${surveillance.waitingOpd} waiting, ${surveillance.withProviderOpd} with provider).`,
      `Revenue collected YTD: ${fmtNaira(summary.totalRevenuePaidNgn)} across ${finance.paidReceiptsCount} settled receipts.`,
      `Governance: ${summary.activeDirectivesCount} active directive(s) and ${pendingTransfers.length} pending workforce transfer(s).`,
    ],
    generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

const PRESET_QUERIES = [
  'Statewide Situation Report',
  'Bed & ICU Surge',
  'Revenue Breakdown',
  'Pending Actions',
  'District Comparison',
  'Supply Chain & Equipment',
  'Licensing & Anti-Quackery',
  'Citizen Grievances & RMNCH',
];

export const MohIntelligenceView: React.FC<MohIntelligenceViewProps> = ({
  snapshot,
  onNavigateTab,
  onBroadcastDirective,
  onScheduleAudit,
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [activePrompt, setActivePrompt] = useState('Statewide Situation Report');
  const [attempted, setAttempted] = useState(false);

  const report = useMemo(() => buildReport(activePrompt, snapshot), [activePrompt, snapshot]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!queryInput.trim()) return;
    setActivePrompt(queryInput.trim());
    setAttempted(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Celestia MOH Executive Intelligence</h1>
          <p className="moh-view-sub">
            Structured ministerial briefings computed strictly from live, de-identified Akwa Ibom facility telemetry.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={onBroadcastDirective}>
          <Send size={15} />
          <span>Act via Directive</span>
        </button>
      </div>

      {/* Prompt Bar + Presets */}
      <div className="moh-panel">
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            className={`moh-input ${attempted && !queryInput.trim() ? 'moh-input-error' : ''}`}
            style={{ flex: 1, minWidth: 260 }}
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Ask about bed surge, ICU occupancy, AkwaRemit revenue, district gaps, or pending transfers..."
          />
          <button type="submit" className="moh-btn-primary">
            <Sparkles size={15} />
            <span>Generate Brief</span>
          </button>
        </form>
        {attempted && !queryInput.trim() && (
          <div style={{ color: '#DC2626', fontSize: '0.74rem', marginTop: 6 }}>
            Enter a ministerial question or select one of the executive brief presets below.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset}
              type="button"
              className="moh-btn-outline"
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                background: activePrompt === preset ? '#ECFDF5' : undefined,
                borderColor: activePrompt === preset ? '#A7F3D0' : undefined,
                color: activePrompt === preset ? '#065F46' : undefined,
              }}
              onClick={() => {
                setQueryInput(preset);
                setActivePrompt(preset);
                setAttempted(false);
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Structured Intelligence Card */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Sparkles size={17} color="#065F46" />
            <span>{report.headline}</span>
          </h2>
          <span className="moh-pill emerald">Grounded at {report.generatedAt} WAT</span>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '0.9rem', lineHeight: 1.55, color: '#1E293B' }}>
          {report.summary}
        </p>

        <div className="moh-kpi-grid" style={{ marginBottom: 16 }}>
          {report.metrics.map((m) => (
            <div key={m.label} className="moh-kpi-card" style={{ background: '#F8FAFC' }}>
              <span className="moh-kpi-label">{m.label}</span>
              <span className="moh-kpi-val" style={{ fontSize: '1.35rem' }}>{m.value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: 8 }}>
          Key Telemetry Findings
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155', fontSize: '0.84rem' }}>
          {report.bullets.map((b, idx) => (
            <li key={idx}>{b}</li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
          <button type="button" className="moh-btn-outline" onClick={() => onNavigateTab('facilities')}>
            <Building2 size={14} />
            <span>Open Facility Registry</span>
            <ArrowRight size={13} />
          </button>
          <button type="button" className="moh-btn-outline" onClick={() => onNavigateTab('surveillance')}>
            <Activity size={14} />
            <span>Open Surveillance Radar</span>
            <ArrowRight size={13} />
          </button>
          <button type="button" className="moh-btn-outline" onClick={onScheduleAudit}>
            <ClipboardCheck size={14} />
            <span>Schedule Inspection</span>
          </button>
        </div>
      </div>
    </div>
  );
};
