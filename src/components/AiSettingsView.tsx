import React, { useState, useEffect } from 'react';
import { AISettingsData } from '../types.js';
import { Sparkles, Brain, Save, CheckCircle2, ShieldAlert } from 'lucide-react';

interface AiSettingsViewProps {
  settings: AISettingsData;
  onSave: (data: Partial<AISettingsData>) => Promise<void>;
  onNotify: (toast: { type: 'success' | 'warning' | 'error'; title: string; message?: string }) => void;
}

export const AiSettingsView: React.FC<AiSettingsViewProps> = ({ settings, onSave, onNotify }) => {
  const [formData, setFormData] = useState<AISettingsData>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onNotify({
        type: 'success',
        title: 'Configurações de IA salvas com sucesso!',
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Erro ao salvar IA',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF7A00] to-[#FFA544] flex items-center justify-center text-white shadow-md shadow-[#FF7A00]/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0C2A4A] font-['Poppins']">
              Diretrizes e Conhecimento da IA
            </h2>
            <p className="text-xs text-slate-500">
              Personalize o comportamento do atendimento automatizado e das variações de follow-up
            </p>
          </div>
        </div>

        {/* Modelo Gemini e Chave */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Modelo Gemini (Google GenAI):</label>
            <select
              value={formData.geminiModel}
              onChange={(e) => setFormData({ ...formData, geminiModel: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (Recomendado - Ultra rápido)</option>
              <option value="gemini-flash-latest">gemini-flash-latest</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Alta taxa)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Status da API Key no Servidor:</label>
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
              {formData.hasGeminiApiKey ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-800">Chave GEMINI_API_KEY Configurada e Ativa</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-800">Chave gerenciada automaticamente pelo AI Studio</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Prompt do Sistema */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Prompt do Sistema (Persona e Instruções de Comportamento):
          </label>
          <textarea
            rows={4}
            value={formData.systemPrompt}
            onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
            placeholder="Você é a assistente virtual da Delivale Odontologia..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
          />
        </div>

        {/* Base de Conhecimento do Negócio */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Informações Oficiais do Negócio (Serviços, Horários, Endereço, Regras):
          </label>
          <textarea
            rows={6}
            value={formData.businessKnowledge}
            onChange={(e) => setFormData({ ...formData, businessKnowledge: e.target.value })}
            placeholder="Clínica Delivale: Horário de atendimento, procedimentos realizados, valores de referência..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            A IA nunca inventará preços ou procedimentos além das informações explicitadas neste campo.
          </p>
        </div>

        {/* Parâmetros Técnicos (Temperatura) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">Temperatura (Criatividade):</label>
              <span className="text-xs font-bold text-[#FF7A00] font-mono">{formData.temperature}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full accent-[#FF7A00] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.1 (Mais preciso/determinístico)</span>
              <span>1.0 (Mais criativo)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Máximo de Tokens de Saída:</label>
            <input
              type="number"
              min={100}
              max={2000}
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value, 10) })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-8 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar Diretrizes da IA'}
          </button>
        </div>
      </form>
    </div>
  );
};
