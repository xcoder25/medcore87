import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const OS_ROOT = path.resolve(import.meta.dirname, '..');

function loadTsModule(relPath, mocks = {}) {
  const absPath = path.join(OS_ROOT, relPath);
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
          return loadTsModule(path.relative(OS_ROOT, resolved + ext), mocks);
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

test('serverSession: signs and verifies session & MFA tokens with tenant binding', async () => {
  const ss = loadTsModule('src/lib/serverSession.ts');
  const mfaToken = await ss.signMfaToken('igh-csh-01', 'igh-ekt', 'email_otp', 300);
  assert.ok(mfaToken.startsWith('mfa.'));

  const okMfa = await ss.verifyMfaToken(mfaToken, 'IGH-CSH-01', 'IGH-EKT');
  assert.ok(okMfa);
  assert.equal(okMfa.method, 'email_otp');

  const wrongBadge = await ss.verifyMfaToken(mfaToken, 'IGH-DOC-02', 'IGH-EKT');
  assert.equal(wrongBadge, null);

  const wrongFacility = await ss.verifyMfaToken(mfaToken, 'IGH-CSH-01', 'OTHER-HOSP');
  assert.equal(wrongFacility, null);

  const sessionTok = await ss.signSessionToken({
    badgeId: 'IGH-CSH-01',
    name: 'Amina Cashier',
    roleKey: 'accountant',
    role: 'Accountant / Cashier',
    facilityId: 'igh-ekt',
    clearanceLevel: 2,
    mfaVerified: true,
  });
  const verified = await ss.verifySessionToken(sessionTok);
  assert.ok(verified);
  assert.equal(verified.facilityId, 'IGH-EKT');
  assert.equal(verified.mfaVerified, true);
  assert.equal(await ss.verifySessionToken(sessionTok + 'tamper'), null);
});

test('notificationEngine: partitions clinical alerts away from Reception and Accounts', () => {
  const ne = loadTsModule('src/lib/notificationEngine.ts', {
    './roleSyncBus': { publishFacilityData: () => {} },
  });

  const clinicalAlert = {
    id: 'N-1',
    facilityId: 'IGH-EKT',
    level: 'critical',
    title: 'NEWS2 Early Warning Score 8',
    body: 'Patient deteriorating in Ward 2',
    module: 'nursing',
    roleHint: 'nurse',
    read: false,
    createdAt: new Date().toISOString(),
  };

  const pendingPayAlert = {
    id: 'N-2',
    facilityId: 'IGH-EKT',
    level: 'important',
    title: 'Incoming Pending Payment · ₦5,000',
    body: 'Patience James (IGH-PT-01) · Folder fee',
    module: 'cashier',
    roleHint: 'accountant',
    read: false,
    createdAt: new Date().toISOString(),
  };

  // Reception never sees NEWS2 / clinical alerts
  assert.equal(ne.notificationVisibleTo(clinicalAlert, { roleKey: 'reception' }), false);

  // Accountant sees pending payment alerts, never nurse/NEWS2 clinical alerts
  assert.equal(ne.notificationVisibleTo(pendingPayAlert, { roleKey: 'accountant' }), true);
  assert.equal(ne.notificationVisibleTo(clinicalAlert, { roleKey: 'accountant' }), false);

  // Nurse sees clinical alerts
  assert.equal(ne.notificationVisibleTo(clinicalAlert, { roleKey: 'nurse' }), true);
});

test('inBasketTaxonomy: routes Accounts / Cashier to dedicated Accounts In-Basket folders', () => {
  const mockIcon = () => null;
  const tax = loadTsModule('src/lib/inBasketTaxonomy.ts', {
    'lucide-react': new Proxy({}, { get: () => mockIcon }),
  });

  const folders = tax.getRoleInBasketFolders('accountant');
  assert.ok(folders.some((f) => f.id === 'pending_payments'));
  assert.ok(folders.some((f) => f.id === 'cleared_receipts'));
  assert.equal(folders.some((f) => f.id === 'critical'), false);

  const meta = tax.getRoleInBasketMeta('cashier');
  assert.equal(meta.scopeBadge, 'ACCOUNTS SCOPE');
});

test('akwaremitServer: verifies HMAC-SHA256 webhook signatures accurately', () => {
  process.env.AKWAREMIT_API_KEY = 'akw_test_key_123456';
  process.env.AKWAREMIT_WEBHOOK_SECRET = 'whsec_test_secret_abc';
  const srv = loadTsModule('src/lib/akwaremitServer.ts');

  const payload = JSON.stringify({ arn: 'ARN-2026-0001', amountNgn: 5000, status: 'paid' });
  const validSig = crypto
    .createHmac('sha256', 'whsec_test_secret_abc')
    .update(payload)
    .digest('hex');

  assert.equal(srv.verifyWebhookSignature(validSig, payload), true);
  assert.equal(srv.verifyWebhookSignature(validSig, payload + ' '), false);
  assert.equal(srv.verifyWebhookSignature('bad-sig', payload), false);
});

test('rateLimit: enforces sliding-window brute-force limits per key', () => {
  const rl = loadTsModule('src/lib/rateLimit.ts');
  const key = `test-otp-${Date.now()}`;
  for (let i = 0; i < 3; i++) {
    const res = rl.checkRateLimit(key, 3, 60_000);
    assert.equal(res.allowed, true);
  }
  const blocked = rl.checkRateLimit(key, 3, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test('hipaaPrivacy: scrubPhiOnLogout removes all PHI keys from localStorage and sessionStorage', () => {
  const lsMap = new Map([
    ['medcore_os_patient_registry_v1', '[{"id":"PT-1"}]'],
    ['medcore_os_patient_context_v1', '{"patientId":"PT-1"}'],
    ['medcore_os_session', '{"badgeId":"DOC-1"}'],
    ['non_phi_theme', 'light'],
  ]);
  const ssMap = new Map([
    ['medcore_focus_patient', 'PT-1'],
    ['medcore_os_patient_context_v1', '{"patientId":"PT-1"}'],
  ]);
  globalThis.window = {
    dispatchEvent: () => {},
  };
  globalThis.localStorage = {
    getItem: (k) => lsMap.get(k) ?? null,
    setItem: (k, v) => lsMap.set(k, String(v)),
    removeItem: (k) => lsMap.delete(k),
  };
  globalThis.sessionStorage = {
    getItem: (k) => ssMap.get(k) ?? null,
    setItem: (k, v) => ssMap.set(k, String(v)),
    removeItem: (k) => ssMap.delete(k),
  };

  const hp = loadTsModule('src/lib/hipaaPrivacy.ts', {
    './auditLogStore': { appendAudit: () => {} },
  });
  hp.scrubPhiOnLogout({ reason: 'inactivity_timeout' });

  assert.equal(lsMap.has('medcore_os_patient_registry_v1'), false);
  assert.equal(lsMap.has('medcore_os_patient_context_v1'), false);
  assert.equal(lsMap.has('medcore_os_session'), false);
  assert.equal(lsMap.get('non_phi_theme'), 'light');
  assert.equal(ssMap.has('medcore_focus_patient'), false);
  assert.equal(ssMap.has('medcore_os_patient_context_v1'), false);
});

test('middleware: allows public auth/lookup routes, blocks unauthenticated PHI, enforces RBAC', async () => {
  const ss = loadTsModule('src/lib/serverSession.ts');
  const nextServerMock = {
    NextResponse: {
      next: (opts) => ({ status: 200, nextOpts: opts }),
      json: (body, init) => ({ status: init?.status || 200, body }),
    },
  };
  const mw = loadTsModule('src/middleware.ts', {
    'next/server': nextServerMock,
  });

  const makeReq = (pathname, method = 'GET', cookieVal = '', query = '') => ({
    method,
    headers: new Headers(),
    cookies: {
      get: (name) => (name === ss.SESSION_COOKIE_NAME && cookieVal ? { value: cookieVal } : undefined),
    },
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams(query),
    },
  });

  // 1) Public auth & staff lookup pass without cookie
  const authRes = await mw.middleware(makeReq('/api/auth/session', 'POST'));
  assert.equal(authRes.status, 200);
  const lookupRes = await mw.middleware(makeReq('/api/staff/lookup', 'GET', '', 'badgeId=IGH-01'));
  assert.equal(lookupRes.status, 200);

  // 2) Unauthenticated PHI request blocked with 401
  const unauthPatients = await mw.middleware(makeReq('/api/patients', 'GET', '', 'facilityId=IGH-EKT'));
  assert.equal(unauthPatients.status, 401);

  // 3) Authenticated clinician can access own facility PHI, blocked from admin-only staff creation
  const docCookie = await ss.signSessionToken({
    badgeId: 'IGH-DOC-01',
    name: 'Dr. Ada',
    roleKey: 'doctor',
    role: 'Doctor',
    facilityId: 'IGH-EKT',
    clearanceLevel: 2,
  });
  const docPatients = await mw.middleware(makeReq('/api/patients', 'GET', docCookie, 'facilityId=IGH-EKT'));
  assert.equal(docPatients.status, 200);
  assert.equal(docPatients.nextOpts.request.headers.get('x-medcore-facility-id'), 'IGH-EKT');

  const docCreateStaff = await mw.middleware(makeReq('/api/staff/create', 'POST', docCookie));
  assert.equal(docCreateStaff.status, 403);

  // 4) Authenticated Hospital Admin passes admin-only staff creation
  const adminCookie = await ss.signSessionToken({
    badgeId: 'IGH-ADM-01',
    name: 'Admin',
    roleKey: 'hospital_admin',
    role: 'Hospital Administrator',
    facilityId: 'IGH-EKT',
    clearanceLevel: 5,
  });
  const adminCreateStaff = await mw.middleware(makeReq('/api/staff/create', 'POST', adminCookie));
  assert.equal(adminCreateStaff.status, 200);
});

test('hipaaPrivacy: stripSecretsDeep & sanitizeStorageString remove all PINs, passwords, tokens, and API secrets', () => {
  const hp = loadTsModule('src/lib/hipaaPrivacy.ts', {
    './auditLogStore': { appendAudit: () => {} },
  });

  const dirty = {
    badgeId: 'IGH-ADM-01',
    name: 'Dr. Ini Akpan',
    pin: '482910',
    password: 'super-secret-password',
    token: 'eyJhbGciOiJIUzI1NiJ9',
    nested: {
      apiKey: 'AIzaSyFakeKey',
      webhookSecret: 'whsec_12345',
      paystackSecretKey: 'sk_live_abc',
      facilityId: 'IGH-EKT',
    },
    rows: [
      { id: '1', pinHash: 'deadbeef', label: 'Safe Label' },
    ],
  };

  const cleanObj = hp.stripSecretsDeep(dirty);
  assert.equal(cleanObj.badgeId, 'IGH-ADM-01');
  assert.equal(cleanObj.name, 'Dr. Ini Akpan');
  assert.equal('pin' in cleanObj, false);
  assert.equal('password' in cleanObj, false);
  assert.equal('token' in cleanObj, false);
  assert.equal('apiKey' in cleanObj.nested, false);
  assert.equal('webhookSecret' in cleanObj.nested, false);
  assert.equal('paystackSecretKey' in cleanObj.nested, false);
  assert.equal(cleanObj.nested.facilityId, 'IGH-EKT');
  assert.equal('pinHash' in cleanObj.rows[0], false);
  assert.equal(cleanObj.rows[0].label, 'Safe Label');

  const serialized = hp.sanitizeStorageString(JSON.stringify(dirty));
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.pin, undefined);
  assert.equal(parsed.password, undefined);
  assert.equal(parsed.token, undefined);
  assert.equal(parsed.nested.apiKey, undefined);
  assert.equal(hp.sanitizeStorageString('IGH-EKT'), 'IGH-EKT');
});

test('postgres: validates ISO dates and projects notifications, vitals, and patients safely', async () => {
  const pg = loadTsModule('src/lib/db/postgres.ts', {
    pg: { Pool: class MockPool {} },
    '@aws-sdk/rds-signer': { Signer: class MockSigner {} },
    '@vercel/functions': { attachDatabasePool: () => {} },
    '@vercel/functions/oidc': { awsCredentialsProvider: () => async () => ({}) },
  });

  // Strict ISO YYYY-MM-DD validation
  assert.equal(pg.toIsoDateOrNull('1994-05-18'), '1994-05-18');
  assert.equal(pg.toIsoDateOrNull('1994-05-18T12:00:00Z'), '1994-05-18');
  assert.equal(pg.toIsoDateOrNull('12/05/1990'), null);
  assert.equal(pg.toIsoDateOrNull('Unknown'), null);
  assert.equal(pg.toIsoDateOrNull('2026-02-31'), null);
  assert.equal(pg.toIsoDateOrNull(''), null);

  const queries = [];
  const mockClient = {
    query: async (sql, params) => {
      queries.push({ sql: String(sql), params });
      return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
    },
    release: () => {},
  };

  // Notifications projection uses valid `meta` column (not nonexistent module/patient_id/payload)
  await pg.projectKeyToRelationalTables(mockClient, 'IGH-EKT', 'medcore_os_notifications_v1', [
    {
      id: 'N-100',
      level: 'critical',
      title: 'Critical Potassium',
      body: 'K+ 6.4 mmol/L',
      module: 'laboratory',
      patientId: 'PT-1',
      roleHint: 'doctor',
      targetStaff: 'Dr. Ada',
      read: false,
    },
  ]);
  const notifQ = queries.find((q) => q.sql.includes('INSERT INTO notifications'));
  assert.ok(notifQ);
  assert.equal(notifQ.sql.includes('meta'), true);
  assert.equal(notifQ.sql.includes('module'), false);
  assert.equal(notifQ.sql.includes('patient_id'), false);
  assert.equal(notifQ.sql.includes('payload'), false);

  // Vitals projection supports medcore_os_nursing_vitals_v1, combines BP, rounds INT pulse/spo2
  await pg.projectKeyToRelationalTables(mockClient, 'IGH-EKT', 'medcore_os_nursing_vitals_v1', [
    {
      id: 'VIT-100',
      patientId: 'PT-1',
      hospitalNumber: 'IGH-PT-001',
      bpSystolic: 132,
      bpDiastolic: 84,
      pulse: 78.6,
      tempC: 37.2,
      spo2: 98.4,
      weightKg: 68.5,
      urgency: 'routine',
      recordedBy: 'Nurse Joy',
    },
  ]);
  const vitalsQ = queries.find((q) => q.sql.includes('INSERT INTO vital_signs'));
  assert.ok(vitalsQ);
  assert.equal(vitalsQ.params[5], '132/84');
  assert.equal(vitalsQ.params[6], 79);
  assert.equal(vitalsQ.params[7], 37.2);
  assert.equal(vitalsQ.params[8], 98);
  assert.equal(vitalsQ.params[9], 68.5);

  // Patient registry projection upserts to patients table with sanitized DOB
  await pg.projectKeyToRelationalTables(mockClient, 'IGH-EKT', 'medcore_os_patient_registry_v1', [
    {
      id: 'PT-99',
      facilityId: 'IGH-EKT',
      hospitalNumber: 'IGH-PT-099',
      firstName: 'Emeka',
      lastName: 'Okafor',
      dob: '15/03/1988',
      sex: 'Male',
      phone: '08012345678',
      nin: '12345678901',
    },
  ]);
  const ptQ = queries.find((q) => q.sql.includes('INSERT INTO patients'));
  assert.ok(ptQ);
  assert.equal(ptQ.params[3], 'Emeka Okafor');
  assert.equal(ptQ.params[5], null);
  assert.equal(JSON.parse(ptQ.params[10]).nin, '12345678901');
});

test('rolePermissionsStore: ambulance module removed from catalog and role defaults', () => {
  const rp = loadTsModule('src/lib/rolePermissionsStore.ts', {
    './facilityContext': { getActiveFacilityId: () => 'IGH-EKT' },
    './roleSyncBus': { publishFacilityData: () => {} },
  });
  assert.equal(rp.MODULE_CATALOG.some((m) => m.key === 'ambulance'), false);
  const permsMap = rp.getRolePermissionsMap();
  assert.equal(permsMap.medical_director.includes('ambulance'), false);
});

test('s3Server: builds private object proxy URLs and tenant-scoped staff headshot keys', () => {
  process.env.MEDCORE_S3_BUCKET = 'medcore-test-bucket';
  process.env.MEDCORE_S3_REGION = 'eu-north-1';
  delete process.env.MEDCORE_S3_CUSTOM_DOMAIN;
  delete process.env.NEXT_PUBLIC_S3_BASE_URL;

  const s3 = loadTsModule('src/lib/s3Server.ts', {
    '@aws-sdk/client-s3': { S3Client: class {}, PutObjectCommand: class {}, GetObjectCommand: class {} },
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => 'https://signed.example' },
    '@vercel/functions/oidc': { awsCredentialsProvider: () => async () => ({}) },
  });

  const key = s3.generateS3ImageKey('staff', 'jpg', 'IGH-EKT');
  assert.ok(key.startsWith('igh-ekt/staff/'));
  assert.ok(key.endsWith('.jpg'));

  const objUrl = s3.buildS3ObjectUrl(key);
  assert.ok(objUrl.startsWith('/api/storage/object?key='));
});

test('authVerifyClient: distinguishes timeouts/network drops/503s from invalid PIN and retries transient drops', async () => {
  const av = loadTsModule('src/lib/authVerifyClient.ts');

  // 1) Offline returns offline, never "Incorrect PIN"
  const offRes = await av.verifyPinOnServer(
    { facilityId: 'IGH-EKT', badgeId: 'IGH-01', pin: '123456' },
    { isOnline: () => false }
  );
  assert.equal(offRes.status, 'offline');
  assert.equal(offRes.verified, false);
  assert.equal(av.formatVerifyFailureMessage(offRes, { mode: 'badge' }).includes('Incorrect'), false);

  // 2) Timeout AbortError returns timeout, never "Incorrect PIN"
  const abortErr = new Error('The operation was aborted');
  abortErr.name = 'AbortError';
  const toRes = await av.verifyPinOnServer(
    { facilityId: 'IGH-EKT', badgeId: 'IGH-01', pin: '123456' },
    {
      isOnline: () => true,
      maxRetries: 0,
      fetchImpl: async () => { throw abortErr; },
    }
  );
  assert.equal(toRes.status, 'timeout');
  assert.equal(av.formatVerifyFailureMessage(toRes, { mode: 'badge' }).toLowerCase().includes('timed out'), true);
  assert.equal(av.formatVerifyFailureMessage(toRes, { mode: 'badge' }).includes('Incorrect'), false);

  // 3) Network drop followed by success auto-recovers on retry
  let calls = 0;
  const retryRes = await av.verifyPinOnServer(
    { facilityId: 'IGH-EKT', badgeId: 'IGH-01', pin: '123456' },
    {
      isOnline: () => true,
      maxRetries: 1,
      retryDelayMs: 5,
      fetchImpl: async () => {
        calls++;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, verified: true, accountFound: true, source: 'postgres' }),
        };
      },
    }
  );
  assert.equal(calls, 2);
  assert.equal(retryRes.status, 'verified');
  assert.equal(retryRes.verified, true);

  // 4) Persistent network drop returns network_error, never "Incorrect PIN"
  const netFail = await av.verifyPinOnServer(
    { facilityId: 'IGH-EKT', email: 'doc@hosp.ng', pin: '123456' },
    {
      isOnline: () => true,
      maxRetries: 1,
      retryDelayMs: 5,
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }
  );
  assert.equal(netFail.status, 'network_error');
  assert.equal(av.formatVerifyFailureMessage(netFail, { mode: 'email' }).includes('Incorrect'), false);

  // 5) HTTP 503 DATABASE_UNAVAILABLE returns server_error, never "Incorrect PIN"
  const dbDown = await av.verifyPinOnServer(
    { facilityId: 'IGH-EKT', badgeId: 'IGH-01', pin: '123456' },
    {
      isOnline: () => true,
      maxRetries: 0,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        json: async () => ({ ok: false, verified: false, transientError: true, error: 'DATABASE_UNAVAILABLE' }),
      }),
    }
  );
  assert.equal(dbDown.status, 'server_error');
  assert.equal(av.formatVerifyFailureMessage(dbDown, { mode: 'badge' }).includes('Incorrect'), false);

  // 6) Genuine wrong PIN returns invalid_pin and displays Incorrect PIN
  const badPin = await av.verifyPinOnServer(
    { facilityId: 'IGH-EKT', badgeId: 'IGH-01', pin: '000000' },
    {
      isOnline: () => true,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, verified: false, accountFound: true, hasPinHash: true }),
      }),
    }
  );
  assert.equal(badPin.status, 'invalid_pin');
  assert.equal(av.formatVerifyFailureMessage(badPin, { mode: 'badge', isAdmin: false }), 'Incorrect Staff ID or PIN.');
});

