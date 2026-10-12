/**
 * Maternity chart intelligence — clinical prompts that rival Stork / PowerChart decision support.
 * Rules are advisory; midwife remains source of clinical judgement.
 */
import type { MaternityRecord } from './maternityStore';
import type { AncPlan, AncVisitSlot } from './ancNpiSms';
import { gaWeeksFromLmp, nextAncVisit } from './ancNpiSms';
import type { FacilityPatient } from './patientRegistryStore';

export type InsightLevel = 'critical' | 'warn' | 'info' | 'ok';

export interface ChartInsight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
  action?: string;
  module?: string;
}

export interface MaternityChartIntel {
  completeness: number; // 0–100
  missing: string[];
  insights: ChartInsight[];
  gaNow: number | null;
  nextVisit: AncVisitSlot | null;
  primaryStage: string | null;
  riskBanner: InsightLevel;
}

export function buildMaternityChartIntel(input: {
  patient: FacilityPatient;
  matRecords: MaternityRecord[];
  ancPlan: AncPlan | null;
}): MaternityChartIntel {
  const { patient: p, matRecords, ancPlan } = input;
  const m = matRecords[0];
  const missing: string[] = [];
  const insights: ChartInsight[] = [];

  if (!p.phone) missing.push('Phone');
  if (!p.dob) missing.push('DOB');
  if (!(p.allergies && p.allergies.length) && !m?.allergies) {
    /* NKDA ok */
  }
  if (!p.bloodGroup && !m?.bloodGroup) missing.push('Blood group');
  if (!p.emergencyContact) missing.push('Emergency contact');
  if (!ancPlan && !m?.edd) missing.push('EDD / ANC plan');
  if (!m && !ancPlan) missing.push('Maternity encounter');
  if (m && !m.gravidaPara) missing.push('Gravida / Para');
  if (m && (m.gbs === 'unknown' || !m.gbs)) missing.push('GBS status');
  if (m && (m.hivStatus === 'unknown' || !m.hivStatus)) missing.push('HIV status');

  const lmp = m?.lmp || ancPlan?.lmp;
  const gaNow = lmp ? gaWeeksFromLmp(lmp) : m?.gaWeeks ?? null;
  const next = nextAncVisit(ancPlan);

  // Intelligence rules
  if (m?.fetalHeartRateBpm != null) {
    const fhr = m.fetalHeartRateBpm;
    if (fhr < 110 || fhr > 160) {
      insights.push({
        id: 'fhr',
        level: 'critical',
        title: 'Fetal heart rate out of range',
        detail: `FHR ${fhr} bpm — evaluate for distress; continuous CTG / escalate per protocol.`,
        action: 'Open labour board',
        module: 'maternity',
      });
    }
  }

  if (m?.risk === 'critical' || (m?.mfti != null && m.mfti <= 2)) {
    insights.push({
      id: 'mfti',
      level: 'critical',
      title: 'High-acuity obstetric triage',
      detail: `Risk ${m?.risk || '—'} · MFTI ${m?.mfti ?? '—'} — prioritise assessment and senior review.`,
      action: 'Obstetric emergency',
      module: 'emergency',
    });
  }

  if (gaNow != null && gaNow < 37 && ['admitted_labour', 'active_labour', 'second_stage'].includes(m?.stage || '')) {
    insights.push({
      id: 'preterm',
      level: 'warn',
      title: 'Preterm labour window',
      detail: `GA ~${gaNow}w in labour pathway — consider steroids, magnesium, neonatal team alert.`,
      action: 'Maternity EMR',
      module: 'maternity',
    });
  }

  if (next) {
    const days = Math.round((new Date(next.dueDate + 'T00:00:00').getTime() - Date.now()) / 864e5);
    if (days < 0) {
      insights.push({
        id: 'anc-overdue',
        level: 'warn',
        title: 'ANC contact overdue',
        detail: `${next.label} was due ${next.dueDate} (${Math.abs(days)}d ago). Offer catch-up visit or SMS.`,
        action: 'Send ANC SMS',
        module: 'maternity',
      });
    } else if (days <= 3) {
      insights.push({
        id: 'anc-due',
        level: 'info',
        title: 'ANC contact due soon',
        detail: `${next.label} on ${next.dueDate} (${days === 0 ? 'today' : `${days}d`}). Confirm attendance.`,
        action: 'View ANC schedule',
        module: 'maternity',
      });
    }
  }

  if (m?.gbs === 'positive' && ['admitted_labour', 'active_labour', 'second_stage'].includes(m.stage || '')) {
    insights.push({
      id: 'gbs',
      level: 'warn',
      title: 'GBS positive in labour',
      detail: 'Ensure intrapartum antibiotic prophylaxis per protocol.',
      module: 'maternity',
    });
  }

  if ((p.allergies || []).length > 0) {
    insights.push({
      id: 'allergy',
      level: 'warn',
      title: 'Allergy on file',
      detail: (p.allergies || []).join(', '),
    });
  }

  if (!m && !ancPlan) {
    insights.push({
      id: 'no-ob',
      level: 'info',
      title: 'No OB episode linked',
      detail: 'Book ANC or triage in Maternity EMR so EDD, G/P and labour board attach to this chart.',
      action: 'Open Maternity EMR',
      module: 'maternity',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'stable',
      level: 'ok',
      title: 'No urgent maternity flags',
      detail: 'Chart is quiet — continue routine ANC / ward surveillance.',
    });
  }

  const fieldsTotal = 10;
  const completeness = Math.max(0, Math.min(100, Math.round(((fieldsTotal - missing.length) / fieldsTotal) * 100)));

  const riskBanner: InsightLevel =
    insights.some((i) => i.level === 'critical') ? 'critical' :
    insights.some((i) => i.level === 'warn') ? 'warn' : 'ok';

  return {
    completeness,
    missing,
    insights: insights.sort((a, b) => {
      const o = { critical: 0, warn: 1, info: 2, ok: 3 };
      return o[a.level] - o[b.level];
    }),
    gaNow,
    nextVisit: next,
    primaryStage: m?.stage || (ancPlan ? 'anc' : null),
    riskBanner,
  };
}
