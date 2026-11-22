import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ADMIN_ROOT = path.resolve(import.meta.dirname, '..');

function loadTsModule(relPath, mocks = {}) {
  const absPath = path.join(ADMIN_ROOT, relPath);
  const src = fs.readFileSync(absPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: absPath,
  }).outputText;

  const mod = { exports: {} };
  const localRequire = (spec) => {
    if (mocks[spec]) return mocks[spec];
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const resolved = path.resolve(path.dirname(absPath), spec);
      for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
        if (fs.existsSync(resolved + ext)) {
          return loadTsModule(path.relative(ADMIN_ROOT, resolved + ext), mocks);
        }
      }
    }
    return require(spec);
  };

  const fn = new vm.Script(
    `(function(exports, require, module, __filename, __dirname) {\n${transpiled}\n})`,
    { filename: absPath }
  ).runInThisContext();
  fn(mod.exports, localRequire, mod, absPath, path.dirname(absPath));
  return mod.exports;
}

test('auth-and-layout: preserves MOHAuthScreen, MOHSplashScreen, admin.css & wires persistent lock', () => {
  assert.ok(fs.existsSync(path.join(ADMIN_ROOT, 'src/components/MOHAuthScreen.tsx')));
  assert.ok(fs.existsSync(path.join(ADMIN_ROOT, 'src/components/MOHSplashScreen.tsx')));
  assert.ok(fs.existsSync(path.join(ADMIN_ROOT, 'src/styles/admin.css')));
  assert.ok(fs.existsSync(path.join(ADMIN_ROOT, 'src/styles/moh-interior.css')));

  const layoutSrc = fs.readFileSync(path.join(ADMIN_ROOT, 'src/app/layout.tsx'), 'utf8');
  assert.ok(layoutSrc.includes("../styles/admin.css"), 'layout.tsx must keep admin.css for Splash/Auth');
  assert.ok(layoutSrc.includes("../styles/moh-interior.css"), 'layout.tsx must import moh-interior.css');
  assert.equal(layoutSrc.includes('command-centre.css'), false, 'layout.tsx should drop legacy command-centre.css');
  assert.equal(layoutSrc.includes('hospital-admin.css'), false, 'layout.tsx should drop legacy hospital-admin.css');

  const pageSrc = fs.readFileSync(path.join(ADMIN_ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('MOHSplashScreen'));
  assert.ok(pageSrc.includes('MOHAuthScreen'));
  assert.ok(pageSrc.includes('MohShell'));
  assert.ok(pageSrc.includes("medcore_moh_session"));
  assert.ok(pageSrc.includes("medcore_moh_terminal_locked_v1"));
});

test('facilities-catalog: enforces 39 canonical Akwa Ibom facilities mapped to 3 Senatorial Districts', () => {
  const cat = loadTsModule('src/data/akwaIbomFacilities.ts');
  const list = cat.OFFICIAL_AKWA_IBOM_FACILITIES;
  assert.equal(Array.isArray(list), true);
  assert.equal(list.length, 39);

  const ids = new Set(list.map((f) => f.facilityId));
  assert.equal(ids.size, 39, 'All 39 official facility IDs must be unique');
  for (const requiredId of ['IGH-EKT', 'UUTH-UYO', 'GH-IKE', 'GH-UAB', 'PHC-UYO']) {
    assert.ok(ids.has(requiredId), `Canonical facility ${requiredId} must be present`);
  }

  const validDistricts = new Set(['Uyo', 'Ikot Ekpene', 'Eket']);
  for (const f of list) {
    assert.ok(validDistricts.has(f.district), `Facility ${f.facilityId} district must be valid: ${f.district}`);
  }
});

test('mohSyncEngine: de-identifies PII, aggregates OS telemetry accurately & syncs oversight writes to OS notifications', async () => {
  const dbQueries = [];
  const publishedEvents = [];

  const mockDb = {
    isPostgresConfigured: () => true,
    ensureMohSchema: async () => {},
    safeTableExists: async () => true,
    query: async (sql, params = []) => {
      dbQueries.push({ sql, params });
      if (sql.includes('SELECT id FROM facilities')) {
        return { rows: [{ id: 'IGH-EKT' }, { id: 'GH-IKE' }] };
      }
      return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
    },
  };

  const mockBroker = {
    publishMohEvent: (type, payload) => {
      publishedEvents.push({ type, payload });
    },
  };

  const engine = loadTsModule('src/lib/mohSyncEngine.ts', {
    './db/postgres': mockDb,
    './mohEventBroker': mockBroker,
  });

  // 1. Safe Harbor PII redaction on audit details
  const rawDetail =
    'Updated chart for Arit Udoh (+2348031234567 / 08091234567, email arit@example.com, NIN 12345678901) at OPD';
  const cleanDetail = engine.sanitizeMohAuditDetail(rawDetail);
  assert.equal(cleanDetail.includes('8031234567'), false);
  assert.equal(cleanDetail.includes('08091234567'), false);
  assert.equal(cleanDetail.includes('arit@example.com'), false);
  assert.equal(cleanDetail.includes('12345678901'), false);
  assert.ok(cleanDetail.includes('[REDACTED]'));
  assert.ok(cleanDetail.includes('at OPD'));

  // 2. De-identified aggregation across OS tables
  const snap = engine.aggregateMohSnapshot({
    syncMode: 'live_db',
    syncedAt: '2026-11-22T20:00:00.000Z',
    facilitiesRows: [
      {
        id: 'IGH-EKT',
        name: 'Immanuel General Hospital, Eket',
        state: 'Akwa Ibom',
        config: { supervisoryBoard: 'AKSHMB', hfrCode: '03/06/1/2/1/0001', medicalDirector: 'Dr. Udoh' },
      },
    ],
    staffRows: [
      { badge_id: 'IGH-DOC-01', facility_id: 'IGH-EKT', full_name: 'Dr. Ekpo', role: 'Medical Officer', role_key: 'doctor', department: 'General OPD', status: 'active', clearance_level: 4 },
      { badge_id: 'IGH-RN-02', facility_id: 'IGH-EKT', full_name: 'Matron Ini', role: 'Nurse', role_key: 'nurse', department: 'ICU', status: 'active', clearance_level: 3 },
    ],
    patientCounts: [{ facility_id: 'IGH-EKT', cnt: 142 }],
    bedRows: [
      { facility_id: 'IGH-EKT', ward: 'General Ward A', status: 'occupied' },
      { facility_id: 'IGH-EKT', ward: 'General Ward A', status: 'available' },
      { facility_id: 'IGH-EKT', ward: 'ICU Bay', status: 'occupied' },
    ],
    visitRows: [
      { facility_id: 'IGH-EKT', status: 'waiting' },
      { facility_id: 'IGH-EKT', status: 'with_provider' },
    ],
    invoiceRows: [
      { facility_id: 'IGH-EKT', source: 'OPD', amount_ngn: 25000, status: 'paid', paid_via: 'akwaremit' },
      { facility_id: 'IGH-EKT', source: 'Pharmacy', amount_ngn: 12000, status: 'pending', paid_via: 'cash' },
    ],
    accountRequestRows: [{ facility_id: 'IGH-EKT', amount_ngn: 50000, status: 'pending', paid_via: 'hmo' }],
    orderRows: [{ facility_id: 'IGH-EKT', order_type: 'lab', status: 'pending', priority: 'stat' }],
    prescriptionRows: [{ facility_id: 'IGH-EKT', status: 'pending' }],
    labRows: [{ id: 'LAB-1', facility_id: 'IGH-EKT', test_name: 'Lassa PCR', flag: 'CRITICAL', status: 'completed', created_at: '2026-11-22T19:00:00.000Z' }],
    vitalRows: [],
    auditLedgerRows: [
      {
        id: 'AUD-LED-1',
        facility_id: 'IGH-EKT',
        actor: 'Dr. Ekpo',
        actor_badge: 'IGH-DOC-01',
        category: 'clinical',
        severity: 'critical',
        action: 'CRITICAL_LAB_FLAG',
        entity: 'lab',
        entity_id: 'LAB-1',
        detail: 'Patient phone 08031112222 notified',
        row_hash: 'abcdef1234567890',
        created_at: '2026-11-22T19:15:00.000Z',
      },
    ],
    directives: [],
    audits: [],
    transfers: [],
    alerts: [],
    facilityOverrides: {},
  });

  assert.equal(snap.summary.totalOfficialFacilities, 39);
  assert.equal(snap.summary.totalBeds, 3);
  assert.equal(snap.summary.occupiedBeds, 2);
  assert.equal(snap.summary.icuBedsTotal, 1);
  assert.equal(snap.summary.icuBedsOccupied, 1);
  assert.equal(snap.summary.activeStaffCount, 2);
  assert.equal(snap.summary.registeredPatientsCount, 142);
  assert.equal(snap.summary.activeOpdVisits, 2);
  assert.equal(snap.finance.byChannel.akwaremit, 25000);
  assert.equal(snap.finance.totalPendingNgn, 62000);
  assert.equal(snap.surveillance.criticalLabAlerts, 1);

  const jsonSnap = JSON.stringify(snap);
  assert.equal(jsonSnap.includes('08031112222'), false, 'Snapshot must redact PII inside audit details');
  for (const forbiddenKey of ['"patientName"', '"pin_hash"', '"nin"', '"phone"', '"email"', '"address"']) {
    assert.equal(jsonSnap.includes(forbiddenKey), false, `Snapshot must never expose PII field ${forbiddenKey}`);
  }

  // 3. Mutations write to MOH tables and fan out OS notifications
  await engine.createMohDirectiveRecord({
    title: 'Daily Surge Bed Reporting',
    summary: 'Submit morning bed census by 08:00 WAT.',
    severity: 'mandatory_order',
    targetDistricts: ['Eket'],
    issuedBy: 'Hon. Commissioner for Health',
  });
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO moh_directives')));
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO notifications') && q.params[1] === 'IGH-EKT'));
  assert.ok(publishedEvents.some((e) => e.type === 'directive'));

  await engine.createMohAuditRecord({
    facilityId: 'GH-IKE',
    facilityName: 'General Hospital, Ikot Ekpene',
    auditDate: '2026-12-01',
    auditorName: 'Inspector Udo',
    category: 'infection_control',
  });
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO moh_audits')));
  assert.ok(publishedEvents.some((e) => e.type === 'audit'));

  await engine.updateMohFacilityOverrideRecord({
    facilityId: 'IGH-EKT',
    emergencyStatus: 'surge_code_red',
    notes: 'Maternity surge redirection active',
    updatedBy: 'Commissioner',
  });
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO moh_facility_overrides')));
  assert.ok(publishedEvents.some((e) => e.type === 'facility'));
});

test('api-routes: enforces valid Next.js 15 Route exports across all apps/admin API routes', () => {
  const ALLOWED_ROUTE_EXPORTS = new Set([
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
    'runtime', 'dynamic', 'revalidate', 'maxDuration', 'preferredRegion', 'fetchCache', 'dynamicParams',
  ]);
  const apiDir = path.join(ADMIN_ROOT, 'src/app/api');
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.isFile() && entry.name === 'route.ts') out.push(full);
    }
    return out;
  };
  const routeFiles = walk(apiDir);
  assert.ok(routeFiles.length >= 7, 'Expected all 7 MOH API routes under src/app/api/moh');
  for (const rf of routeFiles) {
    const src = fs.readFileSync(rf, 'utf8');
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) {
      assert.ok(ALLOWED_ROUTE_EXPORTS.has(m[1]), `Invalid Route export "${m[1]}" in ${path.relative(ADMIN_ROOT, rf)}`);
    }
  }
});

