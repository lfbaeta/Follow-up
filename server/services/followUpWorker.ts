import { db } from '../db/database.js';
import { EvolutionService } from './evolutionService.js';
import { generateAIFollowUpMessage } from './geminiService.js';
import { FollowUpStep, Enrollment } from '../types.js';

let workerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Inicia o worker de follow-up persistente
 */
export function startFollowUpWorker(intervalMs = 5000) {
  if (workerInterval) {
    clearInterval(workerInterval);
  }
  console.log('[FollowUpWorker] Motor de follow-up em segundo plano iniciado.');
  workerInterval = setInterval(() => {
    processFollowUpQueue().catch((err) => {
      console.error('[FollowUpWorker] Erro no ciclo de processamento:', err);
    });
  }, intervalMs);

  // Executa o primeiro ciclo imediatamente
  processFollowUpQueue().catch(() => {});
}

/**
 * Para o worker
 */
export function stopFollowUpWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[FollowUpWorker] Motor de follow-up pausado.');
  }
}

/**
 * Ciclo principal de processamento de inscrições
 */
export async function processFollowUpQueue(): Promise<{ processed: number; executed: number }> {
  if (isRunning) return { processed: 0, executed: 0 };
  isRunning = true;

  let processedCount = 0;
  let executedCount = 0;

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Localiza organizações com follow-up ativo
    const orgs = db.data.organizations;

    for (const org of orgs) {
      const convSettings = db.data.conversationSettings.find((s) => s.organizationId === org.id);
      const fuSettings = db.data.followUpSettings.find((s) => s.organizationId === org.id);

      // Se o follow-up estiver desativado nas configurações gerais, pula a execução das etapas
      if (!convSettings?.followUpEnabled) {
        continue;
      }

      // Ordena as etapas cadastradas
      const steps = db.data.followUpSteps
        .filter((s) => s.organizationId === org.id)
        .sort((a, b) => a.order - b.order);

      if (steps.length === 0) continue;

      // Busca inscrições pendentes cujo tempo de disparo venceu
      const eligibleEnrollments = db.data.enrollments.filter((e) => {
        if (e.organizationId !== org.id) return false;
        if (e.status !== 'in_funnel') return false;
        return new Date(e.dueAt) <= now;
      });

      for (const enrollment of eligibleEnrollments) {
        processedCount++;
        const contact = db.data.contacts.find((c) => c.id === enrollment.contactId);
        if (!contact) {
          enrollment.status = 'error';
          enrollment.exitReason = 'Contato não encontrado';
          continue;
        }

        // Verifica restrições do contato
        if (contact.optOut) {
          enrollment.status = 'opt_out';
          enrollment.completedAt = nowIso;
          enrollment.exitReason = 'Solicitou opt-out';
          continue;
        }

        if (contact.converted) {
          enrollment.status = 'converted';
          enrollment.completedAt = nowIso;
          enrollment.exitReason = 'Cliente converteu (COMPROU)';
          continue;
        }

        // Pausa de intervenção humana do operador
        if (contact.humanPausedUntil && new Date(contact.humanPausedUntil) > now) {
          // Mantém pausado temporariamente, posterga o dueAt para o final da pausa
          enrollment.dueAt = contact.humanPausedUntil;
          continue;
        }

        // Verifica lista negra de números
        if (convSettings.blockedNumbers && convSettings.blockedNumbers.includes(contact.normalizedPhone)) {
          enrollment.status = 'finished_no_action';
          enrollment.completedAt = nowIso;
          enrollment.exitReason = 'Número na lista Não Responder';
          continue;
        }

        // Identifica a etapa atual
        const currentStepIndex = enrollment.stepIndex; // 0-based
        const currentStep: FollowUpStep | undefined = steps[currentStepIndex];

        if (!currentStep) {
          // Já concluiu todas as etapas cadastradas
          enrollment.status = 'finished_no_action';
          enrollment.completedAt = nowIso;
          enrollment.exitReason = 'Todas as etapas foram concluídas';
          continue;
        }

        // Prepara o texto da mensagem
        let finalMessage = currentStep.messageContent;

        // Se modo "Com IA", gera variação contextualizada inteligente
        if (fuSettings?.mode === 'ai') {
          const recentChat = db.data.chatMessages
            .filter((m) => m.contactId === contact.id)
            .slice(-6)
            .map((m) => ({ sender: m.sender, content: m.content }));

          finalMessage = await generateAIFollowUpMessage(
            org.id,
            currentStep.messageContent,
            contact.name,
            recentChat
          );
        } else {
          // Modo texto fixo: substitui variáveis simples
          finalMessage = finalMessage.replace(/{nome}/gi, contact.name || 'amigo(a)');
        }

        // Adiciona rodapé de opt-out configurado se ativo
        if (fuSettings?.optOutActive && fuSettings.optOutFooter) {
          if (!finalMessage.includes(fuSettings.optOutKeyword)) {
            finalMessage = `${finalMessage}\n\n${fuSettings.optOutFooter}`;
          }
        }

        // Executa o envio pelo WhatsApp
        let sendResult;
        if (currentStep.mediaUrl) {
          sendResult = await EvolutionService.sendMediaMessage(
            org.id,
            contact.normalizedPhone,
            finalMessage,
            currentStep.mediaUrl,
            currentStep.mediaOriginalName || undefined,
            currentStep.mediaMimeType || undefined
          );
        } else {
          sendResult = await EvolutionService.sendTextMessage(
            org.id,
            contact.normalizedPhone,
            finalMessage
          );
        }

        executedCount++;
        enrollment.lastMessageSentAt = nowIso;

        // Registra histórico do envio na inscrição
        enrollment.stepHistory.push({
          stepIndex: currentStepIndex + 1,
          stepId: currentStep.id,
          sentAt: nowIso,
          mode: fuSettings?.mode || 'fixed',
          textSent: finalMessage,
          mediaSent: currentStep.mediaUrl || null,
        });

        // Agenda a próxima etapa ou finaliza o funil
        const nextStepIndex = currentStepIndex + 1;
        const nextStep = steps[nextStepIndex];

        if (nextStep) {
          enrollment.stepIndex = nextStepIndex;
          enrollment.currentStepId = nextStep.id;
          // Regra do contrato (Seção 10.4):
          // dueAt = instante de conclusão confirmada da etapa anterior + duração da etapa seguinte
          const nextDueTime = new Date(now.getTime() + nextStep.totalDurationMinutes * 60 * 1000);
          enrollment.dueAt = nextDueTime.toISOString();
          db.addLog(org.id, 'info', 'followup', `Etapa ${currentStepIndex + 1} disparada para ${contact.name || contact.normalizedPhone}. Próxima etapa em ${nextStep.totalDurationMinutes} min.`);
        } else {
          enrollment.status = 'finished_no_action';
          enrollment.completedAt = nowIso;
          enrollment.exitReason = 'Funil concluído sem ação do cliente';
          db.addLog(org.id, 'info', 'followup', `Última etapa disparada para ${contact.name || contact.normalizedPhone}. Inscrição concluída.`);
        }
      }
    }

    if (executedCount > 0) {
      db.save();
    }
  } finally {
    isRunning = false;
  }

  return { processed: processedCount, executed: executedCount };
}

