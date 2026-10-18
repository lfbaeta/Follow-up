import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { authRouter } from './server/routes/auth.js';
import { settingsRouter } from './server/routes/settings.js';
import { whatsappRouter } from './server/routes/whatsapp.js';
import { followupRouter } from './server/routes/followup.js';
import { funnelRouter } from './server/routes/funnel.js';
import { appointmentsRouter } from './server/routes/appointments.js';
import { webhooksRouter } from './server/routes/webhooks.js';
import { simulatorRouter } from './server/routes/simulator.js';
import { logsRouter } from './server/routes/logs.js';
import { startFollowUpWorker } from './server/services/followUpWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body Parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Diretório estático de uploads persistentes
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Rotas da API
app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/followup', followupRouter);
app.use('/api/funnel', funnelRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/logs', logsRouter);

// Endpoint para download do repositório completo compactado
app.get('/api/export-repo', (_req, res) => {
  const exportPath = path.resolve(process.cwd(), 'delivale-followup.tar.gz');
  res.download(exportPath, 'delivale-followup.tar.gz');
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'delivale-followup',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

async function startServer() {
  // Inicialização do worker em segundo plano
  startFollowUpWorker(4000);

  // Integração Vite SPA
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Delivale Follow-up] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Delivale Follow-up] Falha crítica ao iniciar o servidor:', err);
  process.exit(1);
});
