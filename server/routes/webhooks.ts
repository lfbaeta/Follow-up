import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { normalizePhoneNumber, isKeywordMatch } from '../security.js';
import { enrollContactInFollowUp } from '../services/followUpWorker.js';
import { generateAIChatResponse } from '../services/geminiService.js';
import { EvolutionService } from '../services/evolutionService.js';
import { Contact } from '../types.js';

export const webhooksRouter = Router();

// Cache de deduplicação em memória (últimos 1000 IDs de mensagem recebidos)
const processedMessageIds = new Set<string>();

/**
 * Endpoint para receber Webhooks da Evolution API
 * Configurar no painel da Evolution: https://seu-app.com/api/webhooks/evolution
 */
webhooksRouter.post('/evolution', async (req: Request, res: Response) => {
  const payload = req.body;
  const event = payload?.event || payload?.type;
  const instance = payload?.instance;

  // Localiza a conexão correspondente à instância
  const conn = db.data.whatsappConnections.find((c) => c.instanceName === instance) || db.data.whatsappConnections[0];
  const orgId = conn ? conn.organizationId : db.data.organizations[0].id;

  if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
    const state = payload?.data?.state || payload?.state;
    if (state === 'open' || state === 'connected') {
      conn.status = 'connected';
      conn.connectedPhone = payload?.data?.phone || conn.connectedPhone;
      conn.lastEventAt = new Date().toISOString();
      db.save();
    } else if (state === 'close' || state === 'disconnected') {
      conn.status = 'disconnected';
      conn.lastEventAt = new Date().toISOString();
      db.save();
    }
    return res.status(200).json({ received: true });
  }

  // Eventos de mensagem
  if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT' || payload?.data?.message) {
    const msgData = payload?.data || payload;
    const key = msgData?.key;
    const messageContent =
      msgData?.message?.conversation ||
      msgData?.message?.extendedTextMessage?.text ||
      msgData?.message?.imageMessage?.caption ||
      '';

    const remoteJid = key?.remoteJid || '';
    const fromMe = Boolean(key?.fromMe);
    const messageId = key?.id || `msg_${Date.now()}`;

    // Ignora grupos e status broadcasts
    if (remoteJid.includes('@g.us') || remoteJid.includes('status@broadcast')) {
      return res.status(200).json({ ignored: 'group_or_status' });
    }

    // Deduplicação estrita
    if (processedMessageIds.has(messageId)) {
      return res.status(200).json({ ignored: 'duplicate' });
    }
    processedMessageIds.add(messageId);
    if (processedMessageIds.size > 2000) {
      const first = processedMessageIds.values().next().value;
      if (first) processedMessageIds.delete(first);
    }

    const rawNumber = remoteJid.replace('@s.whatsapp.net', '');
    const cleanPhone = normalizePhoneNumber(rawNumber);
    const pushName = msgData?.pushName || 'Cliente WhatsApp';

    await handleIncomingWhatsAppMessage(orgId, cleanPhone, pushName, messageContent, fromMe);
  }

  return res.status(200).json({ success: true });
});

/**
 * Função central de processamento de mensagem recebida
 */
