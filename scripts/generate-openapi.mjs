#!/usr/bin/env node
/**
 * Automated OpenAPI 3.1.0 & Route Handler / Server Action Documentation Generator
 * Scans Next.js App Router Route Handlers in apps/os and apps/admin, parses
 * apps/os/src/middleware.ts for live auth/RBAC/tenant rules, checks for any
 * "use server" Server Actions, and writes:
 *   - docs/api/openapi.json
 *   - docs/api/API_AND_SERVER_ACTIONS.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const APPS = [
  { name: 'medcore-os', label: 'MedCore OS (`apps/os`)', apiDir: path.join(REPO_ROOT, 'apps/os/src/app/api') },
  { name: 'medcore-admin', label: 'MOH Command Portal (`apps/admin`)', apiDir: path.join(REPO_ROOT, 'apps/admin/src/app/api') },
];

const CURATED_SUMMARIES = {
  '/api/auth/session': 'Verify, issue (HMAC-SHA256 HttpOnly cookie), or clear staff session token.',
  '/api/auth/verify-pin': 'Authenticate staff badge ID + PIN and issue signed session cookie.',
  '/api/auth/mfa': 'Send or verify staff Email OTP 2FA challenge.',
  '/api/auth/reset-pin': 'Reset forgotten staff PIN after verified identity check.',
  '/api/auth/biometric': 'Check enrollment status, enroll staff face template, or verify facial biometric match.',
  '/api/auth/biometric/liveness/session': 'Create 3D live facial liveness challenge session.',
  '/api/auth/biometric/liveness/results': 'Evaluate live facial liveness session confidence and issue MFA token.',
  '/api/auth/facility-status': 'Return facility onboarding and authentication readiness.',
  '/api/auth/register-facility-admin': 'Bootstrap initial facility administrator account.',
  '/api/patients': 'List, search, create/update, or delete facility-scoped patient records in PostgreSQL.',
  '/api/staff': 'List, create/update, or remove facility staff directory records.',
  '/api/staff/lookup': 'Public pre-login badge lookup by facility and badge ID.',
  '/api/staff/create': 'Provision staff member and Firebase Auth credential (Admin only).',
  '/api/staff/delete-auth': 'Revoke single staff authentication credential (Admin only).',
  '/api/staff/delete-all-auth': 'Bulk remove staff authentication records for a facility (Admin only).',
  '/api/staff/flush-facility': 'Flush facility sandbox/pilot records (Admin only).',
  '/api/audit': 'Read or append SHA-256 hash-chained entries to clinical_audit_ledger.',
  '/api/audit/anchor': 'Compute and seal zero-PHI SHA-256 Merkle root over audit ledger rows.',
  '/api/facility/sync': 'Read, upsert, or remove multi-device facility_kv keys with relational Postgres projection.',
  '/api/facility/stream': 'Subscribe to facility Server-Sent Events (SSE) live clinical & billing updates.',
  '/api/drafts': 'Persist, resume, or discard multi-step clinical/registration form drafts.',
  '/api/storage/presigned-url': 'Generate pre-signed S3 upload URL with tenant-isolated key prefix.',
  '/api/storage/upload': 'Upload encrypted clinical media/avatar payload to private S3 bucket.',
  '/api/storage/object': 'Authenticated proxy download/stream for private S3 objects.',
  '/api/storage/status': 'Check S3 storage configuration and health.',
  '/api/ai/clinical-safety': 'Run AI-assisted clinical safety, sepsis/NEWS2, and interaction evaluation.',
  '/api/ai/digitize-fhir': 'Digitize scanned paper charts/labs/ultrasounds into structured HL7 FHIR R4 JSON.',
  '/api/ai/patient-brief': 'Generate 30-second longitudinal AI clinician handoff brief.',
  '/api/ai/scan-form': 'OCR structured extraction for paper intake/lab forms.',
  '/api/ai/scribe': 'Convert clinical consultation audio/transcript into structured SOAP note.',
  '/api/ai/transcribe': 'Transcribe dictated clinical audio or patient voice note.',
  '/api/ai/vision-clinical': 'Analyze clinical images/scans via server-side vision proxy.',
  '/api/gemini': 'Server-side Gemini Interactions & generation proxy (never exposes key to browser).',
  '/api/akshia/claims': 'List, draft, validate readiness, or submit AKSHIA/NHIA claims and batches.',
  '/api/akshia/eligibility': 'Check patient AKSHIA/NHIA enrollee eligibility status.',
  '/api/akshia/preauth': 'Request AKSHIA pre-authorization code for inpatient/specialty procedures.',
  '/api/akshia/tariff': 'Retrieve AKSHIA tariff schedule items.',
  '/api/akwaremit/invoice': 'Generate AkwaRemit state revenue collection invoice.',
  '/api/akwaremit/webhook': 'HMAC-SHA256 verified AkwaRemit payment webhook receiver.',
  '/api/akwaremit/verify': 'Verify AkwaRemit settlement reference.',
  '/api/akwaremit/batch-settle': 'Accountant batch settlement of cash receipts into AkwaRemit.',
  '/api/akwaremit/configure': 'Configure facility AkwaRemit treasury credentials (Admin only).',
  '/api/akwaremit/status': 'Check facility AkwaRemit gateway configuration status.',
  '/api/akwaremit/test': 'Run AkwaRemit connectivity check.',
  '/api/paystack/initialize': 'Initialize Paystack card/transfer transaction for patient invoice.',
  '/api/paystack/terminal': 'Trigger Paystack POS Terminal payment intent.',
  '/api/paystack/verify': 'Verify Paystack payment reference.',
  '/api/paystack/webhook': 'HMAC-SHA512 verified Paystack webhook receiver.',
  '/api/referrals/hie': 'Create, bed-lock, accept, update, or discharge inter-facility HIE referrals.',
  '/api/dhis2/submit': 'Export and submit facility DHIS2 aggregate monthly/IDSR report.',
  '/api/fhir/epcr-bridge': 'Exchange HL7 FHIR bundles with ambulance ePCR bridge.',
  '/api/orthanc/studies': 'Query Orthanc PACS DICOM studies for facility.',
  '/api/care/sync': 'Sync Care patient mobile bookings and SHID/AKSHIA status.',
  '/api/care/reminders': 'List or dispatch antenatal, chronic care, and immunization reminders.',
  '/api/whatsapp/triage': 'Meta WhatsApp Cloud API verification challenge & voice/text triage webhook.',
  '/api/sms/send': 'Send patient/staff SMS notification via configured gateway.',
  '/api/events/publish': 'Publish facility operational event to real-time bus / EventBridge.',
  '/api/cron/daily-ops': 'Automated daily operations cron (reminders, expiry alerts, Merkle seal). Verified via CRON_SECRET or admin session.',
  '/api/db/health': 'PostgreSQL connectivity, auth mode, and schema readiness check.',
};

function parseMiddlewareRules() {
  const mwPath = path.join(REPO_ROOT, 'apps/os/src/middleware.ts');
  const src = fs.readFileSync(mwPath, 'utf8');
  const extractList = (name) => {
    const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
    if (!m) return [];
    return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  };
  return {
    publicPrefixes: extractList('PUBLIC_API_PREFIXES'),
    adminOnlyPrefixes: extractList('ADMIN_ONLY_API_PREFIXES'),
  };
}

function walkRoutes(dir, baseDir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkRoutes(full, baseDir));
    } else if (/^route\.(ts|js)$/.test(entry.name)) {
      const rel = path.relative(baseDir, dir).replace(/\\/g, '/');
      const openApiPath = '/api/' + rel.split('/').map((seg) => seg.replace(/^\[([^\]]+)\]$/, '{$1}')).filter(Boolean).join('/');
      results.push({ filePath: full, relPath: path.relative(REPO_ROOT, full).replace(/\\/g, '/'), apiPath: openApiPath });
    }
  }
  return results;
}

function findServerActions() {
  const actions = [];
  const skip = new Set(['node_modules', '.next', '.git', '.vercel', 'dist', 'build', '.expo']);
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const txt = fs.readFileSync(full, 'utf8');
        if (/^\s*['"]use server['"]|[\r\n]\s*['"]use server['"]/m.test(txt)) {
          actions.push(path.relative(REPO_ROOT, full).replace(/\\/g, '/'));
        }
      }
    }
  };
  scan(path.join(REPO_ROOT, 'apps'));
  return actions;
}

function extractRouteMetadata(routeMeta, appName, mwRules) {
  const { filePath, relPath, apiPath } = routeMeta;
  const src = fs.readFileSync(filePath, 'utf8');

  const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)]
    .map((m) => m[1]);
  // Fallback for arrow function exports if any
  for (const m of src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g)) {
    if (!methods.includes(m[1])) methods.push(m[1]);
  }

  const queryParams = [...new Set(
    [...src.matchAll(/searchParams\.get\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)].map((m) => m[1])
  )];

  const pathParams = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);

  const bodyFields = [...new Set(
    [...src.matchAll(/\b(?:body|payload|data)\.([A-Za-z0-9_]+)\b/g)]
      .map((m) => m[1])
      .filter((k) => !['length', 'map', 'filter', 'slice', 'trim', 'toString'].includes(k))
  )].slice(0, 18);

  const statuses = [...new Set(
    [...src.matchAll(/\{\s*status\s*:\s*(\d{3})\s*\}/g)].map((m) => Number(m[1]))
  )].sort((a, b) => a - b);
  if (!statuses.includes(200)) statuses.unshift(200);

  // Extract first JSDoc or top comment summary if present
  const jsdocMatch = src.match(/\/\*\*([\s\S]*?)\*\//);
  let docComment = '';
  if (jsdocMatch) {
    docComment = jsdocMatch[1]
      .replace(/^\s*\*\s?/gm, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('@'))
      .join(' ')
      .slice(0, 220);
  }

  // Classify auth requirement
  let auth = 'SessionCookie (facility-isolated)';
  let security = [{ SessionCookieAuth: [] }];

  if (appName === 'medcore-admin') {
    auth = 'MOH Portal (internal/admin DB cluster)';
    security = [{ SessionCookieAuth: [] }];
  } else {
    const isPublic = mwRules.publicPrefixes.some((p) => apiPath.startsWith(p));
    const isAdminPrefix = mwRules.adminOnlyPrefixes.some((p) => apiPath.startsWith(p));
    if (apiPath === '/api/cron/daily-ops') {
      auth = 'CronBearer (CRON_SECRET) OR Admin SessionCookie';
      security = [{ CronBearerAuth: [] }, { SessionCookieAuth: [] }];
    } else if (apiPath.endsWith('/webhook') || apiPath === '/api/whatsapp/triage') {
      auth = 'Public Webhook (HMAC signature / verify token)';
      security = [{ WebhookSignature: [] }];
    } else if (isAdminPrefix) {
      auth = 'Admin SessionCookie (role: hospital_admin|sysadmin|medical_director or clearance >= 4)';
      security = [{ SessionCookieAuth: [] }];
    } else if (isPublic) {
      auth = 'Public (no session cookie required; rate-limited / route-level token checks)';
      security = [];
    }
  }

  // Tag classification
  const seg = apiPath.replace(/^\/api\//, '').split('/')[0] || 'general';
  const TAG_MAP = {
    auth: 'Authentication & Biometrics',
    patients: 'Patients & MPI',
    staff: 'Staff & Admin Provisioning',
    audit: 'Audit & Merkle Anchoring',
    ai: 'Clinical AI & Digitization',
    gemini: 'Clinical AI & Digitization',
    akshia: 'AKSHIA / NHIA Claims',
    akwaremit: 'AkwaRemit Revenue',
    paystack: 'Paystack Payments',
    facility: 'Facility Sync & Streams',
    drafts: 'Form Drafts',
    storage: 'Object Storage (S3)',
    referrals: 'HIE Referrals',
    dhis2: 'DHIS2 & Interoperability',
    fhir: 'DHIS2 & Interoperability',
    orthanc: 'DICOM / PACS',
    care: 'Patient Engagement & Triage',
    whatsapp: 'Patient Engagement & Triage',
    sms: 'Notifications & Events',
    events: 'Notifications & Events',
    cron: 'Scheduled Operations',
    db: 'Platform Health',
    moh: 'MOH Oversight (apps/admin)',
  };
  const tag = TAG_MAP[seg] || 'General';

  return {
    apiPath,
    appName,
    relPath,
    methods: methods.length ? methods : ['GET'],
    pathParams,
    queryParams,
    bodyFields,
    statuses,
    auth,
    security,
    tag,
    summary: CURATED_SUMMARIES[apiPath] || docComment || `${tag} endpoint (${apiPath})`,
  };
}

function buildOpenApiSpec(routes) {
  const paths = {};
  for (const r of routes) {
    const pathKey = r.appName === 'medcore-admin' ? `/admin${r.apiPath}` : r.apiPath;
    paths[pathKey] = {};
    for (const method of r.methods) {
      const mLower = method.toLowerCase();
      let opAuth = r.auth;
      let opSecurity = r.security;
      if (r.apiPath === '/api/staff' && method === 'DELETE') {
        opAuth = 'Admin SessionCookie (clearance >= 4)';
        opSecurity = [{ SessionCookieAuth: [] }];
      }

      const parameters = [
        ...r.pathParams.map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        })),
        ...r.queryParams.map((name) => ({
          name,
          in: 'query',
          required: false,
          schema: { type: 'string' },
        })),
      ];

      const op = {
        tags: [r.tag],
        operationId: `${r.appName}_${mLower}_${r.apiPath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
        summary: `${method} ${r.apiPath} — ${r.summary}`,
        description: `Source: \`${r.relPath}\` · Auth: ${opAuth}`,
        security: opSecurity,
        ...(parameters.length ? { parameters } : {}),
        responses: {},
      };

      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const props = {};
        for (const f of r.bodyFields) {
          props[f] = { type: 'string', description: `Extracted from route body.${f}` };
        }
        op.requestBody = {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
                ...(Object.keys(props).length ? { properties: props } : {}),
              },
            },
          },
        };
      }

      for (const code of r.statuses) {
        op.responses[String(code)] =
          code >= 200 && code < 300
            ? {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/StandardOkResponse' },
                  },
                },
              }
            : {
                description: code === 401 ? 'Unauthorized' : code === 403 ? 'Forbidden / Tenant Isolation Violation' : code === 404 ? 'Not Found' : code === 429 ? 'Rate Limited' : 'Error Response',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                  },
                },
              };
      }

      if (opSecurity.length > 0) {
        op.responses['401'] = op.responses['401'] || {
          description: 'Unauthorized (missing or invalid session cookie / bearer token)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        };
        op.responses['403'] = op.responses['403'] || {
          description: 'Forbidden (insufficient role clearance or cross-facility tenant violation)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        };
      }

      paths[pathKey][mLower] = op;
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'MedCore OS & MOH Command Portal API',
      version: '2.1.0',
      description:
        'Auto-generated OpenAPI 3.1.0 specification derived from Next.js App Router Route Handlers (apps/os and apps/admin) and apps/os/src/middleware.ts.',
    },
    servers: [
      { url: 'http://localhost:3003', description: 'Local MedCore OS (`apps/os`)' },
      { url: 'http://localhost:3004', description: 'Local MOH Admin Portal (`apps/admin` — paths prefixed `/api/moh/*`)' },
    ],
    components: {
      securitySchemes: {
        SessionCookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'medcore_session_token',
          description: 'HMAC-SHA256 signed HttpOnly session cookie issued by /api/auth/session or /api/auth/verify-pin.',
        },
        CronBearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer CRON_SECRET token for /api/cron/daily-ops.',
        },
        AdminSecretHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-secret',
          description: 'Server-to-server ADMIN_API_SECRET / MEDCORE_ADMIN_API_SECRET.',
        },
        WebhookSignature: {
          type: 'apiKey',
          in: 'header',
          name: 'x-paystack-signature / x-akwaremit-signature',
          description: 'Provider HMAC webhook signature verified before processing.',
        },
      },
      schemas: {
        StandardOkResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
          },
          additionalProperties: true,
        },
        ErrorResponse: {
          type: 'object',
          required: ['ok', 'error'],
          properties: {
            ok: { type: 'boolean', enum: [false] },
            error: { type: 'string' },
            message: { type: 'string' },
            retryAfterSeconds: { type: 'integer' },
          },
          additionalProperties: true,
        },
      },
    },
    paths,
  };
}

function buildMarkdown(routes, serverActions, mwRules) {
  const osRoutes = routes.filter((r) => r.appName === 'medcore-os');
  const adminRoutes = routes.filter((r) => r.appName === 'medcore-admin');

  const lines = [
    '# MedCore API Route Handlers & Server Actions Reference',
    '',
    '> **Auto-generated from source** via `npm run docs:openapi` (`scripts/generate-openapi.mjs`).',
    '> Companion machine-readable spec: [`openapi.json`](./openapi.json) (**OpenAPI 3.1.0**).',
    '',
    '## 1. Architecture & Authentication Summary',
    '',
    `- **Route Handlers documented:** **${routes.length}** total (**${osRoutes.length}** in \`apps/os\`, **${adminRoutes.length}** in \`apps/admin\`).`,
    `- **Next.js Server Actions (\`"use server"\`):** **${serverActions.length}** — MedCore OS intentionally executes all mutations through Edge-Middleware-protected \`/api/*\` Route Handlers rather than implicit React Server Actions, ensuring uniform HttpOnly session validation, rate limiting, facility tenant isolation, and audit logging.`,
    '',
    '### Middleware Enforcement (`apps/os/src/middleware.ts`)',
    '',
    '- **Session Cookie Auth:** Every `/api/*` route outside `PUBLIC_API_PREFIXES` requires a valid HMAC-SHA256 signed `medcore_session_token` cookie; unauthenticated calls receive `401 UNAUTHORIZED`.',
    '- **Tenant Isolation:** Verified requests inject `x-medcore-facility-id`, `x-medcore-staff-badge`, `x-medcore-staff-name`, `x-medcore-role-key`, and `x-medcore-clearance`. Non-superadmin callers passing a mismatched `?facilityId=` receive `403`.',
    '- **Privileged Admin Routes (`ADMIN_ONLY_API_PREFIXES` + `DELETE /api/staff`):** Require `roleKey` in `{hospital_admin, sysadmin, medical_director}` OR `clearanceLevel >= 4` (`403 FORBIDDEN` otherwise).',
    '',
    `**Public Prefixes (\`PUBLIC_API_PREFIXES\`):** ${mwRules.publicPrefixes.map((p) => `\`${p}\``).join(', ')}`,
    '',
    `**Admin-Only Prefixes (\`ADMIN_ONLY_API_PREFIXES\`):** ${mwRules.adminOnlyPrefixes.map((p) => `\`${p}\``).join(', ')}`,
    '',
    '## 2. MedCore OS Route Handlers (`apps/os/src/app/api`)',
    '',
    '| Path | Methods | Auth Requirement | Query / Body Params | Status Codes | Purpose |',
    '|------|---------|------------------|---------------------|--------------|---------|',
  ];

  for (const r of osRoutes) {
    const params = [
      ...r.queryParams.map((q) => `?${q}`),
      ...r.bodyFields.slice(0, 6),
    ].join(', ') || '—';
    const codes = r.statuses.join(', ');
    lines.push(
      `| \`${r.apiPath}\` | ${r.methods.join(', ')} | ${r.auth} | \`${params}\` | ${codes} | ${r.summary} |`
    );
  }

  lines.push(
    '',
    '## 3. MOH Oversight Portal Route Handlers (`apps/admin/src/app/api`)',
    '',
    '| Path | Methods | Query / Body Params | Status Codes | Purpose |',
    '|------|---------|---------------------|--------------|---------|'
  );

  for (const r of adminRoutes) {
    const params = [
      ...r.queryParams.map((q) => `?${q}`),
      ...r.bodyFields.slice(0, 6),
    ].join(', ') || '—';
    const codes = r.statuses.join(', ');
    lines.push(
      `| \`${r.apiPath}\` | ${r.methods.join(', ')} | \`${params}\` | ${codes} | ${r.summary} |`
    );
  }

  lines.push(
    '',
    '## 4. Express Hub API (`services/api-server`)',
    '',
    'For the on-premise LAN / WebSocket Clinical Event Hub endpoints (`/api/v1/lab/results`, `/api/v1/cpoe/order-sets/apply`, etc.), see [API_REFERENCE.md](../API_REFERENCE.md).',
    '',
    '## 5. Regenerating This Documentation',
    '',
    'Whenever you add, rename, or update an API route handler or middleware rule, run:',
    '',
    '```bash',
    'npm run docs:openapi',
    '```',
    ''
  );

  return lines.join('\n');
}

function main() {
  const mwRules = parseMiddlewareRules();
  const serverActions = findServerActions();
  const allRoutes = [];

  for (const app of APPS) {
    const found = walkRoutes(app.apiDir, app.apiDir);
    for (const f of found) {
      allRoutes.push(extractRouteMetadata(f, app.name, mwRules));
    }
  }

  allRoutes.sort((a, b) => (a.appName === b.appName ? a.apiPath.localeCompare(b.apiPath) : a.appName.localeCompare(b.appName)));

  const outDir = path.join(REPO_ROOT, 'docs/api');
  fs.mkdirSync(outDir, { recursive: true });

  const spec = buildOpenApiSpec(allRoutes);
  const md = buildMarkdown(allRoutes, serverActions, mwRules);

  fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(spec, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'API_AND_SERVER_ACTIONS.md'), md, 'utf8');

  console.log(
    `[docs:openapi] Generated docs/api/openapi.json and docs/api/API_AND_SERVER_ACTIONS.md (${allRoutes.length} routes, ${serverActions.length} Server Actions).`
  );
}

main();