test('ui-hygiene: enforces calm UX, zero Math.random in interior UI, no legacy mock names, no seconds clock & no vendor leaks', () => {
  const mohDir = path.join(ADMIN_ROOT, 'src/components/moh');
  const files = [
    path.join(ADMIN_ROOT, 'src/lib/mohRealtime.ts'),
    path.join(ADMIN_ROOT, 'src/app/page.tsx'),
    ...fs.readdirSync(mohDir).filter((f) => f.endsWith('.tsx')).map((f) => path.join(mohDir, f)),
  ];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ADMIN_ROOT, file);
    assert.equal(/\bMath\.random\s*\(/.test(src), false, `${rel} must not contain Math.random() simulation`);
    assert.equal(
      /St\. Jude Metropolitan|Lagos University Teaching Hospital|\bLUTH\b|University College Hospital|\bUCH\b|National Referral Hospital/i.test(src),
      false,
      `${rel} must not contain legacy non-Akwa-Ibom mock hospitals`
    );
    assert.equal(
      /second:\s*['"]2-digit['"]/.test(src),
      false,
      `${rel} must not render a distracting ticking seconds clock`
    );
    const noComments = src.replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
    assert.equal(
      /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres|\bVercel\b|\bFirebase\b/i.test(noComments),
      false,
      `${rel} must remain strictly vendor-neutral`
    );
  }

  const shellSrc = fs.readFileSync(path.join(mohDir, 'MohShell.tsx'), 'utf8');
  assert.ok(shellSrc.includes('Back to Overview'), 'MohShell must provide in-page Back to Overview navigation');

  const ledgerSrc = fs.readFileSync(path.join(mohDir, 'MohAuditLedgerView.tsx'), 'utf8');
  assert.ok(ledgerSrc.includes('Safe Harbor'), 'MohAuditLedgerView must document Safe Harbor de-identification');
});
