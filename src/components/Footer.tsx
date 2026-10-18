import React from 'react';
import { ViewTab } from '../types.js';

interface FooterProps {
  onTabChange: (tab: ViewTab) => void;
  onLogout: () => void;
  version?: string;
}

export const Footer: React.FC<FooterProps> = ({ onTabChange, onLogout, version = '1.0.0' }) => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-500">
        <div>
          <span>Conta Selecionada: </span>
          <span className="font-semibold text-[#0C2A4A]">Padrão (Delivale Admin)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-emerald-500 text-white font-semibold px-3 py-1 rounded-md text-[11px] shadow-2xs">
            Versão {version}
          </span>

          <a
            href="https://github.com/lfbaeta/Follow-up"
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-[#0C2A4A] bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1 rounded-md transition-colors font-mono text-[11px] inline-flex items-center gap-1.5"
            title="Abrir repositório no GitHub"
          >
            <span>GitHub: lfbaeta/Follow-up</span>
          </a>

          <a
            href="/api/export-repo"
            download="delivale-followup.tar.gz"
            className="text-slate-600 hover:text-[#0C2A4A] bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1 rounded-md transition-colors text-[11px]"
            title="Baixar repositório completo (.tar.gz)"
          >
            Baixar Código
          </a>

          <button
            onClick={() => onTabChange('logs')}
            className="text-slate-600 hover:text-[#0C2A4A] bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1 rounded-md transition-colors cursor-pointer"
          >
            Ver Logs
          </button>

          <button
            onClick={onLogout}
            className="text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 px-3 py-1 rounded-md transition-colors cursor-pointer"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </footer>
  );
};
