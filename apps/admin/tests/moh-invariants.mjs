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
    assert.ok(
      typeof f.latitude === 'number' && f.latitude >= 4.4 && f.latitude <= 5.6,
      `Facility ${f.facilityId} latitude must lie in Akwa Ibom: ${f.latitude}`
    );
    assert.ok(
      typeof f.longitude === 'number' && f.longitude >= 7.3 && f.longitude <= 8.5,
      `Facility ${f.facilityId} longitude must lie in Akwa Ibom: ${f.longitude}`
    );
  }
  assert.equal(Array.isArray(cat.AKWA_IBOM_LGAS), true);
  assert.equal(cat.AKWA_IBOM_LGAS.length, 31, 'All 31 Akwa Ibom LGAs must be defined');
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
      const st = fs.statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else if (st.isFile() && entry.name === 'route.ts') out.push(full);
    }
    return out;
  };
  const routeFiles = walk(apiDir);
  assert.ok(routeFiles.length >= 12, 'Expected all 12+ MOH API routes under src/app/api/moh');
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
    path.join(ADMIN_ROOT, 'src/app/feedback/page.tsx'),
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

test('facility-360-dossier: aggregates all 14 OS domains per hospital with zero PII and wires [facilityId] API route', async () => {
  const dbQueries = [];
  const publishedEvents = [];

  const mockDb = {
    isPostgresConfigured: () => true,
    ensureMohSchema: async () => {},
    safeTableExists: async () => true,
    query: async (sql, params = []) => {
      dbQueries.push({ sql, params });
      if (sql.includes('FROM facilities WHERE id =')) {
        return {
          rows: [
            {
              id: 'IGH-EKT',
              name: 'Immanuel General Hospital, Eket',
              state: 'Akwa Ibom',
              config: {
                hfrCode: '03/06/1/2/1/0001',
                supervisoryBoard: 'AKSHMB',
                medicalDirector: 'Dr. Udoh',
                requireStaffMfa: true,
                acceptsAkshia: true,
              },
            },
          ],
        };
      }
      if (sql.includes('FROM staff WHERE facility_id =')) {
        return {
          rows: [
            {
              badge_id: 'IGH-DOC-01',
              full_name: 'Dr. Ekpo',
              role: 'Medical Officer',
              role_key: 'doctor',
              department: 'OPD',
              status: 'active',
              clearance_level: 4,
            },
          ],
        };
      }
      if (sql.includes('FROM staff_biometrics WHERE facility_id =')) {
        return { rows: [{ badge_id: 'IGH-DOC-01', enrolled_at: '2026-11-22T12:00:00.000Z' }] };
      }
      if (sql.includes('FROM patients WHERE facility_id =') && sql.includes('newRegistrations30d')) {
        return { rows: [{ total: 200, active: 195, recent: 18 }] };
      }
      if (sql.includes('COUNT(*)::int AS total') && sql.includes('FROM patients')) {
        return { rows: [{ total: 200, active: 195, recent: 18 }] };
      }
      if (sql.includes('GROUP BY 1') && sql.includes('FROM patients')) {
        return { rows: sql.includes('date_of_birth') ? [{ band: '18–44 yrs (Adult)', cnt: 120 }] : [{ label: 'Female', cnt: 112 }] };
      }
      if (sql.includes('FROM inpatient_beds WHERE facility_id =')) {
        return { rows: [{ id: 'B1', ward: 'ICU Bay', bed_no: 'ICU-01', status: 'occupied', doctor: 'Dr. Ekpo', diagnosis: 'Patient 08031234567 Pneumonia' }] };
      }
      if (sql.includes('FROM prescriptions WHERE facility_id =')) {
        return { rows: [{ id: 'RX1', drug_name: 'Ceftriaxone 1g', dose: '1g', route: 'IV', status: 'dispensed', prescribed_by: 'Dr. Ekpo' }] };
      }
      if (sql.includes('FROM lab_results WHERE facility_id =')) {
        return { rows: [{ id: 'LAB1', test_name: 'Troponin I', flag: 'CRITICAL', status: 'completed', validated_by: 'MLS Ini' }] };
      }
      if (sql.includes('FROM facility_kv WHERE facility_id =')) {
        return { rows: [{ key: 'medcore_os_theatre_cases_v1', value: [{ id: 'SURG-1' }] }] };
      }
      return { rows: [] };
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

  const dossierRoute = loadTsModule('src/app/api/moh/facilities/[facilityId]/route.ts', {
    'next/server': {
      NextResponse: {
        json: (data, init = {}) => ({ status: init.status || 200, data }),
      },
    },
    '../../../../../lib/mohSyncEngine': engine,
  });

  const getRes = await dossierRoute.GET({}, { params: Promise.resolve({ facilityId: 'igh-ekt' }) });
  assert.equal(getRes.status, 200);
  assert.equal(getRes.data.ok, true);
  const d = getRes.data.dossier;
  assert.equal(d.facility.facilityId, 'IGH-EKT');
  assert.equal(d.governance.hfrCode, '03/06/1/2/1/0001');
  assert.equal(d.security.faceIdEnrolledCount, 1);
  assert.equal(d.security.faceIdCompliancePct, 100);
  assert.equal(d.demographics.totalRegistered, 200);
  assert.equal(d.beds.bedList.length, 1);
  assert.equal(d.clinical.pharmacy.topDrugs[0].drugName, 'Ceftriaxone 1g');
  assert.equal(d.clinical.laboratory.criticalFlags, 1);
  assert.equal(d.clinical.specialtyOperations.theatreCasesCount, 1);
  assert.equal(d.workforce.staffRoster[0].faceIdEnrolled, true);

  const jsonDossier = JSON.stringify(d);
  assert.equal(jsonDossier.includes('08031234567'), false, 'Dossier must redact phone inside bed diagnosis');
  for (const piiKey of ['"patientName"', '"pin_hash"', '"nin"', '"phone"', '"email"', '"address"']) {
    assert.equal(jsonDossier.includes(piiKey), false, `Dossier must never contain PII property ${piiKey}`);
  }

  const postRes = await dossierRoute.POST(
    { json: async () => ({ title: 'Verify Oxygen Plant', body: 'Report backup cylinder level.', level: 'alert', sentBy: 'Commissioner' }) },
    { params: Promise.resolve({ facilityId: 'IGH-EKT' }) }
  );
  assert.equal(postRes.status, 200);
  assert.equal(postRes.data.ok, true);
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO notifications') && q.params[1] === 'IGH-EKT'));
  assert.ok(publishedEvents.some((e) => e.type === 'facility'));

  const shellSrc = fs.readFileSync(path.join(ADMIN_ROOT, 'src/components/moh/MohShell.tsx'), 'utf8');
  assert.ok(shellSrc.includes('MohFacilityDossierView'), 'MohShell must wire MohFacilityDossierView');
  const drawerSrc = fs.readFileSync(path.join(ADMIN_ROOT, 'src/components/moh/MohFacilityDrawer.tsx'), 'utf8');
  assert.ok(drawerSrc.includes('onOpenFullDossier'), 'MohFacilityDrawer must expose Open Full 360° Dossier action');
});

test('moh-6-pillars: GIS, private registry, enforcement seal, HRH LGA/recruitment, supply/cold-chain, IDSR/RMNCH & citizen grievance SLA', async () => {
  const dbQueries = [];
  const publishedEvents = [];
  const grievanceStore = new Map();

  const mockDb = {
    isPostgresConfigured: () => true,
    ensureMohSchema: async () => {},
    safeTableExists: async () => true,
    query: async (sql, params = []) => {
      dbQueries.push({ sql, params });
      if (sql.includes('INSERT INTO moh_citizen_grievances')) {
        grievanceStore.set(params[0], {
          id: params[0],
          tracking_code: params[1],
          facility_id: params[2],
          facility_name: params[3],
          lga: params[4],
          channel: params[5],
          category: params[6],
          rating: params[7],
          summary: params[8],
          anonymous: params[9],
          status: 'open',
          assigned_to: '',
          resolution_notes: '',
          turnaround_hours: null,
          created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
          resolved_at: null,
        });
      }
      if (sql.includes('SELECT created_at FROM moh_citizen_grievances')) {
        const hit = grievanceStore.get(params[0]);
        return { rows: hit ? [{ created_at: hit.created_at }] : [] };
      }
      if (sql.includes('UPDATE moh_citizen_grievances')) {
        const hit = grievanceStore.get(params[0]);
        if (!hit) return { rows: [] };
        const updated = {
          ...hit,
          status: params[1] || hit.status,
          assigned_to: params[2] || hit.assigned_to,
          resolution_notes: params[3] || hit.resolution_notes,
          turnaround_hours: params[4] ?? hit.turnaround_hours,
          resolved_at: params[1] === 'resolved' ? new Date().toISOString() : hit.resolved_at,
        };
        grievanceStore.set(params[0], updated);
        return { rows: [updated] };
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

  // 1. Register Private Clinic
  const priv = await engine.registerPrivateFacilityRecord({
    facilityId: 'PRV-UYO-01',
    facilityName: 'Ibom Premier Private Clinic',
    lga: 'Uyo',
    ownership: 'private',
    licenseNo: 'AKS-PRV-001',
    licenseExpiry: '2026-10-01',
    approvedServices: ['General OPD', 'Ultrasound'],
    registeredBy: 'Director of Medical Services',
  });
  assert.equal(priv.facilityId, 'PRV-UYO-01');
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO moh_private_facilities')));

  // 2. Anti-Quackery Seal updates moh_facility_overrides & notifies OS
  const seal = await engine.createEnforcementActionRecord({
    facilityId: 'PRV-UYO-01',
    facilityName: 'Ibom Premier Private Clinic',
    actionType: 'sealed',
    reason: 'Operating unapproved surgical theatre; caller 08035556666 reported',
    checklist: [{ label: 'Valid Operating License', passed: false }],
    officerName: 'Inspector Bassey',
  });
  assert.equal(seal.status, 'active_seal');
  assert.equal(seal.reason.includes('08035556666'), false, 'Enforcement reason must redact phone PII');
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO moh_enforcement_actions')));
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO moh_facility_overrides') && q.params[3] === 'sealed'));
  assert.ok(dbQueries.some((q) => q.sql.includes('INSERT INTO notifications') && q.params[1] === 'PRV-UYO-01'));
  assert.ok(publishedEvents.some((e) => e.type === 'enforcement'));

  // 3. HRH Recruitment posting
  const rec = await engine.createHrhRecruitmentRecord({
    title: 'Rural Midwife Deployment 2026',
    cadre: 'Midwife',
    facilityId: 'IGH-EKT',
    vacanciesCount: 4,
    postedBy: 'HRH Desk',
  });
  assert.equal(rec.vacanciesCount, 4);
  assert.ok(publishedEvents.some((e) => e.type === 'hrh'));

  // 4. Supply Chain (Stock-Out + Cold-Chain + Faulty Equipment + Renovation)
  const vax = await engine.upsertSupplyEquipmentRecord({
    domain: 'medicine_vaccine',
    facilityId: 'IGH-EKT',
    itemName: 'Pentavalent Vaccine',
    category: 'Vaccine',
    quantity: 0,
    reorderLevel: 50,
    coldChainTempC: 11.4,
  });
  assert.equal(vax.functionalStatus, 'stock_out');
  const eq = await engine.upsertSupplyEquipmentRecord({
    domain: 'equipment',
    facilityId: 'IGH-EKT',
    itemName: 'Oxygen Plant',
    functionalStatus: 'faulty',
    quantity: 1,
  });
  const infra = await engine.upsertSupplyEquipmentRecord({
    domain: 'infrastructure',
    facilityId: 'IGH-EKT',
    itemName: 'Maternity Ward Wing',
    functionalStatus: 'ongoing_renovation',
    quantity: 1,
  });
  assert.ok(publishedEvents.some((e) => e.type === 'supply'));

  // 5. DSNO IDSR Outbreak & RMNCH Service Return
  const dsno = await engine.createIdsrReportRecord({
    reportKind: 'dsno_outbreak',
    facilityId: 'IGH-EKT',
    lga: 'Eket',
    disease: 'Cholera',
    suspectedCases: 5,
    confirmedCases: 2,
    deaths: 0,
    dsnoOfficer: 'DSNO Eket',
  });
  const rmnch = await engine.createIdsrReportRecord({
    reportKind: 'service_utilization',
    facilityId: 'IGH-EKT',
    lga: 'Eket',
    periodLabel: '2026-11',
    ancVisits: 310,
    skilledDeliveries: 95,
    immunizationDoses: 480,
    emergencyReferrals: 14,
    maternalDeaths: 1,
    under5Deaths: 2,
  });
  assert.ok(publishedEvents.some((e) => e.type === 'idsr'));

  // 6. Citizen Grievance PII Redaction + SLA Turnaround Calculation
  const grv = await engine.createCitizenGrievanceRecord({
    facilityId: 'IGH-EKT',
    channel: 'qr',
    category: 'extortion_billing',
    rating: 2,
    summary: 'Unreceipted fee requested; contact complainant@example.com or 08091112233',
  });
  assert.equal(grv.summary.includes('complainant@example.com'), false);
  assert.equal(grv.summary.includes('08091112233'), false);
  const resolvedGrv = await engine.updateCitizenGrievanceRecord(grv.id, {
    status: 'resolved',
    assignedTo: 'Commissioner Desk',
    resolutionNotes: 'Cashier audited and billing compliance restored.',
  });
  assert.equal(resolvedGrv.status, 'resolved');
  assert.ok(typeof resolvedGrv.turnaroundHours === 'number' && resolvedGrv.turnaroundHours >= 1.5);
  assert.ok(publishedEvents.some((e) => e.type === 'grievance'));

  // 7. Full Snapshot Aggregation Across All 6 Pillars
  const snap = engine.aggregateMohSnapshot({
    syncMode: 'live_db',
    syncedAt: '2026-11-24T10:00:00.000Z',
    facilitiesRows: [],
    staffRows: [
      { badge_id: 'DOC-1', facility_id: 'IGH-EKT', full_name: 'Dr. Akpan', role: 'Medical Officer', role_key: 'doctor', department: 'OPD', status: 'active', clearance_level: 4 },
      { badge_id: 'MW-1', facility_id: 'IGH-EKT', full_name: 'Midwife Ini', role: 'Senior Midwife', role_key: 'midwife', department: 'Maternity', status: 'active', clearance_level: 3 },
      { badge_id: 'CHW-1', facility_id: 'IGH-EKT', full_name: 'CHEW Edidiong', role: 'CHEW', role_key: 'chew', department: 'PHC', status: 'active', clearance_level: 2 },
    ],
    patientCounts: [],
    bedRows: [],
    visitRows: [],
    invoiceRows: [],
    accountRequestRows: [],
    orderRows: [],
    prescriptionRows: [],
    labRows: [],
    vitalRows: [],
    auditLedgerRows: [],
    directives: [],
    audits: [],
    transfers: [],
    alerts: [],
    facilityOverrides: {
      'PRV-UYO-01': {
        emergencyStatus: 'normal',
        accreditationStatus: 'suspended',
        operationalStatus: 'sealed',
        licenseNo: 'AKS-PRV-001',
        licenseExpiry: '2026-10-01',
        updatedAt: '2026-11-24T10:00:00.000Z',
      },
    },
    privateFacilities: [priv],
    enforcementActions: [seal],
    hrhRecruitment: [rec],
    supplyEquipment: [vax, eq, infra],
    idsrReports: [dsno, rmnch],
    citizenGrievances: [resolvedGrv],
  });

  assert.equal(snap.facilities.length, 40, '39 official + 1 private clinic must be merged');
  const sealedClinic = snap.facilities.find((f) => f.facilityId === 'PRV-UYO-01');
  assert.equal(sealedClinic?.operationalStatus, 'sealed');
  assert.equal(sealedClinic?.licenseAlert, 'expired');

  assert.equal(snap.hrh.lgaDistribution.length, 31, 'HRH distribution must cover all 31 Akwa Ibom LGAs');
  const eketLga = snap.hrh.lgaDistribution.find((r) => r.lga === 'Eket');
  assert.equal(eketLga?.doctors, 1);
  assert.equal(eketLga?.midwives, 1);
  assert.equal(eketLga?.chews, 1);
  assert.equal(snap.hrh.recruitment.length, 1);

  assert.equal(snap.supplyChain.stockOutCount, 1);
  assert.equal(snap.supplyChain.faultyEquipmentCount, 1);
  assert.equal(snap.supplyChain.activeRenovationsCount, 1);

  assert.equal(snap.idsr.dsnoReports.length, 1);
  assert.equal(snap.idsr.maternalDeathsTotal, 1);
  assert.equal(snap.idsr.under5DeathsTotal, 2);
  assert.equal(snap.idsr.ancVisitsTotal, 310);
  assert.equal(snap.idsr.skilledDeliveriesTotal, 95);

  assert.equal(snap.grievances.resolvedCount, 1);
  assert.ok(snap.grievances.avgTurnaroundHours >= 1.5);

  const jsonSnap = JSON.stringify(snap);
  for (const piiKey of ['"patientName"', '"pin_hash"', '"nin"', '"phone"', '"email"', '"address"']) {
    assert.equal(jsonSnap.includes(piiKey), false, `6-pillar snapshot must never expose PII property ${piiKey}`);
  }
});

test('moh-intelligence-api: generates de-identified 6-pillar executive briefings via Interactions API with fallback', async () => {
  const mockNextServer = {
    NextRequest: class {},
    NextResponse: {
      json: (data, init) => ({ status: init?.status || 200, json: async () => data }),
    },
  };

  const mockSnapshot = {
    syncMode: 'live_db',
    syncedAt: '2026-11-24T22:00:00.000Z',
    districtFilter: 'ALL',
    summary: {
      totalOfficialFacilities: 39,
      connectedFacilities: 12,
      pendingFacilities: 27,
      totalBeds: 640,
      occupiedBeds: 410,
      bedOccupancyPct: 64,
      icuBedsTotal: 28,
      icuBedsOccupied: 19,
      icuOccupancyPct: 68,
      activeStaffCount: 310,
      totalStaffCount: 340,
      registeredPatientsCount: 8420,
      activeOpdVisits: 96,
      totalRevenuePaidNgn: 14500000,
      totalRevenuePendingNgn: 1850000,
      activeDirectivesCount: 2,
      pendingTransfersCount: 1,
      openRemediationsCount: 1,
      activeAlertsCount: 1,
      surgeFacilitiesCount: 0,
    },
    facilities: [],
    regionalRollup: [
      {
        district: 'Uyo',
        totalFacilities: 14,
        connectedFacilities: 6,
        totalBeds: 280,
        occupiedBeds: 190,
        icuTotal: 16,
        icuOccupied: 12,
        staffCount: 160,
        patientsCount: 4100,
        revenuePaidNgn: 8200000,
        activeOpdVisits: 48,
        avgComplianceScore: 86,
      },
    ],
    workforce: { totalActive: 310, byCadre: [], staffDirectory: [] },
    finance: {
      totalCollectedNgn: 14500000,
      totalPendingNgn: 1850000,
      byChannel: { akwaremit: 10200000, paystack: 1200000, cash: 900000, hmo: 2200000, other: 0 },
      openRequestsCount: 4,
      paidReceiptsCount: 412,
      byFacility: [],
    },
    surveillance: {
      activeOpdVisits: 96,
      waitingOpd: 40,
      withProviderOpd: 56,
      completedOpdToday: 180,
      totalLabOrders: 240,
      criticalLabAlerts: 2,
      criticalVitalsAlerts: 1,
      totalPrescriptions: 190,
      pendingPrescriptions: 24,
      clinicalSignals: [],
      alerts: [],
    },
    directives: [],
    audits: [],
    transfers: [],
    auditLedger: { totalEvents: 0, criticalEvents: 0, integrityVerified: true, latestHash: '', events: [] },
    enforcement: [],
    hrh: { lgaDistribution: [], attendanceSummary: { avgAttendancePct: 91, avgAbsenteeismPct: 9, ruralUnderstaffedCount: 4 }, recruitment: [] },
    supplyChain: { items: [], lowStockCount: 2, stockOutCount: 1, faultyEquipmentCount: 1, activeRenovationsCount: 2 },
    idsr: {
      dsnoReports: [],
      serviceMetrics: [],
      maternalDeathsTotal: 0,
      under5DeathsTotal: 1,
      ancVisitsTotal: 840,
      skilledDeliveriesTotal: 220,
      immunizationDosesTotal: 1400,
      emergencyReferralsTotal: 18,
    },
    grievances: { items: [], openCount: 2, investigatingCount: 1, resolvedCount: 5, avgTurnaroundHours: 6.2, avgRating: 4.3 },
  };

  const intelRoute = loadTsModule('src/app/api/moh/intelligence/route.ts', {
    'next/server': mockNextServer,
    '../../../../lib/mohSyncEngine': {
      buildLiveMohSnapshot: async () => mockSnapshot,
      sanitizeMohAuditDetail: (raw) => String(raw || '').replace(/\b\d{11}\b/g, '[REDACTED]'),
    },
  });

  // 1. Offline deterministic briefing fallback (no API key)
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const fallbackRes = await intelRoute.POST({
    json: async () => ({ question: 'Statewide Situation Report' }),
  });
  const fallbackJson = await fallbackRes.json();
  assert.equal(fallbackJson.ok, true);
  assert.equal(fallbackJson.report.aiPowered, false);
  assert.ok(fallbackJson.report.recommendedDirectives.length >= 2);
  assert.ok(fallbackJson.report.followUpQuestions.length >= 2);

  // 2. Mocked Gemini Interactions API live synthesis (verifies current model & v1beta/interactions endpoint)
  process.env.GEMINI_API_KEY = 'test-key-moh';
  const origFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedModel = '';
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    const body = JSON.parse(String(init?.body || '{}'));
    capturedModel = body.model;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'int-moh-1',
        steps: [
          {
            type: 'model_output',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  headline: 'Akwa Ibom Executive Health Advisory',
                  summary: '12 live facilities at 64% bed occupancy with 1 supply stock-out.',
                  metrics: [{ label: 'Bed Occupancy', value: '64%' }],
                  bullets: ['Uyo senatorial district leads at 86% compliance.'],
                  recommendedDirectives: ['Replenish flagged stock-out immediately.'],
                  followUpQuestions: ['Show supply chain gaps by LGA'],
                }),
              },
            ],
          },
        ],
      }),
    };
  };

  try {
    const liveRes = await intelRoute.POST({
      json: async () => ({ question: 'Give me a ministerial executive summary' }),
    });
    const liveJson = await liveRes.json();
    assert.equal(liveJson.ok, true);
    assert.equal(liveJson.report.aiPowered, true);
    assert.equal(liveJson.report.headline, 'Akwa Ibom Executive Health Advisory');
    assert.ok(capturedUrl.includes('/v1beta/interactions'));
    assert.equal(capturedModel, 'gemini-4-hydrogen');
  } finally {
    globalThis.fetch = origFetch;
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    else delete process.env.GEMINI_API_KEY;
  }

  // Ensure no deprecated model references exist in intelligence/route.ts
  const routeSrc = fs.readFileSync(path.join(ADMIN_ROOT, 'src/app/api/moh/intelligence/route.ts'), 'utf8');
  assert.equal(/gemini-(?:2\.5|2\.0|1\.5)/i.test(routeSrc), false);
});

