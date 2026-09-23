const http = require('http');
const path = require('path');
const { WebSocket } = require('ws');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '4005';

// Import compiled or tsx server via ts-node or register
const ts = require('typescript');
const fs = require('fs');

console.log('------------------------------------------------------------');
console.log('🧪 Starting MedCore Core Services Automated Verification Suite');
console.log('------------------------------------------------------------\n');

// Compile typescript files in memory or register transpile
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(compiled.outputText, filename);
};

// Now import server
const { app, server } = require('../services/api-server/src/server.ts');

const PORT = 4005;

async function runTests() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`✅ Core server listening on http://localhost:${PORT}\n`);

  async function api(path, options = {}) {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details}`);
      failed++;
    }
  }

  try {
    // ─── TEST 1: System Health & Root Info ───
    console.log('TEST SUITE 1: System Health & Architecture Handshake');
    const root = await api('/');
    assert(root.ok && root.data.status === 'ONLINE', 'Root endpoint reports ONLINE');
    assert(root.data.securityStatus.fieldLevelEncryption.includes('AES-256-GCM'), 'Field-Level AES-256-GCM reported');
    assert(root.data.bankingStatus.accountingEngine.includes('Double-Entry'), 'Double-entry accounting active');

    // ─── TEST 2: Commissioner Security & Privacy Dossier ───
    console.log('\nTEST SUITE 2: Commissioner Security & Privacy Architecture');
    const briefing = await api('/api/v1/security/commissioner-briefing');
    assert(briefing.ok && briefing.data.success, 'Commissioner Briefing endpoint returns 200 OK');
    const dossier = briefing.data.data.dossier;
    assert(dossier.complianceCertifications.hipaaCompliant === true, 'HIPAA Compliance certified');
    assert(dossier.complianceCertifications.gdprCompliant === true, 'GDPR Compliance certified');
    assert(dossier.dataResidency.inCountryStorage === true, 'Sovereign In-Country Data Residency verified');

    // ─── TEST 3: Cryptographic Audit Chain Verification ───
    console.log('\nTEST SUITE 3: SHA-256 Chained Tamper-Evident Audit Ledger');
    const chainVerify = await api('/api/v1/security/verify-ledger');
    assert(chainVerify.ok && chainVerify.data.data.valid === true, 'Audit chain verified from Genesis to Head (0% tampering)');
    assert(chainVerify.data.data.totalBlocks >= 1, `Audit chain has ${chainVerify.data.data.totalBlocks} cryptographically sealed blocks`);

    // ─── TEST 4: Automated HIPAA 18-Identifier De-identification Pipeline ───
    console.log('\nTEST SUITE 4: Automated De-identification Pipeline (MOH Surveillance)');
    const scrubTest = await api('/api/v1/security/deidentify-preview', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'PAT-99120',
        patientName: 'Alhaji Musa Danladi',
        patientMRN: 'MRN-44910',
        patientPhone: '+234-802-991-0021',
        dob: '1968-04-12',
        gender: 'MALE',
        facilityId: 'FAC-001',
        facilityName: 'Apex National Teaching Hospital',
        state: 'Lagos',
        lga: 'Ikeja',
        diagnosisCode: 'A00.0', // Cholera
        diagnosisName: 'Cholera due to Vibrio cholerae',
        symptoms: ['Acute watery diarrhea', 'Dehydration'],
        severity: 'SEVERE',
        outcome: 'ISOLATED',
        timestamp: new Date().toISOString(),
      }),
    });
    assert(scrubTest.ok && scrubTest.data.data.pseudonymId.startsWith('MOH-SYN-'), 'Replaced direct patient ID with salted pseudonym');
    assert(scrubTest.data.data.ageGroup === '55-59', 'DOB converted to HIPAA 5-year age bucket (55-59)');
    assert(scrubTest.data.data.clinicalTelemetry.syndromeGroup === 'GASTROINTESTINAL', 'Syndrome categorized for epidemic surveillance');
    assert(!JSON.stringify(scrubTest.data.data).includes('Alhaji Musa Danladi'), 'Direct patient name completely scrubbed from MOH payload');

    // ─── TEST 5: Emergency Break-Glass Protocol ───
    console.log('\nTEST SUITE 5: Emergency Break-Glass Protocol');
    const bgRes = await api('/api/v1/security/break-glass', {
      method: 'POST',
      body: JSON.stringify({
        doctorId: 'DOC-ER-99',
        doctorName: 'Dr. Obinna Eze (Trauma Lead)',
        patientId: 'PAT-849201',
        patientMRN: 'MRN-78401',
        facilityId: 'FAC-001',
        justification: 'Unconscious motor vehicle accident victim with severe intracranial hemorrhage; immediate allergy profile needed',
        clinicalIndication: 'UNCONSCIOUS_TRAUMA',
      }),
    });
    assert(bgRes.ok && bgRes.data.success, 'Emergency Break-Glass authorized');
    assert(bgRes.data.data.status === 'ACTIVE', 'Break-glass event status is ACTIVE');

    // Re-verify audit chain to confirm break-glass was immutably recorded
    const chainAfterBg = await api('/api/v1/security/verify-ledger');
    assert(chainAfterBg.data.data.valid === true, 'Audit ledger remains 100% valid after appending break-glass block');

    // ─── TEST 6: Patient Data AES-256-GCM Encryption ───
    console.log('\nTEST SUITE 6: Patient PII AES-256-GCM Field-Level Encryption');
    const patientsRaw = await api('/api/v1/patients');
    assert(patientsRaw.ok && patientsRaw.data.data.length > 0, 'Fetched patient index');
    const p1 = patientsRaw.data.data[0];
    assert(p1.encryptedNationalId && p1.encryptedNationalId.algorithm === 'AES-256-GCM', 'National ID stored as AES-256-GCM ciphertext');
    assert(p1.encryptedPhone && p1.encryptedPhone.tag.length === 32, 'Phone stored with 16-byte authenticated tag');

    // Test authorized decryption
    const patientsDecrypted = await api('/api/v1/patients?decrypt=true');
    const p1Dec = patientsDecrypted.data.data[0];
    assert(p1Dec.nationalId.startsWith('NIN-'), `Authorized decryption returned plaintext NIN: ${p1Dec.nationalId}`);
    assert(p1Dec.phone.startsWith('+234'), `Authorized decryption returned plaintext phone: ${p1Dec.phone}`);

    // ─── TEST 7: Banking Core - Double-Entry Ledger Invariant ───
    console.log('\nTEST SUITE 7: Banking Core - Double-Entry Ledger Invariant');
    const initialLedger = await api('/api/v1/banking/ledger');
    assert(initialLedger.ok, 'Fetched ledger accounts');
    const inv1 = initialLedger.data.data.accountingInvariant;
    assert(inv1.isBalanced === true, `Double-entry invariant holds: Debits (${inv1.totalDebits}) == Credits (${inv1.totalCredits})`);

    // ─── TEST 8: Health Wallet Multi-Channel Funding ───
    console.log('\nTEST SUITE 8: Health Wallet Multi-Channel Funding');
    const fundRes = await api('/api/v1/banking/wallets/fund', {
      method: 'POST',
      body: JSON.stringify({
        walletId: 'WAL-PAT-001',
        amount: 500.0,
        paymentMethod: 'CARD',
        reference: 'PAYSTACK-CHG-99210',
      }),
    });
    assert(fundRes.ok && fundRes.data.success, 'Wallet funded with $500');
    assert(fundRes.data.data.wallet.availableBalance === 1350.0, `Wallet balance updated from $850 to $1350`);

    // Verify ledger balance holds after deposit
    const ledgerAfterFund = await api('/api/v1/banking/ledger');
    const inv2 = ledgerAfterFund.data.data.accountingInvariant;
    assert(inv2.isBalanced === true, `Ledger balanced after deposit: Debits (${inv2.totalDebits}) == Credits (${inv2.totalCredits})`);

    // ─── TEST 9: Automated 80/20 HMO & Co-Pay Split Settlement ───
    console.log('\nTEST SUITE 9: Automated 80/20 HMO Split & Co-Pay Bill Settlement');
    const settleRes = await api('/api/v1/banking/bills/BILL-2026-081/settle', {
      method: 'POST',
      body: JSON.stringify({
        patientWalletId: 'WAL-PAT-001',
        settledByCashierId: 'STAFF-CSH-01',
        settledByCashierName: 'Blessing Adeyemi',
        tillId: 'TILL-001',
      }),
    });
    assert(settleRes.ok && settleRes.data.success, 'Bill settled with automated HMO split');
    const settledBill = settleRes.data.data.bill;
    assert(settledBill.status === 'PAID', 'Bill status marked PAID');
    assert(settledBill.hmoContribution === 144.0, 'HMO covered $144.00 (80%)');
    assert(settledBill.patientCoPay === 36.0, 'Patient paid co-pay of $36.00 (20%)');

    // Verify double-entry ledger balance holds after split billing
    const ledgerAfterSettle = await api('/api/v1/banking/ledger');
    const inv3 = ledgerAfterSettle.data.data.accountingInvariant;
    assert(inv3.isBalanced === true, `Ledger balanced after split settlement: Debits (${inv3.totalDebits}) == Credits (${inv3.totalCredits})`);

    // ─── TEST 10: Cashier Shift Till Reconciliation & Close ───
    console.log('\nTEST SUITE 10: Cashier Shift Till Reconciliation & Close');
    const tillCloseRes = await api('/api/v1/banking/tills/TILL-001/close', {
      method: 'POST',
      body: JSON.stringify({
        actualCashCounted: 1670.0,
        cashierId: 'STAFF-CSH-01',
        cashierName: 'Blessing Adeyemi',
        notes: 'Shift balanced with zero cash discrepancy',
      }),
    });
    assert(tillCloseRes.ok && tillCloseRes.data.success, 'Till closed successfully');
    assert(tillCloseRes.data.data.status === 'RECONCILED', 'Till reconciled with zero variance');

    // ─── TEST 11: Real-Time WebSocket Synchronization ───
    console.log('\nTEST SUITE 11: Real-Time WebSocket Synchronization Bus');
    const wsPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
      let welcomeReceived = false;

      ws.on('open', () => {
        // Send subscription
        ws.send(
          JSON.stringify({
            action: 'SUBSCRIBE',
            app: 'MEDCORE_CARE',
            facilityId: 'FAC-001',
            topics: ['PAYMENT_RECEIVED', 'BED_OCCUPIED', 'WALLET_BALANCE_UPDATED'],
          })
        );
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if (msg.eventId && msg.eventId.startsWith('EVT-WELCOME')) {
          welcomeReceived = true;
          // Trigger broadcast to see if ws receives it
          api('/api/v1/sync/broadcast', {
            method: 'POST',
            body: JSON.stringify({
              topic: 'WALLET_BALANCE_UPDATED',
              facilityId: 'FAC-001',
              emitterApp: 'API_SERVER',
              payload: { walletId: 'WAL-PAT-001', message: 'Sync verified' },
            }),
          });
        } else if (msg.topic === 'WALLET_BALANCE_UPDATED') {
          ws.close();
          resolve({ welcomeReceived, eventReceived: true, payload: msg.payload });
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket sync test timed out')), 5000);
    });

    const wsResult = await wsPromise;
    assert(wsResult.welcomeReceived, 'WebSocket client connected and received welcome handshake');
    assert(wsResult.eventReceived, 'Real-time WebSocket event received instantly across bus');

    console.log('\n============================================================');
    console.log(`🎉 ALL VERIFICATION SUITES COMPLETED: ${passed} Passed, ${failed} Failed`);
    console.log('============================================================\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
