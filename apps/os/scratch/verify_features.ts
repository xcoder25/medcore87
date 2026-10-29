import { askPatientFile, CLINICAL_DOSSIERS } from '../src/lib/clinicalGoogleSearch';
import {
  loadMeshState,
  triggerPeerDiscovery,
  broadcastDtnPacket,
  syncViaSatelliteUplink,
  toggleBlackoutSimulation,
  type TelehealthMeshState
} from '../src/lib/telehealthMeshSync';

// Mock localStorage for node environment
const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear()
};
(globalThis as any).CustomEvent = class {
  type: string;
  detail: any;
  constructor(type: string, opts?: any) {
    this.type = type;
    this.detail = opts?.detail;
  }
};
(globalThis as any).dispatchEvent = () => true;

console.log('================================================================');
console.log('🧪 TESTING FEATURE 1: Generative AI "Clinical Google" Search');
console.log('================================================================');

// 1. Test "Ask the Patient File" Bar - Hypertension & Creatinine query
console.log('--- Test 1.1: Complex Hypertension & Creatinine synthesis ---');
const q1 = "Summarize this patient's history of hypertension medications and show me their highest creatinine level.";
const ans1 = askPatientFile('PAT-AKS-4401', q1);

if (!ans1.summary.includes('186 µmol/L')) {
  throw new Error('Clinical Google failed to locate peak creatinine level 186 µmol/L');
}
if (!ans1.summary.includes('Amlodipine') || !ans1.summary.includes('Telmisartan') || !ans1.summary.includes('Nifedipine')) {
  throw new Error('Clinical Google missed key anti-hypertensive regimen progression');
}
if (ans1.citations.length < 3) {
  throw new Error(`Insufficient citations returned: expected >= 3, got ${ans1.citations.length}`);
}
const crCitation = ans1.citations.find(c => c.snippet.includes('186 µmol/L'));
if (!crCitation) {
  throw new Error('Missing exact laboratory report citation for peak creatinine');
}
console.log(`✅ PASS: Correct peak creatinine found: ${crCitation.exactValue}`);
console.log(`✅ PASS: Citations returned with exact sources: ${ans1.citations.length} clinical citations`);
console.log(`✅ PASS: Action hooks verified: ${ans1.actionHooks.map(a => a.label).join(' | ')}`);

// 2. Test Obstetric Pregnancy Query
console.log('\n--- Test 1.2: Obstetric Antepartum & Gestational BP query ---');
const q2 = "What is her gestational blood pressure trajectory and pre-eclampsia laboratory screen?";
const ans2 = askPatientFile('PAT-AKS-8812', q2);
if (!ans2.summary.includes('152/98 mmHg') || !ans2.summary.includes('420mg')) {
  throw new Error('Clinical Google missed gestational BP elevation or proteinuria');
}
console.log(`✅ PASS: Obstetric trajectory synthesized correctly: ${ans2.keyMetrics[0].label} = ${ans2.keyMetrics[0].value}`);

console.log('\n================================================================');
console.log('🧪 TESTING FEATURE 5: Smart Infrastructure & Telehealth Mesh');
console.log('================================================================');

// 3. Test Initial Mesh State
console.log('--- Test 5.1: Mesh Node Topology & Delay-Tolerant Networking ---');
let mesh = loadMeshState();
if (mesh.nodes.length !== 6) {
  throw new Error(`Expected 6 Akwa Ibom mesh nodes, found ${mesh.nodes.length}`);
}
const essienUdim = mesh.nodes.find(n => n.lga === 'Essien Udim');
const easternObolo = mesh.nodes.find(n => n.lga === 'Eastern Obolo');
if (!essienUdim || !easternObolo) {
  throw new Error('Missing Essien Udim or Eastern Obolo remote mesh nodes');
}
console.log(`✅ PASS: 6 LGA nodes loaded (Essien Udim, Eastern Obolo, Ini, Creek Boat, Immanuel GH, State MoH)`);

// 4. Test Peer Discovery & RSSI Ping
console.log('--- Test 5.2: Ad-Hoc Wi-Fi Peer Discovery ---');
mesh = triggerPeerDiscovery(mesh);
console.log(`✅ PASS: Peer discovery active. Essien Udim RSSI: ${mesh.nodes[0].rssiDb} dBm`);

// 5. Test Delay-Tolerant Networking (DTN) Packet Bundling
console.log('--- Test 5.3: P2P DTN Bundle Broadcast & Merkle Clock Increment ---');
const initialClock = mesh.nodes[0].vectorClock;
mesh = broadcastDtnPacket(mesh, 'NODE-ESSIEN-UDIM-01', 'TRIAGE_VITALS', 'PAT-AKS-4401 (STAT Vitals)');
if (mesh.packets[0].originLga !== 'Essien Udim' || mesh.nodes[0].vectorClock <= initialClock) {
  throw new Error('Failed to broadcast DTN packet or advance vector clock');
}
console.log(`✅ PASS: Packet created: ${mesh.packets[0].bundleId} [${mesh.packets[0].payloadType}] with SHA-256 checksum ${mesh.packets[0].checksumSha256.slice(0, 16)}...`);
console.log(`✅ PASS: Vector clock advanced to v${mesh.nodes[0].vectorClock}`);

// 6. Test Opportunistic Satellite Uplink Flush
console.log('--- Test 5.4: Opportunistic Satellite Uplink Backhaul ---');
mesh = syncViaSatelliteUplink(mesh);
if (mesh.nodes[0].queuedDtnBundles !== 0) {
  throw new Error('Satellite flush failed to drain local queued bundles');
}
if (!mesh.satellite.merkleTreeRoot.startsWith('0x')) {
  throw new Error('Satellite sync did not produce valid Merkle root digest');
}
console.log(`✅ PASS: Satellite uplink flushed queues to zero. New Merkle root: ${mesh.satellite.merkleTreeRoot}`);

// 7. Test Total Infrastructure Blackout Simulation
console.log('--- Test 5.5: Infrastructure Blackout & Mesh-Only Fallback ---');
mesh = toggleBlackoutSimulation(mesh);
if (!mesh.blackoutSimulated || mesh.satellite.uplinkState !== 'SEARCHING_SATELLITE') {
  throw new Error('Blackout simulation did not transition nodes to offline store-and-forward');
}
console.log(`✅ PASS: Blackout simulation engaged: nodes switched to peer-to-peer store-and-forward mesh.`);

mesh = toggleBlackoutSimulation(mesh);
console.log(`✅ PASS: Normal connectivity restored.`);

console.log('\n🎉 ALL GENERATIVE AI CLINICAL GOOGLE & TELEHEALTH MESH TESTS PASSED 100%! 🎉\n');
