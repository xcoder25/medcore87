import { NextRequest, NextResponse } from 'next/server';
import { buildLiveMohSnapshot, sanitizeMohAuditDetail } from '../../../../lib/mohSyncEngine';
import type { MohLiveSnapshot } from '../../../../lib/mohTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';
const MOH_AI_MODELS = ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'] as const;

export interface MohIntelligenceReportPayload {
  id: string;
  question: string;
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  bullets: string[];
  recommendedDirectives: string[];
  followUpQuestions: string[];
  aiPowered: boolean;
  generatedAt: string;
}

function cleanKey(raw: string | undefined | null): string {
  let k = String(raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith('bearer ')) k = k.slice(7).trim();
  return k;
}

function resolveGeminiKey(): string {
  const names = [
    'GEMINI_API_KEY',
    'GOOGLE_GEMINI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GOOGLE_API_KEY',
    'GEMINI_KEY',
  ];
  const env = process.env as Record<string, string | undefined>;
  for (const n of names) {
    const k = cleanKey(env[n]);
    if (k) return k;
  }
  return '';
}

function fmtNgn(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function buildDeidentifiedDigest(snapshot: MohLiveSnapshot) {
  const { summary, regionalRollup, finance, surveillance, supplyChain, enforcement, idsr, grievances, transfers, audits, facilities } = snapshot;

  const sealedCount = facilities.filter((f) => f.operationalStatus === 'sealed').length;
  const expiredLicenseCount = facilities.filter((f) => f.licenseAlert === 'expired' || f.licenseAlert === 'expiring_soon').length;

  return {
    syncedAt: snapshot.syncedAt,
    summary: {
      totalOfficialFacilities: summary.totalOfficialFacilities,
      connectedFacilities: summary.connectedFacilities,
      totalBeds: summary.totalBeds,
      occupiedBeds: summary.occupiedBeds,
      bedOccupancyPct: summary.bedOccupancyPct,
      icuBedsTotal: summary.icuBedsTotal,
      icuBedsOccupied: summary.icuBedsOccupied,
      icuOccupancyPct: summary.icuOccupancyPct,
      activeStaffCount: summary.activeStaffCount,
      registeredPatientsCount: summary.registeredPatientsCount,
      activeOpdVisits: summary.activeOpdVisits,
      surgeFacilitiesCount: summary.surgeFacilitiesCount,
      activeAlertsCount: summary.activeAlertsCount,
      activeDirectivesCount: summary.activeDirectivesCount,
      sealedFacilitiesCount: sealedCount,
      expiredLicensesCount: expiredLicenseCount,
      stockOutItemsCount: supplyChain.stockOutCount,
      faultyEquipmentCount: supplyChain.faultyEquipmentCount,
      openGrievancesCount: grievances.openCount,
      idsrAlertsCount: idsr.dsnoReports.length,
      totalRevenuePaidNgn: summary.totalRevenuePaidNgn,
      totalRevenuePendingNgn: summary.totalRevenuePendingNgn,
    },
    regionalRollup,
    finance: {
      totalCollectedNgn: finance.totalCollectedNgn,
      totalPendingNgn: finance.totalPendingNgn,
      byChannel: finance.byChannel,
      topFacilities: finance.byFacility.slice(0, 6),
    },
    surveillance: {
      criticalLabAlerts: surveillance.criticalLabAlerts,
      criticalVitalsAlerts: surveillance.criticalVitalsAlerts,
      waitingOpd: surveillance.waitingOpd,
      withProviderOpd: surveillance.withProviderOpd,
    },
    supplyChain: {
      stockOutCount: supplyChain.stockOutCount,
      lowStockCount: supplyChain.lowStockCount,
      faultyEquipmentCount: supplyChain.faultyEquipmentCount,
      activeRenovationsCount: supplyChain.activeRenovationsCount,
      flaggedItems: supplyChain.items
        .filter(
          (i) =>
            !['in_stock', 'operational', 'adequate'].includes(i.functionalStatus) ||
            (i.coldChainTempC !== null && (i.coldChainTempC < 2 || i.coldChainTempC > 8))
        )
        .slice(0, 8)
        .map((i) => ({
          facilityName: i.facilityName,
          lga: i.lga,
          itemName: i.itemName,
          status: i.functionalStatus,
          quantity: i.quantity,
          unit: i.unit,
          coldChainTempC: i.coldChainTempC,
        })),
    },
    enforcementAndCompliance: {
      openRemediationsCount: audits.filter((a) => a.status === 'remediation_required').length,
      pendingTransfersCount: transfers.filter((t) => t.status === 'pending').length,
      sealedOrPartialFacilities: facilities
        .filter((f) => f.operationalStatus === 'sealed' || f.operationalStatus === 'closed' || f.licenseAlert !== 'valid')
        .slice(0, 8)
        .map((f) => ({
          facilityName: f.facilityName,
          lga: f.lga,
          operationalStatus: f.operationalStatus,
          licenseAlert: f.licenseAlert,
        })),
      recentEnforcement: enforcement.slice(0, 6).map((e) => ({
        facilityName: e.facilityName,
        actionType: e.actionType,
        reason: sanitizeMohAuditDetail(e.reason),
      })),
    },
    idsrAndRmnch: {
      ancVisitsTotal: idsr.ancVisitsTotal,
      skilledDeliveriesTotal: idsr.skilledDeliveriesTotal,
      immunizationDosesTotal: idsr.immunizationDosesTotal,
      emergencyReferralsTotal: idsr.emergencyReferralsTotal,
      maternalDeathsTotal: idsr.maternalDeathsTotal,
      under5DeathsTotal: idsr.under5DeathsTotal,
      priorityReports: idsr.dsnoReports.slice(0, 6).map((r) => ({
        disease: r.disease,
        lga: r.lga,
        facilityName: r.facilityName,
        suspectedCases: r.suspectedCases,
        deaths: r.deaths,
        status: r.status,
      })),
    },
    citizenGrievances: {
      openCount: grievances.openCount,
      resolvedCount: grievances.resolvedCount,
      avgTurnaroundHours: grievances.avgTurnaroundHours,
      avgRating: grievances.avgRating,
      recentOpen: grievances.items
        .filter((g) => g.status !== 'resolved')
        .slice(0, 5)
        .map((g) => ({
          facilityName: g.facilityName,
          category: g.category,
          summary: sanitizeMohAuditDetail(g.summary),
          status: g.status,
        })),
    },
  };
}

function buildDeterministicBriefing(question: string, snapshot: MohLiveSnapshot): MohIntelligenceReportPayload {
  const { summary, finance, supplyChain, idsr, grievances, enforcement, regionalRollup, facilities } = snapshot;
  const q = question.toLowerCase();
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const expiredLicensesCount = facilities.filter(
    (f) => f.licenseAlert === 'expired' || f.licenseAlert === 'expiring_soon'
  ).length;

  let headline = 'Akwa Ibom State Health System Executive Briefing';
  let summaryText = `${summary.connectedFacilities} of ${summary.totalOfficialFacilities} official MOH facilities are connected. Bed occupancy stands at ${summary.bedOccupancyPct}% (ICU ${summary.icuOccupancyPct}%), with ${summary.activeStaffCount} active health workers, ${supplyChain.stockOutCount} stock-out alert(s), ${idsr.dsnoReports.length} active IDSR notification(s), and ${grievances.openCount} open citizen grievance(s).`;
  let metrics = [
    { label: 'Connected Facilities', value: `${summary.connectedFacilities}/${summary.totalOfficialFacilities}` },
    { label: 'Bed / ICU Occupancy', value: `${summary.bedOccupancyPct}% / ${summary.icuOccupancyPct}%` },
    { label: 'Treasury YTD', value: fmtNgn(finance.totalCollectedNgn) },
    { label: 'Open Grievances', value: String(grievances.openCount) },
  ];
  let bullets = [
    ...regionalRollup.map(
      (r) =>
        `${r.district}: ${r.connectedFacilities}/${r.totalFacilities} active · ${r.occupiedBeds}/${r.totalBeds} beds · ${r.staffCount} staff · compliance ${r.avgComplianceScore}%`
    ),
    `RMNCH & Primary Care: ${idsr.ancVisitsTotal.toLocaleString()} ANC visits, ${idsr.skilledDeliveriesTotal.toLocaleString()} skilled deliveries, ${idsr.immunizationDosesTotal.toLocaleString()} immunization doses.`,
    `Supply & Equipment: ${supplyChain.stockOutCount} stock-out(s), ${supplyChain.lowStockCount} low-stock item(s), ${supplyChain.faultyEquipmentCount} faulty medical equipment asset(s).`,
  ];
  const recommendedDirectives = [
    supplyChain.stockOutCount > 0 || supplyChain.faultyEquipmentCount > 0
      ? `Issue rapid replenishment & biomedical repair order for ${supplyChain.stockOutCount} stock-out(s) and ${supplyChain.faultyEquipmentCount} faulty equipment item(s).`
      : 'Maintain routine central medical store replenishment cadence across all 31 LGAs.',
    expiredLicensesCount > 0 || enforcement.length > 0
      ? `Dispatch inspection teams to verify ${expiredLicensesCount} license renewal flag(s) and enforce anti-quackery orders.`
      : 'Continue scheduled quarterly facility accreditation renewals across public and private clinics.',
    idsr.maternalDeathsTotal > 0 || idsr.dsnoReports.length > 0
      ? 'Activate DSNO epidemiological verification & MPDSR review on flagged IDSR and maternal safety alerts.'
      : 'Sustain weekly LGA IDSR zero-reporting compliance.',
  ];

  if (q.includes('supply') || q.includes('vaccine') || q.includes('cold') || q.includes('equipment')) {
    headline = 'Supply Chain, Cold-Chain & Equipment Readiness Briefing';
    summaryText = `Inventory and biomedical oversight spans ${supplyChain.items.length} tracked records. Currently ${supplyChain.stockOutCount} critical stock-out(s), ${supplyChain.lowStockCount} low-stock alert(s), ${supplyChain.faultyEquipmentCount} faulty equipment unit(s), and ${supplyChain.activeRenovationsCount} active renovation project(s) require tracking.`;
    metrics = [
      { label: 'Critical Stock-Outs', value: String(supplyChain.stockOutCount) },
      { label: 'Low Stock Items', value: String(supplyChain.lowStockCount) },
      { label: 'Faulty Equipment', value: String(supplyChain.faultyEquipmentCount) },
      { label: 'Active Renovations', value: String(supplyChain.activeRenovationsCount) },
    ];
    bullets =
      supplyChain.items.slice(0, 6).map(
        (i) =>
          `${i.facilityName} (${i.lga}): ${i.itemName} — ${i.functionalStatus.replace(/_/g, ' ').toUpperCase()} (${i.quantity} ${i.unit}${i.coldChainTempC !== null ? `, ${i.coldChainTempC}°C` : ''})`
      );
  } else if (q.includes('bed') || q.includes('icu') || q.includes('surge') || q.includes('capacity')) {
    const topBeds = [...facilities]
      .filter((f) => f.totalBeds > 0)
      .sort((a, b) => b.occupiedBeds / b.totalBeds - a.occupiedBeds / a.totalBeds)
      .slice(0, 5);
    headline = 'Inpatient Capacity & ICU Surge Briefing';
    summaryText = `Statewide occupancy is ${summary.occupiedBeds}/${summary.totalBeds} general beds (${summary.bedOccupancyPct}%) and ${summary.icuBedsOccupied}/${summary.icuBedsTotal} ICU beds (${summary.icuOccupancyPct}%), with ${summary.surgeFacilitiesCount} facility surge declaration(s).`;
    bullets = topBeds.length
      ? topBeds.map((f) => `${f.facilityName} (${f.district}): ${f.occupiedBeds}/${f.totalBeds} beds · ICU ${f.icuBedsOccupied}/${f.icuBedsTotal}`)
      : ['No occupied inpatient beds reported yet in the current telemetry window.'];
  }

  return {
    id: `rep-${Date.now().toString(36)}`,
    question: sanitizeMohAuditDetail(question),
    headline: sanitizeMohAuditDetail(headline),
    summary: sanitizeMohAuditDetail(summaryText),
    metrics,
    bullets: bullets.map((b) => sanitizeMohAuditDetail(b)),
    recommendedDirectives: recommendedDirectives.map((d) => sanitizeMohAuditDetail(d)),
    followUpQuestions: [
      'Which LGAs have severe rural health worker shortages or stock-outs?',
      'Summarize anti-quackery enforcement and expired facility licenses',
      'Review maternal deliveries, IDSR outbreak signals, and citizen grievance turnaround',
    ],
    aiPowered: false,
    generatedAt: timeStr,
  };
}

const MOH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['label', 'value'],
      },
    },
    bullets: { type: 'array', items: { type: 'string' } },
    recommendedDirectives: { type: 'array', items: { type: 'string' } },
    followUpQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'summary', 'metrics', 'bullets', 'recommendedDirectives', 'followUpQuestions'],
};

