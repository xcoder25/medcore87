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

// Root System Status & Architecture Overview
app.get('/', (req, res) => {
  res.json({
    platform: 'MedCore Healthcare Ecosystem (Powered by M87 Core)',
    status: 'ONLINE',
    version: '2.0.0-realtime',
    port: PORT,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/auth',
      patients: '/api/v1/patients',
      clinical: '/api/v1/clinical',
      banking: '/api/v1/banking',
      security: '/api/v1/security',
      sync: '/api/v1/sync',
      admin: '/api/v1/admin',
      facilities: '/api/v1/facilities',
      // Phase A
      vitals: '/api/v1/vitals',
      lab: '/api/v1/lab',
      theatre: '/api/v1/theatre',
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
