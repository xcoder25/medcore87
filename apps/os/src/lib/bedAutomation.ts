/**
 * Admin AI Bed & Ward Capacity Automation
 *
 * Parses natural-language instructions from Hospital Administrators to create beds
 * by exact count and target ward (e.g. "Create 12 beds in Male Medical Ward" or
 * "Add 8 beds to Maternity and 4 beds in ICU"), or inspect per-ward bed capacity.
 */
import {
  createBeds,
  listBeds,
  listWards,
  generateWardPrefix,
  wardCapacitySummary,
} from './bedBoardStore';
import { appendAudit } from './auditLogStore';
import { emitLiveAction } from './liveActions';

export interface BedCreationJob {
  ward: string;
  count: number;
  prefix?: string;
}

export type BedAutomationIntent =
  | { handled: false }
  | { handled: true; action: 'create'; jobs: BedCreationJob[] }
  | { handled: true; action: 'summary' }
  | { handled: true; action: 'error'; error: string };

export function canAutomateBeds(roleKey: string): boolean {
  const rk = String(roleKey || '').toLowerCase().trim();
  return rk === 'hospital_admin' || rk === 'admin' || rk === 'sysadmin';
}

export function bedAutomationRefusal(roleKey: string): string {
  return (
    `Creating or modifying hospital ward beds is restricted to **Hospital Administrator** (or System Admin).\n\n` +
    `Your active role (**${roleKey || 'staff'}**) can view clinical capacity but cannot provision new beds.`
  );
}

function titleCaseWard(raw: string): string {
  const ACRONYMS = new Set(['icu', 'pacu', 'nicu', 'opd', 'gopd', 'a&e', 'ent', 'ccu', 'hdu', 'obgyn', 'o&g', 'er']);
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const low = w.toLowerCase();
      if (ACRONYMS.has(low)) return low.toUpperCase();
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(' ');
}

function cleanWardFragment(raw: string): string {
  let s = raw
    .replace(/\b(?:with|using)\s+(?:prefix|code)\s+[a-z0-9-]+\b/gi, '')
    .replace(/\b(?:for|in|at|of)\s+(?:this|the)\s+(?:hospital|facility)\b/gi, '')
    .replace(/\b(?:please|now|today)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize trailing "ward" / "unit" only as a clean suffix; match existing ward names later
  s = s.replace(/[.,;:!?]+$/, '').trim();
  if (!s) return '';
  return titleCaseWard(s);
}

function resolveCanonicalWard(wardInput: string, existingWards: string[]): string {
  const cleaned = cleanWardFragment(wardInput);
  if (!cleaned) return '';
  const stripped = cleaned.replace(/\s+wards?$/i, '').trim();

  // Exact or case-insensitive match against existing wards (with or without trailing "Ward")
  for (const w of existingWards) {
    const wl = w.toLowerCase().trim();
    if (wl === cleaned.toLowerCase() || wl === stripped.toLowerCase()) {
      return w;
    }
    if (wl.replace(/\s+wards?$/i, '').trim() === stripped.toLowerCase()) {
      return w;
    }
  }
  return stripped || cleaned;
}

function parseSingleBedClause(clause: string): BedCreationJob | null {
  const text = clause.trim();
  if (!text) return null;

  const prefixMatch = text.match(/\b(?:with|using)\s+(?:prefix|code)\s+([a-z0-9-]{1,8})\b/i);
  const explicitPrefix = prefixMatch ? prefixMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '') : undefined;

  // Pattern 1: "[create/add/...] <count> [new/more] beds in/for/to/under/at <ward>"
  const p1 = text.match(
    /(?:(?:create|add|provision|make|setup|set\s+up|generate|allocate|build|open)\s+)?(\d{1,3})\s*(?:new|more|additional|extra)?\s*beds?\s*(?:in|into|to|for|at|under|on)\s+(?:the\s+)?(.+)/i
  );
  if (p1) {
    const count = Math.min(100, Math.max(1, parseInt(p1[1], 10)));
    const ward = cleanWardFragment(p1[2]);
    if (ward && count > 0) return { count, ward, prefix: explicitPrefix };
  }

  // Pattern 2: "<ward> : <count> beds" or "in <ward> create <count> beds"
  const p2 = text.match(
    /(?:in|for|to|at)\s+(?:the\s+)?([a-z0-9\s&-]{2,40}?)\s*(?:create|add|provision|make|setup|set\s+up|allocate|:)\s*(\d{1,3})\s*(?:new|more)?\s*beds?/i
  );
  if (p2) {
    const count = Math.min(100, Math.max(1, parseInt(p2[2], 10)));
    const ward = cleanWardFragment(p2[1]);
    if (ward && count > 0) return { count, ward, prefix: explicitPrefix };
  }

  // Pattern 3: "<count> [new] <ward> beds" (e.g. "create 6 surgical beds", "add 4 ICU beds")
  const p3 = text.match(
    /(?:(?:create|add|provision|make|setup|set\s+up|generate|allocate)\s+)?(\d{1,3})\s+(?:new|more|additional|extra)?\s*([a-z0-9\s&-]{2,35}?)\s+beds?\b/i
  );
  if (p3) {
    const count = Math.min(100, Math.max(1, parseInt(p3[1], 10)));
    const wardCandidate = p3[2].trim();
    if (!/^(?:new|more|additional|extra|hospital|patient|inpatient|available)$/i.test(wardCandidate)) {
      const ward = cleanWardFragment(wardCandidate);
      if (ward && count > 0) return { count, ward, prefix: explicitPrefix };
    }
  }

  return null;
}

