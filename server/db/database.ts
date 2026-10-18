import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  Organization,
  User,
  Session,
  WhatsAppConnection,
  ConversationSettings,
  AIProviderSettings,
  FollowUpSettings,
  FollowUpStep,
  Contact,
  Enrollment,
  OutboundMessage,
  ChatMessage,
  Appointment,
  AppointmentService,
  AppointmentResource,
  SystemLog
} from '../types.js';
import { hashPassword } from '../security.js';

interface DatabaseSchema {
  organizations: Organization[];
  users: User[];
  sessions: Session[];
  whatsappConnections: WhatsAppConnection[];
  conversationSettings: ConversationSettings[];
  aiSettings: AIProviderSettings[];
  followUpSettings: FollowUpSettings[];
  followUpSteps: FollowUpStep[];
  contacts: Contact[];
  enrollments: Enrollment[];
  outboundMessages: OutboundMessage[];
  chatMessages: ChatMessage[];
  appointments: Appointment[];
  services: AppointmentService[];
  resources: AppointmentResource[];
  logs: SystemLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'delivale_db.json');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Assegura diretórios persistentes
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

class DatabaseManager {
  private memoryData: DatabaseSchema;
  private pgPool: pg.Pool | null = null;
  private isPgAvailable = false;
  private writeLock = false;

  constructor() {
    this.memoryData = this.loadInitialData();
    this.initPostgresIfAvailable();
  }

