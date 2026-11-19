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
