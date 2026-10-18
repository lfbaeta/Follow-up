import React, { useState, useEffect, useRef } from 'react';
import { FollowUpSettingsData, FollowUpStepData, ViewTab } from '../types.js';
import { TimeModal } from './TimeModal.js';
import { Clock, Paperclip, Edit2, X, Plus, Users, Play, FileText, Image as ImageIcon } from 'lucide-react';

interface FollowUpViewProps {
  settings: FollowUpSettingsData;
  steps: FollowUpStepData[];
  onSaveSettings: (data: Partial<FollowUpSettingsData>) => Promise<void>;
  onCreateStep: (formData: FormData) => Promise<void>;
  onUpdateStep: (id: string, formData: FormData) => Promise<void>;
  onDeleteStep: (id: string) => Promise<void>;
  onNavigateTab: (tab: ViewTab) => void;
  onNotifyUnsaved: () => void;
  onTriggerTestCycle: () => Promise<void>;
}

export const FollowUpView: React.FC<FollowUpViewProps> = ({
  settings,
  steps,
  onSaveSettings,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  onNavigateTab,
  onNotifyUnsaved,
  onTriggerTestCycle,
}) => {
  const [formData, setFormData] = useState<FollowUpSettingsData>({ ...settings });
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // Editor de etapas
  const [editorText, setEditorText] = useState('');
  const [editorDays, setEditorDays] = useState(0);
  const [editorHours, setEditorHours] = useState(0);
  const [editorMinutes, setEditorMinutes] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingMediaName, setExistingMediaName] = useState<string | null>(null);

  // Modal de tempo
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [targetStepForTimeModal, setTargetStepForTimeModal] = useState<string | 'editor'>('editor');

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isTestingCycle, setIsTestingCycle] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleSettingsChange = <K extends keyof FollowUpSettingsData>(key: K, value: FollowUpSettingsData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    onNotifyUnsaved();
  };

  const handleSaveAllSettings = async () => {
    setIsSavingSettings(true);
    try {
      await onSaveSettings(formData);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenTimeModalForStep = (stepId: string | 'editor') => {
    setTargetStepForTimeModal(stepId);
    if (stepId === 'editor') {
      setIsTimeModalOpen(true);
    } else {
      const step = steps.find((s) => s.id === stepId);
      if (step) {
        setIsTimeModalOpen(true);
      }
    }
  };

  const handleSaveTimeFromModal = async (days: number, hours: number, minutes: number) => {
    if (targetStepForTimeModal === 'editor') {
      setEditorDays(days);
      setEditorHours(hours);
      setEditorMinutes(minutes);
    } else {
      const step = steps.find((s) => s.id === targetStepForTimeModal);
      if (step) {
        const fd = new FormData();
        fd.append('durationDays', String(days));
        fd.append('durationHours', String(hours));
        fd.append('durationMinutes', String(minutes));
        await onUpdateStep(step.id, fd);
      }
    }
  };

  const handleStartEditStep = (step: FollowUpStepData) => {
    setEditingStepId(step.id);
    setEditorText(step.messageContent);
    setEditorDays(step.durationDays);
    setEditorHours(step.durationHours);
    setEditorMinutes(step.durationMinutes);
    setExistingMediaName(step.mediaOriginalName || null);
    setSelectedFile(null);
  };

  const handleCancelEdit = () => {
    setEditingStepId(null);
    setEditorText('');
    setEditorDays(0);
    setEditorHours(0);
    setEditorMinutes(1);
    setSelectedFile(null);
    setExistingMediaName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorText.trim() && !selectedFile && !existingMediaName) {
      alert('Por favor, informe a mensagem da etapa ou anexe um arquivo.');
      return;
    }

    setIsSavingStep(true);
    try {
      const fd = new FormData();
      fd.append('messageContent', editorText);
      fd.append('durationDays', String(editorDays));
      fd.append('durationHours', String(editorHours));
      fd.append('durationMinutes', String(editorMinutes));

      if (selectedFile) {
        fd.append('mediaFile', selectedFile);
      }

      if (editingStepId) {
        await onUpdateStep(editingStepId, fd);
      } else {
        await onCreateStep(fd);
      }
      handleCancelEdit();
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleTestCycle = async () => {
    setIsTestingCycle(true);
    try {
      await onTriggerTestCycle();
    } finally {
      setIsTestingCycle(false);
    }
  };

  // Tempo atual para o modal
  const modalInitialDays =
    targetStepForTimeModal === 'editor'
      ? editorDays
      : steps.find((s) => s.id === targetStepForTimeModal)?.durationDays || 0;
  const modalInitialHours =
    targetStepForTimeModal === 'editor'
      ? editorHours
      : steps.find((s) => s.id === targetStepForTimeModal)?.durationHours || 0;
  const modalInitialMinutes =
    targetStepForTimeModal === 'editor'
      ? editorMinutes
      : steps.find((s) => s.id === targetStepForTimeModal)?.durationMinutes || 1;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Top Header Controls (Fiel ao vídeo) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('funnel')}
            className="inline-flex items-center gap-2 bg-[#0C2A4A] hover:bg-[#163a63] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Users className="w-4 h-4 text-[#FF7A00]" />
            Gestão - Lista de clientes no funil
          </button>

          {/* Seletor Modo Follow-Up AI: Texto Fixo vs Com IA */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <span className="text-[11px] text-slate-500 px-2 font-bold uppercase">Modo:</span>
            <button
              type="button"
              onClick={() => handleSettingsChange('mode', 'fixed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                formData.mode === 'fixed'
                  ? 'bg-white text-[#0C2A4A] shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Texto Fixo
            </button>
            <button
              type="button"
              onClick={() => handleSettingsChange('mode', 'ai')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                formData.mode === 'ai'
                  ? 'bg-gradient-to-r from-[#FF7A00] to-[#FFA544] text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ✨ Com IA
            </button>
          </div>
        </div>

        {/* Campo Tempo de Inatividade para o Gatilho de Follow-up (Min) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Tempo de Inatividade para Gatilho (Min):
          </label>
          <input
            type="number"
            min={1}
            max={1440}
            value={formData.inactivityMinutes}
            onChange={(e) => handleSettingsChange('inactivityMinutes', Number(e.target.value))}
            className="w-20 bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-3 text-center text-xs font-bold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
          />
        </div>
      </div>

      {/* Dois Blocos: COMPROU e SAIR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Bloco COMPROU */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0C2A4A]">Palavra-chave para o status &quot;COMPROU&quot;</h3>
              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.conversionTriggerActive}
                  onChange={(e) => handleSettingsChange('conversionTriggerActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Mensagem que irá classificar o cliente com status de <strong>&quot;conversão&quot;</strong>. Quando o Cliente
              digitar a mensagem abaixo, receberá resposta da IA (se configurada) e sairá automaticamente da esteira de
              FOLLOW-UP para não ser mais incomodado.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Palavra-chave de Conversão:</label>
            <input
              type="text"
              value={formData.conversionKeyword}
              onChange={(e) => handleSettingsChange('conversionKeyword', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-bold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              placeholder="Ex: JÁ COMPREI"
            />
          </div>
        </div>

        {/* Bloco Opt-out / SAIR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0C2A4A]">Opt-out para follow-up</h3>
              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.optOutActive}
                  onChange={(e) => handleSettingsChange('optOutActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Essa mensagem será enviada ao final de cada follow-up com o objetivo de evitar denúncias ou bloqueios no
              WhatsApp. Ao responder essa palavra-chave, o contato não receberá mais mensagens da esteira.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Palavra-chave de Saída:</label>
            <input
              type="text"
              value={formData.optOutKeyword}
              onChange={(e) => handleSettingsChange('optOutKeyword', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-bold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              placeholder="Ex: SAIR"
            />
          </div>
        </div>
      </div>

      {/* Bloco da Esteira de Etapas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-[#0C2A4A] uppercase tracking-wider">
            Envio de Mensagens Nativas na Conversa para o Gatilho de Inatividade (Min)
          </h2>

          <button
            type="button"
            onClick={handleTestCycle}
            disabled={isTestingCycle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            title="Dispara uma verificação imediata das etapas pendentes no worker"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600" />
            {isTestingCycle ? 'Testando Disparo...' : 'Disparar Verificação Agora'}
          </button>
        </div>

        {/* Tabela de Etapas (Fiel à tabela do vídeo) */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">Nº</th>
                <th className="py-3 px-3 w-28 text-center">D/H/M</th>
                <th className="py-3 px-4">Prévia da Mensagem/Prompt</th>
                <th className="py-3 px-4 w-44">Mídia</th>
                <th className="py-3 px-3 w-20 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {steps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Nenhuma etapa de follow-up cadastrada. Crie a primeira abaixo!
                  </td>
                </tr>
              ) : (
                steps.map((step) => {
                  const formatTime = `${String(step.durationDays).padStart(2, '0')}:${String(
                    step.durationHours
                  ).padStart(2, '0')}:${String(step.durationMinutes).padStart(2, '0')}`;

                  return (
                    <tr key={step.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-500">{step.order}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenTimeModalForStep(step.id)}
                          className="font-mono bg-slate-100 hover:bg-slate-200 text-[#0C2A4A] px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                          title="Clique para alterar o tempo desta etapa"
                        >
                          {formatTime}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-[#0C2A4A]">
                        <p className="line-clamp-2 leading-relaxed">{step.messageContent}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {step.mediaUrl ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 truncate max-w-[160px]">
                            {step.mediaType === 'image' ? (
                              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <a
                              href={step.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate underline hover:text-emerald-900"
                              title={step.mediaOriginalName || 'Mídia'}
                            >
                              {step.mediaOriginalName || 'Arquivo anexado'}
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Nenhum arquivo</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditStep(step)}
                            className="p-1 text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                            title="Editar mensagem da etapa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja realmente excluir a etapa #${step.order}?`)) {
                                onDeleteStep(step.id);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir etapa"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Editor de Nova Etapa / Edição (Fiel à área inferior com botão verde de salvar do vídeo) */}
        <form onSubmit={handleSaveStep} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#0C2A4A] uppercase tracking-wide">
              {editingStepId ? '✏️ Editando Etapa Selecionada' : '➕ Cadastrar Nova Etapa de Follow-up'}
            </span>
            {editingStepId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Cancelar edição
              </button>
            )}
          </div>

          {/* Botão Selecionar Arquivo */}
          <div className="flex items-center gap-3 mb-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                  setExistingMediaName(null);
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#FF7A00]" />
              Clique para selecionar o arquivo
            </button>

            <span className="text-xs text-slate-500 truncate max-w-xs">
              {selectedFile
                ? `Selecionado: ${selectedFile.name}`
                : existingMediaName
                ? `Atual: ${existingMediaName}`
                : 'Nenhum arquivo selecionado'}
            </span>

            {(selectedFile || existingMediaName) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setExistingMediaName(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                title="Remover anexo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Textarea */}
          <div className="mb-4">
            <textarea
              rows={3}
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder="Por favor, insira o texto da mensagem..."
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
            />
          </div>

          {/* Barra de ação do editor com o Reloginho e botão Salvar verde */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Tempo de espera:</span>
              <button
                type="button"
                onClick={() => handleOpenTimeModalForStep('editor')}
                className="inline-flex items-center gap-1.5 bg-[#0C2A4A] hover:bg-[#163a63] text-white px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                title="Configurar dias, horas e minutos"
              >
                <Clock className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>
                  {String(editorDays).padStart(2, '0')} D {String(editorHours).padStart(2, '0')} H{' '}
                  {String(editorMinutes).padStart(2, '0')} M
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isSavingStep}
              className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingStep ? 'Salvando...' : editingStepId ? 'Salvar Alterações' : 'Salvar Etapa'}
            </button>
          </div>
        </form>
      </div>

      {/* Botão Inferior Salvar Configurações (Fiel ao vídeo) */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSaveAllSettings}
          disabled={isSavingSettings}
          className="px-10 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
        >
          {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Modal de Tempo */}
      <TimeModal
        isOpen={isTimeModalOpen}
        initialDays={modalInitialDays}
        initialHours={modalInitialHours}
        initialMinutes={modalInitialMinutes}
        onClose={() => setIsTimeModalOpen(false)}
        onSave={handleSaveTimeFromModal}
      />
    </div>
  );
};