export function parseBedAutomationIntent(query: string): BedAutomationIntent {
  const q = String(query || '').trim();
  if (!q) return { handled: false };

  // Capacity summary / inventory check intent (when NOT a create/add verb)
  const isCapacityQuery =
    /\b(?:how\s+many\s+beds|total\s+beds|bed\s+count|beds?\s+per\s+ward|ward\s+bed\s+capacity|list\s+wards?\s+and\s+beds|bed\s+inventory)\b/i.test(
      q
    ) && !/\b(create|add|provision|make|generate|setup|set\s+up|allocate)\b/i.test(q);

  if (isCapacityQuery) {
    return { handled: true, action: 'summary' };
  }

  // Bed creation intent
  const looksLikeCreateBeds =
    /\b(?:create|add|provision|make|generate|setup|set\s+up|allocate|open|build)\b/i.test(q) &&
    /\bbeds?\b/i.test(q);

  if (!looksLikeCreateBeds) {
    return { handled: false };
  }

  // Split compound clauses e.g. "create 12 beds in Male Medical and 4 beds in ICU"
  const clauses = q
    .split(/\s*(?:\band\b|\+|,|;|\n)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const jobs: BedCreationJob[] = [];
  for (const clause of clauses) {
    const parsed = parseSingleBedClause(clause);
    if (parsed) {
      jobs.push(parsed);
    }
  }

  // Fallback parse against whole query in case ward name itself contains "and" (e.g. "Accident and Emergency")
  if (jobs.length === 0) {
    const single = parseSingleBedClause(q);
    if (single) jobs.push(single);
  }

  if (jobs.length === 0) {
    return {
      handled: true,
      action: 'error',
      error:
        'Please specify both the **number of beds** and the **ward name** — for example:\n' +
        '• `Create 10 beds in Male Medical Ward`\n' +
        '• `Add 6 beds to Maternity and 4 beds in ICU`',
    };
  }

  return { handled: true, action: 'create', jobs };
}

export function executeCreateBedsAutomation(
  jobs: BedCreationJob[],
  facilityId: string,
  actor = 'Hospital Administrator'
): {
  ok: boolean;
  totalCreated: number;
  details: Array<{ ward: string; prefix: string; createdNos: string[]; wardTotal: number }>;
  facilityTotalBeds: number;
  message: string;
} {
  const existingBeds = listBeds(facilityId);
  const existingWards = listWards(facilityId);
  const details: Array<{ ward: string; prefix: string; createdNos: string[]; wardTotal: number }> = [];
  let totalCreated = 0;

  for (const job of jobs) {
    const ward = resolveCanonicalWard(job.ward, existingWards);
    if (!ward) continue;
    const currentBeds = listBeds(facilityId);
    const prefix = job.prefix || generateWardPrefix(ward, currentBeds);
    const count = Math.min(100, Math.max(1, Math.floor(job.count)));

    const created = createBeds({
      facilityId,
      ward,
      prefix,
      count,
      actor,
    });

    const updatedWardBeds = listBeds(facilityId).filter(
      (b) => b.ward.toLowerCase() === ward.toLowerCase()
    );
    totalCreated += created.length;

    if (!existingWards.some((w) => w.toLowerCase() === ward.toLowerCase())) {
      existingWards.push(ward);
    }

    details.push({
      ward,
      prefix,
      createdNos: created.map((c) => c.bedNo),
      wardTotal: updatedWardBeds.length,
    });
  }

  const allAfter = listBeds(facilityId);

  if (totalCreated > 0) {
    const summaryLine = details
      .map((d) => `${d.createdNos.length} bed(s) in ${d.ward} (${d.createdNos[0]}–${d.createdNos[d.createdNos.length - 1]})`)
      .join('; ');
    try {
      appendAudit({
        facilityId,
        actor,
        category: 'clinical',
        severity: 'normal',
        action: 'AI_PROVISION_BEDS',
        entity: 'bed_board',
        detail: `Admin AI created ${totalCreated} bed(s): ${summaryLine}`,
      });
    } catch {
      /* ignore */
    }
    try {
      emitLiveAction(`Admin AI provisioned ${totalCreated} beds · Facility total: ${allAfter.length}`, {
        module: 'beds',
      });
    } catch {
      /* ignore */
    }
  }

  const lines = details.map((d) => {
    const range =
      d.createdNos.length > 1
        ? `**${d.createdNos[0]}** → **${d.createdNos[d.createdNos.length - 1]}**`
        : d.createdNos.length === 1
          ? `**${d.createdNos[0]}**`
          : 'none';
    return `• **${d.ward}** (\`${d.prefix}\`): added **${d.createdNos.length}** bed(s) [${range}] · Ward capacity now **${d.wardTotal}**`;
  });

  const message =
    totalCreated > 0
      ? `Provisioned **${totalCreated} new bed(s)** for **${facilityId}** (${existingBeds.length} → **${allAfter.length}** total facility beds):\n\n` +
        lines.join('\n') +
        `\n\nAll beds are active and immediately available to Clinicians & Nursing on **Bed & Ward Occupancy**.`
      : 'No new beds were created — verify ward name and bed count (1–100).';

  return {
    ok: totalCreated > 0,
    totalCreated,
    details,
    facilityTotalBeds: allAfter.length,
    message,
  };
}

export function executeBedCapacitySummary(facilityId: string): string {
  const summary = wardCapacitySummary(facilityId);
  const total = summary.reduce((s, w) => s + w.total, 0);
  const avail = summary.reduce((s, w) => s + w.available, 0);
  const occ = summary.reduce((s, w) => s + w.occupied + w.isolation, 0);

  if (summary.length === 0) {
    return `Facility **${facilityId}** currently has **0 beds** configured. Ask me e.g. \`Create 10 beds in Male Medical Ward\` to provision beds.`;
  }

  const lines = summary.map(
    (w) =>
      `• **${w.ward}**: **${w.total}** beds (${w.available} available, ${w.occupied + w.isolation} occupied${w.cleaning ? `, ${w.cleaning} turnover` : ''}${w.maintenance ? `, ${w.maintenance} out of service` : ''})`
  );

  return (
    `**Facility Bed Capacity · ${facilityId}**\n\n` +
    `• Total Capacity: **${total} beds** · Occupied: **${occ}** · Available: **${avail}**\n\n` +
    lines.join('\n')
  );
}
