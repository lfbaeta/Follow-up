# DECISÕES DE PRODUTO & ARQUITETURA — DELIVALE FOLLOW-UP

Este documento registra as decisões explícitas de arquitetura e regras de negócio adotadas na versão online do Delivale Follow-up.

---

### 1. Organização e Multi-tenancy Inicial
- **Decisão:** Construído inicialmente com suporte à organização Delivale (`org_delivale_default`) e entidade `Organization` em todos os registros.
- **Racional:** A estrutura de dados já está preparada com `organizationId` em todas as tabelas. Toda a autorização do servidor obtém o `organizationId` a partir da sessão validada, nunca confiando no cliente. Não foram anunciados planos comerciais ou faturamento multi-tenant pois não faziam parte do escopo inicial.

---

### 2. Integração WhatsApp via Evolution API
- **Decisão:** Adoção da Evolution API como adaptador padrão de WhatsApp.
- **Racional:** Trata-se da solução de API de WhatsApp self-hosted mais estável e difundida. O código foi encapsulado no `EvolutionService`, permitindo alternar ou plugar outros provedores no futuro sem alterar as regras de negócio de follow-up.
- **Modo Simulado:** Quando não há servidor remoto configurado, o sistema opera em modo de simulação local sem quebrar nenhuma tela ou fluxo.

---

### 3. Integração de IA com Google GenAI (Gemini)
- **Decisão:** Uso do SDK oficial moderno `@google/genai` com o modelo `gemini-3.8-flash`.
- **Racional:** Atende com extrema velocidade, inteligência de conversação e baixo consumo tanto para atendimento em tempo real quanto para o modo de follow-up "Com IA".
- **Comportamento no modo "Com IA":** A IA recebe as regras comerciais originais da mensagem (ex: cupons, percentual de desconto, prazos) e atua apenas reescrevendo a abordagem inicial para torná-la única e humanizada, impedindo a invenção de promoções inexistentes.

---

### 4. Fórmula Precisa de Cálculo dos Prazos
- **Primeira etapa:**
  $$\text{dueAt} = \text{lastRelevantInteractionAt} + \text{inactivityMinutes} + \text{step}_1.\text{totalDurationMinutes}$$
- **Etapas subsequentes:**
  $$\text{dueAt} = \text{instante de envio confirmado da etapa anterior} + \text{step}_{N+1}.\text{totalDurationMinutes}$$
- **Racional:** Garante que a primeira etapa aguarde a inatividade antes de começar, e que os passos seguintes respeitem a cadência relativa entre mensagens.

---

### 5. Comportamento ao Receber Nova Interação do Contato
- Quando o contato responde normalmente durante uma esteira em andamento, a tarefa pendente é cancelada e a inatividade geral é reiniciada. Se o contato voltar a ficar em silêncio após o atendimento, uma nova esteira pode ser avaliada respeitando o cooldown configurado (padrão 24h).

---

### 6. Intervenção Humana do Atendente
- **Decisão:** Quando uma mensagem é enviada pelo atendente humano no WhatsApp (`fromMe: true`), o sistema ativa uma pausa de segurança de 24 horas (`operatorReactivationHours`) para aquele contato, suspendendo respostas da IA e mensagens de follow-up automáticas para não atrapalhar o atendimento manual.

---

### 7. Prevalência Estrita de Saída (Opt-out)
- Se uma mensagem recebida contiver tanto intenção de saída quanto de compra, a **saída (SAIR) sempre prevalece**, cancelando imediatamente o follow-up e bloqueando novas mensagens automáticas.

---

### 8. Módulo de Agendamentos Próprio
- Como o sistema original do vídeo mencionava agendamentos mas não exibia suas regras internas, foi construída uma agenda odontológica própria com validação transacional que impede sobreposição de horários para o mesmo especialista e dispara confirmações automáticas com data e horário via WhatsApp.
