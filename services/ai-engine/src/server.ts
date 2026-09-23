import express from 'express';
import cors from 'cors';
import aiRoutes from './routes/ai.routes';

const app = express();
const PORT = process.env.AI_PORT || 4001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[AI] ${req.method} ${req.path}`);
  next();
});

app.use('/api/ai', aiRoutes);

app.get('/', (_req, res) => {
  res.json({
    service: 'MedCore AI Clinical Decision Support Engine',
    version: '1.0.0',
    status: 'ONLINE',
    port: PORT,
    endpoints: {
      drugInteractions:      'POST /api/ai/drug-interactions',
      differentialDiagnosis: 'POST /api/ai/differential-diagnosis',
      icd11Search:           'GET  /api/ai/icd11/search?q=',
      icd11Lookup:           'GET  /api/ai/icd11/:code',
      soapFormatter:         'POST /api/ai/soap',
      news2Calculator:       'POST /api/ai/news2',
      health:                'GET  /api/ai/health',
    },
    philosophy: 'Offline-first. No external API required. Gemini/GPT upgradeable.',
  });
});

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('🤖 MedCore AI Clinical Decision Support Engine');
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log('🧠 Drug interactions · Differential Dx · ICD-11');
  console.log('📝 AI Scribe (SOAP) · NEWS2 Calculator');
  console.log('🔌 Mode: OFFLINE — no internet required');
  console.log('═══════════════════════════════════════════════════');
});

export default app;
