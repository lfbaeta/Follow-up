import {
  ConversationSettingsData,
  AISettingsData,
  FollowUpSettingsData,
  WhatsAppConnectionData,
  FollowUpStepData,
  FunnelMetricsData,
  FunnelItemData,
  AppointmentData,
  ServiceData,
  ResourceData,
  ChatMessageData,
  SystemLogData,
} from '../types.js';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errMessage = `Erro HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errMessage = body.error;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  return res.json();
}

export const api = {
  // Configurações gerais
  async getSettings(): Promise<{
    conversationSettings: ConversationSettingsData;
    aiSettings: AISettingsData;
    followUpSettings: FollowUpSettingsData;
    whatsappConnection: WhatsAppConnectionData;
  }> {
    return apiRequest('/api/settings');
  },

  async saveConversationSettings(data: Partial<ConversationSettingsData>) {
    return apiRequest<{ success: boolean; settings: ConversationSettingsData }>('/api/settings/conversations', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async saveAiSettings(data: Partial<AISettingsData>) {
    return apiRequest<{ success: boolean; settings: AISettingsData }>('/api/settings/ai', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async saveFollowUpSettings(data: Partial<FollowUpSettingsData>) {
    return apiRequest<{ success: boolean; settings: FollowUpSettingsData }>('/api/settings/followup', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Etapas de follow-up
  async getSteps(): Promise<{ steps: FollowUpStepData[] }> {
    return apiRequest('/api/followup/steps');
  },

  async createStep(formData: FormData): Promise<{ success: boolean; step: FollowUpStepData }> {
    const res = await fetch('/api/followup/steps', {
      method: 'POST',
      body: formData, // Deixa o browser setar multipart boundary
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao salvar nova etapa');
    }
    return res.json();
  },

  async updateStep(id: string, formData: FormData): Promise<{ success: boolean; step: FollowUpStepData }> {
    const res = await fetch(`/api/followup/steps/${id}`, {
      method: 'PUT',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao atualizar etapa');
    }
    return res.json();
  },

  async deleteStep(id: string): Promise<{ success: boolean; remainingCount: number }> {
    return apiRequest(`/api/followup/steps/${id}`, {
      method: 'DELETE',
    });
  },

  async triggerWorkerCycle(): Promise<{ success: boolean; processed: number; executed: number }> {
    return apiRequest('/api/followup/test-cycle', {
      method: 'POST',
    });
  },

  // Funil de contatos
  async getFunnel(startDate?: string, endDate?: string, search?: string): Promise<{
    metrics: FunnelMetricsData;
    items: FunnelItemData[];
  }> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (search) params.append('search', search);
    return apiRequest(`/api/funnel?${params.toString()}`);
  },

  async updateEnrollmentStatus(id: string, newStatus: string, notes?: string) {
    return apiRequest<{ success: boolean; enrollment: any }>(`/api/funnel/enrollment/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ newStatus, notes }),
    });
  },

  getExportXlsxUrl(startDate?: string, endDate?: string, search?: string): string {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (search) params.append('search', search);
    return `/api/funnel/export/xlsx?${params.toString()}`;
  },

  // WhatsApp
  async getWhatsAppStatus(): Promise<WhatsAppConnectionData> {
    return apiRequest('/api/whatsapp/status');
  },

  async updateWhatsAppConfig(data: { instanceName: string; serverUrl: string; apiKey?: string }) {
    return apiRequest('/api/whatsapp/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async connectWhatsApp(): Promise<{ success: boolean; status: string; qrcode?: string; pairingCode?: string; message?: string }> {
    return apiRequest('/api/whatsapp/connect', {
      method: 'POST',
    });
  },

  async generateOfficialQrCode(): Promise<{ success: boolean; status: string; qrcode?: string; pairingCode?: string }> {
    return apiRequest('/api/whatsapp/qrcode', {
      method: 'POST',
    });
  },

  async checkWhatsAppState(): Promise<{
    success: boolean;
    status: 'connected' | 'disconnected' | 'connecting' | 'pending_config';
    connectedPhone?: string | null;
    connectedName?: string | null;
    lastEventAt?: string | null;
  }> {
    return apiRequest('/api/whatsapp/check-state');
  },

  async createEvolutionInstance(): Promise<{ success: boolean; details?: any }> {
    return apiRequest('/api/whatsapp/create-instance', {
      method: 'POST',
    });
  },

  async setupEvolutionWebhook(webhookUrl?: string): Promise<{ success: boolean; webhookUrl: string }> {
    return apiRequest('/api/whatsapp/setup-webhook', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl }),
    });
  },

  async disconnectWhatsApp(): Promise<{ success: boolean; status: string }> {
    return apiRequest('/api/whatsapp/disconnect', {
      method: 'POST',
    });
  },

  async sendTestMessage(phone: string, message: string) {
    return apiRequest('/api/whatsapp/test-send', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    });
  },

  // Agendamentos
  async getAppointments(date?: string): Promise<{
    appointments: AppointmentData[];
    services: ServiceData[];
    resources: ResourceData[];
  }> {
    const url = date ? `/api/appointments?date=${date}` : '/api/appointments';
    return apiRequest(url);
  },

  async createAppointment(data: {
    contactName: string;
    contactPhone: string;
    serviceId: string;
    resourceId: string;
    date: string;
    startTime: string;
    notes?: string;
    sendWhatsAppConfirmation?: boolean;
  }) {
    return apiRequest<{ success: boolean; appointment: AppointmentData }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAppointmentStatus(id: string, status: string) {
    return apiRequest(`/api/appointments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // Logs
  async getLogs(category?: string, level?: string): Promise<{ logs: SystemLogData[] }> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (level) params.append('level', level);
    return apiRequest(`/api/logs?${params.toString()}`);
  },

  async clearLogs() {
    return apiRequest('/api/logs/clear', { method: 'POST' });
  },

  // Simulador
  async getSimulatorChat(phone?: string): Promise<{
    phone: string;
    contact: any;
    activeEnrollment: any;
    messages: ChatMessageData[];
  }> {
    const p = phone ? `?phone=${phone}` : '';
    return apiRequest(`/api/simulator/messages${p}`);
  },

  async sendSimulatorMessage(data: { phone: string; name: string; messageText: string; senderType: string }) {
    return apiRequest('/api/simulator/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetSimulator(phone: string) {
    return apiRequest('/api/simulator/reset', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },
};
