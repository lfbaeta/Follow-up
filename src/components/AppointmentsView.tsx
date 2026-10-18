import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { AppointmentData, ServiceData, ResourceData } from '../types.js';
import { Calendar as CalendarIcon, Clock, User, CheckCircle2, XCircle, Plus, RefreshCw, MessageSquare } from 'lucide-react';

interface AppointmentsViewProps {
  onNotify: (toast: { type: 'success' | 'warning' | 'error'; title: string; message?: string }) => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({ onNotify }) => {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState(todayStr);

  // Modal Novo Agendamento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formResourceId, setFormResourceId] = useState('');
  const [formDate, setFormDate] = useState(todayStr);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formNotes, setFormNotes] = useState('');
  const [formSendWhatsApp, setFormSendWhatsApp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAppointments(filterDate);
      setAppointments(data.appointments);
      setServices(data.services);
      setResources(data.resources);

      if (data.services.length > 0 && !formServiceId) {
        setFormServiceId(data.services[0].id);
      }
      if (data.resources.length > 0 && !formResourceId) {
        setFormResourceId(data.resources[0].id);
      }
    } catch (err) {
      console.error('Falha ao carregar agendamentos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterDate]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Preencha o nome e o WhatsApp do paciente');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createAppointment({
        contactName: formName,
        contactPhone: formPhone,
        serviceId: formServiceId,
        resourceId: formResourceId,
        date: formDate,
        startTime: formStartTime,
        notes: formNotes,
        sendWhatsAppConfirmation: formSendWhatsApp,
      });

      setIsModalOpen(false);
      setFormName('');
      setFormPhone('');
      setFormNotes('');
      await loadData();

      onNotify({
        type: 'success',
        title: 'Agendamento confirmado!',
        message: formSendWhatsApp ? 'Mensagem de confirmação enviada pelo WhatsApp.' : undefined,
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Não foi possível agendar',
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.updateAppointmentStatus(id, status);
      await loadData();
      onNotify({
        type: 'success',
        title: 'Status atualizado com sucesso',
      });
    } catch (err: any) {
      onNotify({
        type: 'error',
        title: 'Falha ao atualizar',
        message: err.message,
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Topo com filtro de data e botão Novo Agendamento */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#0C2A4A] font-['Poppins']">Agenda Odontológica Delivale</h2>
          <p className="text-xs text-slate-500">Gestão de horários e confirmações automáticas</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs">
            <CalendarIcon className="w-4 h-4 text-[#FF7A00]" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#0C2A4A] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Grid de Serviços Disponíveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {services.map((srv) => (
          <div key={srv.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-bold text-[#0C2A4A]">{srv.name}</h4>
              <span className="text-xs font-black text-emerald-600">
                {srv.price > 0 ? `R$ ${srv.price.toFixed(2)}` : 'Gratuito'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">{srv.description}</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3 text-[#FF7A00]" />
              {srv.durationMinutes} minutos
            </span>
          </div>
        ))}
      </div>

      {/* Tabela de Consultas do Dia */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Consultas do Dia ({appointments.length})
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Horário</th>
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">Procedimento</th>
                <th className="py-3 px-4">Especialista</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading && appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF7A00]" />
                    Carregando agenda...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Nenhum agendamento marcado para esta data. Clique em &quot;Novo Agendamento&quot; acima.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => {
                  const isConfirmed = appt.status === 'confirmed';
                  const isCompleted = appt.status === 'completed';
                  const isCancelled = appt.status === 'cancelled';

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#0C2A4A] whitespace-nowrap">
                        {appt.startTime} - {appt.endTime}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0C2A4A]">{appt.contactName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{appt.contactPhone}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{appt.serviceName}</td>
                      <td className="py-3 px-4 text-slate-600">{appt.resourceName}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isCompleted
                              ? 'bg-blue-100 text-blue-800'
                              : isConfirmed
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCancelled
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {appt.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {appt.status !== 'confirmed' && appt.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(appt.id, 'confirmed')}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                            >
                              Confirmar
                            </button>
                          )}
                          {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(appt.id, 'completed')}
                              className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                            >
                              Concluir
                            </button>
                          )}
                          {appt.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(appt.id, 'cancelled')}
                              className="px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 relative">
            <h3 className="text-base font-bold text-[#0C2A4A] mb-4 font-['Poppins']">Agendar Nova Consulta</h3>

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Paciente:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Maria Eduarda"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">WhatsApp:</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: 5511999998888"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Procedimento:</label>
                  <select
                    value={formServiceId}
                    onChange={(e) => setFormServiceId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.durationMinutes}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Especialista:</label>
                  <select
                    value={formResourceId}
                    onChange={(e) => setFormResourceId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                  >
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Data:</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Horário de Início:</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observações (opcional):</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Informações adicionais do paciente..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-[#0C2A4A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formSendWhatsApp}
                    onChange={(e) => setFormSendWhatsApp(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Enviar confirmação automática com horário para o WhatsApp</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
