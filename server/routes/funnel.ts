import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { generateFunnelXlsx, validateXlsxBuffer, FunnelExportRow } from '../services/xlsxService.js';
import { normalizePhoneNumber } from '../security.js';

export const funnelRouter = Router();

funnelRouter.use(requireAuth);

/**
 * Consulta a lista e indicadores do Funil de Contatos com filtros
 */
funnelRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const { startDate, endDate, search } = req.query as {
    startDate?: string;
    endDate?: string;
    search?: string;
  };

  const steps = db.data.followUpSteps
    .filter((s) => s.organizationId === orgId)
    .sort((a, b) => a.order - b.order);

  // Normaliza filtros de data
  let startTimestamp: number | null = null;
  let endTimestamp: number | null = null;

  if (startDate) {
    startTimestamp = new Date(`${startDate}T00:00:00.000Z`).getTime();
  }
  if (endDate) {
    endTimestamp = new Date(`${endDate}T23:59:59.999Z`).getTime();
  }

  const normSearch = search ? search.trim().toLowerCase() : '';
  const normPhoneSearch = search ? normalizePhoneNumber(search) : '';

  // Filtra as inscrições
  const filteredEnrollments = db.data.enrollments.filter((e) => {
    if (e.organizationId !== orgId) return false;

    const enteredTime = new Date(e.enteredAt).getTime();
    if (startTimestamp && enteredTime < startTimestamp) return false;
    if (endTimestamp && enteredTime > endTimestamp) return false;

    if (normSearch) {
      const matchName = e.contactName.toLowerCase().includes(normSearch);
      const matchPhone = normPhoneSearch
        ? e.contactPhone.includes(normPhoneSearch)
        : e.contactPhone.includes(normSearch);
      if (!matchName && !matchPhone) return false;
    }

    return true;
  });

  // Calcula indicadores com denominador correto
  const totalInFilter = filteredEnrollments.length;
  const inFunnelCount = filteredEnrollments.filter((e) => e.status === 'in_funnel').length;
  const convertedCount = filteredEnrollments.filter((e) => e.status === 'converted').length;
  const optOutCount = filteredEnrollments.filter((e) => e.status === 'opt_out').length;
  const finishedNoActionCount = filteredEnrollments.filter((e) => e.status === 'finished_no_action').length;

  const convertedPct = totalInFilter > 0 ? (convertedCount / totalInFilter) * 100 : 0;
  const optOutPct = totalInFilter > 0 ? (optOutCount / totalInFilter) * 100 : 0;
  const finishedPct = totalInFilter > 0 ? (finishedNoActionCount / totalInFilter) * 100 : 0;

  // Formata os registros para a tabela com dados ricos
  const now = Date.now();
  const rows = filteredEnrollments.map((e) => {
    const stepOrder = e.stepIndex + 1;
    const isClosed = e.status !== 'in_funnel';

    let proximoEnvioLabel = '—';
    if (!isClosed && e.dueAt) {
      const dueTime = new Date(e.dueAt).getTime();
      const diffMinutes = Math.round((dueTime - now) / 60000);
      if (diffMinutes <= 0) {
        proximoEnvioLabel = 'agora';
      } else if (diffMinutes === 1) {
        proximoEnvioLabel = 'em 1 minuto';
      } else if (diffMinutes < 60) {
        proximoEnvioLabel = `em ${diffMinutes} minutos`;
      } else {
        const diffHours = Math.round(diffMinutes / 60);
        proximoEnvioLabel = `em ${diffHours}h`;
      }
    } else if (isClosed) {
      proximoEnvioLabel = 'Encerrado';
    }

    let statusDisplay = 'NO FUNIL';
    if (e.status === 'converted') statusDisplay = 'COMPROU';
    else if (e.status === 'opt_out') statusDisplay = 'OPT-OUT';
    else if (e.status === 'finished_no_action') statusDisplay = 'SEM AÇÃO';
    else if (e.status === 'paused') statusDisplay = 'PAUSADO';

    return {
      id: e.id,
      contactId: e.contactId,
      name: e.contactName,
      phone: e.contactPhone,
      step: isClosed ? `${steps.length}` : `${stepOrder}`,
      stepOrder,
      nextSend: proximoEnvioLabel,
      dueAt: e.dueAt,
      enteredAt: e.enteredAt,
      completedAt: e.completedAt,
      status: e.status,
      statusDisplay,
      exitReason: e.exitReason,
      historyCount: e.stepHistory.length,
    };
  });

  return res.json({
    metrics: {
      totalInFunnel: inFunnelCount,
      totalCount: totalInFilter,
      converted: {
        count: convertedCount,
        percentage: convertedPct.toFixed(2),
      },
      optOut: {
        count: optOutCount,
        percentage: optOutPct.toFixed(2),
      },
      finishedNoAction: {
        count: finishedNoActionCount,
        percentage: finishedPct.toFixed(2),
      },
    },
    items: rows,
  });
});

