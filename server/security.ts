import crypto from 'node:crypto';

// Chave mestre de criptografia (default seguro caso não haja no .env)
const MASTER_KEY_RAW = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const MASTER_KEY = crypto.createHash('sha256').update(MASTER_KEY_RAW).digest();

/**
 * Hash de senha seguro usando Scrypt com salt aleatório
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verificação de senha
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  } catch {
    return false;
  }
}

/**
 * Criptografia AES-256-GCM para segredos em repouso
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decriptografia AES-256-GCM
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  try {
    const [ivHex, tagHex, contentHex] = encryptedPayload.split(':');
    if (!ivHex || !tagHex || !contentHex) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

/**
 * Gera um token aleatório criptograficamente seguro
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Normaliza número de telefone (apenas dígitos, garantindo formato DDI + DDD + número)
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Se tiver 10 ou 11 dígitos (ex: 11999998888 ou 1188887777), adiciona DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Normaliza texto para correspondência de gatilhos (sem acentos, minúsculas, trim, espaços condensados)
 */
export function normalizeTextMatch(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica correspondência de palavra-chave estrita contra aliases
 */
export function isKeywordMatch(incomingMessage: string, targetKeyword: string, aliases: string[] = []): boolean {
  const normInput = normalizeTextMatch(incomingMessage);
  const targets = [targetKeyword, ...aliases].map(normalizeTextMatch).filter(Boolean);
  
  // Regra de segurança da especificação: não considerar "não comprei" como compra!
  if (normInput.includes('nao') || normInput.includes('não')) {
    // Se o target for "comprei", mas a mensagem diz "não comprei", deve ser falso
    if (targets.some(t => t.includes('comprei') && !t.includes('nao'))) {
      return false;
    }
  }

  return targets.some(target => normInput === target || normInput.startsWith(`${target} `) || normInput.endsWith(` ${target}`));
}