  private loadInitialData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('[DB] Erro ao ler arquivo de dados local, recriando seed:', err);
      }
    }
    const defaultData = this.createDefaultSeed();
    this.persistToDisk(defaultData);
    return defaultData;
  }

  private persistToDisk(data: DatabaseSchema) {
    try {
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Falha ao persistir em disco:', err);
    }
  }

  private createDefaultSeed(): DatabaseSchema {
    const orgId = 'org_delivale_default';
    const now = new Date().toISOString();

    const org: Organization = {
      id: orgId,
      name: 'Delivale Odontologia e Saúde',
      slug: 'delivale',
      timezone: 'America/Sao_Paulo',
      createdAt: now,
      updatedAt: now,
    };

    const adminUser: User = {
      id: 'usr_admin_default',
      organizationId: orgId,
      name: 'Administrador Delivale',
      email: 'admin@delivale.com',
      passwordHash: hashPassword('Admin@Delivale2026!'),
      role: 'admin',
      createdAt: now,
    };

    const waConn: WhatsAppConnection = {
      id: 'waconn_default',
      organizationId: orgId,
      name: 'WhatsApp Principal Delivale',
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'delivale_bot',
      serverUrl: process.env.EVOLUTION_API_URL || '',
      status: 'disconnected',
      qrCode: null,
      connectedPhone: null,
      connectedName: null,
      lastEventAt: null,
      lastError: null,
      updatedAt: now,
    };

    const convSettings: ConversationSettings = {
      id: 'conv_settings_default',
      organizationId: orgId,
      aiModelProvider: 'gemini',
      aiModelName: 'gemini-3.8-flash',
      unknownTypeMessage: 'Desculpe, eu ainda não sou capaz de entender esse tipo de mensagem.',
      operatorReactivationHours: 24,
      messageBatchingSeconds: 4,
      schedulingEnabled: false,
      followUpEnabled: true,
      aiResponseEnabled: true,
      allowedNumbers: [],
      blockedNumbers: [],
      updatedAt: now,
    };

    const aiSettings: AIProviderSettings = {
      id: 'ai_settings_default',
      organizationId: orgId,
      geminiModel: 'gemini-3.8-flash',
      openaiModel: 'gpt-4o-mini',
      systemPrompt: 'Você é a assistente virtual inteligente da clínica Delivale. Seu objetivo é atender os pacientes com empatia, tirar dúvidas sobre serviços, convênios e incentivar agendamentos com nossos especialistas. Mantenha um tom profissional, amigável e direto.',
      businessKnowledge: 'Clínica Delivale:\nHorário: Segunda a Sexta 08:00 às 19:00, Sábados 08:00 às 13:00.\nEndereço: Av. Principal, 1200 - Centro.\nServiços: Clareamento dental a laser, implantes, limpeza profunda, ortodontia e estética dental.',
      temperature: 0.7,
      maxTokens: 500,
      updatedAt: now,
    };

    const followUpSettings: FollowUpSettings = {
      id: 'followup_settings_default',
      organizationId: orgId,
      mode: 'fixed',
      inactivityMinutes: 1, // 1 minuto para testes ágeis conforme vídeo
      conversionTriggerActive: true,
      conversionKeyword: 'JÁ COMPREI',
      conversionAliases: ['ja comprei', 'comprei', 'fechei negocio', 'ja paguei', 'agendei'],
      optOutActive: true,
      optOutKeyword: 'SAIR',
      optOutFooter: 'Se não quiser receber novas mensagens, responda SAIR.',
      optOutAliases: ['sair', 'pare', 'parar', 'cancelar', 'remover'],
      sequenceCooldownHours: 24,
      updatedAt: now,
    };

    const step1: FollowUpStep = {
      id: 'step_1',
      organizationId: orgId,
      order: 1,
      durationDays: 0,
      durationHours: 0,
      durationMinutes: 1,
      totalDurationMinutes: 1,
      messageContent: 'Olha só, esqueci de te avisar que estamos com uma promoção de clareamento dental! Vou te deixar um cupom de desconto válido pelos próximos 15 dias! Agende sua consulta o quanto antes e aproveite esse descontão: CUPOM 15%OFF',
      mediaUrl: null,
      mediaOriginalName: null,
      mediaMimeType: null,
      mediaType: 'none',
      createdAt: now,
      updatedAt: now,
    };

    const step2: FollowUpStep = {
      id: 'step_2',
      organizationId: orgId,
      order: 2,
      durationDays: 0,
      durationHours: 0,
      durationMinutes: 2,
      totalDurationMinutes: 2,
      messageContent: 'Olá, não esqueça de agendar a sua consulta com o preço promocional antes que ele acabe!',
      mediaUrl: null,
      mediaOriginalName: null,
      mediaMimeType: null,
      mediaType: 'none',
      createdAt: now,
      updatedAt: now,
    };

    const services: AppointmentService[] = [
      {
        id: 'srv_1',
        organizationId: orgId,
        name: 'Clareamento Dental',
        durationMinutes: 60,
        price: 450,
        description: 'Tratamento estético profissional para branqueamento seguro dos dentes.',
      },
      {
        id: 'srv_2',
        organizationId: orgId,
        name: 'Limpeza e Profilaxia',
        durationMinutes: 45,
        price: 180,
        description: 'Remoção de tártaro, placa bacteriana e aplicação de flúor protetor.',
      },
      {
        id: 'srv_3',
        organizationId: orgId,
        name: 'Consulta de Avaliação Geral',
        durationMinutes: 30,
        price: 0,
        description: 'Diagnóstico completo com câmera intraoral e plano de tratamento.',
      },
    ];

    const resources: AppointmentResource[] = [
      {
        id: 'res_1',
        organizationId: orgId,
        name: 'Dra. Mariana Silva',
        role: 'Odontologia Estética & Reabilitação',
        active: true,
      },
      {
        id: 'res_2',
        organizationId: orgId,
        name: 'Dr. Lucas Alberto',
        role: 'Clínico Geral & Cirurgião',
        active: true,
      },
    ];

    return {
      organizations: [org],
      users: [adminUser],
      sessions: [],
      whatsappConnections: [waConn],
      conversationSettings: [convSettings],
      aiSettings: [aiSettings],
      followUpSettings: [followUpSettings],
      followUpSteps: [step1, step2],
      contacts: [],
      enrollments: [],
      outboundMessages: [],
      chatMessages: [],
      appointments: [],
      services,
      resources,
      logs: [
        {
          id: `log_init_${Date.now()}`,
          organizationId: orgId,
          timestamp: now,
          level: 'info',
          category: 'system',
          message: 'Sistema Delivale Follow-up inicializado com sucesso.',
          details: { version: '1.0.0', storage: 'persistent_data' },
        },
      ],
    };
  }

  private async initPostgresIfAvailable() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('[DB] DATABASE_URL não definida. Operando com armazenamento persistente em disco (./data).');
      return;
    }
    try {
      this.pgPool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
      const client = await this.pgPool.connect();
      client.release();
      this.isPgAvailable = true;
      console.log('[DB] Conectado com sucesso ao PostgreSQL.');
    } catch (err) {
      console.warn('[DB] PostgreSQL indisponível no momento. Mantendo armazenamento transacional em ./data/delivale_db.json.');
      this.isPgAvailable = false;
    }
  }

  // Acessores sincronizados / transacionais
  public get data(): DatabaseSchema {
    return this.memoryData;
  }

  public save() {
    this.persistToDisk(this.memoryData);
  }

  public addLog(organizationId: string, level: 'info' | 'warn' | 'error', category: SystemLog['category'], message: string, details?: Record<string, unknown>) {
    const log: SystemLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: details || null,
    };
    this.memoryData.logs.unshift(log);
    // Limite de 500 logs mais recentes
    if (this.memoryData.logs.length > 500) {
      this.memoryData.logs.pop();
    }
    this.save();
  }

  public isPostgresConnected(): boolean {
    return this.isPgAvailable;
  }
}

export const db = new DatabaseManager();
