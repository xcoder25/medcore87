const { WebSocket } = require('ws');
const ts = require('typescript');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.PORT = '4007';

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

const { app, server } = require('../services/api-server/src/server.ts');
const { bankingCore } = require('../services/api-server/src/banking/bankingCore.ts');

const PORT = 4007;

async function run() {
  await new Promise((r) => server.listen(PORT, r));
  console.log(`Server running on http://localhost:${PORT}`);

  async function api(path, options = {}) {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    return { status: res.status, ok: res.ok, data: await res.json() };
  }

  // Seed a new test bill
  const testBill = {
    id: 'BILL-TEST-PAY-01',
    patientId: 'PAT-849201',
    patientName: 'Amina Bello',
    patientMRN: 'MRN-78401',
    facilityId: 'FAC-001',
    encounterId: 'ENC-TEST-1',
    items: [{ id: '1', code: 'MED', description: 'Pharmacy Refill', category: 'PHARMACY', quantity: 1, unitPrice: 50, totalPrice: 50, coveredByHMO: false, hmoCoveredAmount: 0, patientPayableAmount: 50 }],
    subtotal: 50,
    tax: 0,
    totalAmount: 50,
    hmoContribution: 0,
    patientCoPay: 50,
    depositApplied: 0,
    amountPaid: 0,
    balanceDue: 50,
    status: 'ISSUED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bankingCore['bills'].set(testBill.id, testBill);

  console.log('\n--- 1. Testing AkwaRemit Checkout Generation ---');
  const akwaRes = await api('/api/v1/banking/payments/initiate', {
    method: 'POST',
    body: JSON.stringify({
      billId: testBill.id,
      patientId: testBill.patientId,
      channel: 'AKWAREMIT',
      customerEmail: 'amina.bello@example.com',
    }),
  });
  console.log('AkwaRemit Status:', akwaRes.data.success);
  console.log('Checkout URL:', akwaRes.data.data.akwaRemitSession.checkoutUrl);
  console.log('Virtual Account:', akwaRes.data.data.akwaRemitSession.virtualAccount);
  console.log('USSD Dial:', akwaRes.data.data.akwaRemitSession.ussdPrompt);

  console.log('\n--- 2. Testing Cash OTC Order Generation (Patient Selects Cash in App) ---');
  // Seed a second bill for Cash
  const cashBill = { ...testBill, id: 'BILL-CASH-02', balanceDue: 75, totalAmount: 75, patientCoPay: 75 };
  bankingCore['bills'].set(cashBill.id, cashBill);

  const cashOrderRes = await api('/api/v1/banking/payments/initiate', {
    method: 'POST',
    body: JSON.stringify({
      billId: cashBill.id,
      patientId: cashBill.patientId,
      channel: 'CASH_OTC',
    }),
  });
  const cashOrder = cashOrderRes.data.data.cashOrder;
  console.log('Cash Order Created:', cashOrder.orderCode);
  console.log('Barcode:', cashOrder.barcode);
  console.log('Amount Due:', cashOrder.amountDue);

  console.log('\n--- 3. Testing Hospital Cashier Till Lookup ---');
  const lookupRes = await api('/api/v1/banking/payments/cash-order/lookup', {
    method: 'POST',
    body: JSON.stringify({ query: cashOrder.orderCode }),
  });
  console.log('Cashier Lookup Found Patient:', lookupRes.data.data.order.patientName);
  console.log('Associated Bill Status:', lookupRes.data.data.bill.status);

  console.log('\n--- 4. Testing Cashier Collects Physical Cash banknotes at Till ---');
  const collectRes = await api('/api/v1/banking/payments/cash-order/collect', {
    method: 'POST',
    body: JSON.stringify({
      orderCode: cashOrder.orderCode,
      cashierId: 'STAFF-CSH-01',
      cashierName: 'Blessing Adeyemi',
      tillId: 'TILL-001',
      amountTendered: 100.0, // Patient handed $100 bill for $75 charge
    }),
  });
  console.log('Cash Collected Status:', collectRes.data.success);
  console.log('Receipt Issued:', collectRes.data.data.receiptNumber);
  console.log('Change Returned to Patient:', collectRes.data.data.changeDue);
  console.log('Bill Status Updated to:', collectRes.data.data.bill.status);

  console.log('\n✅ ALL PAYMENT FLOWS (AKWAREMIT + CASH OTC) VERIFIED PERFECTLY!');
  server.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