function extractTextFromInteraction(json: Record<string, unknown> | null): string {
  if (!json) return '';
  const steps = Array.isArray(json.steps) ? (json.steps as Array<Record<string, unknown>>) : [];
  for (const s of steps) {
    if (s.type === 'model_output' && Array.isArray(s.content)) {
      const txt = (s.content as Array<Record<string, unknown>>)
        .filter((c) => c.type === 'text' && typeof c.text === 'string')
        .map((c) => String(c.text))
        .join('')
        .trim();
      if (txt) return txt;
    }
  }
  const outputs = Array.isArray(json.outputs) ? (json.outputs as Array<Record<string, unknown>>) : [];
  for (const out of outputs) {
    if (typeof out.text === 'string' && out.text.trim()) return out.text.trim();
  }
  return '';
}

export async function POST(req: NextRequest) {
  let body: { question?: string; district?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const question = sanitizeMohAuditDetail(String(body.question || 'Statewide Situation Report').trim());
  const district = String(body.district || '').trim() || undefined;
  const snapshot = await buildLiveMohSnapshot({ district });

  const key = resolveGeminiKey();
  if (key) {
    const digest = buildDeidentifiedDigest(snapshot);
    const prompt = [
      `Ministerial Question: ${question}`,
      `Live De-Identified Telemetry Across 6 MOH Pillars:\n${JSON.stringify(digest)}`,
      `Synthesize an authoritative executive briefing strictly grounded in the telemetry above. Do not invent numbers or patient names.`,
    ].join('\n\n');

    for (const model of MOH_AI_MODELS) {
      try {
        const res = await fetch(GEMINI_INTERACTIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
            'Api-Revision': GEMINI_API_REVISION,
          },
          body: JSON.stringify({
            model,
            system_instruction:
              'You are Celestia, Executive Health Intelligence Advisor for the Akwa Ibom State Ministry of Health (MOH). Base every figure strictly on the provided de-identified JSON digest. Never include PII. Give concise operational insights and 2-3 actionable ministerial directives.',
            input: prompt,
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: MOH_RESPONSE_SCHEMA,
            },
            generation_config: {
              temperature: 0.25,
              max_output_tokens: 1100,
            },
          }),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) break;
          continue;
        }
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const rawText = extractTextFromInteraction(json);
        if (!rawText) continue;

        const parsed = JSON.parse(rawText) as {
          headline?: string;
          summary?: string;
          metrics?: { label: string; value: string }[];
          bullets?: string[];
          recommendedDirectives?: string[];
          followUpQuestions?: string[];
        };

        const report: MohIntelligenceReportPayload = {
          id: `rep-${Date.now().toString(36)}`,
          question,
          headline: sanitizeMohAuditDetail(parsed.headline || 'MOH Executive Intelligence Briefing'),
          summary: sanitizeMohAuditDetail(parsed.summary || ''),
          metrics: Array.isArray(parsed.metrics)
            ? parsed.metrics.slice(0, 4).map((m) => ({
                label: sanitizeMohAuditDetail(m.label),
                value: sanitizeMohAuditDetail(m.value),
              }))
            : [],
          bullets: Array.isArray(parsed.bullets)
            ? parsed.bullets.slice(0, 6).map((b) => sanitizeMohAuditDetail(b))
            : [],
          recommendedDirectives: Array.isArray(parsed.recommendedDirectives)
            ? parsed.recommendedDirectives.slice(0, 4).map((d) => sanitizeMohAuditDetail(d))
            : [],
          followUpQuestions: Array.isArray(parsed.followUpQuestions)
            ? parsed.followUpQuestions.slice(0, 3).map((qItem) => sanitizeMohAuditDetail(qItem))
            : [],
          aiPowered: true,
          generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        };

        if (report.summary) {
          return NextResponse.json({ ok: true, report, modelUsed: model });
        }
      } catch {
        continue;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    report: buildDeterministicBriefing(question, snapshot),
  });
}
