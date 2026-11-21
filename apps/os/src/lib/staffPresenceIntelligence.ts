/**
 * Staff Presence Timestamp Formatting & AI Workforce Coverage Intelligence
 */
import type { StaffPresence } from './staffPresenceStore';

export interface FormattedLastSeen {
  exactDateTime: string;
  relative: string;
  neverSeen: boolean;
}

export function formatExactLastSeen(ts: number | string | null | undefined): FormattedLastSeen {
  if (!ts) {
    return { exactDateTime: 'Never logged in', relative: '—', neverSeen: true };
  }
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return { exactDateTime: 'Never logged in', relative: '—', neverSeen: true };
  }

  const d = new Date(ms);
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const exactDateTime = `${datePart}, ${timePart}`;

  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  let relative = 'Just now';
  if (diffMin >= 1 && diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffMin >= 60 && diffMin < 1440) relative = `${Math.floor(diffMin / 60)}h ago`;
  else if (diffMin >= 1440) relative = `${Math.floor(diffMin / 1440)}d ago`;

  return { exactDateTime, relative, neverSeen: false };
}

export interface RosterStaffInput {
  id: string;
  name: string;
  role: string;
  specialty: string;
  ward: string;
  status: 'on-duty' | 'off-duty' | 'leave';
  lastSeenMs?: number | null;
  loggedInAtMs?: number | null;
}

export interface RosterIntelligenceAnalysis {
  totalRoster: number;
  onlineCount: number;
  coveragePct: number;
  neverLoggedInCount: number;
  staleInactiveStaff: Array<{ id: string; name: string; role: string; daysIdle: number }>;
  longShiftFatigueAlerts: Array<{ id: string; name: string; role: string; hoursOnline: number }>;
  uncoveredCriticalRoles: string[];
  recommendedActions: string[];
  statusSeverity: 'optimal' | 'watch' | 'critical';
}

const CRITICAL_ROLE_MAP: Array<{ key: string; label: string }> = [
  { key: 'doctor', label: 'Attending Doctor / Medical Officer' },
  { key: 'nurse', label: 'Nursing Officer / Triage Nurse' },
  { key: 'pharmacist', label: 'Licensed Pharmacist' },
  { key: 'lab', label: 'Medical Lab Scientist' },
  { key: 'reception', label: 'Front Desk / Reception' },
];

export function analyzeStaffRosterIntelligence(
  staff: RosterStaffInput[],
  presenceList: StaffPresence[] = []
): RosterIntelligenceAnalysis {
  const now = Date.now();
  const totalRoster = staff.length;
  const online = staff.filter((s) => s.status === 'on-duty');
  const onlineCount = online.length;
  const coveragePct = totalRoster > 0 ? Math.round((onlineCount / totalRoster) * 100) : 0;

  const onlineRoles = new Set(online.map((s) => s.role.toLowerCase()));
  const uncoveredCriticalRoles: string[] = [];
  for (const cr of CRITICAL_ROLE_MAP) {
    const hasRostered = staff.some((s) => s.role.toLowerCase().includes(cr.key));
    const hasOnline = onlineRoles.has(cr.key);
    if ((hasRostered && !hasOnline) || (totalRoster > 0 && !hasOnline && cr.key === 'nurse')) {
      uncoveredCriticalRoles.push(cr.label);
    }
  }

  const staleInactiveStaff: RosterIntelligenceAnalysis['staleInactiveStaff'] = [];
  let neverLoggedInCount = 0;

  for (const s of staff) {
    if (!s.lastSeenMs || s.lastSeenMs <= 0) {
      neverLoggedInCount += 1;
      continue;
    }
    const daysIdle = Math.floor((now - s.lastSeenMs) / 86_400_000);
    if (s.status !== 'on-duty' && daysIdle >= 14) {
      staleInactiveStaff.push({ id: s.id, name: s.name, role: s.role, daysIdle });
    }
  }

  const longShiftFatigueAlerts: RosterIntelligenceAnalysis['longShiftFatigueAlerts'] = [];
  for (const p of presenceList) {
    const startMs = p.lastSeen;
    if (!startMs || now - p.lastSeen > 180_000) continue;
    const hrs = Math.round(((now - startMs) / 3_600_000) * 10) / 10;
    if (hrs >= 12) {
      longShiftFatigueAlerts.push({
        id: p.badgeId,
        name: p.name,
        role: p.role || p.roleKey || 'Staff',
        hoursOnline: hrs,
      });
    }
  }

  const recommendedActions: string[] = [];
  if (totalRoster === 0) {
    recommendedActions.push('Enrol clinical and desk staff in Access & Staff Enrolment to activate live shift telemetry.');
  } else {
    if (uncoveredCriticalRoles.length > 0) {
      recommendedActions.push(
        `Assign on-duty coverage for uncovered core desks: ${uncoveredCriticalRoles.join(', ')}.`
      );
    }
    if (neverLoggedInCount > 0) {
      recommendedActions.push(
        `${neverLoggedInCount} enrolled staff member(s) have never signed in — verify their PIN onboarding or send activation reminders.`
      );
    }
    if (longShiftFatigueAlerts.length > 0) {
      recommendedActions.push(
        `${longShiftFatigueAlerts.length} active clinician(s) exceeded 12h continuous duty — schedule SBAR shift handover.`
      );
    }
    if (staleInactiveStaff.length > 0) {
      recommendedActions.push(
        `Audit ${staleInactiveStaff.length} inactive credential(s) (>14 days offline) for leave/suspension compliance.`
      );
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('Live shift balance looks healthy across active hospital desks.');
    }
  }

  const statusSeverity: RosterIntelligenceAnalysis['statusSeverity'] =
    totalRoster > 0 && (onlineCount === 0 || uncoveredCriticalRoles.length >= 2)
      ? 'critical'
      : uncoveredCriticalRoles.length > 0 || longShiftFatigueAlerts.length > 0 || coveragePct < 25
        ? 'watch'
        : 'optimal';

  return {
    totalRoster,
    onlineCount,
    coveragePct,
    neverLoggedInCount,
    staleInactiveStaff: staleInactiveStaff.slice(0, 6),
    longShiftFatigueAlerts,
    uncoveredCriticalRoles,
    recommendedActions,
    statusSeverity,
  };
}

export async function generateAiRosterBriefing(
  analysis: RosterIntelligenceAnalysis,
  facilityName: string
): Promise<string> {
  const fallback = [
    `${facilityName} Shift Status (${analysis.statusSeverity.toUpperCase()}): ${analysis.onlineCount}/${analysis.totalRoster} rostered staff active (${analysis.coveragePct}% live coverage).`,
    ...analysis.recommendedActions,
  ].join(' • ');

  if (typeof window === 'undefined') return fallback;

  try {
    const prompt = [
      `Analyze this live hospital staff presence telemetry for ${facilityName} and give 3 crisp, actionable operational recommendations for the Medical Director / Admin in plain text (max 90 words):`,
      JSON.stringify({
        online: analysis.onlineCount,
        total: analysis.totalRoster,
        coveragePct: analysis.coveragePct,
        uncoveredDesks: analysis.uncoveredCriticalRoles,
        neverLoggedIn: analysis.neverLoggedInCount,
        fatigueAlerts: analysis.longShiftFatigueAlerts,
        staleCount: analysis.staleInactiveStaff.length,
      }),
    ].join('\n');

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        system: 'You are MedCore Hospital Operations AI. Be concise, practical, and never mention internal vendor services.',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { reply?: string; text?: string };
    const text = (data.reply || data.text || '').trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}
