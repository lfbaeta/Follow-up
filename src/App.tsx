import React, { useState, useEffect } from 'react';
import {
  ViewTab,
  ConversationSettingsData,
  AISettingsData,
  FollowUpSettingsData,
  WhatsAppConnectionData,
  FollowUpStepData,
} from './types.js';
import { api } from './api/client.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { ToastContainer, ToastMessage } from './components/Toast.js';
import { HomeView } from './components/HomeView.js';
import { FollowUpView } from './components/FollowUpView.js';
import { FunnelView } from './components/FunnelView.js';
import { AppointmentsView } from './components/AppointmentsView.js';
import { WhatsAppSimulator } from './components/WhatsAppSimulator.js';
import { WhatsAppView } from './components/WhatsAppView.js';
import { AiSettingsView } from './components/AiSettingsView.js';
import { LogsView } from './components/LogsView.js';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('home');
  const [isLoading, setIsLoading] = useState(true);

  // Estados principais
  const [conversationSettings, setConversationSettings] = useState<ConversationSettingsData | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettingsData | null>(null);
  const [followUpSettings, setFollowUpSettings] = useState<FollowUpSettingsData | null>(null);
  const [whatsappConnection, setWhatsappConnection] = useState<WhatsAppConnectionData | null>(null);
  const [steps, setSteps] = useState<FollowUpStepData[]>([]);

  // Notificações Toast
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);

  const addToast = (toast: { type: 'success' | 'warning' | 'error'; title: string; message?: string }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, ...toast };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const notifyUnsaved = () => {
    // Alerta idêntico ao do vídeo da referência
    addToast({
      type: 'warning',
      title: 'Alterações não salvas:',
      message: 'Lembre-se de salvar!',
    });
  };

  // Carregamento inicial de dados
  const loadInitialData = async () => {
    try {
      const [settingsRes, stepsRes] = await Promise.all([api.getSettings(), api.getSteps()]);
      setConversationSettings(settingsRes.conversationSettings);
      setAiSettings(settingsRes.aiSettings);
      setFollowUpSettings(settingsRes.followUpSettings);
      setWhatsappConnection(settingsRes.whatsappConnection);
      setSteps(stepsRes.steps);
    } catch (err) {
      console.error('Falha ao carregar dados iniciais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handlers para salvar configurações
  const handleSaveConversationSettings = async (data: Partial<ConversationSettingsData>) => {
    try {
      const res = await api.saveConversationSettings(data);
      setConversationSettings(res.settings);
      addToast({
        type: 'success',
        title: 'Configurações salvas com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao salvar',
        message: err.message,
      });
    }
  };

  const handleSaveFollowUpSettings = async (data: Partial<FollowUpSettingsData>) => {
    try {
      const res = await api.saveFollowUpSettings(data);
      setFollowUpSettings(res.settings);
      addToast({
        type: 'success',
        title: 'Configurações salvas com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao salvar follow-up',
        message: err.message,
      });
    }
  };

  const handleSaveAiSettings = async (data: Partial<AISettingsData>) => {
    try {
      const res = await api.saveAiSettings(data);
      setAiSettings(res.settings);
      addToast({
        type: 'success',
        title: 'Configurações da IA salvas com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao salvar diretrizes',
        message: err.message,
      });
    }
  };

  // Handlers de etapas
  const handleCreateStep = async (formData: FormData) => {
    try {
      const res = await api.createStep(formData);
      setSteps((prev) => [...prev, res.step].sort((a, b) => a.order - b.order));
      addToast({
        type: 'success',
        title: 'Follow up adicionado com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao criar etapa',
        message: err.message,
      });
    }
  };

  const handleUpdateStep = async (id: string, formData: FormData) => {
    try {
      const res = await api.updateStep(id, formData);
      setSteps((prev) => prev.map((s) => (s.id === id ? res.step : s)).sort((a, b) => a.order - b.order));
      addToast({
        type: 'success',
        title: 'Etapa atualizada com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao atualizar etapa',
        message: err.message,
      });
    }
  };

  const handleDeleteStep = async (id: string) => {
    try {
      await api.deleteStep(id);
      setSteps((prev) => prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, order: idx + 1 })));
      addToast({
        type: 'success',
        title: 'Follow up excluído com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao excluir etapa',
        message: err.message,
      });
    }
  };

  const handleTriggerTestCycle = async () => {
    try {
      const res = await api.triggerWorkerCycle();
      addToast({
        type: 'success',
        title: 'Verificação executada',
        message: `${res.executed} etapa(s) disparada(s) pelo worker.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro na verificação',
        message: err.message,
      });
    }
  };

  // WhatsApp Connect / Disconnect
  const handleConnectWhatsApp = async () => {
    setIsConnectingWhatsApp(true);
    try {
      const res = await api.connectWhatsApp();
      const statusRes = await api.getWhatsAppStatus();
      setWhatsappConnection(statusRes);
      if (res.qrcode) {
        setCurrentTab('whatsapp');
        addToast({
          type: 'warning',
          title: 'QR Code gerado',
          message: 'Escaneie o código na tela de Conexão WhatsApp.',
        });
      } else {
        addToast({
          type: 'success',
          title: 'WhatsApp Conectado com sucesso!',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Falha na conexão',
        message: err.message,
      });
    } finally {
      setIsConnectingWhatsApp(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      await api.disconnectWhatsApp();
      const statusRes = await api.getWhatsAppStatus();
      setWhatsappConnection(statusRes);
      addToast({
        type: 'warning',
        title: 'WhatsApp Desconectado',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao desconectar',
        message: err.message,
      });
    }
  };

  const handleRefreshWhatsAppStatus = async () => {
    try {
      const statusRes = await api.getWhatsAppStatus();
      setWhatsappConnection(statusRes);
    } catch {
      // ignore
    }
  };

  const handleUpdateFunnelStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateEnrollmentStatus(id, newStatus);
      addToast({
        type: 'success',
        title: 'Status do lead alterado com sucesso!',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao alterar status',
        message: err.message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex flex-col items-center justify-center text-slate-500 font-sans">
        <RefreshCw className="w-8 h-8 text-[#FF7A00] animate-spin mb-3" />
        <h2 className="text-sm font-bold text-[#0C2A4A] font-['Poppins']">Carregando Delivale Follow-up...</h2>
        <p className="text-xs text-slate-400 mt-1">Inicializando esteira de automação e dados persistentes</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col font-['Nunito',sans-serif] text-[#0C2A4A]">
      {/* Toast notifications container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header Sticky */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        whatsappStatus={whatsappConnection}
        onConnectWhatsApp={handleConnectWhatsApp}
        onDisconnectWhatsApp={handleDisconnectWhatsApp}
        isConnecting={isConnectingWhatsApp}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'home' && conversationSettings && (
          <HomeView
            settings={conversationSettings}
            onSave={handleSaveConversationSettings}
            onNavigateTab={setCurrentTab}
            onNotifyUnsaved={notifyUnsaved}
          />
        )}

        {currentTab === 'followup' && followUpSettings && (
          <FollowUpView
            settings={followUpSettings}
            steps={steps}
            onSaveSettings={handleSaveFollowUpSettings}
            onCreateStep={handleCreateStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            onNavigateTab={setCurrentTab}
            onNotifyUnsaved={notifyUnsaved}
            onTriggerTestCycle={handleTriggerTestCycle}
          />
        )}

        {currentTab === 'funnel' && (
          <FunnelView onUpdateStatus={handleUpdateFunnelStatus} />
        )}

        {currentTab === 'appointments' && (
          <AppointmentsView onNotify={addToast} />
        )}

        {currentTab === 'simulator' && (
          <WhatsAppSimulator onNotify={addToast} />
        )}

        {currentTab === 'whatsapp' && whatsappConnection && (
          <WhatsAppView
            connection={whatsappConnection}
            onRefreshStatus={handleRefreshWhatsAppStatus}
            onNotify={addToast}
          />
        )}

        {currentTab === 'ai' && aiSettings && (
          <AiSettingsView
            settings={aiSettings}
            onSave={handleSaveAiSettings}
            onNotify={addToast}
          />
        )}

        {currentTab === 'logs' && <LogsView />}
      </main>

      {/* Footer */}
      <Footer
        onTabChange={setCurrentTab}
        onLogout={() => {
          if (confirm('Deseja realmente sair da conta administrativa?')) {
            addToast({ type: 'warning', title: 'Sessão reinicializada' });
          }
        }}
        version="1.0.0"
      />
    </div>
  );
}
