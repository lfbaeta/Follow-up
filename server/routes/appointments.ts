import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { EvolutionService } from '../services/evolutionService.js';
import { normalizePhoneNumber } from '../security.js';
import { Appointment } from '../types.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

/**
 * Lista agendamentos, serviços e profissionais
 */
appointmentsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const { date } = req.query as { date?: string };

  let list = db.data.appointments.filter((a) => a.organizationId === orgId);
  if (date) {
    list = list.filter((a) => a.date === date);
  }

  // Ordena por data e horário
  list.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  return res.json({
    appointments: list,
    services: db.data.services.filter((s) => s.organizationId === orgId),
    resources: db.data.resources.filter((r) => r.organizationId === orgId && r.active),
  });
});

/**
 * Cria um agendamento com validação de sobreposição atômica
 */
appointmentsRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const {
    contactName,
    contactPhone,
    serviceId,
    resourceId,
    date,
    startTime,
    notes,
    sendWhatsAppConfirmation = true,
  } = req.body;

  if (!contactName || !contactPhone || !serviceId || !resourceId || !date || !startTime) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
  }

  const cleanPhone = normalizePhoneNumber(contactPhone);
  const service = db.data.services.find((s) => s.id === serviceId && s.organizationId === orgId);
  const resource = db.data.resources.find((r) => r.id === resourceId && r.organizationId === orgId);

  if (!service || !resource) {
    return res.status(404).json({ error: 'Serviço ou profissional não encontrado' });
  }

  // Calcula horário final com base na duração do serviço
  const [startHour, startMin] = startTime.split(':').map(Number);
  const totalMinutes = startHour * 60 + startMin + service.durationMinutes;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

  // Verificação transacional de sobreposição de horário para o mesmo profissional
  const hasOverlap = db.data.appointments.some((a) => {
    if (a.organizationId !== orgId || a.resourceId !== resourceId || a.date !== date) return false;
    if (a.status === 'cancelled') return false;

    // Conflito se (novoInicio < existenteFim) E (novoFim > existenteInicio)
    return startTime < a.endTime && endTime > a.startTime;
  });

  if (hasOverlap) {
    return res.status(409).json({
      error: `Horário indisponível! O profissional ${resource.name} já possui outro agendamento neste intervalo.`,
    });
  }

  const newAppointment: Appointment = {
    id: `appt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    organizationId: orgId,
    contactId: `ctc_${cleanPhone}`,
    contactName: contactName.trim(),
    contactPhone: cleanPhone,
    serviceId: service.id,
    serviceName: service.name,
    resourceId: resource.id,
    resourceName: resource.name,
    date,
    startTime,
    endTime,
    notes: notes || '',
    status: 'scheduled',
    confirmationSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.data.appointments.push(newAppointment);
  db.addLog(orgId, 'info', 'appointments', `Novo agendamento criado: ${service.name} para ${contactName} em ${date} às ${startTime}.`);

  // Se solicitado, envia confirmação via WhatsApp
  if (sendWhatsAppConfirmation) {
    const confirmationText = `✅ *Confirmação de Agendamento - Delivale*\n\nOlá, *${contactName}*! Seu agendamento foi realizado com sucesso:\n\n📅 *Data:* ${new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR')}\n⏰ *Horário:* ${startTime} às ${endTime}\n🩺 *Procedimento:* ${service.name}\n👨‍⚕️ *Profissional:* ${resource.name}\n📍 *Local:* Av. Principal, 1200 - Centro\n\nCaso precise remarcar, basta nos responder aqui. Te esperamos!`.trim();

    EvolutionService.sendTextMessage(orgId, cleanPhone, confirmationText)
      .then((resSend) => {
        if (resSend.success) {
          newAppointment.confirmationSent = true;
          db.save();
        }
      })
      .catch((err) => {
        console.error('[Appointment] Falha ao enviar WhatsApp de confirmação:', err);
      });
  }

  db.save();
  return res.status(201).json({ success: true, appointment: newAppointment });
});

/**
 * Atualiza status do agendamento (confirmed, completed, cancelled)
 */
appointmentsRouter.put('/:id/status', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const apptId = req.params.id;
  const { status } = req.body;

  const appt = db.data.appointments.find((a) => a.id === apptId && a.organizationId === orgId);
  if (!appt) {
    return res.status(404).json({ error: 'Agendamento não encontrado' });
  }

  appt.status = status;
  appt.updatedAt = new Date().toISOString();
  db.save();

  return res.json({ success: true, appointment: appt });
});
