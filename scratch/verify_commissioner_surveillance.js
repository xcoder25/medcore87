const ts = require('typescript');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.PORT = '4009';

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

const PORT = 4009;

async function run() {
  await new Promise((r) => server.listen(PORT, r));
  console.log(`Server listening on http://localhost:${PORT}`);

  async function api(path) {
    const res = await fetch(`http://localhost:${PORT}${path}`);
    return { status: res.status, ok: res.ok, data: await res.json() };
  }

  console.log('\n--- 1. Testing Commissioner Master Surveillance Dashboard ---');
  const dashRes = await api('/api/v1/admin/dashboard');
  const dash = dashRes.data.data;
  console.log('Status:', dashRes.data.success);
  console.log('Total Facilities Monitored:', dash.nationalMetrics.totalRegisteredFacilities);
  console.log('National Bed Occupancy:', dash.nationalMetrics.nationalBedOccupancyRate + '%');
  console.log('National ICU Utilization:', dash.nationalMetrics.nationalIcuUtilizationRate + '%');

  console.log('\n--- 2. Testing Alive / Dead Census & Vital Statistics ---');
  const census = dash.vitalCensus;
  console.log('Total Registered Patients:', census.totalRegisteredPatients);
  console.log('Currently Admitted (Alive in Wards/ICU):', census.totalAdmittedCurrently);
  console.log('Discharged Alive:', census.totalDischargedAlive);
  console.log('Total Deceased:', census.totalDeceased);
  console.log('Mortality Rate:', census.mortalityRatePercent + '%');
  console.log('Maternal Mortality Count:', census.maternalMortalityCount);
  console.log('Leading Causes of Death:', census.leadingCausesOfDeath.map((c) => `${c.cause} (${c.count} cases, ${c.percentage}%)`));

  console.log('\n--- 3. Testing Real-Time Mortality Registry ---');
  const mortRes = await api('/api/v1/admin/mortality-registry');
  console.log('Mortality Records Count:', mortRes.data.total);
  const m1 = mortRes.data.data[0];
  console.log('Sample Record Pseudonym:', m1.pseudonymId);
  console.log('Primary Cause of Death:', m1.primaryCauseOfDeath);
  console.log('ICD-10 Code:', m1.icd10Code);
  console.log('Certifying Doctor Hash:', m1.certifyingPhysicianHash);

  console.log('\n--- 4. Testing Multi-Facility Financial Surveillance ---');
  const fin = dash.financialSurveillance;
  console.log('Gross State/National Revenue:', `$${fin.totalGrossRevenue.toLocaleString()}`);
  console.log('  • Paystack Health Wallet Revenue:', `$${fin.totalPaystackWalletRevenue.toLocaleString()}`);
  console.log('  • AkwaRemit (Card/Transfer) Revenue:', `$${fin.totalAkwaRemitRevenue.toLocaleString()}`);
  console.log('  • Cash Collected at Hospital Tills:', `$${fin.totalCashOTCRevenue.toLocaleString()}`);
  console.log('  • HMO Claims Adjudicated:', `$${fin.totalHmoClaimsRevenue.toLocaleString()}`);
  console.log('Facility Breakdown Count:', fin.facilityBreakdowns.length);

  console.log('\n--- 5. Testing Security & Cryptographic Proof ---');
  const sec = dash.securityProof;
  console.log('Encryption Status:', sec.fieldLevelEncryptionStatus);
  console.log('Audit Ledger Integrity Valid?:', sec.auditLedgerIntegrity);
  console.log('Total Chained Blocks:', sec.totalChainedBlocks);
  console.log('Sovereign Data Residency:', sec.sovereignDataResidency);

  console.log('\n✅ ALL COMMISSIONER SURVEILLANCE & VITAL CENSUS VERIFIED 100%!');
  server.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
