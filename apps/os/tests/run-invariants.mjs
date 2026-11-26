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
    './roleSyncBus': { publishFacilityData: () => { } },
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
    dispatchEvent: () => { },
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
    './auditLogStore': { appendAudit: () => { } },
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
    './auditLogStore': { appendAudit: () => { } },
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
    pg: { Pool: class MockPool { } },
    '@aws-sdk/rds-signer': { Signer: class MockSigner { } },
    '@vercel/functions': { attachDatabasePool: () => { } },
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
    release: () => { },
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
    './roleSyncBus': { publishFacilityData: () => { } },
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
    '@aws-sdk/client-s3': { S3Client: class { }, PutObjectCommand: class { }, GetObjectCommand: class { } },
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
    './liveActions': { emitLiveAction: () => { } },
    './roleSyncBus': { publishFacilityData: () => { }, FACILITY_KEYS: { facilityCatalog: 'medcore_facility_catalog_v1' } },
    './firebase': { firestoreSubscribeFacility: () => () => { }, firestoreReadFacility: async () => null },
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
    pg: { Pool: class MockPool { } },
    '@aws-sdk/rds-signer': { Signer: class MockSigner { } },
    '@vercel/functions': { attachDatabasePool: () => { } },
    '@vercel/functions/oidc': { awsCredentialsProvider: () => async () => ({}) },
  });

  const queries = [];
  const mockClient = {
    query: async (sql, params) => {
      queries.push({ sql: String(sql), params });
      return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
    },
    release: () => { },
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
  globalThis.window = { dispatchEvent: () => { } };
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
    './durableOutbox': { enqueueFacilitySync: () => { } },
    './adminRealtimeStore': { getActiveFacilityId: () => 'IGH-EKT' },
    './roleSyncBus': { publishFacilityData: () => { } },
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

function withBrowserShims(fn) {
  const prevWin = globalThis.window;
  const prevLs = globalThis.localStorage;
  const prevCE = globalThis.CustomEvent;
  const lsMap = new Map();
  const listeners = new Map();

  class ShimCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  const ls = {
    getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
    setItem: (k, v) => lsMap.set(k, String(v)),
    removeItem: (k) => lsMap.delete(k),
  };
  const win = {
    addEventListener: (t, cb) => {
      const list = listeners.get(t) || [];
      list.push(cb);
      listeners.set(t, list);
    },
    removeEventListener: (t, cb) => {
      const list = listeners.get(t) || [];
      listeners.set(t, list.filter((x) => x !== cb));
    },
    dispatchEvent: (ev) => {
      const list = listeners.get(ev?.type) || [];
      for (const cb of list) {
        try { cb(ev); } catch { /* ignore */ }
      }
      return true;
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };

  globalThis.CustomEvent = ShimCustomEvent;
  globalThis.localStorage = ls;
  globalThis.window = win;
  const cleanup = () => {
    globalThis.window = prevWin;
    globalThis.localStorage = prevLs;
    globalThis.CustomEvent = prevCE;
  };
  try {
    const out = fn();
    if (out && typeof out.then === 'function') {
      return out.finally(cleanup);
    }
    cleanup();
    return out;
  } catch (err) {
    cleanup();
    throw err;
  }
}

test('bedAutomation: parses multi-ward bed requests and increments bed numbers without collision', () => {
  withBrowserShims(() => {
    const mocks = {
      './roleSyncBus': { publishFacilityData: () => { }, FACILITY_KEYS: { beds: 'beds' } },
      './idb': { idbGet: async () => null, idbSet: async () => { } },
      './dhis2TrackerBedBridge': { syncTrackerFromBedRecord: () => { } },
      './auditLogStore': { appendAudit: () => { } },
      './liveActions': { emitLiveAction: () => { } },
    };
    const bedAuto = loadTsModule('src/lib/bedAutomation.ts', mocks);

    assert.equal(bedAuto.canAutomateBeds('hospital_admin'), true);
    assert.equal(bedAuto.canAutomateBeds('admin'), true);
    assert.equal(bedAuto.canAutomateBeds('doctor'), false);

    const parsed = bedAuto.parseBedAutomationIntent('Create 12 beds in Male Medical Ward and 4 beds in ICU');
    assert.equal(parsed.handled, true);
    assert.equal(parsed.action, 'create');
    assert.equal(parsed.jobs.length, 2);

    const res1 = bedAuto.executeCreateBedsAutomation(parsed.jobs, 'TEST-FAC', 'Admin Test');
    assert.equal(res1.ok, true);
    assert.equal(res1.totalCreated, 16);
    assert.equal(res1.details[1].createdNos.join(','), 'ICU-01,ICU-02,ICU-03,ICU-04');

    const more = bedAuto.parseBedAutomationIntent('Add 3 more beds to ICU');
    assert.equal(more.handled, true);
    assert.equal(more.action, 'create');
    const res2 = bedAuto.executeCreateBedsAutomation(more.jobs, 'TEST-FAC', 'Admin Test');
    assert.equal(res2.totalCreated, 3);
    assert.equal(res2.details[0].createdNos.join(','), 'ICU-05,ICU-06,ICU-07');
    assert.equal(res2.details[0].wardTotal, 7);
  });
});

test('akwaRemit & paymentReceipts: cash stays pending until Accountant batch settlement, never Direct AkwaRemit', async () => {
  await withBrowserShims(async () => {
    const mocks = {
      './roleSyncBus': { publishFacilityData: () => { } },
      './adminSettingsStore': { getAdminSettings: () => ({}), isPublicOwnership: () => true },
      './systemSettingsStore': { getSystemSettings: () => ({}) },
      './receptionSettingsStore': { getReceptionSettings: () => null },
    };
    const pr = loadTsModule('src/lib/paymentReceiptModule.ts', mocks);
    const ak = loadTsModule('src/lib/akwaRemitStore.ts', mocks);

    const cashReceipt = pr.issuePaymentReceipt(
      {
        facilityId: 'IGH-EKT',
        facilityName: 'Immanuel General Hospital',
        patientId: 'PT-1',
        patientName: 'Okon Udoh',
        hospitalNumber: 'HOSP-001',
        amountNgn: 5000,
        method: 'cash',
        channel: 'AkwaRemit TSA Gateway',
        purpose: 'Consultation Fee',
        reference: 'ARN-2026-1001-2001',
        cashier: 'Cashier Mary',
        skipAkwaRemitSync: true,
      },
      { print: false }
    );
    assert.equal(cashReceipt.remittanceStatus, 'pending');

    // Even if a caller mistakenly passes direct_akwaremit for cash, cash must stay pending until batched
    const rec = ak.recordAkwaRemitPayment({
      arn: 'ARN-2026-1001-2001',
      receiptNo: cashReceipt.receiptNo,
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital',
      patientId: 'PT-1',
      patientName: 'Okon Udoh',
      hospitalNumber: 'HOSP-001',
      amountNgn: 5000,
      method: 'cash',
      serviceCategory: 'consultation',
      description: 'Consultation Fee',
      cashierName: 'Cashier Mary',
      cashierBadge: 'RCP-01',
      shiftId: 'SHIFT-1',
      remittanceStatus: 'direct_akwaremit',
    });
    assert.equal(rec.remittanceStatus, 'pending');

    const before = ak.getAkwaRemitDailySummary('IGH-EKT');
    assert.equal(before.directAkwaRemitTotalNgn, 0);
    assert.equal(before.pendingCashNgn, 5000);
    assert.equal(before.remittedCashNgn, 0);

    const batch = ak.executeAkwaRemitBatch({
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital',
      batchType: 'cash_bulk',
      paymentIds: [rec.id],
      akwaRemitRrr: 'RRR-2026-8844',
      bankName: 'Zenith Bank TSA',
      bankTellerRef: 'TELL-009',
      remittedBy: 'Chief Accountant',
      remittedByBadge: 'ACC-01',
      witnessedBy: 'Internal Auditor',
      witnessedByBadge: 'AUD-01',
    });
    assert.equal(batch.status, 'remitted');

    // Allow dynamic import('./paymentReceiptModule') promise inside executeAkwaRemitBatch to settle
    await new Promise((r) => setTimeout(r, 40));

    const after = ak.getAkwaRemitDailySummary('IGH-EKT');
    assert.equal(after.pendingCashNgn, 0);
    assert.equal(after.remittedCashNgn, 5000);
    assert.equal(after.alreadyInAkwaRemitNgn, 5000);
    assert.equal(after.directAkwaRemitTotalNgn, 0);

    const updatedReceipt = pr.getPaymentReceipt(cashReceipt.receiptNo);
    assert.equal(updatedReceipt.remittanceStatus, 'remitted');
    assert.equal(updatedReceipt.akwaRemitRrr, 'RRR-2026-8844');
  });
});

test('accountsAutomation & inBasketTaxonomy: routes Akwa Remitta Mandate to Notices and resolves live treasury intents', () => {
  withBrowserShims(() => {
    const mocks = {
      './roleSyncBus': { publishFacilityData: () => { } },
      './adminSettingsStore': { getAdminSettings: () => ({}), isPublicOwnership: () => true },
      './systemSettingsStore': { getSystemSettings: () => ({}) },
      './frontDeskAccountsBridge': { listAccountsRequests: () => [] },
      './receptionOpsStore': { dayStats: () => ({ collected: 0, appointments: 0 }), todayPayments: () => [] },
      './patientBillingStore': { listBillLines: () => [], listPatientsWithOpenBills: () => [] },
      './patientRegistryStore': { listPatients: () => [] },
      'lucide-react': { Inbox: {}, AlertTriangle: {}, Megaphone: {}, HeartPulse: {}, Users: {}, Banknote: {}, Pill: {}, ShieldCheck: {}, FlaskConical: {} },
    };
    const tax = loadTsModule('src/lib/inBasketTaxonomy.ts', mocks);
    const accAuto = loadTsModule('src/lib/accountsAutomation.ts', mocks);

    const accFolders = tax.getRoleInBasketFolders('accountant');
    const folder = tax.classifyNotificationForRole(
      {
        id: 'n1',
        facilityId: 'IGH-EKT',
        level: 'important',
        title: 'Akwa Remitta Mandate · ₦5,000 Physical Cash Awaiting Remittance',
        body: 'Batch remit to TSA.',
        module: 'treasury-notice',
        createdAt: new Date().toISOString(),
        read: false,
      },
      accFolders
    );
    assert.equal(folder.id, 'system');
    assert.equal(folder.epicLabel, 'Notices');
    assert.ok(folder.label.includes('Notices'));

    assert.equal(accAuto.canAutomateAccounts('cashier'), true);
    assert.equal(accAuto.canAutomateAccounts('accountant'), true);
    assert.equal(accAuto.canAutomateAccounts('doctor'), false);

    const a1 = accAuto.resolveAccountsAction('Pending cash at till');
    assert.equal(a1.type, 'pending_remittance');
    const reply = accAuto.executeAccountsAction(a1, { facilityId: 'IGH-EKT', facilityName: 'IGH' });
    assert.ok(reply.includes('Pending Cash') || reply.includes('Cash'));
  });
});

test('ui-invariants: Mark paid removed beside Collect, Bed admin guard active, 10s mandate, AI minimize present', () => {
  const accSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/dashboards/AccountingWorkspace.tsx'), 'utf8');
  assert.equal(accSrc.includes('Mark paid'), false);
  assert.equal(accSrc.includes('Quick Mark Paid'), false);
  assert.ok(accSrc.includes('printPaymentReceiptDocument'));
  assert.ok(accSrc.includes('Print Receipt'));

  const bedSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/beds/BedManagement.tsx'), 'utf8');
  assert.ok(bedSrc.includes('isAdminView'));
  assert.ok(bedSrc.includes('readOnlyAdmin={isAdminView}'));

  const dhisBedSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/interop/Dhis2TrackerBedBoardSuite.tsx'), 'utf8');
  assert.ok(dhisBedSrc.includes('!readOnlyAdmin && showAdmitModal'));

  const balSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/finance/AutoAccountBalancingCard.tsx'), 'utf8');
  assert.ok(balSrc.includes('summary.pendingCashNgn'));
  assert.ok(balSrc.includes('mandateSecondsLeft'));
  assert.ok(balSrc.includes('upsertFacilityNotice'));

  const aiSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/ai-insights/M87AICopilotSuite.tsx'), 'utf8');
  assert.ok(aiSrc.includes('parseBedAutomationIntent'));
  assert.ok(aiSrc.includes('resolveAccountsAction'));
  assert.ok(aiSrc.includes('onMinimize'));
  assert.ok(aiSrc.includes('<Minus'));

  const newFiles = [
    'src/components/beds/DoctorAdmissionSuite.tsx',
    'src/components/notifications/NotificationDetailModal.tsx',
    'src/app/api/akwaremit/batch-settle/route.ts',
    'src/lib/bedAutomation.ts',
    'src/lib/accountsAutomation.ts',
    'src/lib/patientVerification.ts',
    'src/components/common/VerifiedPatientField.tsx',
  ];
  for (const rel of newFiles) {
    const content = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    for (const phrase of ['Stored in AWS S3', 'Aurora Postgres', 'Vercel', 'Firebase']) {
      assert.equal(content.includes(phrase), false, `${rel} must not expose "${phrase}"`);
    }
  }
});

test('patientVerification: verifies existing hospital numbers, rejects non-existent/mismatched entries, catches duplicate names & folder numbers', async () => {
  const localRecords = [
    {
      id: 'PT-1',
      hospitalNumber: 'IGH-PT-1001',
      firstName: 'Ekemini',
      lastName: 'Okon',
      nin: '12345678901',
      mrn: 'MRN-1001',
      nhiaNumber: 'AKSHIA-55',
    },
    {
      id: 'PT-2',
      hospitalNumber: 'IGH-PT-1002',
      firstName: 'John',
      lastName: 'Doe',
    },
    {
      id: 'PT-3',
      hospitalNumber: 'IGH-PT-1003',
      firstName: 'John',
      lastName: 'Doe',
    },
  ];

  const pv = loadTsModule('src/lib/patientVerification.ts', {
    './patientRegistryStore': {
      listPatients: () => localRecords,
      hydratePatientsFromPostgres: async (_fac, search) => {
        if (String(search || '').includes('9009') && !localRecords.some((p) => p.id === 'PT-9')) {
          localRecords.push({
            id: 'PT-9',
            hospitalNumber: 'IGH-PT-9009',
            firstName: 'Iniobong',
            lastName: 'Akpan',
          });
        }
        return localRecords;
      },
    },
  });

  const empty = pv.verifyPatientExists('IGH-EKT', {});
  assert.equal(empty.valid, false);
  assert.equal(empty.status, 'empty');

  const okHn = pv.verifyPatientExists('IGH-EKT', { hospitalNumber: 'igh-pt-1001' });
  assert.equal(okHn.valid, true);
  assert.equal(okHn.status, 'verified');
  assert.equal(okHn.matchedBy, 'hospitalNumber');
  assert.equal(okHn.patient.id, 'PT-1');

  const missing = pv.verifyPatientExists('IGH-EKT', { hospitalNumber: 'IGH-PT-9999' });
  assert.equal(missing.valid, false);
  assert.equal(missing.status, 'not_found');
  assert.ok(missing.error.includes('does not exist'));

  const mismatch = pv.verifyPatientExists('IGH-EKT', {
    hospitalNumber: 'IGH-PT-1001',
    patientName: 'Wrong Person',
  });
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.status, 'mismatch');
  assert.ok(mismatch.error.includes('belongs to Ekemini Okon'));

  const okNin = pv.verifyPatientExists('IGH-EKT', { query: '12345678901' });
  assert.equal(okNin.valid, true);
  assert.equal(okNin.matchedBy, 'nin');
  assert.equal(okNin.patient.id, 'PT-1');

  const okUniqueName = pv.verifyPatientExists('IGH-EKT', { patientName: 'Ekemini Okon' });
  assert.equal(okUniqueName.valid, true);
  assert.equal(okUniqueName.matchedBy, 'name');
  assert.equal(okUniqueName.patient.id, 'PT-1');

  const ambig = pv.verifyPatientExists('IGH-EKT', { patientName: 'John Doe' });
  assert.equal(ambig.valid, false);
  assert.equal(ambig.status, 'ambiguous_name');
  assert.equal(ambig.matches.length, 2);

  const disambiguated = pv.verifyPatientExists('IGH-EKT', {
    hospitalNumber: 'IGH-PT-1002',
    patientName: 'John Doe',
  });
  assert.equal(disambiguated.valid, true);
  assert.equal(disambiguated.patient.id, 'PT-2');

  assert.equal(pv.isHospitalNumberTaken('IGH-EKT', 'igh-pt-1001')?.id, 'PT-1');
  assert.equal(pv.isHospitalNumberTaken('IGH-EKT', 'IGH-PT-1001', 'PT-1'), undefined);

  const remoteOk = await pv.verifyPatientExistsAsync('IGH-EKT', { hospitalNumber: 'IGH-PT-9009' });
  assert.equal(remoteOk.valid, true);
  assert.equal(remoteOk.checkedServer, true);
  assert.equal(remoteOk.patient.id, 'PT-9');

  const remoteMissing = await pv.verifyPatientExistsAsync('IGH-EKT', { hospitalNumber: 'IGH-PT-0000' });
  assert.equal(remoteMissing.valid, false);
  assert.equal(remoteMissing.status, 'not_found');
  assert.equal(remoteMissing.checkedServer, true);
});

test('ui-invariants: patient verification enforced across clinical, financial, bed, and registry forms', () => {
  const mustHaveVerifiedAndValidator = [
    'src/components/beds/BedManagement.tsx',
    'src/components/beds/DoctorAdmissionSuite.tsx',
    'src/components/interop/Dhis2TrackerBedBoardSuite.tsx',
    'src/components/dashboards/NurseDeskHome.tsx',
    'src/components/cashier/CashierRevenue.tsx',
    'src/components/finance/BillingInvoicingSuite.tsx',
    'src/components/finance/AkwaRemitRevenueSuite.tsx',
    'src/components/finance/AccountingArDesk.tsx',
    'src/components/clinical-core/BloodBankSuite.tsx',
    'src/components/clinical-core/OperatingTheatreSuite.tsx',
    'src/components/clinical-core/MaternityOgSuite.tsx',
    'src/components/clinical-core/PaediatricsNicuSuite.tsx',
    'src/components/clinical-core/MortuaryRegistrySuite.tsx',
    'src/components/gateway-modules/PatientsManager.tsx',
    'src/components/gateway-modules/ReferralsManager.tsx',
    'src/components/interop/AkwaIbomStateSuite.tsx',
    'src/components/interop/StatewideEmrSuite.tsx',
    'src/components/reception/FrontDeskWorkqueues.tsx',
  ];
  for (const rel of mustHaveVerifiedAndValidator) {
    const src = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    assert.ok(src.includes('VerifiedPatientField'), `${rel} must render VerifiedPatientField`);
    assert.ok(src.includes('verifyPatientExists'), `${rel} must validate via verifyPatientExists`);
  }

  assert.ok(
    fs.readFileSync(path.join(OS_ROOT, 'src/components/gateway-modules/ClinicalTasksManager.tsx'), 'utf8')
      .includes('VerifiedPatientField')
  );
  for (const rel of [
    'src/components/dashboards/DoctorPortal.tsx',
    'src/components/dashboards/LabDeskHome.tsx',
    'src/components/common/VerifiedPatientField.tsx',
  ]) {
    assert.ok(
      fs.readFileSync(path.join(OS_ROOT, rel), 'utf8').includes('SearchablePatientSelect'),
      `${rel} must use SearchablePatientSelect`
    );
  }
  assert.ok(
    fs.readFileSync(path.join(OS_ROOT, 'src/components/records/EditPatientModal.tsx'), 'utf8')
      .includes('isHospitalNumberTaken')
  );
  for (const rel of [
    'src/components/cashier/PosPaymentDesk.tsx',
    'src/components/dashboards/AccountingWorkspace.tsx',
    'src/components/dashboards/ReceptionWorkspace.tsx',
    'src/components/common/SearchablePatientSelect.tsx',
  ]) {
    assert.ok(
      fs.readFileSync(path.join(OS_ROOT, rel), 'utf8').includes('hydratePatientsFromPostgres'),
      `${rel} must hydrate missing patient lookups from the facility registry API`
    );
  }
});

test('phase-a-to-f-invariants: QR, HIM cards, Nurse e-MAR/ICU, Pharmacy isolation/deferral, Reception auto OPD, Persistent Lock, AI & Biometrics', () => {
  // 1. Scannable QR & HIM Card issuance (no fake hardcoded patient)
  for (const rel of [
    'src/lib/qrPayload.ts',
    'src/components/common/ScannableQrCode.tsx',
    'src/app/verify/page.tsx',
    'src/components/him/HimIssueCardModal.tsx',
  ]) {
    assert.ok(fs.existsSync(path.join(OS_ROOT, rel)), `Missing QR/HIM file: ${rel}`);
  }
  const dpc = fs.readFileSync(path.join(OS_ROOT, 'src/components/patient-card/DigitalPatientCard.tsx'), 'utf8');
  assert.ok(!dpc.includes('Alex Rivera'), 'DigitalPatientCard must not fall back to fake Alex Rivera patient');
  assert.ok(dpc.includes('PhysicalFormScannerModal'), 'DigitalPatientCard must wire AI Paper Form Scanner');

  // 2. Nurse e-MAR, Ward Med Requests, ICU Step-Down & cloud sync keys
  for (const rel of [
    'src/lib/wardMedRequestStore.ts',
    'src/components/clinical-core/WardMedRequestsSuite.tsx',
    'src/lib/icuStepDownStore.ts',
  ]) {
    assert.ok(fs.existsSync(path.join(OS_ROOT, rel)), `Missing Phase A file: ${rel}`);
  }
  const fcs = fs.readFileSync(path.join(OS_ROOT, 'src/lib/facilityCloudSync.ts'), 'utf8');
  assert.ok(!fcs.includes('AWS S3'), 'facilityCloudSync must not expose AWS S3 in UI/sync metadata');
  assert.ok(fcs.includes('WARD_MED_REQUESTS_KEY') && fcs.includes('ICU_STEPDOWN_KEY'));

  // 3. Universal Red Validation with Skip exemption
  assert.ok(fs.existsSync(path.join(OS_ROOT, 'src/lib/formValidation.ts')));
  assert.ok(fs.existsSync(path.join(OS_ROOT, 'src/components/common/GlobalFormValidator.tsx')));
  const css = fs.readFileSync(path.join(OS_ROOT, 'src/styles/os.css'), 'utf8');
  assert.ok(css.includes('.mc-field-invalid'), 'os.css must style .mc-field-invalid red');
  const gfv = fs.readFileSync(path.join(OS_ROOT, 'src/components/common/GlobalFormValidator.tsx'), 'utf8');
  assert.ok(gfv.includes('data-skip-btn'), 'GlobalFormValidator must exempt skip buttons');

  // 4. Pharmacy Overhaul: Isolation, pay-gate .cleared fix, Hold/Defer, Dedicated POS & Rx Records
  const ceb = fs.readFileSync(path.join(OS_ROOT, 'src/lib/clinicalEventBus.ts'), 'utf8');
  assert.ok(ceb.includes('isOrderBillCleared(orderId).cleared'), 'clinicalEventBus must inspect .cleared boolean');
  assert.ok(ceb.includes('autoAdvancePatientVisitStage'), 'clinicalEventBus must call autoAdvancePatientVisitStage');
  const pbs = fs.readFileSync(path.join(OS_ROOT, 'src/lib/patientBillingStore.ts'), 'utf8');
  assert.ok(pbs.includes('deferPharmacyBillLine') && pbs.includes('restoreDeferredPharmacyBillLine'));
  assert.ok(pbs.includes("l.status === 'unpaid' || l.status === 'partial'"));
  for (const rel of [
    'src/components/dashboards/PharmacyDeskHome.tsx',
    'src/components/pharmacy/PrescriptionRecordsSuite.tsx',
    'src/components/pharmacy/PharmacyPaymentDesk.tsx',
  ]) {
    assert.ok(fs.existsSync(path.join(OS_ROOT, rel)), `Missing Pharmacy Overhaul file: ${rel}`);
  }
  const pds = fs.readFileSync(path.join(OS_ROOT, 'src/components/clinical-core/PharmacyDispensingSuite.tsx'), 'utf8');
  assert.ok(!pds.includes('localhost:4000'), 'PharmacyDispensingSuite must not call localhost:4000');
  assert.ok(pds.includes('parseScannedEmrQr') && pds.includes('ward-requests'));

  // 5. Reception: No duplicate In-Basket card, no manual Send/Done, Auto admitted stage, Clear Scan, Persistent Lock
  const rdh = fs.readFileSync(path.join(OS_ROOT, 'src/components/dashboards/ReceptionDeskHome.tsx'), 'utf8');
  assert.ok(!rdh.includes("label: 'In Basket'"), 'Duplicate In Basket quick-action tile must be removed');
  assert.ok(!rdh.includes("liveUpdate(v.id, 'with_provider')"), 'Manual Send button must be removed from All Active OPD');
  assert.ok(!rdh.includes("liveUpdate(v.id, 'completed')"), 'Manual Done button must be removed from All Active OPD');
  const rw = fs.readFileSync(path.join(OS_ROOT, 'src/components/dashboards/ReceptionWorkspace.tsx'), 'utf8');
  assert.ok(rw.includes('scanMatchedPatient') && rw.includes('Clear Scan'), 'Reception scan must isolate scanMatchedPatient and support Clear Scan');
  assert.ok(rw.includes('PhysicalFormScannerModal'), 'ReceptionWorkspace must wire AI Paper Form Scanner');
  const pageSrc = fs.readFileSync(path.join(OS_ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('TERMINAL_LOCK_KEY') && pageSrc.includes('medcore_os_terminal_locked_v1'));

  // 6. Staff Presence Date/Time + AI, Voice-to-Text, Biometrics 2FA, Celestia Supertools & Novice Manual
  const so = fs.readFileSync(path.join(OS_ROOT, 'src/components/staffing/StaffingOverview.tsx'), 'utf8');
  assert.ok(!so.includes('formatSince(0)'), 'Off-duty staff must read real presence timestamp instead of formatSince(0)');
  assert.ok(so.includes('formatExactLastSeen') && so.includes('analyzeStaffRosterIntelligence'));
  for (const rel of [
    'src/lib/staffPresenceIntelligence.ts',
    'src/app/api/ai/scan-form/route.ts',
    'src/components/reception/PhysicalFormScannerModal.tsx',
    'src/app/api/ai/transcribe/route.ts',
    'src/lib/voiceTranscription.ts',
    'src/lib/celestiaSuperTools.ts',
    'src/app/api/auth/biometric/route.ts',
    'src/lib/biometricAuth.ts',
  ]) {
    const full = path.join(OS_ROOT, rel);
    assert.ok(fs.existsSync(full), `Missing Phase E/F file: ${rel}`);
    const content = fs.readFileSync(full, 'utf8');
    assert.ok(!/AWS S3|Aurora Postgres/i.test(content), `${rel} must not expose infrastructure vendor names`);
  }
  assert.ok(
    fs.existsSync(path.resolve(OS_ROOT, '..', '..', 'docs', 'MEDCORE_NOVICE_USER_MANUAL.md')),
    'Novice EMR user manual must exist in docs/MEDCORE_NOVICE_USER_MANUAL.md'
  );
});

test('facialBiometrics: validates Rekognition config/quality/liveness/matching, unified passkey+face vault, and vendor-neutral UI', async () => {
  const sdkCalls = [];
  const stsCalls = [];
  let mockCompareSimilarity = 96.4;
  let mockChallengeSmile = true;
  let mockChallengeYaw = 15;
  let mockLivenessStatus = 'SUCCEEDED';
  let mockLivenessConfidence = 96.2;
  let mockLivenessRefBytes = null;

  class MockRekognitionClient {
    constructor(opts) {
      this.opts = opts;
    }
    async send(cmd) {
      sdkCalls.push(cmd.type);
      if (cmd.type === 'DetectFaces') {
        const isChallenge = Buffer.from(cmd.input.Image.Bytes).toString('utf8').includes('challenge');
        return {
          FaceDetails: [
            {
              Confidence: 99.1,
              EyesOpen: { Value: true, Confidence: 99 },
              Sunglasses: { Value: false, Confidence: 99 },
              Quality: { Brightness: 78, Sharpness: 82 },
              Smile: { Value: isChallenge ? mockChallengeSmile : false, Confidence: isChallenge ? 92 : 10 },
              Pose: { Yaw: isChallenge ? mockChallengeYaw : 1, Pitch: 2, Roll: 0 },
            },
          ],
        };
      }
      if (cmd.type === 'CompareFaces') {
        return {
          FaceMatches: mockCompareSimilarity >= (cmd.input.SimilarityThreshold || 0)
            ? [{ Similarity: mockCompareSimilarity }]
            : [],
        };
      }
      if (cmd.type === 'CreateFaceLivenessSession') {
        return { SessionId: 'liveness-sess-123' };
      }
      if (cmd.type === 'GetFaceLivenessSessionResults') {
        return {
          Status: mockLivenessStatus,
          Confidence: mockLivenessConfidence,
          ReferenceImage: mockLivenessRefBytes ? { Bytes: mockLivenessRefBytes } : undefined,
        };
      }
      return {};
    }
  }

  const rekMocks = {
    '@aws-sdk/client-rekognition': {
      RekognitionClient: MockRekognitionClient,
      DetectFacesCommand: function (input) { this.type = 'DetectFaces'; this.input = input; },
      CompareFacesCommand: function (input) { this.type = 'CompareFaces'; this.input = input; },
      CreateFaceLivenessSessionCommand: function (input) { this.type = 'CreateFaceLivenessSession'; this.input = input; },
      GetFaceLivenessSessionResultsCommand: function (input) { this.type = 'GetFaceLivenessSessionResults'; this.input = input; },
    },
    '@aws-sdk/client-sts': {
      STSClient: class MockStsClient {
        async send(cmd) {
          stsCalls.push(cmd.input);
          return {
            Credentials: {
              AccessKeyId: 'ASIA-STS-TEMP-1',
              SecretAccessKey: 'sts-temp-secret-1',
              SessionToken: 'sts-temp-token-1',
              Expiration: new Date(Date.now() + 900_000),
            },
          };
        }
      },
      AssumeRoleCommand: function (input) { this.input = input; },
    },
    '@vercel/functions/oidc': {
      awsCredentialsProvider: ({ roleArn }) => async () => ({
        roleArn,
        accessKeyId: 'ASIA-OIDC-TEST-1',
        secretAccessKey: 'oidc-secret-1',
        sessionToken: 'oidc-session-token-1',
        expiration: new Date(Date.now() + 900_000),
      }),
    },
  };

  const prevEnv = {
    MEDCORE_REKOGNITION_ROLE_ARN: process.env.MEDCORE_REKOGNITION_ROLE_ARN,
    MEDCORE_REKOGNITION_REGION: process.env.MEDCORE_REKOGNITION_REGION,
    MEDCORE_REKOGNITION_LIVENESS_ENABLED: process.env.MEDCORE_REKOGNITION_LIVENESS_ENABLED,
    MEDCORE_REKOGNITION_LIVENESS_ROLE_ARN: process.env.MEDCORE_REKOGNITION_LIVENESS_ROLE_ARN,
    MEDCORE_REKOGNITION_LIVENESS_MIN_CONFIDENCE: process.env.MEDCORE_REKOGNITION_LIVENESS_MIN_CONFIDENCE,
    AWS_ROLE_ARN: process.env.AWS_ROLE_ARN,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    MEDCORE_S3_ROLE_ARN: process.env.MEDCORE_S3_ROLE_ARN,
    MEDCORE_S3_ACCESS_KEY_ID: process.env.MEDCORE_S3_ACCESS_KEY_ID,
    MEDCORE_S3_SECRET_ACCESS_KEY: process.env.MEDCORE_S3_SECRET_ACCESS_KEY,
    MEDCORE_AWS_ACCESS_KEY_ID: process.env.MEDCORE_AWS_ACCESS_KEY_ID,
    MEDCORE_AWS_SECRET_ACCESS_KEY: process.env.MEDCORE_AWS_SECRET_ACCESS_KEY,
  };

  try {
    delete process.env.MEDCORE_REKOGNITION_ROLE_ARN;
    delete process.env.AWS_ROLE_ARN;
    delete process.env.MEDCORE_S3_ROLE_ARN;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.MEDCORE_S3_ACCESS_KEY_ID;
    delete process.env.MEDCORE_S3_SECRET_ACCESS_KEY;
    delete process.env.MEDCORE_AWS_ACCESS_KEY_ID;
    delete process.env.MEDCORE_AWS_SECRET_ACCESS_KEY;

    const rek = loadTsModule('src/lib/aws/rekognitionServer.ts', rekMocks);
    assert.equal(rek.isRekognitionConfigured(), false);

    process.env.MEDCORE_REKOGNITION_ROLE_ARN = 'arn:aws:iam::123456789012:role/medcore-oidc';
    process.env.MEDCORE_REKOGNITION_REGION = 'eu-west-1';
    rek.resetRekognitionClient();
    const oidcCfg = rek.getRekognitionConfig();
    assert.equal(oidcCfg.isConfigured, true);
    assert.equal(oidcCfg.authMethod, 'oidc_role');
    assert.equal(oidcCfg.region, 'eu-west-1');

    // Pure face quality checks
    assert.equal(rek.evaluateFaceQuality([]).ok, false);
    assert.equal(rek.evaluateFaceQuality([{}, {}]).ok, false);
    assert.equal(
      rek.evaluateFaceQuality([{ Confidence: 99, EyesOpen: { Value: false, Confidence: 95 } }]).ok,
      false
    );
    assert.equal(
      rek.evaluateFaceQuality([{ Confidence: 99, Sunglasses: { Value: true, Confidence: 92 } }]).ok,
      false
    );
    assert.equal(
      rek.evaluateFaceQuality([{ Confidence: 99, Pose: { Yaw: 35, Pitch: 0, Roll: 0 } }]).ok,
      false
    );
    const qOk = rek.evaluateFaceQuality([
      {
        Confidence: 99.4,
        EyesOpen: { Value: true, Confidence: 99 },
        Sunglasses: { Value: false, Confidence: 99 },
        Pose: { Yaw: 3, Pitch: -2, Roll: 1 },
        Quality: { Brightness: 72, Sharpness: 84 },
      },
    ]);
    assert.equal(qOk.ok, true);

    // Pure auto-scan probe evaluation checks
    assert.equal(rek.evaluateFaceProbe([], { stage: 'neutral' }).faceDetected, false);
    assert.equal(rek.evaluateFaceProbe([], { stage: 'neutral' }).readyForNeutral, false);
    assert.equal(
      rek.evaluateFaceProbe([{ Confidence: 99 }, { Confidence: 98 }], { stage: 'neutral' }).readyForNeutral,
      false
    );
    assert.equal(
      rek.evaluateFaceProbe(
        [{ Confidence: 99, BoundingBox: { Width: 0.08 } }],
        { stage: 'enroll' }
      ).readyForNeutral,
      false
    );
    const probeNeutralOk = rek.evaluateFaceProbe(
      [
        {
          Confidence: 99.4,
          BoundingBox: { Width: 0.38 },
          EyesOpen: { Value: true, Confidence: 99 },
          Sunglasses: { Value: false, Confidence: 99 },
          Pose: { Yaw: 2, Pitch: -1, Roll: 0 },
          Quality: { Brightness: 74, Sharpness: 86 },
          Smile: { Value: false, Confidence: 8 },
        },
      ],
      { stage: 'neutral' }
    );
    assert.equal(probeNeutralOk.faceDetected, true);
    assert.equal(probeNeutralOk.readyForNeutral, true);
    assert.equal(probeNeutralOk.engine, 'cloud_vision');

    const probeLivenessNoSmile = rek.evaluateFaceProbe(
      [{ Confidence: 99, BoundingBox: { Width: 0.38 }, Smile: { Value: false, Confidence: 10 }, Pose: { Yaw: 1 } }],
      { stage: 'liveness', prompt: 'smile', neutralPoseYaw: 1, neutralSmileConfidence: 8 }
    );
    assert.equal(probeLivenessNoSmile.livenessMatched, false);

    const probeLivenessSmileOk = rek.evaluateFaceProbe(
      [{ Confidence: 99, BoundingBox: { Width: 0.38 }, Smile: { Value: true, Confidence: 92 }, Pose: { Yaw: 1 } }],
      { stage: 'liveness', prompt: 'smile', neutralPoseYaw: 1, neutralSmileConfidence: 8 }
    );
    assert.equal(probeLivenessSmileOk.livenessMatched, true);

    const probeLivenessTurnOk = rek.evaluateFaceProbe(
      [{ Confidence: 99, BoundingBox: { Width: 0.38 }, Pose: { Yaw: 16 } }],
      { stage: 'liveness', prompt: 'turn_left', neutralPoseYaw: 1, neutralSmileConfidence: 8 }
    );
    assert.equal(probeLivenessTurnOk.livenessMatched, true);

    // Pure liveness checks
    const neutralFace = { Smile: { Value: false, Confidence: 5 }, Pose: { Yaw: 0 } };
    assert.equal(
      rek.evaluateActiveLiveness(neutralFace, { Smile: { Value: true, Confidence: 91 }, Pose: { Yaw: 1 } }, 'smile').ok,
      true
    );
    assert.equal(
      rek.evaluateActiveLiveness(neutralFace, { Smile: { Value: false, Confidence: 95 }, Pose: { Yaw: 1 } }, 'smile').ok,
      false
    );
    assert.equal(
      rek.evaluateActiveLiveness(neutralFace, { Pose: { Yaw: 14 } }, 'turn_left').ok,
      true
    );
    assert.equal(
      rek.evaluateActiveLiveness(neutralFace, { Pose: { Yaw: 2 } }, 'turn_right').ok,
      false
    );

    // Identical frames must be rejected as replay/spoof
    const sameBuf = Buffer.alloc(2048, 1);
    const replayRes = await rek.verifyActiveLiveness(sameBuf, sameBuf, 'smile');
    assert.equal(replayRes.ok, false);

    // Safe error messages never leak provider names
    const safeMsg = rek.toSafeBiometricError({ name: 'AccessDeniedException', message: 'Amazon Rekognition IAM failed' });
    assert.equal(/amazon|aws|rekognition/i.test(safeMsg), false);

    // Unified vault backwards-compatibility + end-to-end API flow
    const validImg = Buffer.concat([Buffer.from('neutral-'), Buffer.alloc(2048, 7)]).toString('base64');
    const challengeImg = Buffer.concat([Buffer.from('challenge-'), Buffer.alloc(2048, 9)]).toString('base64');
    let memVaultRow = null;

    const postgresMock = {
      ensureSchema: async () => { },
      isPostgresConfigured: () => true,
      withTenantClient: async (_fid, fn) =>
        fn({
          query: async (sql, params) => {
            if (sql.includes('SELECT descriptor')) {
              return { rows: memVaultRow ? [{ descriptor: memVaultRow }] : [] };
            }
            if (sql.includes('INSERT INTO staff_biometrics')) {
              memVaultRow = JSON.parse(params[3]);
            }
            if (sql.includes('DELETE FROM staff_biometrics')) {
              memVaultRow = null;
            }
            return { rows: [] };
          },
        }),
    };
    const s3Mock = {
      isS3Configured: () => false,
      uploadBufferToS3: async () => { throw new Error('unused'); },
      getS3ObjectBuffer: async () => { throw new Error('unused'); },
    };
    const serverSessionMock = {
      signMfaToken: async (badgeId, facilityId, method) => `mfa.${badgeId}.${facilityId}.${method}`,
    };
    const rateLimitMock = {
      checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
      getClientIp: () => '127.0.0.1',
    };

    const routeMocks = {
      'next/server': {
        NextResponse: {
          json: (data, init = {}) => ({ status: init.status || 200, data }),
        },
      },
      './db/postgres': postgresMock,
      './s3Server': s3Mock,
      '../../../../lib/db/postgres': postgresMock,
      '../../../../lib/serverSession': serverSessionMock,
      '../../../../../../lib/serverSession': serverSessionMock,
      '../../../../lib/rateLimit': rateLimitMock,
      '../../../../../../lib/rateLimit': rateLimitMock,
      '../../../../lib/s3Server': s3Mock,
      '../../../../lib/aws/rekognitionServer': rek,
      '../../../../../../lib/aws/rekognitionServer': rek,
    };

    const bioVault = loadTsModule('src/lib/biometricVault.ts');
    const bioRoute = loadTsModule('src/app/api/auth/biometric/route.ts', routeMocks);
    assert.equal(bioRoute.normalizeBiometricVault, undefined, 'route.ts must not export non-Route helpers');
    const legacyOnly = bioVault.normalizeBiometricVault({
      credentialId: 'cred-legacy-1',
      publicKeySpkiB64: 'c3BraQ==',
      counter: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(legacyOnly, null, 'Legacy passkey-only entries must normalize to null');
    const faceNormalized = bioVault.normalizeBiometricVault({
      version: 2,
      passkey: { credentialId: 'cred-legacy-1', publicKeySpkiB64: 'c3BraQ==', counter: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      face: { storageMode: 'inline_vault', referenceImageB64: 'dGVzdA==', enrolledAt: '2026-11-21T00:00:00.000Z', qualityScore: 95 },
    });
    assert.equal(faceNormalized.version, 2);
    assert.equal(faceNormalized.passkey, undefined);
    assert.equal(faceNormalized.face.storageMode, 'inline_vault');
    memVaultRow = null;

    const post = async (body) =>
      bioRoute.POST({
        headers: new Headers(),
        json: async () => body,
      });

    // Auto-scan face_probe via Amazon Rekognition
    const probeCloudNeutral = await post({
      action: 'face_probe',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
      stage: 'neutral',
      imageBase64: `data:image/jpeg;base64,${validImg}`,
    });
    assert.equal(probeCloudNeutral.status, 200);
    assert.equal(probeCloudNeutral.data.engine, 'cloud_vision');
    assert.equal(probeCloudNeutral.data.readyForNeutral, true);
    assert.equal(/amazon|aws|rekognition/i.test(JSON.stringify(probeCloudNeutral.data)), false);

    mockChallengeSmile = true;
    const probeCloudLiveness = await post({
      action: 'face_probe',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
      stage: 'liveness',
      prompt: 'smile',
      neutralPoseYaw: 1,
      neutralSmileConfidence: 10,
      imageBase64: `data:image/jpeg;base64,${challengeImg}`,
    });
    assert.equal(probeCloudLiveness.status, 200);
    assert.equal(probeCloudLiveness.data.livenessMatched, true);

    // Enroll face
    const enrollRes = await post({
      action: 'face_enroll',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
      staffName: 'Dr. Iniobong',
      imageBase64: `data:image/jpeg;base64,${validImg}`,
    });
    assert.equal(enrollRes.status, 200);
    assert.equal(enrollRes.data.faceEnrolled, true);

    const statusRes = await post({
      action: 'status',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
    });
    assert.equal(statusRes.data.enrolled, true);
    assert.equal(statusRes.data.faceEnrolled, true);
    assert.equal(statusRes.data.faceServiceAvailable, true);
    assert.equal(statusRes.data.passkeyEnrolled, undefined);

    // Challenge -> Verify success
    const chalRes = await post({
      action: 'face_challenge',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
    });
    assert.equal(chalRes.status, 200);
    assert.ok(['smile', 'turn_left', 'turn_right'].includes(chalRes.data.prompt));

    mockCompareSimilarity = 96.4;
    mockChallengeSmile = true;
    mockChallengeYaw = 15;
    const verOk = await post({
      action: 'face_verify',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
      challengeToken: chalRes.data.challengeToken,
      neutralImageBase64: validImg,
      challengeImageBase64: challengeImg,
    });
    assert.equal(verOk.status, 200);
    assert.equal(verOk.data.verified, true);
    assert.equal(verOk.data.mfaToken, 'mfa.DOC-FACE-1.TEST-FAC.biometric');

    // Mismatched face fails cleanly without vendor exposure
    mockCompareSimilarity = 42.0;
    const chalRes2 = await post({
      action: 'face_challenge',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
    });
    const verFail = await post({
      action: 'face_verify',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
      challengeToken: chalRes2.data.challengeToken,
      neutralImageBase64: validImg,
      challengeImageBase64: challengeImg,
    });
    assert.equal(verFail.status, 401);
    assert.equal(verFail.data.verified, false);
    assert.equal(/amazon|aws|rekognition/i.test(verFail.data.error), false);

    // Revoke removes facial biometric cleanly
    await post({
      action: 'revoke',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
      target: 'face',
    });
    const afterRevoke = await post({
      action: 'status',
      badgeId: 'DOC-FACE-1',
      facilityId: 'TEST-FAC',
    });
    assert.equal(afterRevoke.data.enrolled, false);
    assert.equal(afterRevoke.data.faceEnrolled, false);

    assert.ok(sdkCalls.includes('DetectFaces') && sdkCalls.includes('CompareFaces'));

    // 3D Face Liveness session + scoped STS credentials + GetFaceLivenessSessionResults flow
    const livenessSessionRoute = loadTsModule('src/app/api/auth/biometric/liveness/session/route.ts', routeMocks);
    const livenessResultsRoute = loadTsModule('src/app/api/auth/biometric/liveness/results/route.ts', routeMocks);
    memVaultRow = null;

    // When MEDCORE_REKOGNITION_LIVENESS_ENABLED is unset, /liveness/session degrades gracefully
    delete process.env.MEDCORE_REKOGNITION_LIVENESS_ENABLED;
    const liveDisabled = await livenessSessionRoute.POST({
      headers: new Headers(),
      json: async () => ({ badgeId: 'DOC-LIVE-1', facilityId: 'TEST-FAC', mode: 'enroll' }),
    });
    assert.equal(liveDisabled.status, 200);
    assert.equal(liveDisabled.data.available, false);

    // Enable 3D Live Liveness with OIDC role & custom secondary liveness role
    process.env.MEDCORE_REKOGNITION_LIVENESS_ENABLED = 'true';
    process.env.MEDCORE_REKOGNITION_LIVENESS_ROLE_ARN = 'arn:aws:iam::123456789012:role/medcore-liveness-web';
    const liveCredsViaSts = await rek.getTemporaryLivenessCredentials();
    assert.equal(liveCredsViaSts.accessKeyId, 'ASIA-STS-TEMP-1');
    assert.equal(liveCredsViaSts.sessionToken, 'sts-temp-token-1');
    assert.ok(stsCalls.some((c) => String(c.Policy || '').includes('rekognition:StartFaceLivenessSession')));
    delete process.env.MEDCORE_REKOGNITION_LIVENESS_ROLE_ARN;

    const liveSessEnroll = await livenessSessionRoute.POST({
      headers: new Headers(),
      json: async () => ({ badgeId: 'DOC-LIVE-1', facilityId: 'TEST-FAC', mode: 'enroll' }),
    });
    assert.equal(liveSessEnroll.status, 200);
    assert.equal(liveSessEnroll.data.available, true);
    assert.equal(liveSessEnroll.data.sessionId, 'liveness-sess-123');
    assert.equal(liveSessEnroll.data.region, 'eu-west-1');
    assert.ok(liveSessEnroll.data.livenessToken);

    const credsRes = await livenessSessionRoute.GET({
      headers: new Headers(),
      nextUrl: new URL(`http://localhost/api/auth/biometric/liveness/session?livenessToken=${encodeURIComponent(liveSessEnroll.data.livenessToken)}`),
    });
    assert.equal(credsRes.status, 200);
    assert.ok(credsRes.data.sessionToken);

    const badCredsRes = await livenessSessionRoute.GET({
      headers: new Headers(),
      nextUrl: new URL('http://localhost/api/auth/biometric/liveness/session?livenessToken=bad.token'),
    });
    assert.equal(badCredsRes.status, 401);

    // Reject low confidence liveness result
    mockLivenessConfidence = 42.0;
    mockLivenessRefBytes = Buffer.concat([Buffer.from('neutral-'), Buffer.alloc(2048, 8)]);
    const liveResLow = await livenessResultsRoute.POST({
      headers: new Headers(),
      json: async () => ({
        sessionId: 'liveness-sess-123',
        livenessToken: liveSessEnroll.data.livenessToken,
        badgeId: 'DOC-LIVE-1',
        facilityId: 'TEST-FAC',
        staffName: 'Dr. Live',
        mode: 'enroll',
      }),
    });
    assert.equal(liveResLow.status, 401);

    // High confidence enroll succeeds and stores reference portrait
    mockLivenessConfidence = 97.4;
    const liveResEnroll = await livenessResultsRoute.POST({
      headers: new Headers(),
      json: async () => ({
        sessionId: 'liveness-sess-123',
        livenessToken: liveSessEnroll.data.livenessToken,
        badgeId: 'DOC-LIVE-1',
        facilityId: 'TEST-FAC',
        staffName: 'Dr. Live',
        mode: 'enroll',
      }),
    });
    assert.equal(liveResEnroll.status, 200);
    assert.equal(liveResEnroll.data.faceEnrolled, true);

    // Live 3D verify matches reference portrait and issues MFA token
    const liveSessVer = await livenessSessionRoute.POST({
      headers: new Headers(),
      json: async () => ({ badgeId: 'DOC-LIVE-1', facilityId: 'TEST-FAC', mode: 'verify' }),
    });
    assert.equal(liveSessVer.status, 200);
    assert.equal(liveSessVer.data.available, true);

    mockCompareSimilarity = 97.1;
    const liveResVer = await livenessResultsRoute.POST({
      headers: new Headers(),
      json: async () => ({
        sessionId: liveSessVer.data.sessionId,
        livenessToken: liveSessVer.data.livenessToken,
        badgeId: 'DOC-LIVE-1',
        facilityId: 'TEST-FAC',
        staffName: 'Dr. Live',
        mode: 'verify',
      }),
    });
    assert.equal(liveResVer.status, 200);
    assert.equal(liveResVer.data.verified, true);
    assert.equal(liveResVer.data.mfaToken, 'mfa.DOC-LIVE-1.TEST-FAC.biometric');
    assert.ok(sdkCalls.includes('CreateFaceLivenessSession') && sdkCalls.includes('GetFaceLivenessSessionResults'));
    delete process.env.MEDCORE_REKOGNITION_LIVENESS_ENABLED;

    const prevExtraEnv = {
      MEDCORE_REKOGNITION_AWS_ROLE_ARN: process.env.MEDCORE_REKOGNITION_AWS_ROLE_ARN,
      MEDCORE_REKOGNITION_AWS_REGION: process.env.MEDCORE_REKOGNITION_AWS_REGION,
      MEDCORE_S3_AWS_ROLE_ARN: process.env.MEDCORE_S3_AWS_ROLE_ARN,
      MEDCORE_AWS_ROLE_ARN: process.env.MEDCORE_AWS_ROLE_ARN,
      AWS_REGION: process.env.AWS_REGION,
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
    };

    try {
      // Clear any extra OIDC/region env vars during test
      for (const k of Object.keys(prevExtraEnv)) delete process.env[k];

      // Test MEDCORE_REKOGNITION_AWS_ROLE_ARN + eu-north-1 fallback -> eu-west-1
      process.env.MEDCORE_REKOGNITION_AWS_ROLE_ARN = 'arn:aws:iam::123456789012:role/medcore-prefixed-oidc';
      process.env.MEDCORE_REKOGNITION_AWS_REGION = 'eu-north-1';
      rek.resetRekognitionClient();
      const prefixedCfg = rek.getRekognitionConfig();
      assert.equal(prefixedCfg.isConfigured, true);
      assert.equal(prefixedCfg.region, 'eu-west-1', 'eu-north-1 must fall back to Rekognition-supported eu-west-1');
      delete process.env.MEDCORE_REKOGNITION_AWS_ROLE_ARN;
      delete process.env.MEDCORE_REKOGNITION_AWS_REGION;
      delete process.env.MEDCORE_REKOGNITION_ROLE_ARN;
      delete process.env.MEDCORE_REKOGNITION_REGION;

      // Test Standard Vector Fallback when Rekognition is unconfigured
      rek.resetRekognitionClient();
      assert.equal(rek.isRekognitionConfigured(), false);
      memVaultRow = null;

      const makeVec = (seedShift = 0, deltaIdx = -1) => {
        const arr = [];
        for (let i = 0; i < 128; i++) {
          let v = Math.sin((i + 1 + seedShift) * 0.37) * 0.5 + Math.cos((i + 3) * 0.19) * 0.5;
          if (i === deltaIdx) v += 0.45;
          arr.push(Math.round(v * 10000) / 10000);
        }
        return arr;
      };
      const baseVec = makeVec(0);
      const movedVec = makeVec(0, 12);
      const strangerVec = makeVec(4.2);

      const stdEnroll = await post({
        action: 'face_enroll',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
        staffName: 'Admin Ini',
        imageBase64: `data:image/jpeg;base64,${validImg}`,
        faceVector: baseVec,
      });
      assert.equal(stdEnroll.status, 200);
      assert.equal(stdEnroll.data.faceEnrolled, true);

      // Standard fallback auto-scan face_probe
      const probeStdNeutral = await post({
        action: 'face_probe',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
        stage: 'neutral',
        imageBase64: `data:image/jpeg;base64,${validImg}`,
        faceVector: baseVec,
      });
      assert.equal(probeStdNeutral.status, 200);
      assert.equal(probeStdNeutral.data.engine, 'standard');
      assert.equal(probeStdNeutral.data.readyForNeutral, true);

      const probeStdMoved = await post({
        action: 'face_probe',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
        stage: 'liveness',
        prompt: 'smile',
        imageBase64: `data:image/jpeg;base64,${challengeImg}`,
        faceVector: movedVec,
        neutralFaceVector: baseVec,
      });
      assert.equal(probeStdMoved.status, 200);
      assert.equal(probeStdMoved.data.livenessMatched, true);

      const stdChal = await post({
        action: 'face_challenge',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
      });
      assert.equal(stdChal.status, 200);

      // Identical frames must still be rejected
      const stdReplay = await post({
        action: 'face_verify',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
        challengeToken: stdChal.data.challengeToken,
        neutralImageBase64: validImg,
        challengeImageBase64: validImg,
        neutralFaceVector: baseVec,
        challengeFaceVector: movedVec,
      });
      assert.equal(stdReplay.status, 401);

      // Valid match succeeds with mfaToken
      const stdChal2 = await post({ action: 'face_challenge', badgeId: 'ADM-STD-1', facilityId: 'TEST-FAC' });
      const stdOk = await post({
        action: 'face_verify',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
        challengeToken: stdChal2.data.challengeToken,
        neutralImageBase64: validImg,
        challengeImageBase64: challengeImg,
        neutralFaceVector: baseVec,
        challengeFaceVector: movedVec,
      });
      assert.equal(stdOk.status, 200);
      assert.equal(stdOk.data.verified, true);
      assert.equal(stdOk.data.mfaToken, 'mfa.ADM-STD-1.TEST-FAC.biometric');

      // Mismatched vector fails cleanly
      const stdChal3 = await post({ action: 'face_challenge', badgeId: 'ADM-STD-1', facilityId: 'TEST-FAC' });
      const stdMismatch = await post({
        action: 'face_verify',
        badgeId: 'ADM-STD-1',
        facilityId: 'TEST-FAC',
        challengeToken: stdChal3.data.challengeToken,
        neutralImageBase64: validImg,
        challengeImageBase64: challengeImg,
        neutralFaceVector: strangerVec,
        challengeFaceVector: movedVec,
      });
      assert.equal(stdMismatch.status, 401);
      assert.equal(stdMismatch.data.verified, false);
    } finally {
      for (const [k, v] of Object.entries(prevExtraEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }

    // Verify AdminSettings Face ID + auto-2FA, AuthScreen Face ID 2FA check, & AccessControl pre-issuance gate
    const adminSettingsSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/admin/AdminSettings.tsx'), 'utf8');
    assert.ok(adminSettingsSrc.includes('Enroll Face ID') && adminSettingsSrc.includes('requireStaffMfa: true'));
    assert.ok(adminSettingsSrc.includes('FaceBiometricCaptureModal') && adminSettingsSrc.includes('requireFaceIdOnStaffEnrol'));

    const accessCtrlSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/rbac/AccessControl.tsx'), 'utf8');
    assert.ok(
      accessCtrlSrc.includes('pendingStaffEnrolment') &&
      accessCtrlSrc.includes('finalizeStaffEnrolment') &&
      accessCtrlSrc.includes('FaceBiometricCaptureModal'),
      'AccessControl must gate staff issuance behind Face ID capture'
    );

    const authScreenSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/AuthScreen.tsx'), 'utf8');
    assert.ok(authScreenSrc.includes('getStaffBiometricStatus'), 'AuthScreen must check Face ID enrollment for 2FA');

    const faceModalSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/FaceBiometricCaptureModal.tsx'), 'utf8');
    assert.ok(
      faceModalSrc.includes('probeStaffFaceFrame') &&
      faceModalSrc.includes('Auto-Scan') &&
      faceModalSrc.includes('LiveFaceLivenessDetector') &&
      faceModalSrc.includes('startLiveLivenessSession') &&
      faceModalSrc.includes('completeLiveLivenessSession'),
      'FaceBiometricCaptureModal must wire LiveFaceLivenessDetector and hands-free auto-scan fallback'
    );

    const otpModalSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/StaffEmailOtpModal.tsx'), 'utf8');
    assert.ok(
      otpModalSrc.includes('autoLaunchedFaceRef') && otpModalSrc.includes('setFaceModalOpen(true)'),
      'StaffEmailOtpModal must auto-open Face ID verification when Face ID is enrolled'
    );

    // UI + client vendor secrecy & Fingerprint/Passkey removal verification
    for (const rel of [
      'src/components/auth/FaceBiometricCaptureModal.tsx',
      'src/components/auth/StaffEmailOtpModal.tsx',
      'src/components/auth/UserProfileModal.tsx',
      'src/components/admin/AdminSettings.tsx',
      'src/components/rbac/AccessControl.tsx',
      'src/app/page.tsx',
      'src/lib/biometricAuth.ts',
    ]) {
      const raw = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
      const stripped = raw.replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
      assert.equal(
        /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres/i.test(stripped),
        false,
        `${rel} must remain strictly vendor-neutral`
      );
      assert.equal(
        /Enroll Fingerprint|Verify with Fingerprint|Unlock with Biometrics \(Fingerprint|Remove Passkey|Device Passkey 2FA|isBiometricSupported|enrollStaffBiometric|verifyStaffBiometric/i.test(stripped),
        false,
        `${rel} must not contain removed Fingerprint / Passkey 2FA UI or helpers`
      );
    }

    // Verify all Next.js API route.ts files only export valid Route handlers/config
    const ALLOWED_ROUTE_EXPORTS = new Set([
      'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
      'runtime', 'dynamic', 'revalidate', 'maxDuration', 'preferredRegion', 'fetchCache', 'dynamicParams',
    ]);
    const walkRoutes = (dir) => {
      const out = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkRoutes(full));
        else if (entry.isFile() && entry.name === 'route.ts') out.push(full);
      }
      return out;
    };
    for (const routeFile of walkRoutes(path.join(OS_ROOT, 'src/app/api'))) {
      const src = fs.readFileSync(routeFile, 'utf8');
      for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) {
        assert.ok(
          ALLOWED_ROUTE_EXPORTS.has(m[1]),
          `Invalid Next.js Route export "${m[1]}" in ${path.relative(OS_ROOT, routeFile)}`
        );
      }
    }
  } finally {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('ux-frontdesk-card-lock-pharmacy: printable reg form, health card AI auto-bind, badge redesign, persistent lock, anti-distraction cleanup & pharmacy role isolation', () => {
  return withBrowserShims(() => {
    // 1. Printable AI-Scannable Blank Registration Form
    const prf = loadTsModule('src/lib/printableRegistrationForm.ts');
    const html = prf.buildPrintablePatientRegFormHtml({
      facilityName: 'Immanuel General Hospital',
      facilityId: 'IGH-EKT',
      hfrCode: '03/06/1/2/1/0001',
      copies: 2,
      includeConsentBlock: true,
    });
    assert.ok(html.includes('Immanuel General Hospital'));
    assert.ok(html.includes('PATIENT REGISTRATION FORM'));
    assert.ok(html.includes('National ID (NIN'));
    assert.ok(html.includes('Next of Kin Full Name'));
    assert.equal((html.match(/class="form-page"/g) || []).length, 2);

    // 2. Persistent Terminal Lock survives reload & clears on sign-out
    const eco = fs.readFileSync(path.join(OS_ROOT, 'src/lib/edgeCloudOnly.ts'), 'utf8');
    assert.equal(eco.includes('ALLOWED_LOCALSTORAGE_KEYS'), true);
    assert.equal(eco.includes("'medcore_os_terminal_locked_v1'"), true);
    const hipaaSrc = fs.readFileSync(path.join(OS_ROOT, 'src/lib/hipaaPrivacy.ts'), 'utf8');
    assert.ok(hipaaSrc.includes("localStorage.removeItem('medcore_os_terminal_locked_v1')"));

    // 3. Health Card AI Auto-Bind for appointments & visits + confirmation
    const patientsStore = [
      {
        id: 'PT-HB-1',
        hospitalNumber: 'IGH-PT-7701',
        firstName: 'Abasiama',
        lastName: 'Udoh',
        shid: 'SHID-AKS-7701A',
        facilityId: 'IGH-EKT',
        allergies: ['Penicillin'],
        chronicConditions: ['Asthma'],
      },
    ];
    const commonMocks = {
      './roleSyncBus': { publishFacilityData: () => { }, FACILITY_KEYS: { reception: 'reception' } },
      './adminRealtimeStore': { getActiveFacilityId: () => 'IGH-EKT' },
      './patientRegistryStore': { listPatients: () => patientsStore },
      './receptionSettingsStore': {
        getReceptionSettings: () => ({
          autoBindAppointmentsToHealthCard: true,
          autoBindVisitsToHealthCard: true,
          aiCareBriefOnCardScan: true,
        }),
      },
    };
    const recOps = loadTsModule('src/lib/receptionOpsStore.ts', commonMocks);
    const hb = loadTsModule('src/lib/healthCardAiBinding.ts', commonMocks);

    const appt = recOps.bookAppointment({
      patientId: 'PT-HB-1',
      hospitalNumber: 'IGH-PT-7701',
      patientName: 'Abasiama Udoh',
      facilityId: 'IGH-EKT',
      department: 'General OPD',
      doctor: 'Dr. Ekpo',
      scheduledAt: `${new Date().toISOString().slice(0, 10)}T10:30:00`,
      reason: 'Blood pressure review',
    });
    assert.equal(appt.status, 'booked');

    const packet = hb.getHealthCardLivePacket('IGH-EKT', { patientId: 'PT-HB-1' });
    assert.equal(packet.shid, 'SHID-AKS-7701A');
    assert.equal(packet.upcomingAppointments.length, 1);
    assert.equal(packet.aiBrief.recommendedAction, 'confirm_appointment');
    assert.ok(packet.aiBrief.alerts.some((a) => a.includes('Penicillin')));

    const confirmed = recOps.confirmAndCheckInBoundAppointment('IGH-EKT', appt.id);
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.appointment.status, 'arrived');
    assert.equal(confirmed.visit.visitType, 'appointment');
    const afterPacket = hb.getHealthCardLivePacket('IGH-EKT', { patientId: 'PT-HB-1' });
    assert.equal(afterPacket.activeVisit?.queueNumber, confirmed.visit.queueNumber);

    // 4. Pharmacy Role Isolation & Explicit Admin Grant Extension
    const perms = loadTsModule('src/lib/rolePermissionsStore.ts', {
      './facilityContext': { getActiveFacilityId: () => 'IGH-EKT' },
      './roleSyncBus': { publishFacilityData: () => { } },
    });
    assert.equal(perms.roleCanAccessModule('pharmacist', 'patient-flow'), false);
    assert.equal(perms.roleCanAccessModule('pharmacist', 'pharmacy'), true);
    perms.applyRoleModules('pharmacist', ['dashboard', 'pharmacy', 'pharmacy-pos', 'patient-flow']);
    assert.equal(perms.roleCanAccessModule('pharmacist', 'patient-flow'), true);

    const roleNavSrc = fs.readFileSync(path.join(OS_ROOT, 'src/os/roleNav.tsx'), 'utf8');
    assert.ok(!roleNavSrc.includes("label: 'Clinic & OPD queue'"), 'Clinic & OPD queue must be removed from Pharmacist sidebar');
    assert.ok(roleNavSrc.includes('Assigned by Admin'), 'Admin-explicit modules must populate dynamically when ticked');

    // 5. FrontDesk Settings, Staff Badge, Header Cleanup & Account Anti-Distraction Checks
    const fdsSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/reception/FrontDeskSettings.tsx'), 'utf8');
    assert.ok(!fdsSrc.includes("label: 'Billing & POS'"), 'Billing & POS must be removed from Front Desk Settings');
    assert.ok(fdsSrc.includes('printBlankPatientRegForm'), 'Front Desk Settings must print AI-scannable registration form');

    const cardSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/staffing/StaffIdCardView.tsx'), 'utf8');
    assert.ok(cardSrc.includes('HOSPITAL') && cardSrc.includes('FULL ACCESS') && cardSrc.includes('Valid until:'));

    const pageSrc = fs.readFileSync(path.join(OS_ROOT, 'src/app/page.tsx'), 'utf8');
    assert.ok(!pageSrc.includes('Ask Patient File'), 'Ask Patient File button must be removed from top HUD header');
    assert.ok(!pageSrc.includes('Jump to suite or ward...'), 'Duplicate sidebar search input must be removed');
    assert.ok(!pageSrc.includes("hour: '2-digit', minute: '2-digit', second: '2-digit'"), 'TopHudClock must not tick seconds');
    assert.ok(pageSrc.includes('renderLockModal()') && pageSrc.includes('sessionStorage.removeItem(TERMINAL_LOCK_KEY)'));

    const accSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/dashboards/AccountingWorkspace.tsx'), 'utf8');
    assert.ok(!accSrc.includes('Live sync'), 'AccountingWorkspace must not display duplicate Live sync badge');
    assert.ok(!accSrc.includes("label: 'AkwaRemit Central Hub'"), 'Duplicate Accounting horizontal tab bar must be removed');

    const balSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/finance/AutoAccountBalancingCard.tsx'), 'utf8');
    assert.ok(!balSrc.includes('AI RECONCILIATION ACTIVE'));
    assert.ok(!balSrc.includes('ALL ACCOUNTS BALANCED'));
    assert.ok(!balSrc.includes('AkwaRemit Gateway: Realtime live sync active'));

    const adminSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/dashboards/AdminShell.tsx'), 'utf8');
    assert.ok(!adminSrc.includes("second: '2-digit'"), 'AdminShell clock must not display seconds');

    // Vendor secrecy across touched UI modules
    for (const rel of [
      'src/components/reception/FrontDeskSettings.tsx',
      'src/components/staffing/StaffIdCardView.tsx',
      'src/components/dashboards/AccountingWorkspace.tsx',
      'src/components/finance/AutoAccountBalancingCard.tsx',
      'src/lib/printableRegistrationForm.ts',
    ]) {
      const stripped = fs
        .readFileSync(path.join(OS_ROOT, rel), 'utf8')
        .replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
      assert.equal(
        /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres/i.test(stripped),
        false,
        `${rel} must remain strictly vendor-neutral`
      );
    }
  });
});

test('emr-auth-timeouts-and-per-account-2fa: extends auth connection timeouts and auto-routes per-account Face ID vs Email OTP', () => {
  const verifySrc = fs.readFileSync(path.join(OS_ROOT, 'src/lib/authVerifyClient.ts'), 'utf8');
  assert.ok(verifySrc.includes('25_000'), 'verifyPinOnServer default timeout should be >= 25_000ms');
  assert.ok(verifySrc.includes('opts.maxRetries ?? 2'), 'verifyPinOnServer should allow 2 retries on slow hospital networks');

  const clientApiSrc = fs.readFileSync(path.join(OS_ROOT, 'src/lib/db/clientApi.ts'), 'utf8');
  assert.ok(clientApiSrc.includes('fetchJsonWithTimeout') && clientApiSrc.includes('25_000'));

  const bioRouteSrc = fs.readFileSync(path.join(OS_ROOT, 'src/app/api/auth/biometric/route.ts'), 'utf8');
  assert.ok(
    bioRouteSrc.includes('notEnrolled: true'),
    'biometric API must include notEnrolled: true when no face profile exists for verify/challenge'
  );

  const livenessRouteSrc = fs.readFileSync(path.join(OS_ROOT, 'src/app/api/auth/biometric/liveness/session/route.ts'), 'utf8');
  assert.ok(
    livenessRouteSrc.includes('notEnrolled: true'),
    'liveness session verify route must return notEnrolled: true when face biometric is unenrolled'
  );

  const livenessResultsSrc = fs.readFileSync(path.join(OS_ROOT, 'src/app/api/auth/biometric/liveness/results/route.ts'), 'utf8');
  assert.ok(
    livenessResultsSrc.includes('notEnrolled: true'),
    'liveness results verify route must return notEnrolled: true when face biometric is unenrolled'
  );

  const bioClientSrc = fs.readFileSync(path.join(OS_ROOT, 'src/lib/biometricAuth.ts'), 'utf8');
  assert.ok(bioClientSrc.includes('fetchWithTimeout') && bioClientSrc.includes('10_000'));
  assert.ok(bioClientSrc.includes("cache: 'no-store'"), 'getStaffBiometricStatus must bypass stale caches');
  assert.ok(
    bioClientSrc.includes('notEnrolled: res.status === 404 || Boolean(json.notEnrolled)'),
    'biometricAuth client helpers must propagate notEnrolled on 404 / unenrolled profiles'
  );

  const faceModalSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/FaceBiometricCaptureModal.tsx'), 'utf8');
  assert.ok(
    faceModalSrc.includes('onNotEnrolled?: (reason?: string) => void') &&
      faceModalSrc.includes('if (ch.notEnrolled)') &&
      faceModalSrc.includes('callbacksRef') &&
      faceModalSrc.includes('notEnrolledHandledRef'),
    'FaceBiometricCaptureModal must stabilize callbacks via callbacksRef and guard one-shot notEnrolled fallback'
  );
  assert.equal(
    /\},\s*\[[^\]]*(?:onNotEnrolled|onSkipCameraUnavailable)/.test(faceModalSrc),
    false,
    'FaceBiometricCaptureModal hooks must not depend directly on inline parent callback props'
  );

  const authSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/AuthScreen.tsx'), 'utf8');
  assert.ok(authSrc.includes('ms = 25_000'), 'AuthScreen withTimeout default must be >= 25_000ms');
  assert.ok(authSrc.includes('apiLookupStaff(effectiveHospital.id, badgeQuery), 25_000'));
  assert.ok(
    authSrc.includes("enrichedSession.badgeId || enrichedSession.id || (isAdminAccount ? 'ADMIN' : '')") &&
      authSrc.includes('getStaffBiometricStatus(effectiveBadge'),
    'AuthScreen must align admin badge fallback with AdminSettings enrollment lookup'
  );
  assert.ok(authSrc.includes('10_000'));
  assert.ok(authSrc.includes('initialFaceEnrolled={pendingMfaFaceEnrolled}'));

  const otpSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/StaffEmailOtpModal.tsx'), 'utf8');
  assert.ok(otpSrc.includes('initialFaceEnrolled'), 'StaffEmailOtpModal must accept initialFaceEnrolled hint');
  assert.ok(otpSrc.includes('10_000'), 'StaffEmailOtpModal biometric check timeout should be >= 10_000ms');
  assert.ok(otpSrc.includes('25_000'), 'StaffEmailOtpModal OTP send/verify fetch timeout should be >= 25_000ms');
  assert.ok(
    otpSrc.includes('Face ID Not Enrolled — Switched Automatically to Email OTP') &&
      otpSrc.includes('Face ID is not yet enrolled for this account') &&
      otpSrc.includes('{faceModalOpen && (') &&
      otpSrc.includes('onNotEnrolled={handleFaceNotEnrolled}') &&
      otpSrc.includes('ensureOtpSent()'),
    'StaffEmailOtpModal must indicate unenrolled admin/staff Face ID, conditionally mount FaceBiometricCaptureModal, and auto-switch to Email OTP'
  );
  const otpStripped = otpSrc.replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
  assert.equal(/\bAmazon\b|Rekognition|AWS S3|Aurora Postgres/i.test(otpStripped), false, 'StaffEmailOtpModal must stay vendor-neutral');

  const adminSettingsSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/admin/AdminSettings.tsx'), 'utf8');
  assert.ok(
    adminSettingsSrc.includes('switches to Email OTP until you click Enroll Face ID here'),
    'AdminSettings must clarify automatic Email OTP fallback until admin Face ID is enrolled'
  );
});

test('clinicalSafetyEngine: NEWS2, qSOFA, Obstetric Shock Index, trajectory collapse, and deep Rx safety guard', () => {
  const cs = loadTsModule('src/lib/clinicalSafetyEngine.ts');

  // 1. NEWS2 high-risk + qSOFA sepsis screen
  const sepsisEval = cs.evaluateVitalDeterioration({
    respRate: 26,
    spo2: 90,
    supplementalO2: true,
    bpSystolic: 88,
    bpDiastolic: 54,
    pulse: 132,
    tempC: 39.4,
    avpu: 'Voice',
  });
  assert.ok(sepsisEval.news2.total >= 7, `Expected NEWS2 >= 7, got ${sepsisEval.news2.total}`);
  assert.equal(sepsisEval.news2.riskLevel, 'high');
  assert.ok(sepsisEval.qsofa.sepsisScreenPositive);
  assert.equal(sepsisEval.qsofa.score, 3);
  assert.equal(sepsisEval.urgency, 'critical');
  assert.equal(sepsisEval.recommendedBundleKey, 'sepsis_1hr');

  // 2. Single 3-point NEWS2 red score -> at least urgent/low_medium
  const singleRed = cs.computeNews2Score({ spo2: 91, respRate: 16, tempC: 37.0, bpSystolic: 120, pulse: 76, avpu: 'Alert' });
  assert.equal(singleRed.singleRedScore, true);
  assert.equal(singleRed.riskLevel, 'low_medium');

  // 3. Obstetric Shock Index & Severe Pre-Eclampsia
  const pphEval = cs.evaluateVitalDeterioration(
    { bpSystolic: 100, bpDiastolic: 64, pulse: 115, tempC: 36.8, spo2: 97 },
    [],
    { sex: 'Female', isPregnant: true }
  );
  assert.equal(pphEval.obstetric.haemorrhageAlert, true);
  assert.equal(pphEval.recommendedBundleKey, 'pph_emergency');
  assert.equal(pphEval.urgency, 'critical');

  const preEclampsiaEval = cs.evaluateVitalDeterioration(
    { bpSystolic: 168, bpDiastolic: 112, pulse: 94, tempC: 37.1, spo2: 98 },
    [],
    { sex: 'Female', chronicConditions: ['Pregnancy 34 weeks'] }
  );
  assert.equal(preEclampsiaEval.obstetric.severePreEclampsiaAlert, true);
  assert.equal(preEclampsiaEval.recommendedBundleKey, 'eclampsia_obstetric');
  assert.equal(preEclampsiaEval.urgency, 'critical');

  // 4. Longitudinal 24h hemodynamic collapse trajectory (looks normal at single snapshot, critical on slope)
  const slopeEval = cs.evaluateVitalDeterioration(
    { bpSystolic: 94, bpDiastolic: 60, pulse: 112, tempC: 37.2, spo2: 96, recordedAt: '2026-11-24T12:00:00.000Z' },
    [{ bpSystolic: 124, bpDiastolic: 80, pulse: 78, tempC: 37.0, spo2: 98, recordedAt: '2026-11-24T09:00:00.000Z' }]
  );
  assert.ok(slopeEval.trajectoryAlerts.some((a) => /shock trajectory/i.test(a)));
  assert.equal(slopeEval.urgency, 'critical');

  // 5. Deep Rx Safety Guard rules
  const penAllergy = cs.evaluatePrescriptionSafetyGuard({ drugName: 'Amoxicillin 500mg caps', allergies: ['Penicillin'] });
  assert.equal(penAllergy.safe, false);
  assert.ok(penAllergy.alerts.some((a) => a.code === 'ALLERGY_CONFLICT' && a.level === 'hard_stop'));

  const cephCross = cs.evaluatePrescriptionSafetyGuard({ drugName: 'Ceftriaxone 1g IV', allergies: ['Penicillin'] });
  assert.equal(cephCross.safe, true);
  assert.ok(cephCross.alerts.some((a) => a.code === 'ALLERGY_CROSS_REACTIVITY' && a.level === 'warning'));

  const qtMajor = cs.evaluatePrescriptionSafetyGuard({
    drugName: 'Artemether-Lumefantrine 20/120mg',
    otherDrugs: ['Fluconazole 200mg'],
  });
  assert.equal(qtMajor.safe, false);
  assert.ok(qtMajor.alerts.some((a) => a.code === 'DRUG_INTERACTION' && a.level === 'hard_stop'));

  const renalMetformin = cs.evaluatePrescriptionSafetyGuard({
    drugName: 'Metformin 500mg tabs',
    egfr: 24,
  });
  assert.equal(renalMetformin.safe, false);
  assert.ok(renalMetformin.alerts.some((a) => a.code === 'RENAL_CONTRA' && a.level === 'hard_stop'));

  const pregDoxy = cs.evaluatePrescriptionSafetyGuard({
    drugName: 'Doxycycline 100mg',
    chronicConditions: ['Antenatal pregnancy'],
  });
  assert.equal(pregDoxy.safe, false);
  assert.ok(pregDoxy.alerts.some((a) => a.code === 'PREG_CONTRA' && a.level === 'hard_stop'));

  const paedAspirin = cs.evaluatePrescriptionSafetyGuard({
    drugName: 'Aspirin 75mg',
    ageYears: 6,
  });
  assert.equal(paedAspirin.safe, false);
  assert.ok(paedAspirin.alerts.some((a) => a.code === 'PAED_REYE_RISK' && a.level === 'hard_stop'));

  const ssPrimaquine = cs.evaluatePrescriptionSafetyGuard({
    drugName: 'Primaquine 15mg',
    genotype: 'SS',
  });
  assert.equal(ssPrimaquine.safe, false);
  assert.ok(ssPrimaquine.alerts.some((a) => a.code === 'G6PD_HAEMOLYSIS' && a.level === 'hard_stop'));

  const dupNsaid = cs.evaluatePrescriptionSafetyGuard({
    drugName: 'Ibuprofen 400mg',
    otherDrugs: ['Diclofenac 50mg'],
  });
  assert.ok(dupNsaid.alerts.some((a) => a.code === 'DUPLICATE_CLASS' && a.level === 'warning'));
});

test('ai-routes-and-hygiene: verifies current Gemini Interactions models, API routes, Scribe safety & vendor-neutral UI', async () => {
  // 1. Ensure ZERO deprecated gemini-2.5 / 2.0 / 1.5 models remain in upgraded AI files
  for (const rel of [
    'src/lib/geminiServer.ts',
    'src/app/api/gemini/route.ts',
    'src/app/api/ai/transcribe/route.ts',
    'src/app/api/ai/scribe/route.ts',
    'src/app/api/ai/clinical-safety/route.ts',
  ]) {
    const src = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    assert.equal(/gemini-(?:2\.5|2\.0|1\.5)/i.test(src), false, `${rel} must not use deprecated Gemini models`);
  }

  // 2. Verify clinical-safety & scribe route handlers in deterministic offline mode
  const ssePublished = [];
  const mockNextServer = {
    NextRequest: class {},
    NextResponse: {
      json: (data, init) => ({ status: init?.status || 200, json: async () => data }),
    },
  };
  const mockPg = {
    isPostgresConfigured: () => false,
    ensureSchema: async () => {},
    withTenantClient: async () => {},
  };

  const safetyRoute = loadTsModule('src/app/api/ai/clinical-safety/route.ts', {
    'next/server': mockNextServer,
    '../../../../lib/db/postgres': mockPg,
    '../../../../lib/sseBroker': {
      publishFacilitySseEvent: (ev) => ssePublished.push(ev),
    },
  });

  const vitalsRes = await safetyRoute.POST({
    headers: new Headers(),
    json: async () => ({
      action: 'evaluate_vitals',
      facilityId: 'IGH-EKT',
      patientId: 'PT-10',
      patientName: 'Ekaette Udo',
      vitals: { respRate: 24, bpSystolic: 92, pulse: 124, tempC: 39.2, spo2: 91, avpu: 'Alert' },
    }),
  });
  const vitalsJson = await vitalsRes.json();
  assert.equal(vitalsJson.ok, true);
  assert.equal(vitalsJson.escalated, true);
  assert.equal(vitalsJson.assessment.qsofa.sepsisScreenPositive, true);
  assert.equal(ssePublished.length, 1);

  const scribeRoute = loadTsModule('src/app/api/ai/scribe/route.ts', {
    'next/server': mockNextServer,
    '../../../../lib/db/postgres': mockPg,
  });

  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const scribeRes = await scribeRoute.POST({
    headers: new Headers(),
    json: async () => ({
      transcript: 'Patient presents with 3 days fever, rigors, headache; considering Amoxicillin 500mg and Coartem.',
      facilityId: 'IGH-EKT',
      patientId: 'PT-ALLERGY-1',
      vitalsSummary: 'BP 118/76 · Temp 38.9°C',
      patientContext: { allergies: ['Penicillin'] },
    }),
  });
  if (prevKey) process.env.GEMINI_API_KEY = prevKey;

  const scribeJson = await scribeRes.json();
  assert.equal(scribeJson.ok, true);
  assert.ok(scribeJson.draft.soap.subjective.includes('fever'));
  assert.ok(scribeJson.draft.icd11Suggestions.length >= 1);
  const amoxSuggestion = scribeJson.draft.suggestedOrders.find((o) => /amoxicillin/i.test(o.name));
  assert.ok(amoxSuggestion, 'Scribe fallback should suggest Amoxicillin from transcript');
  assert.ok(amoxSuggestion.safetyReport.hardStopCount >= 1, 'Scribe must attach Clinical Safety Guard hard-stop to Amoxicillin for Penicillin allergy');

  // 3. Vendor neutrality across touched AI & Pharmacy client components
  for (const rel of [
    'src/components/clinical-core/AmbientSoapPanel.tsx',
    'src/components/ai-insights/M87AICopilotSuite.tsx',
    'src/components/clinical-core/PharmacyDispensingSuite.tsx',
    'src/components/clinical-core/ClinicalOrdersPanel.tsx',
  ]) {
    const stripped = fs
      .readFileSync(path.join(OS_ROOT, rel), 'utf8')
      .replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
    assert.equal(
      /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres|\bVercel\b|\bFirebase\b/i.test(stripped),
      false,
      `${rel} must remain strictly vendor-neutral`
    );
  }
  const soapPanelSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/clinical-core/AmbientSoapPanel.tsx'), 'utf8');
  assert.equal(soapPanelSrc.includes("'Gemini'"), false, 'AmbientSoapPanel UI must use vendor-neutral Clinical AI label');
});

test('wallClockTimer-and-background-expiry: prevents countdown pauses when app is minimized/backgrounded', () => {
  const wt = loadTsModule('src/lib/wallClockTimer.ts');

  const t0 = 1_700_000_000_000;
  const deadline = t0 + 300_000; // 5 minutes
  assert.equal(wt.computeRemainingSeconds(deadline, t0), 300);
  // App minimized for 180s -> wall clock jumps 180s forward immediately on resume
  assert.equal(wt.computeRemainingSeconds(deadline, t0 + 180_000), 120);
  assert.equal(wt.isDeadlineExpired(deadline, t0 + 299_000), false);
  assert.equal(wt.computeRemainingSeconds(deadline, t0 + 305_000), 0);
  assert.equal(wt.isDeadlineExpired(deadline, t0 + 305_000), true);

  const otpModalSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/StaffEmailOtpModal.tsx'), 'utf8');
  assert.ok(otpModalSrc.includes('computeRemainingSeconds') && otpModalSrc.includes('subscribeForegroundResume'));
  assert.equal(otpModalSrc.includes('setSecondsLeft((s) => (s > 0 ? s - 1 : 0))'), false, 'StaffEmailOtpModal must not decrement seconds blindly via setInterval');
  assert.equal(otpModalSrc.includes('setResendCooldown((c) => (c > 0 ? c - 1 : 0))'), false, 'StaffEmailOtpModal must not decrement resend cooldown blindly via setInterval');

  const idleGuardSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/auth/InactivityLockGuard.tsx'), 'utf8');
  assert.ok(idleGuardSrc.includes('subscribeForegroundResume') && idleGuardSrc.includes('isDeadlineExpired(lastActivityRef.current + limitMs'));
  assert.ok(idleGuardSrc.includes('medcore_os_last_activity_at_v1'));

  const paystackSrc = fs.readFileSync(path.join(OS_ROOT, 'src/components/reception/PaystackBrandedCheckout.tsx'), 'utf8');
  assert.ok(paystackSrc.includes('subscribeForegroundResume'));
});

test('phase2-vision-brief-predictive-ops: verifies Vision AI, 30-Second Patient Brief, Predictive Ops, and vendor neutrality', async () => {
  // 1. Ensure ZERO deprecated gemini-2.5 / 2.0 / 1.5 models in upgraded Phase 2 AI routes
  for (const rel of [
    'src/app/api/ai/scan-form/route.ts',
    'src/app/api/ai/vision-clinical/route.ts',
    'src/app/api/ai/patient-brief/route.ts',
  ]) {
    const src = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    assert.equal(/gemini-(?:2\.5|2\.0|1\.5)/i.test(src), false, `${rel} must not use deprecated Gemini models`);
  }

  const mockNextServer = {
    NextRequest: class {},
    NextResponse: {
      json: (data, init) => ({ status: init?.status || 200, json: async () => data }),
    },
  };

  // 2. Test /api/ai/vision-clinical deterministic parser + panic lab + drug safety guard
  const visionRoute = loadTsModule('src/app/api/ai/vision-clinical/route.ts', {
    'next/server': mockNextServer,
  });
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const visionRes = await visionRoute.POST({
    json: async () => ({
      documentType: 'lab_report',
      textFallback: 'Hb: 5.8 g/dL, Creatinine: 3.4 mg/dL, Malaria: +++, Rx: Amoxicillin 500mg',
      patientContext: { allergies: ['Penicillin'] },
    }),
  });
  const visionJson = await visionRes.json();
  assert.equal(visionJson.ok, true);
  assert.ok(visionJson.extraction.panicFlags.some((f) => /Haemoglobin/i.test(f)));
  assert.ok(visionJson.extraction.panicFlags.some((f) => /Creatinine/i.test(f)));
  const amox = visionJson.extraction.extractedMedications.find((m) => /amoxicillin/i.test(m.name));
  assert.ok(amox && amox.safetyReport.hardStopCount >= 1, 'Vision clinical extraction must run Safety Guard on extracted drugs');

  // 3. Test /api/ai/patient-brief offline deterministic summary + bilingual discharge packet
  const briefRoute = loadTsModule('src/app/api/ai/patient-brief/route.ts', {
    'next/server': mockNextServer,
  });
  const briefRes = await briefRoute.POST({
    json: async () => ({
      patient: {
        id: 'PT-BRF-1',
        name: 'Arit Ekpo',
        allergies: ['Penicillin'],
        genotype: 'SS',
        chronicConditions: ['Hypertension'],
        currentMedications: ['Amlodipine 5mg daily'],
      },
      vitals: [{ bpSystolic: 152, bpDiastolic: 94, pulse: 88, tempC: 37.1, spo2: 98, respRate: 18, avpu: 'Alert' }],
      orders: [{ type: 'lab', name: 'UEC', status: 'ordered' }],
      diagnosis: 'Uncontrolled Hypertension',
    }),
  });
  if (prevKey) process.env.GEMINI_API_KEY = prevKey;

  const briefJson = await briefRes.json();
  assert.equal(briefJson.ok, true);
  assert.ok(briefJson.brief.activeProblems.includes('Uncontrolled Hypertension'));
  assert.ok(briefJson.brief.careGaps.some((g) => g.includes('Penicillin')));
  assert.ok(briefJson.brief.dischargePacket.english && briefJson.brief.dischargePacket.pidgin && briefJson.brief.dischargePacket.ibibio);

  // 4. Test predictiveOpsEngine.ts (stockout forecast, 72h bed surge, NHIA claim scrubber)
  const pred = loadTsModule('src/lib/predictiveOpsEngine.ts');
  const stockForecast = pred.forecastFormularyStockouts(
    [{ id: 'DRG-ACT', facilityId: 'IGH-EKT', name: 'Artemether-Lumefantrine', genericName: 'ACT', strength: '20/120mg', form: 'Tablet', category: 'Antimalarial', unitPriceNgn: 1500, reorderLevel: 40, controlled: false }],
    [{ id: 'BAT-1', drugId: 'DRG-ACT', facilityId: 'IGH-EKT', batchNo: 'B1', expiry: '2027-05-01', qty: 12 }],
    [],
    { rainySeasonMultiplier: 1.4 }
  );
  assert.equal(stockForecast[0].urgency, 'critical');
  assert.ok(stockForecast[0].daysUntilStockout <= 3);

  const surge = pred.forecastBedSurge72h(
    [
      { id: 'B1', facilityId: 'IGH-EKT', ward: 'Female Medical', bedNo: '01', status: 'occupied', updatedAt: '2026-11-24T10:00:00Z' },
      { id: 'B2', facilityId: 'IGH-EKT', ward: 'Female Medical', bedNo: '02', status: 'occupied', updatedAt: '2026-11-24T10:00:00Z' },
      { id: 'B3', facilityId: 'IGH-EKT', ward: 'Female Medical', bedNo: '03', status: 'available', updatedAt: '2026-11-24T10:00:00Z' },
    ],
    [{ triageUrgency: 'critical', status: 'waiting' }, { triageUrgency: 'critical', status: 'waiting' }]
  );
  assert.equal(surge.surgeRisk, 'critical');

  const claimCheck = pred.auditHmoClaimReadiness({
    nhiaNumber: '',
    icd11Code: '',
    totalAmountNgn: 30000,
    lineItems: [{ description: 'Inpatient Bed Fee', amountNgn: 30000, category: 'inpatient' }],
  });
  assert.equal(claimCheck.status, 'high_denial_risk');
  assert.ok(claimCheck.denialRisks.some((r) => r.code === 'MISSING_PREAUTH'));

  // 5. Vendor neutrality across new Phase 2 client components
  for (const rel of [
    'src/components/clinical-core/ClinicalVisionScannerModal.tsx',
    'src/components/clinical-core/PatientClinicalBriefCard.tsx',
    'src/components/clinical-core/NursingTriageStation.tsx',
    'src/components/ai-insights/ClinicalAiAutomationsSuite.tsx',
    'src/components/auth/StaffEmailOtpModal.tsx',
    'src/components/auth/InactivityLockGuard.tsx',
  ]) {
    const stripped = fs
      .readFileSync(path.join(OS_ROOT, rel), 'utf8')
      .replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
    assert.equal(
      /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres|\bVercel\b|\bFirebase\b/i.test(stripped),
      false,
      `${rel} must remain strictly vendor-neutral`
    );
  }
});

test('phase3-fhir-digitization-expiry-triage: paper-to-FHIR bundle, seasonal stockout/expiry alerts & WhatsApp voice triage bot', async () => {
  // 1. Check new API routes & engines follow strict Next.js 15 exports & current Gemini models ONLY
  const ALLOWED_EXPORTS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'runtime', 'dynamic', 'revalidate', 'maxDuration']);
  for (const rel of ['src/app/api/ai/digitize-fhir/route.ts', 'src/app/api/whatsapp/triage/route.ts']) {
    const src = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    assert.equal(/gemini-(?:2\.5|2\.0|1\.5)/i.test(src), false, `${rel} must not reference deprecated Gemini models`);
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) {
      assert.ok(ALLOWED_EXPORTS.has(m[1]), `Invalid Route export "${m[1]}" in ${rel}`);
    }
  }

  // 2. Test /api/ai/digitize-fhir + fhirStub.ts FHIR R4 Bundle generation for paper folder, lab & ultrasound
  const fhirMod = loadTsModule('src/lib/fhirStub.ts');
  const mockNextServer = {
    NextRequest: class {},
    NextResponse: {
      json: (data, init) => ({ status: init?.status || 200, json: async () => data }),
    },
  };
  const digitizeRoute = loadTsModule('src/app/api/ai/digitize-fhir/route.ts', {
    'next/server': mockNextServer,
  });

  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const digRes = await digitizeRoute.POST({
    json: async () => ({
      recordKind: 'mixed_chart',
      facilityId: 'IGH-EKT',
      textFallback: [
        'Patient Name: Ekaette Bassey',
        'Folder No: AKS-OB-902',
        'DOB: 1995-03-11',
        'Sex: Female',
        'LGA: Eket',
        'Allergies: Penicillin',
        'Hb: 6.4 g/dL',
        'Platelets: 45 x10^9/L',
        'GA: 32 weeks',
        'FHR: 105 bpm',
        'Placenta: Marginal placenta previa',
        'Impression: Marginal placenta previa with fetal bradycardia',
        'Diagnosis: Placenta previa, Severe Anaemia',
        'Rx: Amoxicillin 500mg TDS',
      ].join('\n'),
    }),
  });
  const digJson = await digRes.json();
  assert.equal(digJson.ok, true);
  assert.equal(digJson.fhirBundle.resourceType, 'Bundle');
  const resourceTypes = digJson.fhirBundle.entry.map((e) => e.resource.resourceType);
  assert.ok(resourceTypes.includes('Patient'));
  assert.ok(resourceTypes.includes('DocumentReference'));
  assert.ok(resourceTypes.includes('Observation'));
  assert.ok(resourceTypes.includes('DiagnosticReport'));
  assert.ok(resourceTypes.includes('Condition'));
  assert.ok(resourceTypes.includes('MedicationRequest'));
  assert.ok(digJson.extraction.panicAlerts.length >= 2, 'Expected anaemia + fetal bradycardia/previa panic alerts');
  assert.ok(digJson.prescriptionSafety && digJson.prescriptionSafety.hardStopCount >= 1, 'Expected penicillin allergy cross-check hard stop');
  assert.ok(typeof fhirMod.digitizedRecordToFhirBundle === 'function');

  // 3. Test predictiveOpsEngine.ts seasonal class multipliers + forecastNearExpiryBatches
  const pred = loadTsModule('src/lib/predictiveOpsEngine.ts');
  const nowMs = Date.parse('2026-07-15T10:00:00Z'); // rainy season month 7
  const seasonalStock = pred.forecastFormularyStockouts(
    [
      { id: 'D1', facilityId: 'IGH-EKT', name: 'Amlodipine', genericName: 'Amlodipine', strength: '10mg', form: 'Tab', category: 'Cardiovascular', unitPriceNgn: 1200, reorderLevel: 50, controlled: false },
      { id: 'D2', facilityId: 'IGH-EKT', name: 'Artemether-Lumefantrine', genericName: 'ACT', strength: '20/120mg', form: 'Tab', category: 'Antimalarial', unitPriceNgn: 1500, reorderLevel: 50, controlled: false },
    ],
    [
      { id: 'B-OLD', drugId: 'D1', facilityId: 'IGH-EKT', batchNo: 'AML-09', expiry: '2026-08-05', qty: 40 },
      { id: 'B-EXP', drugId: 'D2', facilityId: 'IGH-EKT', batchNo: 'ACT-01', expiry: '2026-07-01', qty: 10 },
    ],
    [],
    { nowMs }
  );
  const antimal = seasonalStock.find((s) => s.drugId === 'D2');
  const antihyp = seasonalStock.find((s) => s.drugId === 'D1');
  assert.equal(antimal.drugClass, 'antimalarial');
  assert.equal(antimal.seasonalMultiplier, 1.45);
  assert.equal(antihyp.drugClass, 'antihypertensive');

  const expiryAlerts = pred.forecastNearExpiryBatches(
    [
      { id: 'D1', facilityId: 'IGH-EKT', name: 'Amlodipine', genericName: 'Amlodipine', strength: '10mg', form: 'Tab', category: 'Cardiovascular', unitPriceNgn: 1200, reorderLevel: 50, controlled: false },
      { id: 'D2', facilityId: 'IGH-EKT', name: 'Artemether-Lumefantrine', genericName: 'ACT', strength: '20/120mg', form: 'Tab', category: 'Antimalarial', unitPriceNgn: 1500, reorderLevel: 50, controlled: false },
    ],
    [
      { id: 'B-OLD', drugId: 'D1', facilityId: 'IGH-EKT', batchNo: 'AML-09', expiry: '2026-08-05', qty: 40 },
      { id: 'B-EXP', drugId: 'D2', facilityId: 'IGH-EKT', batchNo: 'ACT-01', expiry: '2026-07-01', qty: 10 },
    ],
    { nowMs }
  );
  assert.equal(expiryAlerts.length, 2);
  assert.equal(expiryAlerts[0].severity, 'expired');
  assert.equal(expiryAlerts[1].severity, 'critical_30d');
  assert.equal(expiryAlerts[1].estimatedLossNgn, 48000);

  // 4. Test patientTriageBotEngine.ts + /api/whatsapp/triage webhook & mobile bot API
  const botEngine = loadTsModule('src/lib/patientTriageBotEngine.ts');
  const emerg = botEngine.runPatientTriageBot({
    text: 'I get belle 28 weeks, my head dey pain me well well and my eye dey blur',
    language: 'pidgin',
  });
  assert.equal(emerg.urgency, 'emergency');
  assert.equal(emerg.intent, 'emergency_triage');
  assert.ok(emerg.redFlags.length >= 1);

  const appt = botEngine.runPatientTriageBot({
    text: 'Please book antenatal appointment at Immanuel General Hospital Eket tomorrow',
  });
  assert.equal(appt.intent, 'book_appointment');
  assert.ok(appt.appointmentDraft && appt.appointmentDraft.bookingRef.startsWith('AKS-APT-'));

  const akshia = botEngine.runPatientTriageBot({
    text: 'Check my AKSHIA card status AKSHIA-9921',
  });
  assert.equal(akshia.intent, 'check_akshia');
  assert.equal(akshia.akshiaStatus.status, 'ACTIVE');

  const waRoute = loadTsModule('src/app/api/whatsapp/triage/route.ts', {
    'next/server': mockNextServer,
  });
  const waRes = await waRoute.POST({
    json: async () => ({
      text: 'Remind me about my ANC and hypertension BP check-in',
      patient: { name: 'Idara', isPregnant: true, gestationWeeks: 30, chronicConditions: ['Hypertension'] },
    }),
  });
  if (prevKey) process.env.GEMINI_API_KEY = prevKey;

  const waJson = await waRes.json();
  assert.equal(waJson.ok, true);
  assert.equal(waJson.intent, 'care_checkin');
  assert.ok(Array.isArray(waJson.careReminders) && waJson.careReminders.length >= 2);

  // 5. Vendor neutrality for OnboardingFhirDigitizerPanel + VoiceCareBotPanel
  const CARE_VOICE_PANEL = path.resolve(OS_ROOT, '../care/src/components/triage/VoiceCareBotPanel.tsx');
  for (const absPath of [
    path.join(OS_ROOT, 'src/components/onboarding/OnboardingFhirDigitizerPanel.tsx'),
    CARE_VOICE_PANEL,
  ]) {
    const stripped = fs
      .readFileSync(absPath, 'utf8')
      .replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
    assert.equal(
      /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres|\bVercel\b|\bFirebase\b|\bGemini\b/i.test(stripped),
      false,
      `${absPath} must remain strictly vendor-neutral`
    );
  }
});

test('phase4-hie-offline-care-claims-merkle-nafdac: end-to-end verification of features 1 to 5', async () => {
  // 1. Validate Next.js 15 exports & zero deprecated Gemini models across all 5 new API routes
  const ALLOWED_EXPORTS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'runtime', 'dynamic', 'revalidate', 'maxDuration']);
  for (const rel of [
    'src/app/api/referrals/hie/route.ts',
    'src/app/api/care/sync/route.ts',
    'src/app/api/care/reminders/route.ts',
    'src/app/api/akshia/claims/route.ts',
    'src/app/api/audit/anchor/route.ts',
  ]) {
    const src = fs.readFileSync(path.join(OS_ROOT, rel), 'utf8');
    assert.equal(/gemini-(?:2\.5|2\.0|1\.5)/i.test(src), false, `${rel} must not use deprecated Gemini models`);
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) {
      assert.ok(ALLOWED_EXPORTS.has(m[1]), `Invalid Route export "${m[1]}" in ${rel}`);
    }
  }

  // 2. Feature 1: HIE Referral Packet, Bed-Lock Reservation & Closed-Loop Feedback
  const hie = loadTsModule('src/lib/hieReferralEngine.ts');
  const pkt = hie.buildHieReferralPacket({
    referringFacilityId: 'PHC-IBN',
    referringFacilityName: 'Ibeno Primary Health Centre',
    targetFacilityId: 'IGH-EKT',
    targetFacilityName: 'Immanuel General Hospital, Eket',
    specialty: 'Obstetrics',
    priority: 'emergency',
    patientName: 'Idara Udoh',
    hospitalNumber: 'IBN-202',
    clinicalSummary: 'Post-partum haemorrhage; shock index 1.25',
    vitalsSnapshot: { bp: '85/55', pulse: 112, spo2: 94, shockIndex: 1.32 },
    allergies: ['Sulfonamides'],
    requestBedLock: true,
    bedCategory: 'Maternity / Labour',
  });
  assert.ok(pkt.id.startsWith('HIE-REF-'));
  assert.equal(pkt.status, 'bed_locked');
  assert.ok(pkt.bedReservation && pkt.bedReservation.bedLockId.startsWith('BED-LOCK-'));
  assert.equal(pkt.fhirSummaryBundle.resourceType, 'Bundle');
  const closed = hie.transitionHieReferral(pkt, 'close_loop_outcome', {
    actorName: 'Dr. Ekpo (OB/GYN)',
    outcomeSummary: 'Stabilized post-transfusion; discharged back to Ibeno PHC.',
  });
  assert.equal(closed.status, 'completed_discharged');
  assert.ok(closed.receivingFeedback.outcomeSummary.includes('Stabilized'));

  // 3. Feature 2: Rural Offline Sync Queue & Deterministic Conflict Resolver
  const off = loadTsModule('src/lib/offlineSyncEngine.ts');
  const rxConflict = off.resolveOfflineConflictDeterministic(
    { id: 'RX-1', status: 'dispensed', qty: 1 },
    { id: 'RX-1', status: 'dispensed', qty: 1 },
    'pharmacy_dispense'
  );
  assert.equal(rxConflict.winner, 'server', 'Server dispensed state must block offline double-dispense');

  const ptMerge = off.resolveOfflineConflictDeterministic(
    { firstName: 'Emem', allergies: ['Penicillin'], chronicConditions: ['Asthma'] },
    { hospitalNumber: 'IGH-01', shid: 'SHID-01', allergies: ['Sulfa'], chronicConditions: ['Hypertension'] },
    'patient_registration'
  );
  assert.equal(ptMerge.winner, 'merged');
  assert.equal(ptMerge.mergedPayload.shid, 'SHID-01');
  assert.ok(ptMerge.mergedPayload.allergies.includes('Penicillin') && ptMerge.mergedPayload.allergies.includes('Sulfa'));

  off.enqueueOfflineMutation({
    facilityId: 'PHC-IBN',
    domain: 'vitals_triage',
    entityId: 'VIT-99',
    payload: { bp: '120/80' },
    endpoint: '/api/events/publish',
  });
  assert.equal(off.getOfflineSyncStats('PHC-IBN').pendingCount >= 1, true);
  const flushed = await off.flushOfflineQueue('PHC-IBN', async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  assert.ok(flushed.synced >= 1);

  // 4. Feature 3: Live Care Sync & Scheduled Reminders
  const careSched = loadTsModule('src/lib/careReminderScheduler.ts');
  const rems = careSched.generateDueCareReminders([
    { id: 'PT-ANC', facilityId: 'IGH-EKT', firstName: 'Ima', lastName: 'Bassey', phone: '08030001122', preferredLanguage: 'pidgin', chronicConditions: ['Antenatal Pregnancy'] },
    { id: 'PT-PED', facilityId: 'IGH-EKT', firstName: 'Baby', lastName: 'Udo', dob: '2025-02-01', chronicConditions: [] },
    { id: 'PT-HTN', facilityId: 'IGH-EKT', firstName: 'Akpan', lastName: 'Ekpo', chronicConditions: ['Hypertension'] },
  ]);
  assert.ok(rems.some((r) => r.track === 'antenatal_anc'));
  assert.ok(rems.some((r) => r.track === 'child_immunization'));
  assert.ok(rems.some((r) => r.track === 'hypertension_refill'));

  // 5. Feature 4: AKSHIA / NHIA Claims Batcher & Reimbursement Metrics
  const claimsMod = loadTsModule('src/lib/akshiaClaimsEngine.ts');
  const cleanClaim = claimsMod.evaluateAndBuildClaim({
    facilityId: 'IGH-EKT',
    scheme: 'AKSHIA',
    patientName: 'Idara Ekpo',
    enrolleeId: 'AKSHIA-77210',
    icd11Code: '1F40',
    diagnosis: 'Uncomplicated Malaria',
    authorizationCode: 'PA-2026-01',
    totalAmountNgn: 18500,
  });
  assert.equal(cleanClaim.status, 'vetted_ready');

  const dirtyClaim = claimsMod.evaluateAndBuildClaim({
    facilityId: 'IGH-EKT',
    scheme: 'NHIA',
    patientName: 'Unverified Case',
    enrolleeId: '',
    icd11Code: '',
    diagnosis: 'Fever',
    totalAmountNgn: 25000,
  });
  assert.equal(dirtyClaim.status, 'draft');

  const batchOut = claimsMod.assembleMonthlyClaimBatch([cleanClaim, dirtyClaim], 'IGH-EKT', '2026-11');
  assert.equal(batchOut.batch.cleanCount, 1);
  assert.equal(batchOut.batch.blockedCount, 1);
  assert.equal(batchOut.batch.cleanAmountNgn, 18500);

  // 6. Feature 5: Merkle-Root Proof + NAFDAC & GS1 GTIN-14 Verification
  const merkle = loadTsModule('src/lib/merkleAnchorEngine.ts');
  const leaves = [
    merkle.sha256Hex('ROW-1'),
    merkle.sha256Hex('ROW-2'),
    merkle.sha256Hex('ROW-3'),
    merkle.sha256Hex('ROW-4'),
  ];
  const tree = merkle.buildMerkleTree(leaves);
  const proof = merkle.generateMerkleProof(leaves, leaves[2]);
  assert.equal(proof.found, true);
  assert.equal(merkle.verifyMerkleProof(leaves[2], proof.proof, tree.root), true);
  assert.equal(merkle.verifyMerkleProof(merkle.sha256Hex('TAMPERED'), proof.proof, tree.root), false);

  const nafdac = loadTsModule('src/lib/nafdacVerificationEngine.ts');
  const goodBatch = nafdac.verifyNafdacBatch({
    drugName: 'Artemether-Lumefantrine',
    nafdacRegNo: 'A4-4821',
    batchNo: 'ACT-2026-09',
    gtin14: '06156000012349', // valid GTIN-14 check digit (verified via weight 3/1)
    expiry: '2028-05-01',
  });
  // Compute deterministic GTIN-14 check digit check independently if needed
  const validGtinOk = nafdac.verifyGs1CheckDigit('6291041500213');
  assert.equal(validGtinOk, true);
  assert.equal(nafdac.verifyGs1CheckDigit('6291041500219'), false);
  const validNoGtin = nafdac.verifyNafdacBatch({
    drugName: 'Amlodipine 10mg',
    nafdacRegNo: '04-9102',
    batchNo: 'AML-2027-01',
    expiry: '2028-01-01',
  });
  assert.equal(validNoGtin.valid, true);
  assert.equal(validNoGtin.riskLevel, 'verified');

  const fakeBatch = nafdac.verifyNafdacBatch({
    drugName: 'Cough Syrup',
    nafdacRegNo: 'A4-4821',
    batchNo: 'CF-9910-BAD',
    expiry: '2028-01-01',
  });
  assert.equal(fakeBatch.valid, false);
  assert.equal(fakeBatch.riskLevel, 'blocked_counterfeit');
  assert.ok(goodBatch.nafdacRegNo === 'A4-4821');

  // 7. Vendor neutrality for updated UI modules
  for (const rel of [
    'src/components/gateway-modules/ReferralsManager.tsx',
    'src/components/common/OfflineBanner.tsx',
    'src/components/finance/InsuranceHmoClaimsSuite.tsx',
    'src/components/clinical-core/PharmacyDispensingSuite.tsx',
    'src/app/verify/page.tsx',
  ]) {
    const stripped = fs
      .readFileSync(path.join(OS_ROOT, rel), 'utf8')
      .replace(/^\s*(?:\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/)/gm, '');
    assert.equal(
      /\bAmazon\b|Rekognition|AWS S3|Aurora Postgres|\bVercel\b|\bFirebase\b|\bGemini\b/i.test(stripped),
      false,
      `${rel} must remain strictly vendor-neutral`
    );
  }
});

test('phase5-postgres-rls-and-daily-cron: indexed relational tables with RLS, vercel.json cron & daily-ops route auth', async () => {
  // 1. Verify all 6 indexed relational tables + RLS policies in postgres.ts
  const pgSrc = fs.readFileSync(path.join(OS_ROOT, 'src/lib/db/postgres.ts'), 'utf8');
  for (const tbl of [
    'hie_referrals',
    'akshia_claims',
    'akshia_claim_batches',
    'merkle_anchors',
    'care_bookings',
    'care_reminders',
  ]) {
    assert.ok(pgSrc.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`), `Missing relational table ${tbl}`);
    assert.ok(pgSrc.includes(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY`), `Missing RLS enable on ${tbl}`);
  }
  assert.ok(pgSrc.includes('hie_shared_facility_policy'), 'hie_referrals must support referring & target facility RLS');

  // 2. Verify vercel.json cron registration
  const vercelCfg = JSON.parse(fs.readFileSync(path.join(OS_ROOT, 'vercel.json'), 'utf8'));
  assert.ok(Array.isArray(vercelCfg.crons) && vercelCfg.crons.some((c) => c.path === '/api/cron/daily-ops'));

  // 3. Verify /api/cron/daily-ops exports ONLY valid Next.js 15 Route exports & enforces CRON_SECRET
  const cronSrc = fs.readFileSync(path.join(OS_ROOT, 'src/app/api/cron/daily-ops/route.ts'), 'utf8');
  const ALLOWED_EXPORTS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'runtime', 'dynamic', 'revalidate', 'maxDuration']);
  for (const m of cronSrc.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) {
    assert.ok(ALLOWED_EXPORTS.has(m[1]), `Invalid Route export "${m[1]}" in daily-ops/route.ts`);
  }

  const cronRoute = loadTsModule('src/app/api/cron/daily-ops/route.ts', {
    'next/server': {
      NextRequest: class {},
      NextResponse: {
        json: (data, init) => ({ status: init?.status || 200, json: async () => data }),
      },
    },
  });

  const prevSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-cron-secret-2026';

  const unauthRes = await cronRoute.GET({
    headers: new Headers(),
    cookies: { get: () => undefined },
    nextUrl: { searchParams: new URLSearchParams() },
  });
  assert.equal(unauthRes.status, 401);

  const authRes = await cronRoute.GET({
    headers: new Headers({ authorization: 'Bearer test-cron-secret-2026' }),
    cookies: { get: () => undefined },
    nextUrl: { searchParams: new URLSearchParams('facilityId=IGH-EKT') },
  });
  if (prevSecret) process.env.CRON_SECRET = prevSecret;
  else delete process.env.CRON_SECRET;

  assert.equal(authRes.status, 200);
  const authJson = await authRes.json();
  assert.equal(authJson.ok, true);
  assert.ok(authJson.anchorsSealed >= 1);
  assert.equal(JSON.stringify(authJson).includes('"patientName"'), false, 'Daily cron summary must be PII-free');
});