test('publicHospitalCompliance: enforces public boards, HFR codes, and statutory regulatory councils', () => {
  const phc = loadTsModule('src/lib/publicHospitalCompliance.ts');

  assert.equal(phc.isPublicOwnership('public_state'), true);
  assert.equal(phc.isPublicOwnership('public_federal'), true);
  assert.equal(phc.isPublicOwnership('private'), false);
  assert.equal(phc.isPublicOwnership('mission'), false);

  assert.equal(phc.defaultSupervisoryBoard('public_state', 'primary_health_centre'), 'AKSPHCDA');
  assert.equal(phc.defaultSupervisoryBoard('public_state', 'district_general'), 'AKSHMB');
  assert.equal(phc.defaultSupervisoryBoard('public_federal', 'tertiary_teaching'), 'FMOH');
  assert.equal(phc.defaultSupervisoryBoard('private', 'secondary_specialist'), 'PRIVATE_REG');

  assert.equal(phc.validateHfrCode('123').ok, false);
  assert.equal(phc.validateHfrCode('03/06/1/2/1/0001').ok, true);

  assert.equal(phc.getRequiredCouncilForRole('doctor').council, 'MDCN');
  assert.equal(phc.getRequiredCouncilForRole('doctor').required, true);
  assert.equal(phc.getRequiredCouncilForRole('nurse').council, 'NMCN');
  assert.equal(phc.getRequiredCouncilForRole('midwife').council, 'NMCN');
  assert.equal(phc.getRequiredCouncilForRole('pharmacist').council, 'PCN');
  assert.equal(phc.getRequiredCouncilForRole('lab').council, 'MLSCN');
  assert.equal(phc.getRequiredCouncilForRole('records').council, 'HRORBN');
  assert.equal(phc.getRequiredCouncilForRole('records').required, true);
  assert.equal(phc.getRequiredCouncilForRole('reception').council, 'NONE');
  assert.equal(phc.getRequiredCouncilForRole('reception').required, false);
});

