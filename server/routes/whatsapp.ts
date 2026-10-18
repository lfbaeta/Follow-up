import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { EvolutionService } from '../services/evolutionService.js';
import { encryptSecret, normalizePhoneNumber } from '../security.js';

export const whatsappRouter = Router();

whatsappRouter.use(requireAuth);

/**
 * Retorna o status da conexão WhatsApp
 */
whatsappRouter.get('/status', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const conn = db.data.whatsappConnections.find((c) => c.organizationId === orgId) || db.data.whatsappConnections[0];

  return res.json({
    status: conn.status,
    instanceName: conn.instanceName,
    serverUrl: conn.serverUrl,
    hasApiKey: Boolean(conn.apiKeyEncrypted || process.env.EVOLUTION_API_KEY),
    connectedPhone: conn.connectedPhone,
    connectedName: conn.connectedName,
    lastEventAt: conn.lastEventAt,
    lastError: conn.lastError,
    qrCode: conn.qrCode,
  });
});

/**
 * Atualiza configurações de conexão da Evolution API
 */
whatsappRouter.put('/config', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  let conn = db.data.whatsappConnections.find((c) => c.organizationId === orgId);

  if (!conn) {
    conn = {
      id: `waconn_${Date.now()}`,
      organizationId: orgId,
      name: 'WhatsApp Principal',
      instanceName: 'delivale_bot',
      serverUrl: '',
      status: 'disconnected',
      updatedAt: new Date().toISOString(),
    };
    db.data.whatsappConnections.push(conn);
  }

  const { instanceName, serverUrl, apiKey } = req.body;

  if (instanceName) conn.instanceName = instanceName.trim();
  if (serverUrl !== undefined) conn.serverUrl = serverUrl.trim();
  if (apiKey) {
    conn.apiKeyEncrypted = encryptSecret(apiKey.trim());
  }

  conn.updatedAt = new Date().toISOString();
  db.addLog(orgId, 'info', 'whatsapp', 'Parâmetros da Evolution API atualizados.');
  db.save();

  return res.json({ success: true, connection: conn });
});

/**
 * Conecta e busca QR Code ou testa estado atual
 */
whatsappRouter.post('/connect', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const conn = db.data.whatsappConnections.find((c) => c.organizationId === orgId);

  if (!conn) {
    return res.status(404).json({ error: 'Conexão não encontrada' });
  }

  // Testa conexão na Evolution API se houver URL configurada
  if (conn.serverUrl && conn.instanceName) {
    const testRes = await EvolutionService.testConnection(orgId);
    if (testRes.success) {
      return res.json({ success: true, status: 'connected' });
    }
  }

  // Solicita QR Code oficial
  const qrRes = await EvolutionService.fetchQrCode(orgId);
  if (qrRes.success && qrRes.qrcode) {
    return res.json({
      success: true,
      status: 'connecting',
      qrcode: qrRes.qrcode,
      pairingCode: qrRes.pairingCode,
    });
  }

  return res.status(400).json({
    success: false,
    error: qrRes.error || 'Falha ao conectar com a Evolution API',
  });
});

/**
 * Endpoint dedicado para Gerar QR Code Oficial da Evolution API
 */
whatsappRouter.post('/qrcode', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const qrRes = await EvolutionService.fetchQrCode(orgId);

  if (!qrRes.success) {
    return res.status(400).json({
      success: false,
      error: qrRes.error || 'Não foi possível gerar o QR Code oficial',
    });
  }

  return res.json({
    success: true,
    qrcode: qrRes.qrcode,
    pairingCode: qrRes.pairingCode,
    status: qrRes.status,
  });
});

/**
 * Criação da instância oficial na Evolution API
 */
whatsappRouter.post('/create-instance', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const result = await EvolutionService.createInstance(orgId);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error || 'Erro ao criar instância' });
  }
  return res.json({ success: true, details: result.details });
});

/**
 * Verifica o estado em tempo real da conexão (Polling após escanear QR Code)
 */
whatsappRouter.get('/check-state', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const result = await EvolutionService.testConnection(orgId);
  const conn = db.data.whatsappConnections.find((c) => c.organizationId === orgId);

  return res.json({
    success: result.success,
    status: conn?.status || 'disconnected',
    connectedPhone: conn?.connectedPhone,
    connectedName: conn?.connectedName,
    lastEventAt: conn?.lastEventAt,
  });
});

/**
 * Configuração automática de webhook na Evolution API
 */
whatsappRouter.post('/setup-webhook', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const appUrl = (req.body.webhookUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const webhookEndpoint = `${appUrl}/api/webhooks/evolution`;

  const result = await EvolutionService.configureWebhook(orgId, webhookEndpoint);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  return res.json({ success: true, webhookUrl: webhookEndpoint, details: result.details });
});

/**
 * Desconecta a instância
 */
whatsappRouter.post('/disconnect', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  await EvolutionService.disconnect(orgId);
  db.addLog(orgId, 'info', 'whatsapp', 'Instância WhatsApp desconectada.');
  return res.json({ success: true, status: 'disconnected' });
});

/**
 * Envio de mensagem de teste
 */
whatsappRouter.post('/test-send', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Informe o número e a mensagem' });
  }

  const cleanPhone = normalizePhoneNumber(phone);
  const result = await EvolutionService.sendTextMessage(orgId, cleanPhone, message);

  if (!result.success) {
    return res.status(500).json({ error: result.error || 'Falha ao enviar mensagem de teste' });
  }

  return res.json({ success: true, messageId: result.messageId });
});