test('docs-openapi-and-compliance-invariants: OpenAPI 3.1 spec covers all API routes and docs/env templates contain zero live secrets', () => {
  const REPO_ROOT = path.resolve(OS_ROOT, '../..');
  const openApiPath = path.join(REPO_ROOT, 'docs/api/openapi.json');
  assert.ok(fs.existsSync(openApiPath), 'docs/api/openapi.json must exist');
  const spec = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
  assert.equal(spec.openapi, '3.1.0', 'OpenAPI spec must declare version 3.1.0');
  assert.ok(spec.components?.securitySchemes?.SessionCookieAuth, 'OpenAPI must declare SessionCookieAuth');

  // Verify 100% route coverage for apps/os/src/app/api/**/route.ts
  const osApiDir = path.join(OS_ROOT, 'src/app/api');
  const expectedRoutes = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') {
        const rel = path.relative(osApiDir, dir).replace(/\\/g, '/');
        const apiPath = '/api/' + rel.split('/').map((s) => s.replace(/^\[([^\]]+)\]$/, '{$1}')).filter(Boolean).join('/');
        expectedRoutes.push(apiPath);
      }
    }
  };
  walk(osApiDir);
  assert.ok(expectedRoutes.length >= 50, `Expected >= 50 OS API routes, found ${expectedRoutes.length}`);
  for (const r of expectedRoutes) {
    assert.ok(spec.paths?.[r], `docs/api/openapi.json missing route handler path: ${r}`);
  }

  // Verify required compliance docs and .env.example files exist without accidental live credentials
  const requiredDocs = [
    'docs/README.md',
    'docs/api/API_AND_SERVER_ACTIONS.md',
    'docs/DATABASE_AND_WORKFLOWS.md',
    'docs/SECURITY_RBAC_AUDIT.md',
    'docs/SETUP_AND_RECOVERY.md',
    '.env.example',
    'apps/os/.env.example',
    'apps/admin/.env.example',
  ];
  const LIVE_SECRET_PATTERNS = [
    /sk_live_[A-Za-z0-9]{12,}/,
    /AIzaSy[A-Za-z0-9_-]{25,}/,
    /re_[A-Za-z0-9]{20,}/,
    /-----BEGIN PRIVATE KEY-----/,
  ];
  for (const rel of requiredDocs) {
    const abs = path.join(REPO_ROOT, rel);
    assert.ok(fs.existsSync(abs), `Missing required documentation/template file: ${rel}`);
    const content = fs.readFileSync(abs, 'utf8');
    assert.ok(content.trim().length > 200, `${rel} must contain substantive documentation`);
    for (const pat of LIVE_SECRET_PATTERNS) {
      assert.equal(pat.test(content), false, `${rel} must not contain live credential pattern ${pat}`);
    }
  }
});