test('facilityCatalogStore: completeness checks HFR, supervisory board, ward & CMD for public hospitals', () => {
  const fc = loadTsModule('src/lib/facilityCatalogStore.ts', {
    './bedBoardStore': { createBeds: () => [], listBeds: () => [], listWards: () => [] },
    './liveActions': { emitLiveAction: () => {} },
    './roleSyncBus': { publishFacilityData: () => {}, FACILITY_KEYS: { facilityCatalog: 'medcore_facility_catalog_v1' } },
    './firebase': { firestoreSubscribeFacility: () => () => {}, firestoreReadFacility: async () => null },
  });

  const blankPublic = fc.defaultCatalog('IGH-EKT', 'Immanuel General Hospital');
  const comp1 = fc.catalogCompleteness(blankPublic);
  assert.equal(comp1.missing.includes('HFR Code'), true);
  assert.equal(comp1.missing.includes('Supervisory Board Circular Ref'), true);
  assert.equal(comp1.missing.includes('Ward'), true);
  assert.equal(comp1.missing.includes('License number'), false);

  const populatedPublic = {
    ...blankPublic,
    lga: 'Eket',
    ward: 'Idua Ward I',
    hfrCode: '03/06/1/2/1/0001',
    boardAuthCircularRef: 'HMB/AKS/EMR/2026/014',
    medicalDirector: 'Dr. Iniobong Udoh',
    targetTotalBeds: 80,
  };
  const comp2 = fc.catalogCompleteness(populatedPublic);
  assert.equal(comp2.missing.length, 0);
  assert.equal(comp2.score, 100);
});

