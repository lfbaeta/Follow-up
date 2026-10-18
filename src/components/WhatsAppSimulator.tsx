import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { ChatMessageData } from '../types.js';
import { Send, CheckCheck, RotateCcw, Play, UserCheck, Bot, Smartphone, ArrowRight } from 'lucide-react';

interface WhatsAppSimulatorProps {
  onNotify: (toast: { type: 'success' | 'warning' | 'error'; title: string; message?: string }) => void;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({ onNotify }) => {
  const [phone, setPhone] = useState('5511999998888');
  const [name, setName] = useState('Lucas Alberto');
  const [inputText, setInputText] = useState('');
  const [senderType, setSenderType] = useState<'contact' | 'human_operator'>('contact');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [activeEnrollment, setActiveEnrollment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChat = async () => {
    try {
      const data = await api.getSimulatorChat(phone);
      setMessages(data.messages);
      setActiveEnrollment(data.activeEnrollment);
    } catch (err) {
      console.error('Falha ao carregar simulador:', err);
    }
  };

  useEffect(() => {
    loadChat();
    const interval = setInterval(loadChat, 3000);
    return () => clearInterval(interval);
  }, [phone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending) return;

    setIsSending(true);
    try {
      await api.sendSimulatorMessage({
        phone,
        name,
        messageText: text,
        senderType,
      });
      setInputText('');
      await loadChat();
      onNotify({
        type: 'success',
        title: 'Mensagem enviada no simulador',
        message: senderType === 'human_operator' ? 'Operador humano respondeu (IA e follow-up pausados por 24h).' : undefined,
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Erro ao enviar mensagem',
        message: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerFollowUp = async () => {
    try {
      const res = await api.triggerWorkerCycle();
      await loadChat();
      onNotify({
        type: 'success',
        title: 'Ciclo de follow-up executado',
        message: `${res.executed} etapa(s) disparada(s) com sucesso.`,
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Falha no disparo',
        message: err.message,
      });
    }
  };

  const handleReset = async () => {
    if (!confirm('Deseja limpar as mensagens e reiniciar o funil deste número?')) return;
    try {
      await api.resetSimulator(phone);
      await loadChat();
      onNotify({
        type: 'success',
        title: 'Simulador reiniciado',
        message: 'Histórico e funil resetados para novos testes.',
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Erro ao resetar',
        message: err.message,
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Controle à Esquerda */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#FF7A00]" />
              Dados do Teste
            </h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nome do Cliente:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Número de WhatsApp:</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Enviar como:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSenderType('contact')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      senderType === 'contact'
                        ? 'bg-[#0C2A4A] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    👤 Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setSenderType('human_operator')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      senderType === 'human_operator'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Simula intervenção manual do atendente (ativa pausa de 24h)"
                  >
                    👨‍💼 Operador
                  </button>
                </div>
              </div>
            </div>

            {/* Status do funil para este contato */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs">
              <span className="font-bold text-slate-600 block mb-1">Status no Funil:</span>
              {activeEnrollment ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>No Funil (Etapa {activeEnrollment.stepIndex + 1})</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Próximo disparo previsto para:{' '}
                    <strong>{new Date(activeEnrollment.dueAt).toLocaleTimeString('pt-BR')}</strong>
                  </p>
                </div>
              ) : (
                <p className="text-slate-400">Nenhuma esteira de follow-up ativa no momento.</p>
              )}
            </div>

            {/* Ações Rápidas */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                Atalhos Rápidos de Teste:
              </span>
              <button
                type="button"
                onClick={() => handleSendMessage('Olá! Gostaria de informações sobre clareamento dental')}
                className="w-full text-left text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>&quot;Olá, informações clareamento&quot;</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#FF7A00]" />
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('JÁ COMPREI')}
                className="w-full text-left text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center justify-between border border-emerald-200"
              >
                <span>&quot;JÁ COMPREI&quot; (Conversão)</span>
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('SAIR')}
                className="w-full text-left text-xs bg-red-50 hover:bg-red-100 text-red-800 p-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center justify-between border border-red-200"
              >
                <span>&quot;SAIR&quot; (Opt-out)</span>
                <ArrowRight className="w-3.5 h-3.5 text-red-600" />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleTriggerFollowUp}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Play className="w-3.5 h-3.5" />
                Disparar Follow-up Agora
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-1.5 px-3 text-xs font-semibold text-slate-600 hover:text-red-600 bg-white border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar Conversa
              </button>
            </div>
          </div>
        </div>

        {/* Janela de Chat Estilo WhatsApp Web (Fiel à janela do vídeo) */}
        <div className="lg:col-span-2 bg-[#EFEAE2] rounded-2xl border border-slate-300 shadow-md flex flex-col h-[620px] overflow-hidden">
          {/* Header do WhatsApp Web */}
          <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold leading-tight">{name}</h4>
                <span className="text-[11px] text-white/80 font-mono">{phone}</span>
              </div>
            </div>
            <div className="text-xs bg-white/10 px-2.5 py-1 rounded-md text-white/90 font-medium">
              WhatsApp Web Simulado
            </div>
          </div>

          {/* Área de Mensagens com fundo característico de chat */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div className="text-center my-2">
              <span className="bg-white/80 text-slate-500 text-[10px] px-3 py-1 rounded-full shadow-2xs font-semibold">
                AS MENSAGENS E AS LIGAÇÕES SÃO PROTEGIDAS COM A CRIPTOGRAFIA DE PONTA A PONTA.
              </span>
            </div>

            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Bot className="w-10 h-10 mb-2 text-slate-400" />
                <p>Nenhuma mensagem trocada ainda.</p>
                <p className="text-[11px] mt-1">Envie uma mensagem abaixo para iniciar a demonstração!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isFromContact = msg.sender === 'contact';
                const isBot = msg.sender === 'bot';
                const isHuman = msg.sender === 'human_operator';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isFromContact ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs shadow-xs relative leading-relaxed ${
                        isFromContact
                          ? 'bg-white text-slate-900 rounded-tl-xs'
                          : isHuman
                          ? 'bg-amber-100 text-amber-950 rounded-tr-xs border border-amber-200'
                          : 'bg-[#D9FDD3] text-slate-900 rounded-tr-xs'
                      }`}
                    >
                      {/* Remetente label */}
                      <span className="text-[10px] font-bold block mb-1 opacity-70">
                        {isFromContact ? name : isHuman ? 'Atendente Humano (Operador)' : 'Delivale Bot (IA)'}
                      </span>

                      {/* Conteúdo */}
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Anexo se houver */}
                      {msg.mediaUrl && (
                        <div className="mt-2 pt-2 border-t border-black/10 text-[11px]">
                          <a
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline font-semibold flex items-center gap-1"
                          >
                            📎 Ver arquivo anexo
                          </a>
                        </div>
                      )}

                      {/* Timestamp e status de entrega */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500">
                        <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {!isFromContact && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Barra de Digitação */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="bg-[#F0F2F5] p-3 border-t border-slate-300 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder={senderType === 'human_operator' ? 'Responder como atendente humano...' : 'Digite uma mensagem...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-white rounded-lg px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none border border-transparent focus:border-[#008069]"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="w-10 h-10 rounded-full bg-[#008069] hover:bg-[#006e5a] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
