export type AIProvider = 'gemini' | 'openai';

export type FollowUpMode = 'fixed' | 'ai';

export type EnrollmentStatus =
  | 'in_funnel'
  | 'converted'
  | 'opt_out'
  | 'finished_no_action'
  | 'paused'
  | 'error';

export type WhatsAppStatus =
  | 'connected'
  | 'disconnected'
  | 'pending_config'
  | 'connecting';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'operator';
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  organizationId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface WhatsAppConnection {
  id: string;
  organizationId: string;
  name: string;
  instanceName: string;
  serverUrl: string;
  apiKeyEncrypted?: string;
  status: WhatsAppStatus;
  qrCode?: string | null;
  connectedPhone?: string | null;
  connectedName?: string | null;
  lastEventAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
}

export interface ConversationSettings {
  id: string;
  organizationId: string;
  aiModelProvider: AIProvider;
  aiModelName: string;
  unknownTypeMessage: string;
  operatorReactivationHours: number; // default 24h
  messageBatchingSeconds: number; // default 4s
  schedulingEnabled: boolean;
  followUpEnabled: boolean;
  aiResponseEnabled: boolean;
  allowedNumbers: string[]; // Whitelist "Somente Responder"
  blockedNumbers: string[]; // Blacklist "Não Responder"
  updatedAt: string;
}

export interface AIProviderSettings {
  id: string;
  organizationId: string;
  geminiModel: string;
  openaiModel: string;
  systemPrompt: string;
  businessKnowledge: string;
  temperature: number;
  maxTokens: number;
  updatedAt: string;
}

export interface FollowUpSettings {
  id: string;
  organizationId: string;
  mode: FollowUpMode;
  inactivityMinutes: number; // default 60 (mínimo 1)
  conversionTriggerActive: boolean;
  conversionKeyword: string; // default "JÁ COMPREI"
  conversionAliases: string[];
  optOutActive: boolean;
  optOutKeyword: string; // default "SAIR"
  optOutFooter: string; // default "Se não quiser receber novas mensagens, responda SAIR."
  optOutAliases: string[];
  sequenceCooldownHours: number; // default 24h
  updatedAt: string;
}

export interface FollowUpStep {
  id: string;
  organizationId: string;
  order: number;
  durationDays: number;
  durationHours: number;
  durationMinutes: number;
  totalDurationMinutes: number;
  messageContent: string;
  mediaUrl?: string | null;
  mediaOriginalName?: string | null;
  mediaMimeType?: string | null;
  mediaType: 'document' | 'image' | 'none';
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  optOut: boolean;
  converted: boolean;
  humanPausedUntil?: string | null;
  lastRelevantInteractionAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  organizationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  stepIndex: number;
  currentStepId?: string | null;
  status: EnrollmentStatus;
  enteredAt: string;
  dueAt: string;
  completedAt?: string | null;
  lastMessageSentAt?: string | null;
  exitReason?: string | null;
  stepHistory: {
    stepIndex: number;
    stepId: string;
    sentAt: string;
    mode: FollowUpMode;
    textSent: string;
    mediaSent?: string | null;
  }[];
}

export interface OutboundMessage {
  id: string;
  organizationId: string;
  contactId: string;
  phone: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: 'document' | 'image' | 'none';
  status: 'pending' | 'sent' | 'failed' | 'uncertain';
  enrollmentId?: string;
  stepId?: string;
  scheduledFor: string;
  sentAt?: string | null;
  error?: string | null;
  providerMessageId?: string | null;
}

export interface ChatMessage {
  id: string;
  organizationId: string;
  contactId: string;
  phone: string;
  sender: 'contact' | 'bot' | 'human_operator';
  content: string;
  mediaUrl?: string | null;
  timestamp: string;
  delivered: boolean;
}

export interface AppointmentService {
  id: string;
  organizationId: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
}

export interface AppointmentResource {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  active: boolean;
}

export interface Appointment {
  id: string;
  organizationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  serviceId: string;
  serviceName: string;
  resourceId: string;
  resourceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  confirmationSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemLog {
  id: string;
  organizationId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: 'whatsapp' | 'followup' | 'ai' | 'auth' | 'system' | 'appointments';
  message: string;
  details?: Record<string, unknown> | null;
}
