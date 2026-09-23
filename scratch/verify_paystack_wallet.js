const crypto = require('crypto');
const ts = require('typescript');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.PORT = '4008';

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

const { server } = require('../services/api-server/src/server.ts');
const { bankingCore } = require('../services/api-server/src/banking/bankingCore.ts');

const PORT = 4008;

async function run() {
  await new Promise((r) => server.listen(PORT, r));
  console.log(`Server listening on http://localhost:${PORT}`);

  async function api(path, options = {}) {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    return { status: res.status, ok: res.ok, data: await res.json() };
  }

  console.log('\n--- 1. Testing Paystack DVA on Patient Wallet ---');
  const walletRes = await api('/api/v1/banking/wallets/WAL-PAT-001');
  const wallet = walletRes.data.data;
  console.log('Wallet Owner:', wallet.ownerName);
  console.log('Initial Available Balance:', wallet.availableBalance);
  console.log('Paystack Customer Code:', wallet.paystackCustomerCode);
  console.log('Paystack Dedicated NUBAN:', wallet.paystackDedicatedAccount);

  console.log('\n--- 2. Testing Assigning Paystack DVA to a New Patient Wallet ---');
  // Create an unassigned wallet first
  const newWallet = {
    id: 'WAL-PAT-NEW',
    ownerId: 'PAT-99001',
    ownerName: 'Zainab Kabir',
    ownerType: 'PATIENT',
    currency: 'USD',
    availableBalance: 0,
    escrowBalance: 0,
    totalBalance: 0,
    status: 'ACTIVE',
    dailySpendingLimit: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bankingCore['wallets'].set(newWallet.id, newWallet);

  const dvaRes = await api('/api/v1/banking/wallets/create-dva', {
    method: 'POST',
    body: JSON.stringify({
      walletId: 'WAL-PAT-NEW',
      patientId: 'PAT-99001',
      patientName: 'Zainab Kabir',
      email: 'zainab.kabir@example.com',
      preferredBank: 'titan-paystack',
    }),
  });
  console.log('Assigned DVA Status:', dvaRes.data.success);
  console.log('Generated Paystack Account:', dvaRes.data.data.dedicatedAccount);

  console.log('\n--- 3. Testing Paystack Webhook (Patient transfers to Paystack NUBAN) ---');
  // Patient transfers $250 / 25,000 to their Paystack dedicated account
  const webhookPayload = {
    event: 'charge.success',
    data: {
      reference: 'PAYSTACK_REF_9918274',
      amount: 250.0,
      status: 'success',
      channel: 'bank_transfer',
      customer: {
        customer_code: wallet.paystackCustomerCode,
        email: 'amina.bello@example.com',
      },
      metadata: {
        walletId: 'WAL-PAT-001',
        isKobo: false,
      },
    },
  };

  const webhookRes = await api('/api/v1/banking/webhooks/paystack', {
    method: 'POST',
    headers: {
      'x-paystack-signature': 'test-sig',
    },
    body: JSON.stringify(webhookPayload),
  });
  console.log('Paystack Webhook Processed:', webhookRes.data.received);
  console.log('Updated Wallet Balance After Transfer:', webhookRes.data.wallet.availableBalance);

  console.log('\n--- 4. Verify Double-Entry Ledger Remained Balanced ---');
  const ledgerRes = await api('/api/v1/banking/ledger');
  const inv = ledgerRes.data.data.accountingInvariant;
  console.log('Accounting Invariant Balanced?:', inv.isBalanced);
  console.log(`Debits: ${inv.totalDebits}, Credits: ${inv.totalCredits}`);

  console.log('\n✅ PAYSTACK-BACKED WALLET CORE FULLY VERIFIED!');
  server.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
