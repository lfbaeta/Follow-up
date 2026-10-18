import { GoogleGenAI } from '@google/genai';
import { db } from '../db/database.js';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

/**
 * Gera resposta de atendimento ao cliente via IA
 */
export async function generateAIChatResponse(
  organizationId: string,
  userMessage: string,
  contactName: string,
  recentHistory: { sender: string; content: string }[] = []
): Promise<string> {
  const aiSettings = db.data.aiSettings.find((s) => s.organizationId === organizationId);
  const client = getGeminiClient();

  if (!client) {
    return 'Olá! Agradecemos sua mensagem. No momento nosso canal automatizado está em manutenção. Um atendente humano responderá em breve.';
  }

  const modelName = aiSettings?.geminiModel || 'gemini-3.8-flash';
  const systemInstruction = `
${aiSettings?.systemPrompt || 'Você é o assistente virtual da Delivale.'}

INFORMAÇÕES OFICIAIS DO NEGÓCIO:
${aiSettings?.businessKnowledge || 'Atendimento odontológico de excelência.'}

DIRETRIZES DE ATENDIMENTO:
- Responda em português (pt-BR) de forma educada, prestativa e concisa.
- O nome do cliente é: ${contactName || 'Cliente'}.
- Se o cliente perguntar sobre agendamento, informe que temos opções disponíveis e pergunte qual o melhor dia ou horário.
- Não invente preços, promoções ou procedimentos que não estejam nas informações oficiais.
- Não gere respostas longas e prolixas; mantenha estilo natural de mensagens de WhatsApp.
`.trim();

  try {
    const formattedHistory = recentHistory.map((h) => `${h.sender === 'contact' ? 'Cliente' : 'Atendente'}: ${h.content}`).join('\n');
    const prompt = `
HISTÓRICO RECENTE DA CONVERSA:
${formattedHistory}

ÚLTIMA MENSAGEM DO CLIENTE:
"${userMessage}"

Por favor, responda diretamente ao cliente com a melhor mensagem:
`.trim();

    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: aiSettings?.temperature ?? 0.7,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      throw new Error('Resposta vazia da IA');
    }
    return reply;
  } catch (error: any) {
    db.addLog(organizationId, 'error', 'ai', `Erro ao gerar resposta com Gemini: ${error?.message || error}`);
    return 'Olá! Recebi sua mensagem e já estou verificando com nossa equipe. Em instantes te dou um retorno completo!';
  }
}

/**
 * Gera variação dinâmica e personalizada de follow-up (Modo "Com IA")
 * Preserva estritamente a oferta original (cupom, condições), variando o tom e a abordagem com base no histórico.
 */
export async function generateAIFollowUpMessage(
  organizationId: string,
  baseMessageContent: string,
  contactName: string,
  recentHistory: { sender: string; content: string }[] = []
): Promise<string> {
  const client = getGeminiClient();
  const aiSettings = db.data.aiSettings.find((s) => s.organizationId === organizationId);

  // Se Gemini não estiver disponível, faz fallback seguro ao texto fixo
  if (!client) {
    return baseMessageContent.replace(/{nome}/gi, contactName || 'amigo(a)');
  }

  const modelName = aiSettings?.geminiModel || 'gemini-3.8-flash';
  const historyText = recentHistory.length
    ? recentHistory.map((h) => `${h.sender === 'contact' ? 'Cliente' : 'Atendente'}: ${h.content}`).join('\n')
    : 'Nenhum histórico anterior registrado.';

  const prompt = `
Você é o assistente da Delivale encarregado de enviar uma mensagem de follow-up amigável no WhatsApp.
O cliente se chama: ${contactName || 'amigo(a)'}.

MENSAGEM BASE ORIGINAL / OFERTA DETERMINADA:
"${baseMessageContent}"

HISTÓRICO DE CONVERSAS ANTERIORES:
${historyText}

REGRAS ESTRITAS DE COMPORTAMENTO:
1. Preserve 100% dos dados comerciais da mensagem base: qualquer menção a cupom, código promocional, desconto, validade ou benefício DEVE permanecer inalterada.
2. Reescreva a introdução e o tom de forma calorosa, simpática e inédita (ex: "Ei ${contactName || ''}, passei aqui rapidinho...", "Olha só, lembrei de você hoje..."), para que soe como um contato humano natural.
3. Não use linguagem robótica. Seja curto, direto e atrativo para WhatsApp (no máximo 3 a 4 frases).
4. Retorne APENAS a mensagem final, sem aspas e sem explicações antes ou depois.
`.trim();

  try {
    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });

    const generated = response.text?.trim();
    if (!generated || generated.length < 10) {
      return baseMessageContent.replace(/{nome}/gi, contactName || 'amigo(a)');
    }
    return generated;
  } catch (err: any) {
    db.addLog(organizationId, 'warn', 'ai', `Fallback para mensagem fixa após falha no Gemini Follow-up: ${err?.message}`);
    return baseMessageContent.replace(/{nome}/gi, contactName || 'amigo(a)');
  }
}
