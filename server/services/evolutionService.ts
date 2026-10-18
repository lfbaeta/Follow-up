import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';
import { decryptSecret } from '../security.js';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

import QRCode from 'qrcode';

export class EvolutionService {
  /**
   * Obtém a chave de API decriptografada da conexão
   */
  private static getApiKey(organizationId: string): string {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    if (!conn) return '';
    if (conn.apiKeyEncrypted) {
      return decryptSecret(conn.apiKeyEncrypted);
    }
    return process.env.EVOLUTION_API_KEY || '';
  }

  /**
   * Cria ou inicializa oficialmente a instância na Evolution API
   */
  static async createInstance(organizationId: string): Promise<{ success: boolean; details?: any; error?: string }> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    if (!conn || !conn.serverUrl || !conn.instanceName) {
      return { success: false, error: 'URL do servidor ou nome da instância não configurados' };
    }

    const apiKey = this.getApiKey(organizationId);
    const cleanUrl = conn.serverUrl.replace(/\/+$/, '');

    try {
      const res = await fetch(`${cleanUrl}/instance/create`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: conn.instanceName,
          token: apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      const data: any = await res.json().catch(() => ({}));
      db.addLog(organizationId, 'info', 'whatsapp', `Tentativa de criação de instância '${conn.instanceName}' na Evolution API`, { status: res.status });
      return { success: res.ok || data?.instance?.instanceName, details: data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao criar instância na Evolution API' };
    }
  }

  /**
   * Testa a conexão com a Evolution API
   */
  static async testConnection(organizationId: string): Promise<{ success: boolean; status: string; details?: any }> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    if (!conn || !conn.serverUrl || !conn.instanceName) {
      return { success: false, status: 'pending_config', details: 'URL ou nome da instância não configurados' };
    }

    const apiKey = this.getApiKey(organizationId);
    const cleanUrl = conn.serverUrl.replace(/\/+$/, '');

    try {
      // Endpoint padrão da Evolution API para verificar estado da conexão
      const res = await fetch(`${cleanUrl}/instance/connectionState/${conn.instanceName}`, {
        method: 'GET',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, status: 'error', details: `Erro HTTP ${res.status}: ${errorText}` };
      }

      const data: any = await res.json();
      const state = data?.instance?.state || data?.state || 'disconnected';
      const isConnected = state === 'open' || state === 'connected';

      conn.status = isConnected ? 'connected' : 'disconnected';
      if (isConnected) {
        conn.qrCode = null;
        if (data?.instance?.ownerJid) {
          conn.connectedPhone = data.instance.ownerJid.replace('@s.whatsapp.net', '');
        }
        if (data?.instance?.profileName) {
          conn.connectedName = data.instance.profileName;
        }
      }
      conn.lastEventAt = new Date().toISOString();
      conn.updatedAt = new Date().toISOString();
      db.save();

      return {
        success: isConnected,
        status: isConnected ? 'connected' : 'disconnected',
        details: data,
      };
    } catch (err: any) {
      return { success: false, status: 'disconnected', details: err?.message || 'Falha de rede ao conectar à Evolution API' };
    }
  }

  /**
   * Solicita o QR Code oficial para pareamento na Evolution API
   */
  static async fetchQrCode(organizationId: string): Promise<{
    success: boolean;
    qrcode?: string;
    pairingCode?: string;
    status?: string;
    error?: string;
  }> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    if (!conn) {
      return { success: false, error: 'Conexão não encontrada' };
    }

    // Se não houver servidor configurado, gera QR Code demonstrativo para testes imediatos
    if (!conn.serverUrl || !conn.instanceName) {
      const demoPayload = `DELIVALE-WHATSAPP-DEMO:${conn.instanceName}:${Date.now()}`;
      const demoQrDataUrl = await QRCode.toDataURL(demoPayload, {
        width: 320,
        margin: 2,
        color: { dark: '#0C2A4A', light: '#FFFFFF' },
      });

      conn.qrCode = demoQrDataUrl;
      conn.status = 'connecting';
      conn.updatedAt = new Date().toISOString();
      db.save();

      return {
        success: true,
        qrcode: demoQrDataUrl,
        status: 'connecting',
      };
    }

    const apiKey = this.getApiKey(organizationId);
    const cleanUrl = conn.serverUrl.replace(/\/+$/, '');

