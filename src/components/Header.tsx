import React from 'react';
import { ViewTab, WhatsAppConnectionData } from '../types.js';
import { Wifi, WifiOff, MessageSquare, ChevronDown } from 'lucide-react';

interface HeaderProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  whatsappStatus: WhatsAppConnectionData | null;
  onConnectWhatsApp: () => void;
  onDisconnectWhatsApp: () => void;
  isConnecting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  whatsappStatus,
  onConnectWhatsApp,
  onDisconnectWhatsApp,
  isConnecting,
}) => {
  const isConnected = whatsappStatus?.status === 'connected';

  const tabLabels: Record<ViewTab, string> = {
    home: 'Início',
    followup: 'Follow up',
    funnel: 'Funil de Clientes',
    appointments: 'Agendamentos',
    simulator: 'Simulador WhatsApp',
    ai: 'Configurações da IA',
    whatsapp: 'Conexão WhatsApp',
    logs: 'Logs do Sistema',
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF7A00] to-[#FFA544] flex items-center justify-center text-white shadow-md shadow-[#FF7A00]/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#0C2A4A] block leading-none font-['Poppins']">
              Delivale <span className="text-[#FF7A00]">Follow-up</span>
            </span>
            <span className="text-xs text-slate-400 font-medium tracking-wide">
              Automação Inteligente de Atendimento
            </span>
          </div>
        </div>

        {/* Seletor Dropdown Central (Fiel à referência do vídeo) */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-[#FFF3E6] border border-[#FFDCC4] rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0C2A4A] shadow-xs">
            <select
              value={currentTab}
              onChange={(e) => onTabChange(e.target.value as ViewTab)}
              aria-label="Navegar entre as seções"
              className="bg-transparent text-[#0C2A4A] font-semibold text-sm cursor-pointer focus:outline-none pr-6 appearance-none py-0.5"
            >
              <option value="home">Início</option>
              <option value="followup">Follow up</option>
              <option value="funnel">Funil de Clientes</option>
              <option value="appointments">Agendamentos</option>
              <option value="simulator">Simulador WhatsApp Web</option>
              <option value="whatsapp">Conexão WhatsApp</option>
              <option value="ai">Configurações da IA</option>
              <option value="logs">Logs do Sistema</option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#FF7A00] absolute right-2.5 pointer-events-none" />
          </div>
        </div>

        {/* WhatsApp Connection State & Action Button */}
        <div className="flex flex-col sm:flex-row items-center sm:gap-3 gap-1">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Wifi className="w-3.5 h-3.5" />
              <span>Conectado ao WhatsApp</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span>WhatsApp Desconectado</span>
            </div>
          )}

          {isConnected ? (
            <button
              onClick={onDisconnectWhatsApp}
              className="text-xs font-semibold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Desconectar WhatsApp
            </button>
          ) : (
            <button
              onClick={onConnectWhatsApp}
              disabled={isConnecting}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isConnecting ? 'Conectando...' : 'Conectar WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