/**
 * Atualiza o status de uma inscrição (ex: conversão manual, saída, reinício)
 */
funnelRouter.put('/enrollment/:id/status', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const enrollmentId = req.params.id;
  const { newStatus, notes } = req.body;

  const enrollment = db.data.enrollments.find((e) => e.id === enrollmentId && e.organizationId === orgId);
  if (!enrollment) {
    return res.status(404).json({ error: 'Inscrição não encontrada' });
  }

  const validStatuses = ['in_funnel', 'converted', 'opt_out', 'finished_no_action', 'paused'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'Status informado é inválido' });
  }

  const previousStatus = enrollment.status;
  enrollment.status = newStatus;
  enrollment.exitReason = notes || `Status alterado manualmente de ${previousStatus} para ${newStatus}`;

  const contact = db.data.contacts.find((c) => c.id === enrollment.contactId);
  if (contact) {
    if (newStatus === 'converted') {
      contact.converted = true;
      contact.optOut = false;
      enrollment.completedAt = new Date().toISOString();
    } else if (newStatus === 'opt_out') {
      contact.optOut = true;
      contact.converted = false;
      enrollment.completedAt = new Date().toISOString();
    } else if (newStatus === 'in_funnel') {
      contact.converted = false;
      contact.optOut = false;
      enrollment.completedAt = null;
      // Reavalia dueAt para não ficar atrasado
      enrollment.dueAt = new Date(Date.now() + 60 * 1000).toISOString();
    }
    contact.updatedAt = new Date().toISOString();
  }

  db.addLog(orgId, 'info', 'followup', `Status da inscrição ${enrollmentId} alterado para ${newStatus}.`);
  db.save();

  return res.json({ success: true, enrollment });
});

/**
 * Exporta a lista filtrada em arquivo XLSX binário real
 */
funnelRouter.get('/export/xlsx', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const { startDate, endDate, search } = req.query as {
    startDate?: string;
    endDate?: string;
    search?: string;
  };

  let startTimestamp: number | null = null;
  let endTimestamp: number | null = null;

  if (startDate) {
    startTimestamp = new Date(`${startDate}T00:00:00.000Z`).getTime();
  }
  if (endDate) {
    endTimestamp = new Date(`${endDate}T23:59:59.999Z`).getTime();
  }

  const normSearch = search ? search.trim().toLowerCase() : '';
  const normPhoneSearch = search ? normalizePhoneNumber(search) : '';

  const filtered = db.data.enrollments.filter((e) => {
    if (e.organizationId !== orgId) return false;
    const enteredTime = new Date(e.enteredAt).getTime();
    if (startTimestamp && enteredTime < startTimestamp) return false;
    if (endTimestamp && enteredTime > endTimestamp) return false;

    if (normSearch) {
      const matchName = e.contactName.toLowerCase().includes(normSearch);
      const matchPhone = normPhoneSearch
        ? e.contactPhone.includes(normPhoneSearch)
        : e.contactPhone.includes(normSearch);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  const exportRows: FunnelExportRow[] = filtered.map((e) => ({
    nome: e.contactName,
    numero: e.contactPhone,
    inscricaoId: e.id,
    dataEntrada: new Date(e.enteredAt).toLocaleString('pt-BR'),
    etapaAtual: `Etapa ${e.stepIndex + 1}`,
    proximoEnvio: e.status === 'in_funnel' ? new Date(e.dueAt).toLocaleString('pt-BR') : 'Encerrado',
    status: e.status.toUpperCase(),
    motivoEncerramento: e.exitReason || '',
    dataConclusao: e.completedAt ? new Date(e.completedAt).toLocaleString('pt-BR') : '',
  }));

  const xlsxBuffer = generateFunnelXlsx(exportRows);

  // Validação estrita do arquivo conforme contrato 12.11
  const isValid = validateXlsxBuffer(xlsxBuffer);
  if (!isValid) {
    return res.status(500).json({ error: 'Falha na integridade da planilha XLSX gerada' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `delivale_followup_funil_${todayStr}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(xlsxBuffer);
});
