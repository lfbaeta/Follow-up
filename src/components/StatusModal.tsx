import React, { useState } from 'react';
import { X } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  contactName: string;
  currentStatus: string;
  onClose: () => void;
  onConfirm: (newStatus: string) => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  isOpen,
  contactName,
  currentStatus,
  onClose,
  onConfirm,
}) => {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus || 'in_funnel');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold text-center text-[#0C2A4A] mb-1 font-['Poppins']">
          Alterar Status - Lead
        </h3>
        <p className="text-xs text-center text-slate-500 mb-6 truncate">{contactName}</p>

        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Novo Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 px-3 text-sm font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
          >
            <option value="in_funnel">No Funil (Ativo)</option>
            <option value="converted">Comprou (Convertido)</option>
            <option value="finished_no_action">Finalizou sem ação</option>
            <option value="opt_out">Opt-out (Saiu do funil)</option>
          </select>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm(selectedStatus);
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            Confirmar Alteração
          </button>
        </div>
      </div>
    </div>
  );
};