    try {
      // 1. Tenta conectar na instância existente
      let res = await fetch(`${cleanUrl}/instance/connect/${conn.instanceName}`, {
        method: 'GET',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
      });

      // Se a instância ainda não existe (404), tenta criá-la primeiro
      if (res.status === 404) {
        await this.createInstance(organizationId);
        // Tenta conectar novamente
        res = await fetch(`${cleanUrl}/instance/connect/${conn.instanceName}`, {
          method: 'GET',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Erro na Evolution API (${res.status}): ${errText}` };
      }

      const data: any = await res.json();

      // Extrai base64 ou code da resposta
      let qrcodeRaw =
        data?.base64 ||
        data?.qrcode?.base64 ||
        data?.qrcode ||
        data?.code ||
        data?.qrcode?.code;

      const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode;

      if (qrcodeRaw && typeof qrcodeRaw === 'string') {
        let finalQrDataUrl = qrcodeRaw;

        // Se for string de código puro do WhatsApp (ex: "2@abc..."), converte para imagem QR Code
        if (!qrcodeRaw.startsWith('data:image') && !qrcodeRaw.startsWith('iVBORw0KGgo')) {
          try {
            finalQrDataUrl = await QRCode.toDataURL(qrcodeRaw, {
              width: 320,
              margin: 2,
              color: { dark: '#0C2A4A', light: '#FFFFFF' },
            });
          } catch (qrErr) {
            console.warn('[Evolution] Erro ao converter code em QR data URL:', qrErr);
          }
        } else if (qrcodeRaw.startsWith('iVBORw0KGgo')) {
          finalQrDataUrl = `data:image/png;base64,${qrcodeRaw}`;
        }

        conn.qrCode = finalQrDataUrl;
        conn.status = 'connecting';
        conn.lastEventAt = new Date().toISOString();
        conn.updatedAt = new Date().toISOString();
        db.save();

        db.addLog(organizationId, 'info', 'whatsapp', `QR Code oficial obtido com sucesso para a instância '${conn.instanceName}'`);

        return {
          success: true,
          qrcode: finalQrDataUrl,
          pairingCode,
          status: 'connecting',
        };
      }

      // Se a resposta indicar que já está conectado
      if (data?.instance?.state === 'open' || data?.state === 'open') {
        conn.status = 'connected';
        conn.qrCode = null;
        conn.updatedAt = new Date().toISOString();
        db.save();
        return { success: true, status: 'connected' };
      }

      return {
        success: false,
        error: 'A Evolution API não retornou o QR Code. Verifique se a instância já está conectada ou tente reiniciar.',
      };
    } catch (err: any) {
      db.addLog(organizationId, 'error', 'whatsapp', `Falha ao requisitar QR Code da Evolution API: ${err?.message}`);
      return { success: false, error: err?.message || 'Erro de rede ao comunicar com a Evolution API' };
    }
  }

  /**
   * Configura automaticamente o webhook da aplicação na Evolution API
   */
  static async configureWebhook(organizationId: string, webhookUrl: string): Promise<{ success: boolean; details?: any; error?: string }> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    if (!conn || !conn.serverUrl || !conn.instanceName) {
      return { success: false, error: 'URL do servidor ou instância não configurados' };
    }

    const apiKey = this.getApiKey(organizationId);
    const cleanUrl = conn.serverUrl.replace(/\/+$/, '');

    try {
      const res = await fetch(`${cleanUrl}/webhook/set/${conn.instanceName}`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: [
              'MESSAGES_UPSERT',
              'CONNECTION_UPDATE',
              'QRCODE_UPDATED',
            ],
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      db.addLog(organizationId, 'info', 'whatsapp', `Webhook configurado na Evolution API para '${webhookUrl}'`);
      return { success: res.ok, details: data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao configurar webhook na Evolution API' };
    }
  }

  /**
   * Desconecta a instância no WhatsApp
   */
  static async disconnect(organizationId: string): Promise<boolean> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    if (!conn) return false;

    const apiKey = this.getApiKey(organizationId);
    if (conn.serverUrl && conn.instanceName && apiKey) {
      const cleanUrl = conn.serverUrl.replace(/\/+$/, '');
      try {
        await fetch(`${cleanUrl}/instance/logout/${conn.instanceName}`, {
          method: 'DELETE',
          headers: { apikey: apiKey },
        });
      } catch (err) {
        console.warn('[Evolution] Falha ao chamar logout na API externa:', err);
      }
    }

    conn.status = 'disconnected';
    conn.qrCode = null;
    conn.connectedPhone = null;
    conn.connectedName = null;
    conn.updatedAt = new Date().toISOString();
    db.save();
    return true;
  }

  /**
   * Envia mensagem de texto para um número
   */
  static async sendTextMessage(organizationId: string, phone: string, text: string): Promise<SendMessageResult> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    const cleanPhone = phone.replace(/\D/g, '');

    // Registra a mensagem na lista de conversas interna
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const contact = db.data.contacts.find((c) => c.organizationId === organizationId && c.normalizedPhone === cleanPhone);

    db.data.chatMessages.push({
      id: msgId,
      organizationId,
      contactId: contact?.id || 'unknown',
      phone: cleanPhone,
      sender: 'bot',
      content: text,
      timestamp: new Date().toISOString(),
      delivered: true,
    });
    db.save();

    // Se houver conexão real com Evolution API e estiver conectada, despacha para a API
    if (conn && conn.serverUrl && conn.instanceName && conn.status === 'connected') {
      const apiKey = this.getApiKey(organizationId);
      const cleanUrl = conn.serverUrl.replace(/\/+$/, '');

      try {
        const res = await fetch(`${cleanUrl}/message/sendText/${conn.instanceName}`, {
          method: 'POST',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: cleanPhone,
            text,
            delay: 1200,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          db.addLog(organizationId, 'warn', 'whatsapp', `Falha no envio WhatsApp real para ${cleanPhone}: ${errBody}`);
          return { success: false, messageId: msgId, error: errBody };
        }

        const data: any = await res.json();
        db.addLog(organizationId, 'info', 'whatsapp', `Mensagem WhatsApp enviada com sucesso para ${cleanPhone}`, { text: text.substring(0, 50) });
        return { success: true, messageId: data?.key?.id || msgId };
      } catch (err: any) {
        db.addLog(organizationId, 'error', 'whatsapp', `Erro de rede no envio WhatsApp para ${cleanPhone}: ${err?.message}`);
        return { success: false, error: err?.message };
      }
    }

    // Modo simulado / ambiente de desenvolvimento
    db.addLog(organizationId, 'info', 'whatsapp', `[Simulador/Dev] Mensagem gravada para ${cleanPhone}`, { text: text.substring(0, 60) });
    return { success: true, messageId: msgId };
  }

  /**
   * Envia mensagem com mídia (imagem ou documento)
   */
  static async sendMediaMessage(
    organizationId: string,
    phone: string,
    caption: string,
    mediaRelativeUrl: string,
    originalFilename?: string,
    mimeType?: string
  ): Promise<SendMessageResult> {
    const conn = db.data.whatsappConnections.find((c) => c.organizationId === organizationId);
    const cleanPhone = phone.replace(/\D/g, '');
    const msgId = `msg_media_${Date.now()}`;

    // Registra chat message
    db.data.chatMessages.push({
      id: msgId,
      organizationId,
      contactId: 'unknown',
      phone: cleanPhone,
      sender: 'bot',
      content: caption || `[Arquivo anexado: ${originalFilename || 'Mídia'}]`,
      mediaUrl: mediaRelativeUrl,
      timestamp: new Date().toISOString(),
      delivered: true,
    });
    db.save();

    if (conn && conn.serverUrl && conn.instanceName && conn.status === 'connected') {
      const apiKey = this.getApiKey(organizationId);
      const cleanUrl = conn.serverUrl.replace(/\/+$/, '');

      try {
        const filePath = path.resolve(process.cwd(), mediaRelativeUrl.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) {
          return { success: false, error: 'Arquivo de mídia não encontrado no disco local' };
        }

        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');
        const mediaKind = mimeType?.startsWith('image/') ? 'image' : 'document';

        const res = await fetch(`${cleanUrl}/message/sendMedia/${conn.instanceName}`, {
          method: 'POST',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: cleanPhone,
            mediatype: mediaKind,
            mimetype: mimeType || 'application/octet-stream',
            caption: caption || '',
            media: `data:${mimeType || 'application/octet-stream'};base64,${base64Data}`,
            fileName: originalFilename || 'anexo',
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return { success: false, error: err };
        }

        return { success: true, messageId: msgId };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    }

    return { success: true, messageId: msgId };
  }
}