test('mohSyndromicEngine: detects cross-LGA outbreak clusters across neighboring LGAs with zero PII', () => {
  const syn = loadTsModule('src/lib/mohSyndromicEngine.ts');
  const clusters = syn.detectCrossLgaSyndromicAnomalies({
    syncedAt: '2026-11-24T22:00:00.000Z',
    facilities: [
      { facilityId: 'FAC-UYO', facilityName: 'Uyo Clinic', lga: 'Uyo' },
      { facilityId: 'FAC-ITU', facilityName: 'Itu General Hospital', lga: 'Itu' },
    ],
    surveillance: {
      clinicalSignals: [
        { id: 'S1', facilityId: 'FAC-UYO', facilityName: 'Uyo Clinic', summary: 'Severe acute watery diarrhoea cholera suspect' },
        { id: 'S2', facilityId: 'FAC-ITU', facilityName: 'Itu General Hospital', summary: 'Cluster of acute watery diarrhoea and dehydration' },
      ],
    },
    idsr: {
      dsnoReports: [
        { id: 'D1', lga: 'Uyo', facilityName: 'Uyo Clinic', disease: 'Cholera', suspectedCases: 3, notes: 'Stool RDT positive' },
      ],
    },
  });

  assert.ok(clusters.length >= 1, 'Expected Cholera cross-LGA cluster across neighboring Uyo and Itu');
  assert.equal(clusters[0].syndromeKey, 'cholera_awd');
  assert.equal(clusters[0].severity, 'outbreak_surge');
  assert.ok(clusters[0].affectedLgas.includes('Uyo') && clusters[0].affectedLgas.includes('Itu'));
  assert.ok(clusters[0].neighboringRiskLgas.length >= 1);
  assert.equal(JSON.stringify(clusters).includes('"patientName"'), false);

  const heatmap = syn.buildMohOutbreakHeatmap({
    syncedAt: '2026-11-24T22:00:00.000Z',
    facilities: [
      { facilityId: 'FAC-UYO', facilityName: 'Uyo Clinic', lga: 'Uyo', latitude: 5.0377, longitude: 7.9128 },
      { facilityId: 'FAC-EKT', facilityName: 'Eket GH', lga: 'Eket', latitude: 4.6423, longitude: 7.9244 },
    ],
    surveillance: {
      clinicalSignals: [
        { id: 'S1', facilityId: 'FAC-UYO', facilityName: 'Uyo Clinic', summary: 'Suspected Cholera acute watery diarrhoea' },
      ],
    },
    idsr: {
      dsnoReports: [
        { id: 'D2', lga: 'Eket', facilityName: 'Eket GH', disease: 'Lassa Fever', suspectedCases: 2, notes: 'PCR sent' },
      ],
    },
  });
  assert.ok(heatmap.length === 2, 'Expected Uyo Cholera & Eket Lassa hotspots on heatmap');
  assert.equal(heatmap[0].dominantSyndrome, 'lassa_vhf');
  assert.equal(JSON.stringify(heatmap).includes('"patientName"'), false);
});

