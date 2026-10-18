import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface TimeModalProps {
  isOpen: boolean;
  initialDays: number;
  initialHours: number;
  initialMinutes: number;
  onClose: () => void;
  onSave: (days: number, hours: number, minutes: number) => void;
}

export const TimeModal: React.FC<TimeModalProps> = ({
  isOpen,
  initialDays,
  initialHours,
  initialMinutes,
  onClose,
  onSave,
}) => {
  const [days, setDays] = useState(initialDays);
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);

  useEffect(() => {
    if (isOpen) {
      setDays(initialDays);
      setHours(initialHours);
      setMinutes(initialMinutes);
    }
  }, [isOpen, initialDays, initialHours, initialMinutes]);

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

        <h3 className="text-base font-bold text-center text-[#0C2A4A] mb-6 font-['Poppins']">
          Configurar Tempo do Follow-Up
        </h3>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Dias */}
          <div className="flex flex-col items-center">
            <label className="text-[11px] font-semibold text-slate-500 mb-1">Dias</label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-2 text-center text-sm font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* Horas */}
          <div className="flex flex-col items-center">
            <label className="text-[11px] font-semibold text-slate-500 mb-1">Horas</label>
            <select
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-2 text-center text-sm font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* Minutos */}
          <div className="flex flex-col items-center">
            <label className="text-[11px] font-semibold text-slate-500 mb-1">Minutos</label>
            <select
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-2 text-center text-sm font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            >
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
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
              onSave(days, hours, minutes);
              onClose();
            }}
            className="px-6 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
