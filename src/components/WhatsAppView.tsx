import React, { useState, useEffect, useRef } from 'react';
import { WhatsAppConnectionData } from '../types.js';
import { api } from '../api/client.js';
import {
  QrCode,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Send,
  Server,
  Key,
  Smartphone,
  RefreshCw,
  Zap,
  Globe,
  Copy,
  Check
} from 'lucide-react';

interface WhatsAppViewProps {
  connection: WhatsAppConnectionData;
  onRefreshStatus: () => Promise<void>;
  onNotify: (toast: { type: 'success' | 'warning' | 'error'; title: string; message?: string }) => void;
}

export const WhatsAppView: React.FC<WhatsAppViewProps> = ({ connection, onRefreshStatus, onNotify }) => {
  const [instanceName, setInstanceName] = useState(connection.instanceName || 'delivale_bot');
  const [serverUrl, setServerUrl] = useState(connection.serverUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(connection.qrCode || null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(30);
  const [copiedPairing, setCopiedPairing] = useState(false);

  // Teste de disparo
  const [testPhone, setTestPhone] = useState('5511999998888');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do Delivale Follow-up.');
  const [isTesting, setIsTesting] = useState(false);

  const isConnected = connection.status === 'connected';
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Monitora e faz polling automático enquanto o QR Code estiver sendo exibido
  useEffect(() => {
    if (qrCodeData && !isConnected) {
      pollingRef.current = setInterval(async () => {
        try {
          const state = await api.checkWhatsAppState();
          if (state.status === 'connected') {
            setQrCodeData(null);
            if (pollingRef.current) clearInterval(pollingRef.current);
            await onRefreshStatus();
            onNotify({
              type: 'success',
              title: 'WhatsApp Conectado com sucesso!',
              message: `Aparelho pareado com o número ${state.connectedPhone || 'oficial'}.`,
            });
          }
        } catch {
          // ignore transient polling errors
        }
      }, 2500);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [qrCodeData, isConnected]);

  // Timer regressivo visual para o QR Code
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (qrCodeData && !isConnected) {
      setQrCountdown(30);
      timer = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [qrCodeData, isConnected]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateWhatsAppConfig({
        instanceName,
        serverUrl,
        apiKey: apiKey || undefined,
      });
      await onRefreshStatus();
      onNotify({
        type: 'success',
        title: 'Configurações da Evolution API salvas!',
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Erro ao salvar configurações',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * GERAR QR CODE OFICIAL DA INSTÂNCIA NA EVOLUTION API
   */
  const handleGenerateOfficialQrCode = async () => {
    setIsGeneratingQr(true);
    try {
      // Salva antes os parâmetros mais recentes da tela para garantir consistência
      await api.updateWhatsAppConfig({
        instanceName,
        serverUrl,
        apiKey: apiKey || undefined,
      });

      const res = await api.generateOfficialQrCode();

      if (res.qrcode) {
        setQrCodeData(res.qrcode);
        setPairingCode(res.pairingCode || null);
        onNotify({
          type: 'success',
          title: 'QR Code Oficial gerado com sucesso!',
          message: 'Aponte a câmera do WhatsApp para escanear e conectar.',
        });
      } else if (res.status === 'connected') {
        setQrCodeData(null);
        onNotify({
          type: 'success',
          title: 'Instância já conectada!',
          message: 'O WhatsApp já está autenticado nesta instância.',
        });
      }
      await onRefreshStatus();
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Falha ao gerar QR Code Oficial',
        message: err.message || 'Verifique se a URL e a API Key da Evolution API estão corretas.',
      });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  /**
   * Criação oficial da instância na Evolution API
   */
  const handleCreateInstance = async () => {
    setIsCreatingInstance(true);
    try {
      await api.updateWhatsAppConfig({
        instanceName,
        serverUrl,
        apiKey: apiKey || undefined,
      });
      await api.createEvolutionInstance();
      onNotify({
        type: 'success',
        title: `Instância '${instanceName}' inicializada!`,
        message: 'Agora você pode gerar o QR Code Oficial.',
      });
      await handleGenerateOfficialQrCode();
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Erro ao criar instância',
        message: err.message,
      });
    } finally {
      setIsCreatingInstance(false);
    }
  };

  /**
   * Configuração automática do Webhook da Evolution API
   */
  const handleSetupWebhook = async () => {
    setIsSettingWebhook(true);
    try {
      const res = await api.setupEvolutionWebhook();
      onNotify({
        type: 'success',
        title: 'Webhook Oficial Configurado!',
        message: `Eventos apontados para: ${res.webhookUrl}`,
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Falha ao configurar webhook',
        message: err.message,
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectWhatsApp();
      setQrCodeData(null);
      await onRefreshStatus();
      onNotify({
        type: 'warning',
        title: 'WhatsApp Desconectado',
        message: 'A sessão da instância foi encerrada.',
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Erro ao desconectar',
        message: err.message,
      });
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    try {
      await api.sendTestMessage(testPhone, testMessage);
      onNotify({
        type: 'success',
        title: 'Mensagem enviada com sucesso!',
        message: `Disparada para o número ${testPhone}.`,
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Falha no envio de teste',
        message: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPairing(true);
    setTimeout(() => setCopiedPairing(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Banner de Status Principal */}
      <div
        className={`rounded-2xl p-6 mb-6 border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isConnected ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {isConnected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold font-['Poppins']">
              {isConnected ? 'WhatsApp Conectado e Operacional' : 'WhatsApp Desconectado'}
            </h3>
            <p className="text-xs opacity-80 mt-0.5">
              {isConnected
                ? `Instância Oficial: ${connection.instanceName} | Conectado em: ${connection.connectedPhone || 'WhatsApp'} ${
                    connection.connectedName ? `(${connection.connectedName})` : ''
                  }`
                : `Instância: ${instanceName} — Gere o QR Code Oficial abaixo para parear seu aparelho.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-xs font-bold text-red-600 hover:text-white bg-white hover:bg-red-600 border border-red-300 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              Desconectar WhatsApp
            </button>
          ) : (
            <button
              onClick={handleGenerateOfficialQrCode}
              disabled={isGeneratingQr}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              {isGeneratingQr ? 'Gerando QR Code Oficial...' : 'Gerar QR Code Oficial'}
            </button>
          )}
        </div>
      </div>

      {/* BLOCO EM DESTAQUE: GERAR QR CODE OFICIAL COM A INSTÂNCIA DA EVOLUTION API */}
      {!isConnected && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500/30 p-6 sm:p-8 mb-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block mb-1.5">
                Evolution API Oficial
              </span>
              <h3 className="text-lg font-bold text-[#0C2A4A] font-['Poppins'] flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                Conectar WhatsApp com QR Code Oficial
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gere o código de autenticação diretamente na sua instância da Evolution API (Baileys)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateOfficialQrCode}
                disabled={isGeneratingQr}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQr ? 'animate-spin' : ''}`} />
                {isGeneratingQr ? 'Gerando...' : 'Gerar QR Code Oficial'}
              </button>

              <button
                type="button"
                onClick={handleCreateInstance}
                disabled={isCreatingInstance}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                title="Cria a instância na Evolution API se ela ainda não existir"
              >
                <Zap className="w-3.5 h-3.5 text-[#FF7A00]" />
                Criar Instância
              </button>

              <button
                type="button"
                onClick={handleSetupWebhook}
                disabled={isSettingWebhook}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                title="Configura os eventos de Webhook automaticamente na Evolution API"
              >
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                Configurar Webhook
              </button>
            </div>
          </div>

          {/* Exibição do QR Code quando gerado */}
          {qrCodeData ? (
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="relative p-4 bg-white rounded-2xl shadow-lg border border-slate-200 mb-4 group">
                <img
                  src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                  alt="QR Code Oficial da Evolution API"
                  className="w-64 h-64 mx-auto object-contain"
                />
                <div className="absolute inset-x-0 bottom-2 text-center pointer-events-none">
                  <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                    Renova em {qrCountdown}s
                  </span>
                </div>
              </div>

              {/* Código de Pareamento por Texto se fornecido */}
              {pairingCode && (
                <div className="mb-4 flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-mono">
                  <span className="text-slate-500 font-sans font-bold">Código de Pareamento:</span>
                  <span className="text-emerald-700 font-bold text-sm">{pairingCode}</span>
                  <button
                    onClick={() => copyToClipboard(pairingCode)}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title="Copiar código"
                  >
                    {copiedPairing ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* Status de Polling em tempo real */}
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-full mb-4 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Aguardando leitura do QR Code pelo seu celular...
              </div>

              {/* Instruções de escaneamento */}
              <div className="max-w-md text-center text-xs text-slate-600 space-y-1">
                <p className="font-bold text-[#0C2A4A]">Instruções para Pareamento:</p>
                <ol className="text-left list-decimal list-inside text-[11px] space-y-1 text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                  <li>Abra o aplicativo do <strong>WhatsApp</strong> no seu smartphone.</li>
                  <li>Acesse o menu de <strong>Configurações</strong> (iOS) ou os <strong>três pontinhos</strong> (Android).</li>
                  <li>Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong>.</li>
                  <li>Aponte a câmera para o QR Code acima para finalizar a conexão.</li>
                </ol>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateOfficialQrCode}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Recarregar / Gerar Novo QR Code Oficial
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
              <QrCode className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-[#0C2A4A] mb-1 font-['Poppins']">
                Nenhum QR Code gerado no momento
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                Clique no botão verde <strong>&quot;Gerar QR Code Oficial&quot;</strong> para solicitar o código oficial de pareamento da sua instância na Evolution API.
              </p>
              <button
                type="button"
                onClick={handleGenerateOfficialQrCode}
                disabled={isGeneratingQr}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingQr ? 'Gerando QR Code Oficial...' : 'Gerar QR Code Oficial Agora'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Formulário de Configuração da Instância Evolution API */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-xs">
        <h3 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-4">
          Configuração da Instância (Evolution API)
        </h3>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Nome da Instância:</label>
            <div className="relative">
              <input
                type="text"
                required
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Ex: delivale_bot"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pl-9 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
              <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Nome identificador da sua instância na Evolution API.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">URL do Servidor Evolution API:</label>
            <div className="relative">
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="Ex: https://evolution.seuservidor.com"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pl-9 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
              <Server className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              URL base onde sua Evolution API está hospedada (ex: VPS ou Cloud).
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">API Key / Token Global:</label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={connection.hasApiKey ? '••••••••••••••••••••••••' : 'Cole sua chave de API'}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pl-9 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Chave de autenticação (HEADER: <code className="text-slate-600 font-mono">apikey</code>).
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações da Instância'}
        </button>
      </form>

      {/* Bloco Teste de Disparo Real */}
      <form onSubmit={handleSendTest} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-4">
          Enviar Mensagem de Teste pelo WhatsApp
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Número de Destino com DDI:</label>
            <input
              type="text"
              required
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Ex: 5511999998888"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Mensagem:</label>
            <input
              type="text"
              required
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isTesting}
          className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#0C2A4A] hover:bg-[#163a63] rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5 text-[#FF7A00]" />
          {isTesting ? 'Enviando...' : 'Enviar Teste'}
        </button>
      </form>
    </div>
  );
};