test('mohSupplyForecastEngine: forecasts seasonal stockouts, near-expiry/cold-chain risks & inter-LGA transfers', () => {
  const sf = loadTsModule('src/lib/mohSupplyForecastEngine.ts');
  const nowMs = Date.parse('2026-07-20T09:00:00Z');
  const report = sf.forecastStatewideDrugDemandAndExpiry(
    {
      supplyChain: {
        items: [
          {
            id: 'SUP-1',
            domain: 'medicine_vaccine',
            facilityId: 'FAC-EKT',
            facilityName: 'Immanuel General Hospital, Eket',
            lga: 'Eket',
            itemName: 'Artemether-Lumefantrine 20/120mg (ACT)',
            category: 'Antimalarial',
            quantity: 18,
            reorderLevel: 60,
            unit: 'packs',
            coldChainTempC: null,
            functionalStatus: 'low_stock',
            notes: 'High OPD demand',
          },
          {
            id: 'SUP-2',
            domain: 'medicine_vaccine',
            facilityId: 'FAC-UYO',
            facilityName: 'Ibom Specialist Hospital, Uyo',
            lga: 'Uyo',
            itemName: 'Artemether-Lumefantrine 20/120mg (ACT)',
            category: 'Antimalarial',
            quantity: 420,
            reorderLevel: 80,
            unit: 'packs',
            coldChainTempC: null,
            functionalStatus: 'in_stock',
            notes: 'Batch expiring 2026-08-10 short-dated',
          },
          {
            id: 'SUP-3',
            domain: 'medicine_vaccine',
            facilityId: 'FAC-ORN',
            facilityName: 'General Hospital, Oron',
            lga: 'Oron',
            itemName: 'Pentavalent Vaccine',
            category: 'Immunization',
            quantity: 200,
            reorderLevel: 50,
            unit: 'doses',
            coldChainTempC: 11.4,
            functionalStatus: 'in_stock',
            notes: 'Solar fridge door seal fault',
          },
        ],
      },
    },
    nowMs
  );

  assert.equal(report.antimalarialMultiplier, 1.45);
  assert.ok(report.stockoutRisks.some((r) => r.facilityId === 'FAC-EKT' && r.therapeuticClass === 'antimalarial'));
  assert.ok(report.nearExpiryRisks.some((n) => n.reason === 'short_dated_expiry'));
  assert.ok(report.nearExpiryRisks.some((n) => n.reason === 'cold_chain_excursion'));
  assert.ok(report.redistributionPairs.some((p) => p.fromLga === 'Uyo' && p.toLga === 'Eket'));
  assert.equal(/\bMath\.random\s*\(/.test(fs.readFileSync(path.join(ADMIN_ROOT, 'src/lib/mohSupplyForecastEngine.ts'), 'utf8')), false);

  const mohMerkle = loadTsModule('src/lib/mohMerkle.ts');
  const root = mohMerkle.computeMohLedgerMerkleRoot([
    mohMerkle.sha256Hex('EVENT-1'),
    mohMerkle.sha256Hex('EVENT-2'),
  ]);
  assert.equal(root.length, 64);
  assert.equal(/\bMath\.random\s*\(/.test(fs.readFileSync(path.join(ADMIN_ROOT, 'src/lib/mohMerkle.ts'), 'utf8')), false);
});



