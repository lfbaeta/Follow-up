import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { handleIncomingWhatsAppMessage } from './webhooks.js';
import { processFollowUpQueue } from '../services/followUpWorker.js';
import { normalizePhoneNumber } from '../security.js';

export const simulatorRouter = Router();

simulatorRouter.use(requireAuth);

/**
 * Retorna as mensagens de chat e status do contato no simulador
 */
simulatorRouter.get('/messages', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const phone = normalizePhoneNumber((req.query.phone as string) || '5511999998888');

  const contact = db.data.contacts.find((c) => c.organizationId === orgId && c.normalizedPhone === phone);
  const messages = db.data.chatMessages
    .filter((m) => m.organizationId === orgId && m.phone === phone)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const enrollment = db.data.enrollments.find(
    (e) => e.organizationId === orgId && e.contactPhone === phone && e.status === 'in_funnel'
  );

  return res.json({
    phone,
    contact: contact || null,
    activeEnrollment: enrollment || null,
    messages,
  });
});

/**
 * Envia uma mensagem simulada no papel de cliente ou operador humano
 */
simulatorRouter.post('/send', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const { phone = '5511999998888', name = 'Lucas Alberto', messageText, senderType = 'contact' } = req.body;

  if (!messageText || !messageText.trim()) {
    return res.status(400).json({ error: 'Digite uma mensagem para simular' });
  }

  const cleanPhone = normalizePhoneNumber(phone);
  const fromMe = senderType === 'human_operator';

  const result = await handleIncomingWhatsAppMessage(
    orgId,
    cleanPhone,
    name,
    messageText.trim(),
    fromMe
  );

  return res.json({
    success: true,
    result,
  });
});

/**
 * Força a execução imediata de follow-up do worker
 */
simulatorRouter.post('/trigger-worker', async (_req: AuthenticatedRequest, res: Response) => {
  const result = await processFollowUpQueue();
  return res.json({ success: true, ...result });
});

/**
 * Reseta o histórico de mensagens e funil do contato de teste
 */
simulatorRouter.post('/reset', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const phone = normalizePhoneNumber((req.body.phone as string) || '5511999998888');

  db.data.chatMessages = db.data.chatMessages.filter(
    (m) => !(m.organizationId === orgId && m.phone === phone)
  );

  db.data.enrollments = db.data.enrollments.filter(
    (e) => !(e.organizationId === orgId && e.contactPhone === phone)
  );

  const contact = db.data.contacts.find((c) => c.organizationId === orgId && c.normalizedPhone === phone);
  if (contact) {
    contact.optOut = false;
    contact.converted = false;
    contact.humanPausedUntil = null;
    contact.lastRelevantInteractionAt = new Date().toISOString();
  }

  db.save();
  return res.json({ success: true, message: 'Dados de teste limpos com sucesso.' });
});