test('postgres: projects public hospital settings into facilities.config cleanly', async () => {
  const pg = loadTsModule('src/lib/db/postgres.ts', {
    pg: { Pool: class MockPool {} },
    '@aws-sdk/rds-signer': { Signer: class MockSigner {} },
    '@vercel/functions': { attachDatabasePool: () => {} },
    '@vercel/functions/oidc': { awsCredentialsProvider: () => async () => ({}) },
  });

  const queries = [];
  const mockClient = {
    query: async (sql, params) => {
      queries.push({ sql: String(sql), params });
      return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
    },
    release: () => {},
  };

  await pg.projectKeyToRelationalTables(mockClient, 'IGH-EKT', 'medcore_os_admin_settings_v1', {
    facilityId: 'IGH-EKT',
    displayName: 'Immanuel General Hospital, Eket',
    ownership: 'public_state',
    hfrCode: '03/06/1/2/1/0001',
    supervisoryBoard: 'AKSHMB',
    boardAuthCircularRef: 'HMB/AKS/EMR/2026/014',
    akshiaProviderId: 'AKSHIA-PUB-104',
    medicalDirector: 'Dr. Iniobong Udoh',
    state: 'Akwa Ibom',
    lga: 'Eket',
    ward: 'Idua Ward I',
    gpsLatitude: '4.6423',
    gpsLongitude: '7.9265',
  });

  const facQ = queries.find((q) => q.sql.includes('INSERT INTO facilities') && q.sql.includes('config'));
  assert.ok(facQ);
  assert.equal(facQ.params[0], 'IGH-EKT');
  assert.equal(facQ.params[1], 'Immanuel General Hospital, Eket');
  assert.equal(facQ.params[2], 'Akwa Ibom');
  const cfg = JSON.parse(facQ.params[3]);
  assert.equal(cfg.hfrCode, '03/06/1/2/1/0001');
  assert.equal(cfg.supervisoryBoard, 'AKSHMB');
  assert.equal(cfg.akshiaProviderId, 'AKSHIA-PUB-104');
  assert.equal(cfg.ward, 'Idua Ward I');
  assert.equal(cfg.gpsLatitude, '4.6423');
  assert.equal(cfg.gpsLongitude, '7.9265');
});

