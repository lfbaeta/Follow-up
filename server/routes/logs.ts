import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';

export const logsRouter = Router();

logsRouter.use(requireAuth);

logsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const { category, level, limit = 100 } = req.query as {
    category?: string;
    level?: string;
    limit?: string;
  };

  let logs = db.data.logs.filter((l) => l.organizationId === orgId);

  if (category) {
    logs = logs.filter((l) => l.category === category);
  }
  if (level) {
    logs = logs.filter((l) => l.level === level);
  }

  const numLimit = Math.min(500, Math.max(10, parseInt(limit as string, 10) || 100));
  return res.json({ logs: logs.slice(0, numLimit) });
});

logsRouter.post('/clear', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  db.data.logs = db.data.logs.filter((l) => l.organizationId !== orgId);
  db.save();
  return res.json({ success: true });
});
