/**
 * Offline scale bench for MedCore patient registry shapes.
 * Run: node scripts/scale-patient-bench.mjs
 */
function makePatient(i, fid = 'IGH-EKT') {
  return {
    id: `PT-${String(i).padStart(6, '0')}`,
    hospitalNumber: `IGH-PT-${String(i).padStart(6, '0')}`,
    firstName: `Patient${i}`,
    lastName: `Test${i % 500}`,
    dob: '1990-01-15',
    sex: i % 2 === 0 ? 'Male' : 'Female',
    phone: `0803${String(i).padStart(7, '0')}`.slice(-11),
    address: `${i} Hospital Road, Eket`,
    state: 'Akwa Ibom',
    lga: 'Eket',
    facilityId: fid,
    facilityName: 'Immanuel General Hospital, Eket',
    status: 'active',
    registeredAt: '2026-01-01T10:00:00.000Z',
    nin: String(i).padStart(11, '0'),
  };
}

function bench(n) {
  const patients = Array.from({ length: n }, (_, i) => makePatient(i));
  const t0 = performance.now();
  const raw = JSON.stringify(patients);
  const t1 = performance.now();
  const parsed = JSON.parse(raw);
  const t2 = performance.now();
  const filtered = parsed.filter((p) => p.facilityId === 'IGH-EKT');
  const t3 = performance.now();
  const q = 'patient500';
  const hits = [];
  for (const p of filtered) {
    const blob = `${p.firstName}${p.lastName}${p.hospitalNumber}${p.phone}`.toLowerCase();
    if (blob.includes(q)) {
      hits.push(p);
      if (hits.length >= 50) break;
    }
  }
  const t4 = performance.now();
  const byHn = new Map(filtered.map((p) => [p.hospitalNumber, p]));
  const t5 = performance.now();
  byHn.get('IGH-PT-000500');
  const t6 = performance.now();
  const bytes = Buffer.byteLength(raw, 'utf8');
  return {
    n,
    mb: +(bytes / 1024 / 1024).toFixed(3),
    stringifyMs: +(t1 - t0).toFixed(1),
    parseMs: +(t2 - t1).toFixed(1),
    filterMs: +(t3 - t2).toFixed(1),
    searchMs: +(t4 - t3).toFixed(1),
    indexLookupMs: +(t6 - t5).toFixed(3),
    hits: hits.length,
    lsOk: bytes < 4.5 * 1024 * 1024,
  };
}

console.log('MedCore patient registry scale bench\n');
for (const n of [100, 500, 1000, 2500, 5000, 10000]) {
  const r = bench(n);
  console.log(
    `n=${String(r.n).padStart(5)}  ${r.mb}MB  parse=${r.parseMs}ms  search=${r.searchMs}ms  idx=${r.indexLookupMs}ms  ${r.lsOk ? 'localStorage OK' : 'QUOTA RISK'}`
  );
}
console.log('\nVerdict:');
console.log('- 1,000 patients: safe on local-first + searchPatients limit');
console.log('- 5,000+: prefer Firestore archive; keep hot local subset');
console.log('- UI must never .map() full registry — use searchPatients/listPatientsPage');
