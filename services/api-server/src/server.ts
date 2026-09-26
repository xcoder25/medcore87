import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { syncEventBus } from './sync/eventBus';

// Import route modules
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import clinicalRoutes from './routes/clinical.routes';
import bankingRoutes from './routes/banking.routes';
import securityRoutes from './routes/security.routes';
import syncRoutes from './routes/sync.routes';
import adminRoutes from './routes/admin.routes';
import facilitiesRoutes from './routes/facilities.routes';
// Phase A — Real-Time Engine
import vitalsRoutes from './routes/vitals.routes';
import labRoutes from './routes/lab.routes';
import theatreRoutes from './routes/theatre.routes';
// Phase B — HL7 FHIR Interoperability Layer
import fhirRoutes from './routes/fhir.routes';
// Phase C — Closed Clinical Loop, CPOE, Pharmacy Stock & HMO Engine
import pharmacyRoutes from './routes/pharmacy.routes';
import cpoeRoutes from './routes/cpoe.routes';
import hmoRoutes from './routes/hmo.routes';
import commsRoutes from './routes/comms.routes';
// Phase D — NDHA compliance: DHIS2/NHMIS, HCX eClaim, NDPR
import dhis2Routes from './routes/dhis2.routes';
import hcxRoutes from './routes/hcx.routes';
import ndprRoutes from './routes/ndpr.routes';
import hieRoutes from './routes/hie.routes';
import connectathonRoutes from './routes/connectathon.routes';
import aiRoutes from './routes/ai.routes';

const app = express();
const server = http.createServer(app);

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ─── Mount Routes ───────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/clinical', clinicalRoutes);
app.use('/api/v1/banking', bankingRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/facilities', facilitiesRoutes);
// Phase A — Real-Time Engine
app.use('/api/v1/vitals', vitalsRoutes);
app.use('/api/v1/lab', labRoutes);
app.use('/api/v1/theatre', theatreRoutes);
// Phase B — HL7 FHIR Interoperability Engine
app.use('/api/v1/fhir', fhirRoutes);
// Phase C — Closed Clinical Loop, CPOE, Pharmacy Stock, HMO & Comms
app.use('/api/v1/pharmacy', pharmacyRoutes);
app.use('/api/v1/cpoe', cpoeRoutes);
app.use('/api/v1/hmo', hmoRoutes);
app.use('/api/v1/comms', commsRoutes);
app.use('/api/v1/dhis2', dhis2Routes);
app.use('/api/v1/hcx', hcxRoutes);
app.use('/api/v1/ndpr', ndprRoutes);
app.use('/api/v1/hie', hieRoutes);
app.use('/api/v1/connectathon', connectathonRoutes);
app.use('/api/v1/ai', aiRoutes);

// Root System Status & Architecture Overview
app.get('/', (req, res) => {
  res.json({
    platform: 'MedCore Healthcare Ecosystem (Powered by M87 Core)',
    status: 'ONLINE',
    version: '2.1.0-ndha-compliance',
    port: PORT,
    timestamp: new Date().toISOString(),
    policyAlignment: {
      ndha: 'FHIR R4 + HCX packager + HIE-oriented profiles',
      nhmis: '/api/v1/dhis2 (live or simulated)',
      ndpr: '/api/v1/ndpr',
      matrix: 'docs/architecture/NDHA_COMPLIANCE.md',
    },
    endpoints: {
      auth: '/api/v1/auth',
      patients: '/api/v1/patients',
      clinical: '/api/v1/clinical',
      banking: '/api/v1/banking',
      security: '/api/v1/security',
      sync: '/api/v1/sync',
      admin: '/api/v1/admin',
      facilities: '/api/v1/facilities',
      vitals: '/api/v1/vitals',
      lab: '/api/v1/lab',
      theatre: '/api/v1/theatre',
      fhir: '/api/v1/fhir',
      hie: '/api/v1/hie',
      connectathon: '/api/v1/connectathon',
      ai: '/api/v1/ai',
      pharmacy: '/api/v1/pharmacy',
      cpoe: '/api/v1/cpoe',
      hmo: '/api/v1/hmo',
      comms: '/api/v1/comms',
      dhis2: '/api/v1/dhis2',
      hcx: '/api/v1/hcx',
      ndpr: '/api/v1/ndpr',
      webSocket: `ws://${req.headers.host || 'localhost:' + PORT}/ws`,
    },
    securityStatus: {
      fieldLevelEncryption: 'AES-256-GCM ACTIVE',
      auditLedger: 'SHA-256 Chained Hash Immutable Ledger ACTIVE',
      commissionerDossier: '/api/v1/security/commissioner-briefing',
      ledgerVerification: '/api/v1/security/verify-ledger',
    },
    bankingStatus: {
      accountingEngine: 'Double-Entry Bookkeeping (Active Balancing)',
      splitBilling: '80/20 HMO & Co-Pay Instant Settlement ACTIVE',
      escrowEngine: 'Surgical & Admission Escrow Protected',
      tillManagement: 'Multi-Cashier Shift Tills with Float Reconciliation ACTIVE',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

// ─── WebSocket Server on /ws ────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
syncEventBus.attachWebSocketServer(wss);

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(`🚀 MedCore Central Data Hub & Real-time Event Bus (M87 Core)`);
    console.log(`📡 HTTP Server running on: http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Server running on: ws://localhost:${PORT}/ws`);
    console.log(`🛡️ Commissioner Security Dossier: http://localhost:${PORT}/api/v1/security/commissioner-briefing`);
    console.log(`💳 Banking & Wallet Core: http://localhost:${PORT}/api/v1/banking/ledger`);
    console.log(`=============================================================`);
  });
}

export { app, server };
