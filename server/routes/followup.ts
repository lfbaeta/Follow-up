import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { FollowUpStep } from '../types.js';
import { processFollowUpQueue } from '../services/followUpWorker.js';

export const followupRouter = Router();

followupRouter.use(requireAuth);

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuração do multer para upload de anexos de mídia
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${basename}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
});

/**
 * Lista as etapas de follow-up da organização
 */
followupRouter.get('/steps', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const steps = db.data.followUpSteps
    .filter((s) => s.organizationId === orgId)
    .sort((a, b) => a.order - b.order);

  return res.json({ steps });
});

/**
 * Cria uma nova etapa de follow-up (com ou sem mídia)
 */
followupRouter.post('/steps', upload.single('mediaFile'), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const {
    messageContent,
    durationDays = 0,
    durationHours = 0,
    durationMinutes = 0,
    mediaType = 'none',
  } = req.body;

  if (!messageContent && !req.file) {
    return res.status(400).json({ error: 'Informe a mensagem ou anexe um arquivo para a etapa' });
  }

  const d = Math.max(0, parseInt(durationDays, 10) || 0);
  const h = Math.min(23, Math.max(0, parseInt(durationHours, 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(durationMinutes, 10) || 0));
  const totalMinutes = d * 24 * 60 + h * 60 + m;

  const currentSteps = db.data.followUpSteps.filter((s) => s.organizationId === orgId);
  const nextOrder = currentSteps.length + 1;

  let mediaUrl: string | null = null;
  let mediaOriginalName: string | null = null;
  let mediaMimeType: string | null = null;

  if (req.file) {
    mediaUrl = `/uploads/${req.file.filename}`;
    mediaOriginalName = req.file.originalname;
    mediaMimeType = req.file.mimetype;
  }

  const newStep: FollowUpStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    organizationId: orgId,
    order: nextOrder,
    durationDays: d,
    durationHours: h,
    durationMinutes: m,
    totalDurationMinutes: totalMinutes,
    messageContent: messageContent || '',
    mediaUrl,
    mediaOriginalName,
    mediaMimeType,
    mediaType: mediaUrl ? (mediaMimeType?.startsWith('image/') ? 'image' : 'document') : 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.data.followUpSteps.push(newStep);
  db.addLog(orgId, 'info', 'followup', `Nova etapa #${nextOrder} cadastrada com duração de ${totalMinutes} min.`);
  db.save();

  return res.status(201).json({ success: true, step: newStep });
});

/**
 * Atualiza uma etapa existente
 */
followupRouter.put('/steps/:id', upload.single('mediaFile'), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const stepId = req.params.id;
  const step = db.data.followUpSteps.find((s) => s.id === stepId && s.organizationId === orgId);

  if (!step) {
    return res.status(404).json({ error: 'Etapa não encontrada' });
  }

  const {
    messageContent,
    durationDays,
    durationHours,
    durationMinutes,
    removeMedia,
  } = req.body;

  if (messageContent !== undefined) step.messageContent = messageContent;

  const d = durationDays !== undefined ? Math.max(0, parseInt(durationDays, 10) || 0) : step.durationDays;
  const h = durationHours !== undefined ? Math.min(23, Math.max(0, parseInt(durationHours, 10) || 0)) : step.durationHours;
  const m = durationMinutes !== undefined ? Math.min(59, Math.max(0, parseInt(durationMinutes, 10) || 0)) : step.durationMinutes;

  step.durationDays = d;
  step.durationHours = h;
  step.durationMinutes = m;
  step.totalDurationMinutes = d * 24 * 60 + h * 60 + m;

  if (removeMedia === 'true' || removeMedia === true) {
    step.mediaUrl = null;
    step.mediaOriginalName = null;
    step.mediaMimeType = null;
    step.mediaType = 'none';
  }

  if (req.file) {
    step.mediaUrl = `/uploads/${req.file.filename}`;
    step.mediaOriginalName = req.file.originalname;
    step.mediaMimeType = req.file.mimetype;
    step.mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
  }

  step.updatedAt = new Date().toISOString();
  db.addLog(orgId, 'info', 'followup', `Etapa #${step.order} atualizada com sucesso.`);
  db.save();

  return res.json({ success: true, step });
});

/**
 * Exclui uma etapa e reordena as restantes
 */
followupRouter.delete('/steps/:id', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const stepId = req.params.id;

  const initialCount = db.data.followUpSteps.length;
  db.data.followUpSteps = db.data.followUpSteps.filter((s) => !(s.id === stepId && s.organizationId === orgId));

  if (db.data.followUpSteps.length === initialCount) {
    return res.status(404).json({ error: 'Etapa não encontrada' });
  }

  // Reordena
  const remaining = db.data.followUpSteps
    .filter((s) => s.organizationId === orgId)
    .sort((a, b) => a.order - b.order);

  remaining.forEach((s, idx) => {
    s.order = idx + 1;
  });

  db.addLog(orgId, 'info', 'followup', `Etapa ${stepId} removida com sucesso.`);
  db.save();

  return res.json({ success: true, remainingCount: remaining.length });
});

/**
 * Força a execução imediata de um ciclo de follow-up (para testes rápidos)
 */
followupRouter.post('/test-cycle', async (_req: AuthenticatedRequest, res: Response) => {
  const result = await processFollowUpQueue();
  return res.json({ success: true, ...result });
});
