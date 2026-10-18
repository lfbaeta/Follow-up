export type ViewTab =
  | 'home'
  | 'followup'
  | 'funnel'
  | 'appointments'
  | 'whatsapp'
  | 'ai'
  | 'logs'
  | 'simulator';

export interface WhatsAppConnectionData {
  status: 'connected' | 'disconnected' | 'pending_config' | 'connecting';
  instanceName: string;
  serverUrl: string;
  hasApiKey: boolean;
  connectedPhone?: string | null;
  connectedName?: string | null;
  lastEventAt?: string | null;
  lastError?: string | null;
  qrCode?: string | null;
}

export interface ConversationSettingsData {
  id: string;
  organizationId: string;
  aiModelProvider: 'gemini' | 'openai';
  aiModelName: string;
  unknownTypeMessage: string;
  operatorReactivationHours: number;
  messageBatchingSeconds: number;
  schedulingEnabled: boolean;
  followUpEnabled: boolean;
  aiResponseEnabled: boolean;
  allowedNumbers: string[];
  blockedNumbers: string[];
  updatedAt: string;
}

export interface AISettingsData {
  id: string;
  organizationId: string;
  geminiModel: string;
  openaiModel: string;
  systemPrompt: string;
  businessKnowledge: string;
  temperature: number;
  maxTokens: number;
  hasGeminiApiKey?: boolean;
}

export interface FollowUpSettingsData {
  id: string;
  organizationId: string;
  mode: 'fixed' | 'ai';
  inactivityMinutes: number;
  conversionTriggerActive: boolean;
  conversionKeyword: string;
  conversionAliases: string[];
  optOutActive: boolean;
  optOutKeyword: string;
  optOutFooter: string;
  optOutAliases: string[];
  sequenceCooldownHours: number;
  updatedAt: string;
}

export interface FollowUpStepData {
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

export interface FunnelItemData {
  id: string;
  contactId: string;
  name: string;
  phone: string;
  step: string;
  stepOrder: number;
  nextSend: string;
  dueAt: string;
  enteredAt: string;
  completedAt?: string | null;
  status: 'in_funnel' | 'converted' | 'opt_out' | 'finished_no_action' | 'paused' | 'error';
  statusDisplay: string;
  exitReason?: string | null;
  historyCount: number;
}

export interface FunnelMetricsData {
  totalInFunnel: number;
  totalCount: number;
  converted: {
    count: number;
    percentage: string;
  };
  optOut: {
    count: number;
    percentage: string;
  };
  finishedNoAction: {
    count: number;
    percentage: string;
  };
}

export interface AppointmentData {
  id: string;
  organizationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  serviceId: string;
  serviceName: string;
  resourceId: string;
  resourceName: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  confirmationSent: boolean;
  createdAt: string;
}

export interface ServiceData {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
}

export interface ResourceData {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export interface ChatMessageData {
  id: string;
  phone: string;
  sender: 'contact' | 'bot' | 'human_operator';
  content: string;
  mediaUrl?: string | null;
  timestamp: string;
  delivered: boolean;
}

export interface SystemLogData {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  details?: any;
}