test('dhis2Export: uses configured HFR code as orgUnit and includes Akwa Ibom facility metadata', () => {
  const lsMap = new Map([
    [
      'medcore_os_admin_settings_v1:IGH-EKT',
      JSON.stringify({
        facilityId: 'IGH-EKT',
        displayName: 'Immanuel General Hospital, Eket',
        hfrCode: '03/06/1/2/1/0001',
        supervisoryBoard: 'AKSHMB',
        state: 'Akwa Ibom',
        lga: 'Eket',
        ward: 'Idua Ward I',
        gpsLatitude: '4.6423',
        gpsLongitude: '7.9265',
      }),
    ],
  ]);
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.localStorage = {
    getItem: (k) => lsMap.get(k) ?? null,
    setItem: (k, v) => lsMap.set(k, String(v)),
    removeItem: (k) => lsMap.delete(k),
  };

  const dhis2 = loadTsModule('src/lib/dhis2Export.ts', {
    './receptionOpsStore': { todayVisits: () => [], dayStats: () => ({ checkIns: 0, waiting: 0, appointments: 0, collected: 0 }) },
    './patientRegistryStore': { listPatients: () => [] },
    './clinicalEventBus': { listOrders: () => [] },
    './bedBoardStore': { listBeds: () => [], listBedAudit: () => [] },
    './dhis2TrackerBedBridge': { readTrackerStore: () => [] },
    './durableOutbox': { enqueueFacilitySync: () => {} },
    './adminRealtimeStore': { getActiveFacilityId: () => 'IGH-EKT' },
    './roleSyncBus': { publishFacilityData: () => {} },
  });

  const payload = dhis2.buildDhis2Aggregate('IGH-EKT');
  assert.equal(payload.orgUnit, '03/06/1/2/1/0001');
  assert.equal(payload.meta.hfrCode, '03/06/1/2/1/0001');
  assert.equal(payload.meta.supervisoryBoard, 'AKSHMB');
  assert.equal(payload.meta.ward, 'Idua Ward I');
});