/**
 * Cria ou reativa uma inscrição para um contato elegível
 */
export function enrollContactInFollowUp(organizationId: string, contactId: string): Enrollment | null {
  const convSettings = db.data.conversationSettings.find((s) => s.organizationId === organizationId);
  const fuSettings = db.data.followUpSettings.find((s) => s.organizationId === organizationId);
  const contact = db.data.contacts.find((c) => c.id === contactId);

  if (!convSettings?.followUpEnabled || !contact) return null;
  if (contact.optOut || contact.converted) return null;

  // Verifica lista de bloqueio
  if (convSettings.blockedNumbers?.includes(contact.normalizedPhone)) return null;

  // Verifica lista de permissão (se configurada e não vazia)
  if (convSettings.allowedNumbers && convSettings.allowedNumbers.length > 0) {
    if (!convSettings.allowedNumbers.includes(contact.normalizedPhone)) return null;
  }

  // Verifica se já tem inscrição ativa no funil
  const existingActive = db.data.enrollments.find(
    (e) => e.organizationId === organizationId && e.contactId === contactId && e.status === 'in_funnel'
  );

  const steps = db.data.followUpSteps
    .filter((s) => s.organizationId === organizationId)
    .sort((a, b) => a.order - b.order);

  if (steps.length === 0) return null;

  const now = new Date();
  const inactivityMinutes = fuSettings?.inactivityMinutes ?? 1;
  const firstStep = steps[0];

  // Regra do contrato (Seção 10.3):
  // Primeira etapa: dueAt = lastRelevantInteractionAt + inatividade configurada + duração da primeira etapa.
  const lastInteractionTime = contact.lastRelevantInteractionAt
    ? new Date(contact.lastRelevantInteractionAt).getTime()
    : now.getTime();

  const totalDelayMinutes = inactivityMinutes + firstStep.totalDurationMinutes;
  const dueAtDate = new Date(lastInteractionTime + totalDelayMinutes * 60 * 1000);

  if (existingActive) {
    // Se a conversa teve nova interação, recalcula o dueAt a partir do novo lastRelevantInteractionAt
    existingActive.dueAt = dueAtDate.toISOString();
    db.save();
    return existingActive;
  }

  // Cria nova inscrição
  const newEnrollment: Enrollment = {
    id: `enr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    organizationId,
    contactId: contact.id,
    contactName: contact.name || 'Cliente',
    contactPhone: contact.normalizedPhone,
    stepIndex: 0,
    currentStepId: firstStep.id,
    status: 'in_funnel',
    enteredAt: now.toISOString(),
    dueAt: dueAtDate.toISOString(),
    completedAt: null,
    lastMessageSentAt: null,
    exitReason: null,
    stepHistory: [],
  };

  db.data.enrollments.push(newEnrollment);
  db.addLog(organizationId, 'info', 'followup', `Cliente ${contact.name || contact.normalizedPhone} inscrito no funil. Primeiro follow-up agendado para ${dueAtDate.toLocaleTimeString('pt-BR')}`);
  db.save();

  return newEnrollment;
}