export async function handleIncomingWhatsAppMessage(
  organizationId: string,
  phone: string,
  name: string,
  messageText: string,
  fromMe: boolean
): Promise<{ reply?: string; status: string }> {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Busca ou cria o contato
  let contact: Contact | undefined = db.data.contacts.find(
    (c) => c.organizationId === organizationId && c.normalizedPhone === phone
  );

  if (!contact) {
    contact = {
      id: `ctc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizationId,
      name: name || 'Cliente',
      phone,
      normalizedPhone: phone,
      optOut: false,
      converted: false,
      humanPausedUntil: null,
      lastRelevantInteractionAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.data.contacts.push(contact);
  } else {
    contact.lastRelevantInteractionAt = nowIso;
    contact.updatedAt = nowIso;
    if (name && contact.name === 'Cliente') {
      contact.name = name;
    }
  }

  // 2. Se a mensagem foi enviada pelo operador humano no WhatsApp Web/app (fromMe: true)
  if (fromMe) {
    const convSettings = db.data.conversationSettings.find((s) => s.organizationId === organizationId);
    const pauseHours = convSettings?.operatorReactivationHours ?? 24;
    const pauseUntil = new Date(now.getTime() + pauseHours * 60 * 60 * 1000).toISOString();

    contact.humanPausedUntil = pauseUntil;
    db.data.chatMessages.push({
      id: `msg_op_${Date.now()}`,
      organizationId,
      contactId: contact.id,
      phone,
      sender: 'human_operator',
      content: messageText,
      timestamp: nowIso,
      delivered: true,
    });

    db.addLog(
      organizationId,
      'info',
      'whatsapp',
      `Intervenção humana detectada para ${contact.name || phone}. IA e follow-up pausados por ${pauseHours}h.`
    );
    db.save();
    return { status: 'human_paused' };
  }

  // 3. Registra a mensagem do cliente no histórico
  db.data.chatMessages.push({
    id: `msg_in_${Date.now()}`,
    organizationId,
    contactId: contact.id,
    phone,
    sender: 'contact',
    content: messageText,
    timestamp: nowIso,
    delivered: true,
  });

  const fuSettings = db.data.followUpSettings.find((s) => s.organizationId === organizationId);
  const convSettings = db.data.conversationSettings.find((s) => s.organizationId === organizationId);

  // 4. Avaliação de Opt-Out (SAIR)
  const isOptOut =
    fuSettings?.optOutActive &&
    fuSettings.optOutKeyword &&
    isKeywordMatch(messageText, fuSettings.optOutKeyword, fuSettings.optOutAliases);

  // 5. Avaliação de Conversão (JÁ COMPREI)
  const isConversion =
    fuSettings?.conversionTriggerActive &&
    fuSettings.conversionKeyword &&
    isKeywordMatch(messageText, fuSettings.conversionKeyword, fuSettings.conversionAliases);

  // Regra 8.10 do contrato: Em conflito entre saída e conversão, a SAÍDA PREVALECE
  if (isOptOut) {
    contact.optOut = true;
    contact.converted = false;

    // Cancela inscrições ativas no funil
    const activeEnrollments = db.data.enrollments.filter(
      (e) => e.organizationId === organizationId && e.contactId === contact.id && e.status === 'in_funnel'
    );
    activeEnrollments.forEach((e) => {
      e.status = 'opt_out';
      e.completedAt = nowIso;
      e.exitReason = `Solicitou opt-out via mensagem: "${messageText}"`;
    });

    const optOutAck = 'Perfeito, sua solicitação foi registrada e você não receberá novas mensagens automáticas. Caso queira voltar a conversar, estamos à disposição!';
    await EvolutionService.sendTextMessage(organizationId, phone, optOutAck);

    db.addLog(organizationId, 'info', 'followup', `Cliente ${contact.name || phone} solicitou opt-out.`);
    db.save();
    return { reply: optOutAck, status: 'opt_out_confirmed' };
  }

  if (isConversion) {
    contact.converted = true;
    contact.optOut = false;

    // Encerra inscrições no funil com status 'converted'
    const activeEnrollments = db.data.enrollments.filter(
      (e) => e.organizationId === organizationId && e.contactId === contact.id && e.status === 'in_funnel'
    );
    activeEnrollments.forEach((e) => {
      e.status = 'converted';
      e.completedAt = nowIso;
      e.exitReason = `Cliente converteu com a palavra-chave "${messageText}"`;
    });

    const conversionAck = 'Excelente! Muito obrigado pela confirmação da sua compra/agendamento. Ficamos muito felizes em ter você conosco!';
    await EvolutionService.sendTextMessage(organizationId, phone, conversionAck);

    db.addLog(organizationId, 'info', 'followup', `Cliente ${contact.name || phone} converteu (COMPROU).`);
    db.save();
    return { reply: conversionAck, status: 'converted_confirmed' };
  }

  // 6. Mensagem normal: inscreve / reavalia no funil de follow-up se ativo
  if (convSettings?.followUpEnabled && !contact.optOut && !contact.converted) {
    enrollContactInFollowUp(organizationId, contact.id);
  }

  // 7. Resposta automática com IA (se ativado)
  let aiReplyText = '';
  if (convSettings?.aiResponseEnabled) {
    const recentHistory = db.data.chatMessages
      .filter((m) => m.contactId === contact.id)
      .slice(-6)
      .map((m) => ({ sender: m.sender, content: m.content }));

    aiReplyText = await generateAIChatResponse(organizationId, messageText, contact.name, recentHistory);

    // Envia a resposta da IA após delay natural de digitação
    await EvolutionService.sendTextMessage(organizationId, phone, aiReplyText);
  }

  db.save();
  return { reply: aiReplyText, status: 'message_handled' };
}
