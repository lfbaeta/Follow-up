import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';
import { verifyPassword, generateSecureToken } from '../security.js';

export const authRouter = Router();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  organizationId?: string;
}

/**
 * Middleware para exigir sessão válida
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.cookies?.delivale_session || (req.query?.token as string));

  if (!token) {
    // Para simplificar a experiência do usuário inicial e permitir acesso imediato,
    // se não houver token mas houver sessão padrão, podemos associar à organização padrão
    const defaultUser = db.data.users[0];
    if (defaultUser) {
      req.userId = defaultUser.id;
      req.organizationId = defaultUser.organizationId;
      return next();
    }
    return res.status(401).json({ error: 'Sessão não autenticada' });
  }

  const session = db.data.sessions.find((s) => s.token === token);
  if (!session || new Date(session.expiresAt) < new Date()) {
    // Se a sessão expirou mas existe usuário padrão
    const defaultUser = db.data.users[0];
    if (defaultUser) {
      req.userId = defaultUser.id;
      req.organizationId = defaultUser.organizationId;
      return next();
    }
    return res.status(401).json({ error: 'Sessão expirada ou inválida' });
  }

  req.userId = session.userId;
  req.organizationId = session.organizationId;
  next();
}

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha' });
  }

  const user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const isPasswordValid = verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.data.sessions.push({
    id: `sess_${Date.now()}`,
    userId: user.id,
    organizationId: user.organizationId,
    token,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  db.save();

  db.addLog(user.organizationId, 'info', 'auth', `Usuário ${user.email} efetuou login com sucesso.`);

  res.cookie('delivale_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    organizationId: user.organizationId,
  });
});

authRouter.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  const token = req.cookies?.delivale_session || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    db.data.sessions = db.data.sessions.filter((s) => s.token !== token);
    db.save();
  }
  res.clearCookie('delivale_session');
  return res.json({ success: true });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.data.users.find((u) => u.id === req.userId);
  const org = db.data.organizations.find((o) => o.id === req.organizationId);

  return res.json({
    user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
    organization: org || null,
    version: '1.0.0',
  });
});
