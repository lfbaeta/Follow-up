import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { SystemLogData } from '../types.js';
import { Terminal, RefreshCw, Trash2, Filter } from 'lucide-react';

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogData[]>([]);
  const [category, setCategory] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getLogs(category || undefined, level || undefined);
      setLogs(data.logs);
    } catch (err) {
      console.error('Falha ao carregar logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [category, level]);

  const handleClear = async () => {
    if (!confirm('Deseja limpar todos os logs registrados?')) return;
    await api.clearLogs();
    await loadLogs();
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#FF7A00] flex items-center justify-center shadow-md">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0C2A4A] font-['Poppins']">Logs de Auditoria e Sistema</h2>
              <p className="text-xs text-slate-500">Histórico de eventos de WhatsApp, follow-up, IA e agendamentos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Atualizar logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClear}
              className="p-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
              title="Limpar logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600">Categoria:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg py-1 px-2 text-xs font-semibold text-[#0C2A4A]"
            >
              <option value="">Todas</option>
              <option value="followup">Follow-up</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="ai">IA / Gemini</option>
              <option value="appointments">Agendamentos</option>
              <option value="system">Sistema</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Nível:</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg py-1 px-2 text-xs font-semibold text-[#0C2A4A]"
            >
              <option value="">Todos</option>
              <option value="info">Info</option>
              <option value="warn">Avisos</option>
              <option value="error">Erros</option>
            </select>
          </div>
        </div>

        {/* Lista de logs estilo console */}
        <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-200 max-h-[500px] overflow-y-auto space-y-2 border border-slate-800">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Nenhum log encontrado para os filtros selecionados.</div>
          ) : (
            logs.map((log) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';

              return (
                <div key={log.id} className="flex items-start gap-2 text-[11px] hover:bg-slate-900/60 p-1 rounded">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                  <span
                    className={`uppercase font-bold px-1 rounded text-[10px] shrink-0 ${
                      isError
                        ? 'bg-red-950 text-red-400'
                        : isWarn
                        ? 'bg-amber-950 text-amber-400'
                        : 'bg-emerald-950 text-emerald-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-blue-400 font-semibold shrink-0">[{log.category}]</span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
