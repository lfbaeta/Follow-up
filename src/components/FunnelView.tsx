import React, { useState, useEffect } from 'react';
import { FunnelItemData, FunnelMetricsData } from '../types.js';
import { StatusModal } from './StatusModal.js';
import { api } from '../api/client.js';
import { FileSpreadsheet, Search, RefreshCw, Calendar, CheckCircle2, UserX, AlertCircle } from 'lucide-react';

interface FunnelViewProps {
  onUpdateStatus: (id: string, newStatus: string) => Promise<void>;
}

export const FunnelView: React.FC<FunnelViewProps> = ({ onUpdateStatus }) => {
  const [metrics, setMetrics] = useState<FunnelMetricsData>({
    totalInFunnel: 0,
    totalCount: 0,
    converted: { count: 0, percentage: '0.00' },
    optOut: { count: 0, percentage: '0.00' },
    finishedNoAction: { count: 0, percentage: '0.00' },
  });
  const [items, setItems] = useState<FunnelItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de status
  const [selectedItemForStatus, setSelectedItemForStatus] = useState<FunnelItemData | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFunnel(startDate, endDate, searchTerm);
      setMetrics(data.metrics);
      setItems(data.items);
    } catch (err) {
      console.error('Falha ao carregar funil:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000); // Polling a cada 4 segundos para refletir contadores em tempo real
    return () => clearInterval(interval);
  }, [startDate, endDate, searchTerm]);

  const handleConfirmStatusChange = async (newStatus: string) => {
    if (!selectedItemForStatus) return;
    await onUpdateStatus(selectedItemForStatus.id, newStatus);
    setSelectedItemForStatus(null);
    loadData();
  };

  const exportUrl = api.getExportXlsxUrl(startDate, endDate, searchTerm);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* 4 Cartões KPI no topo (Fiel ao vídeo) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total no Funil */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total no Funil
          </span>
          <div className="text-2xl font-black text-[#0C2A4A] tabular-nums font-['Poppins']">
            {metrics.totalInFunnel}
          </div>
        </div>

        {/* Convertido */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
            Convertido
          </span>
          <div className="text-2xl font-black text-emerald-600 tabular-nums font-['Poppins']">
            {metrics.converted.count}{' '}
            <span className="text-xs font-semibold text-emerald-700">({metrics.converted.percentage}%)</span>
          </div>
        </div>

        {/* Opt-out */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Opt-out
          </span>
          <div className="text-2xl font-black text-slate-600 tabular-nums font-['Poppins']">
            {metrics.optOut.count}{' '}
            <span className="text-xs font-semibold text-slate-500">({metrics.optOut.percentage}%)</span>
          </div>
        </div>

        {/* Fim sem Ação */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Fim sem Ação
          </span>
          <div className="text-2xl font-black text-slate-600 tabular-nums font-['Poppins']">
            {metrics.finishedNoAction.count}{' '}
            <span className="text-xs font-semibold text-slate-500">({metrics.finishedNoAction.percentage}%)</span>
          </div>
        </div>
      </div>

      {/* Card da Gestão de Clientes no Funil */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-6">
        <h2 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-5">
          Gestão de Clientes no Funil
        </h2>

        {/* Linha de Filtros (Data Início, Data Fim, Busca) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Data Início:</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Data Fim:</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Encontrar:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Digite o nome ou número do cliente"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-3 text-center">Etapa</th>
                <th className="py-3 px-4 text-center">Próximo</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF7A00]" />
                    Carregando contatos do funil...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Nenhum cliente registrado no funil para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isConverted = item.status === 'converted';
                  const isOptOut = item.status === 'opt_out';
                  const isInFunnel = item.status === 'in_funnel';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#0C2A4A]">{item.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.phone}</td>
                      <td className="py-3 px-3 text-center font-bold text-[#0C2A4A]">{item.step}</td>
                      <td className="py-3 px-4 text-center text-slate-600 font-medium">
                        {item.nextSend}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isConverted
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOptOut
                              ? 'bg-slate-100 text-slate-600'
                              : isInFunnel
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.statusDisplay}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedItemForStatus(item)}
                          className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Conversão: {isConverted ? 'Sim' : 'Não'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Botão Exportar Lista em XLSX (Fiel ao botão verde central do vídeo) */}
        <div className="flex justify-center">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Lista em XLSX
          </a>
        </div>
      </div>

      {/* Modal Alterar Status */}
      {selectedItemForStatus && (
        <StatusModal
          isOpen={Boolean(selectedItemForStatus)}
          contactName={`${selectedItemForStatus.name} (${selectedItemForStatus.phone})`}
          currentStatus={selectedItemForStatus.status}
          onClose={() => setSelectedItemForStatus(null)}
          onConfirm={handleConfirmStatusChange}
        />
      )}
    </div>
  );
};