test('ui-copy: hides backend infrastructure vendor names from user-facing components and client messages', () => {
  const filesToCheck = [
    'src/components/rbac/AccessControl.tsx',
    'src/components/admin/AdminSettings.tsx',
    'src/components/dashboards/ReceptionWorkspace.tsx',
    'src/components/onboarding/HospitalOnboardingWizard.tsx',
    'src/components/auth/StaffEmailOtpModal.tsx',
    'src/components/compliance/ComplianceAuditLogs.tsx',
    'src/components/records/EditPatientModal.tsx',
    'src/components/interop/DeviceGatewaySettings.tsx',
    'src/lib/authVerifyClient.ts',
    'src/lib/storageClient.ts',
    'src/lib/disasterRecoveryStore.ts',
    'src/lib/geminiClient.ts',
  ];

  const forbidden = [
    'Stored in AWS S3',
    'to AWS S3',
    'in S3)',
    'S3 upload failed',
    'Headshot S3 upload',
    'Aurora PostgreSQL',
    'Aurora Postgres',
    'Postgres RLS',
    'Delivered via Resend',
    'RESEND_API_KEY',
    'FIREBASE_WEB_API_KEY',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'GEMINI_API_KEY is not set',
    'not Vercel directly',
    'AWS/Postgres, Vercel',
    'confirm Firestore catches up',
  ];

  for (const rel of filesToCheck) {
    const raw = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    // Ignore JS/TS/JSX comments since comments are never rendered to end users
    const content = raw.replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
    for (const phrase of forbidden) {
      assert.equal(
        content.includes(phrase),
        false,
        `${rel} must not expose backend phrase "${phrase}" to users`
      );
    }
  }
});
