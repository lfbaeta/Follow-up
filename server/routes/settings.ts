import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { normalizePhoneNumber } from '../security.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

/**
 * Retorna o agregado de configurações da organização
 */
settingsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const convSettings = db.data.conversationSettings.find((s) => s.organizationId === orgId) || db.data.conversationSettings[0];
  const aiSettings = db.data.aiSettings.find((s) => s.organizationId === orgId) || db.data.aiSettings[0];
  const fuSettings = db.data.followUpSettings.find((s) => s.organizationId === orgId) || db.data.followUpSettings[0];
  const waConn = db.data.whatsappConnections.find((c) => c.organizationId === orgId) || db.data.whatsappConnections[0];

  return res.json({
    conversationSettings: convSettings,
    aiSettings: {
      ...aiSettings,
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    },
    followUpSettings: fuSettings,
    whatsappConnection: {
      id: waConn?.id,
      name: waConn?.name,
      instanceName: waConn?.instanceName,
      serverUrl: waConn?.serverUrl,
      status: waConn?.status || 'disconnected',
      connectedPhone: waConn?.connectedPhone,
      connectedName: waConn?.connectedName,
      lastEventAt: waConn?.lastEventAt,
    },
  });
});

/**
 * Salva configurações de conversas (Início)
 */
settingsRouter.put('/conversations', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  let convSettings = db.data.conversationSettings.find((s) => s.organizationId === orgId);

  if (!convSettings) {
    convSettings = {
      id: `conv_${Date.now()}`,
      organizationId: orgId,
      aiModelProvider: 'gemini',
      aiModelName: 'gemini-3.8-flash',
      unknownTypeMessage: 'Desculpe, não compreendi esse tipo de arquivo.',
      operatorReactivationHours: 24,
      messageBatchingSeconds: 4,
      schedulingEnabled: false,
      followUpEnabled: true,
      aiResponseEnabled: true,
      allowedNumbers: [],
      blockedNumbers: [],
      updatedAt: new Date().toISOString(),
    };
    db.data.conversationSettings.push(convSettings);
  }

  const {
    aiModelProvider,
    aiModelName,
    unknownTypeMessage,
    operatorReactivationHours,
    messageBatchingSeconds,
    schedulingEnabled,
    followUpEnabled,
    aiResponseEnabled,
    allowedNumbers,
    blockedNumbers,
  } = req.body;

  if (aiModelProvider) convSettings.aiModelProvider = aiModelProvider;
  if (aiModelName) convSettings.aiModelName = aiModelName;
  if (unknownTypeMessage !== undefined) convSettings.unknownTypeMessage = unknownTypeMessage;
  if (operatorReactivationHours !== undefined) convSettings.operatorReactivationHours = Number(operatorReactivationHours);
  if (messageBatchingSeconds !== undefined) convSettings.messageBatchingSeconds = Number(messageBatchingSeconds);
  if (schedulingEnabled !== undefined) convSettings.schedulingEnabled = Boolean(schedulingEnabled);
  if (followUpEnabled !== undefined) convSettings.followUpEnabled = Boolean(followUpEnabled);
  if (aiResponseEnabled !== undefined) convSettings.aiResponseEnabled = Boolean(aiResponseEnabled);

  if (Array.isArray(allowedNumbers)) {
    convSettings.allowedNumbers = allowedNumbers.map(normalizePhoneNumber).filter(Boolean);
  }
  if (Array.isArray(blockedNumbers)) {
    convSettings.blockedNumbers = blockedNumbers.map(normalizePhoneNumber).filter(Boolean);
  }

  convSettings.updatedAt = new Date().toISOString();
  db.addLog(orgId, 'info', 'system', 'Configurações de conversa atualizadas com sucesso.');
  db.save();

  return res.json({ success: true, settings: convSettings });
});

/**
 * Salva configurações da IA
 */
settingsRouter.put('/ai', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  let aiSettings = db.data.aiSettings.find((s) => s.organizationId === orgId);

  if (!aiSettings) {
    aiSettings = {
      id: `ai_${Date.now()}`,
      organizationId: orgId,
      geminiModel: 'gemini-3.8-flash',
      openaiModel: 'gpt-4o-mini',
      systemPrompt: '',
      businessKnowledge: '',
      temperature: 0.7,
      maxTokens: 500,
      updatedAt: new Date().toISOString(),
    };
    db.data.aiSettings.push(aiSettings);
  }

  const { geminiModel, openaiModel, systemPrompt, businessKnowledge, temperature, maxTokens } = req.body;

  if (geminiModel) aiSettings.geminiModel = geminiModel;
  if (openaiModel) aiSettings.openaiModel = openaiModel;
  if (systemPrompt !== undefined) aiSettings.systemPrompt = systemPrompt;
  if (businessKnowledge !== undefined) aiSettings.businessKnowledge = businessKnowledge;
  if (temperature !== undefined) aiSettings.temperature = Number(temperature);
  if (maxTokens !== undefined) aiSettings.maxTokens = Number(maxTokens);

  aiSettings.updatedAt = new Date().toISOString();
  db.addLog(orgId, 'info', 'ai', 'Configurações de IA atualizadas com sucesso.');
  db.save();

  return res.json({ success: true, settings: aiSettings });
});

/**
 * Salva configurações de follow-up
 */
settingsRouter.put('/followup', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  let fuSettings = db.data.followUpSettings.find((s) => s.organizationId === orgId);

  if (!fuSettings) {
    fuSettings = {
      id: `fu_${Date.now()}`,
      organizationId: orgId,
      mode: 'fixed',
      inactivityMinutes: 1,
      conversionTriggerActive: true,
      conversionKeyword: 'JÁ COMPREI',
      conversionAliases: [],
      optOutActive: true,
      optOutKeyword: 'SAIR',
      optOutFooter: 'Se não quiser receber novas mensagens, responda SAIR.',
      optOutAliases: [],
      sequenceCooldownHours: 24,
      updatedAt: new Date().toISOString(),
    };
    db.data.followUpSettings.push(fuSettings);
  }

  const {
    mode,
    inactivityMinutes,
    conversionTriggerActive,
    conversionKeyword,
    conversionAliases,
    optOutActive,
    optOutKeyword,
    optOutFooter,
    optOutAliases,
    sequenceCooldownHours,
  } = req.body;

  if (mode === 'fixed' || mode === 'ai') fuSettings.mode = mode;
  if (inactivityMinutes !== undefined) fuSettings.inactivityMinutes = Math.max(1, Number(inactivityMinutes));
  if (conversionTriggerActive !== undefined) fuSettings.conversionTriggerActive = Boolean(conversionTriggerActive);
  if (conversionKeyword) fuSettings.conversionKeyword = conversionKeyword.trim();
  if (Array.isArray(conversionAliases)) fuSettings.conversionAliases = conversionAliases;
  if (optOutActive !== undefined) fuSettings.optOutActive = Boolean(optOutActive);
  if (optOutKeyword) fuSettings.optOutKeyword = optOutKeyword.trim();
  if (optOutFooter !== undefined) fuSettings.optOutFooter = optOutFooter;
  if (Array.isArray(optOutAliases)) fuSettings.optOutAliases = optOutAliases;
  if (sequenceCooldownHours !== undefined) fuSettings.sequenceCooldownHours = Number(sequenceCooldownHours);

  fuSettings.updatedAt = new Date().toISOString();
  db.addLog(orgId, 'info', 'followup', 'Configurações de follow-up salvas com sucesso.');
  db.save();

  return res.json({ success: true, settings: fuSettings });
});
