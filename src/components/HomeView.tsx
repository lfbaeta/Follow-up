import React, { useState, useEffect } from 'react';
import { ConversationSettingsData, ViewTab } from '../types.js';
import { HelpCircle, Plus, Trash2, Sliders, Check } from 'lucide-react';

interface HomeViewProps {
  settings: ConversationSettingsData;
  onSave: (data: Partial<ConversationSettingsData>) => Promise<void>;
  onNavigateTab: (tab: ViewTab) => void;
  onNotifyUnsaved: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  onSave,
  onNavigateTab,
  onNotifyUnsaved,
}) => {
  const [formData, setFormData] = useState<ConversationSettingsData>({ ...settings });
  const [newAllowedNumber, setNewAllowedNumber] = useState('');
  const [newBlockedNumber, setNewBlockedNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
    setHasChanges(false);
  }, [settings]);

  const handleChange = <K extends keyof ConversationSettingsData>(key: K, value: ConversationSettingsData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    onNotifyUnsaved();
  };

  const handleAddAllowed = () => {
    const clean = newAllowedNumber.replace(/\D/g, '');
    if (!clean) return;
    if (!formData.allowedNumbers.includes(clean)) {
      handleChange('allowedNumbers', [...formData.allowedNumbers, clean]);
    }
    setNewAllowedNumber('');
  };

  const handleRemoveAllowed = (num: string) => {
    handleChange(
      'allowedNumbers',
      formData.allowedNumbers.filter((n) => n !== num)
    );
  };

  const handleAddBlocked = () => {
    const clean = newBlockedNumber.replace(/\D/g, '');
    if (!clean) return;
    if (!formData.blockedNumbers.includes(clean)) {
      handleChange('blockedNumbers', [...formData.blockedNumbers, clean]);
    }
    setNewBlockedNumber('');
  };

  const handleRemoveBlocked = (num: string) => {
    handleChange(
      'blockedNumbers',
      formData.blockedNumbers.filter((n) => n !== num)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        {/* Bloco Modelo */}
        <div className="mb-8 pb-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-3">Modelo</h2>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">IA Selecionada:</label>
              <select
                value={formData.aiModelProvider}
                onChange={(e) => handleChange('aiModelProvider', e.target.value as 'gemini' | 'openai')}
                className="bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              >
                <option value="gemini">Gemini (Google GenAI)</option>
                <option value="openai">GPT (OpenAI)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('ai')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <Sliders className="w-3.5 h-3.5" />
              Configurações da IA
            </button>
          </div>
        </div>

        {/* Bloco Conversas */}
        <div className="mb-8 pb-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-4">Conversas</h2>

          <div className="mb-5">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Mensagem de Resposta para Tipos Desconhecidos
            </label>
            <textarea
              rows={2}
              value={formData.unknownTypeMessage}
              onChange={(e) => handleChange('unknownTypeMessage', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              placeholder="Ex: Desculpe, ainda não sou capaz de entender esse tipo de arquivo..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Tempo para reativação (Horas)</label>
                <div title="Tempo de silêncio após intervenção manual antes de reativar a IA" className="cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={72}
                value={formData.operatorReactivationHours}
                onChange={(e) => handleChange('operatorReactivationHours', Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Aguardar resposta / Agrupamento (Seg)</label>
                <div title="Janela de segundos para agrupar mensagens consecutivas do cliente em uma única resposta" className="cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={30}
                value={formData.messageBatchingSeconds}
                onChange={(e) => handleChange('messageBatchingSeconds', Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Somente Responder */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-700 block mb-2">Somente Responder</label>
              <p className="text-[11px] text-slate-500 mb-2">Se vazio, atende qualquer número que entrar em contato.</p>

              <div className="flex flex-wrap gap-2 mb-3 max-h-28 overflow-y-auto">
                {formData.allowedNumbers.map((num) => (
                  <div key={num} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md text-xs font-mono">
                    <span>{num}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllowed(num)}
                      className="text-red-500 hover:text-red-700 transition-colors ml-1"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Exemplo: '5511999998888'"
                  value={newAllowedNumber}
                  onChange={(e) => setNewAllowedNumber(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
                <button
                  type="button"
                  onClick={handleAddAllowed}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* Não Responder */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-700 block mb-2">Não Responder</label>
              <p className="text-[11px] text-slate-500 mb-2">Números bloqueados nunca receberão mensagens ou follow-up.</p>

              <div className="flex flex-wrap gap-2 mb-3 max-h-28 overflow-y-auto">
                {formData.blockedNumbers.map((num) => (
                  <div key={num} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md text-xs font-mono">
                    <span>{num}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlocked(num)}
                      className="text-red-500 hover:text-red-700 transition-colors ml-1"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Exemplo: '5511999998888'"
                  value={newBlockedNumber}
                  onChange={(e) => setNewBlockedNumber(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
                <button
                  type="button"
                  onClick={handleAddBlocked}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bloco Recursos de Conversa */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider mb-4">Recursos de Conversa</h2>
          <div className="flex flex-col sm:flex-row gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            {/* Toggle Agendamento */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.schedulingEnabled}
                onChange={(e) => handleChange('schedulingEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 relative"></div>
              <span className="text-xs font-bold text-[#0C2A4A]">Agendamento</span>
            </label>

            {/* Toggle Follow-Up */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.followUpEnabled}
                onChange={(e) => handleChange('followUpEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 relative"></div>
              <span className="text-xs font-bold text-[#0C2A4A]">Follow-Up</span>
            </label>

            {/* Toggle Resposta IA */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.aiResponseEnabled}
                onChange={(e) => handleChange('aiResponseEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 relative"></div>
              <span className="text-xs font-bold text-[#0C2A4A]">Atendimento Inteligente com IA</span>
            </label>
          </div>
        </div>

        {/* Botão Salvar Configurações (Verde fiel ao vídeo) */}
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
};
