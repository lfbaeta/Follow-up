# Delivale Follow-up — Sistema de Atendimento com IA & Follow-up WhatsApp

Sistema corporativo de automação de follow-up, atendimento inteligente com inteligência artificial (Gemini/OpenAI), gestão de funil de leads e agendamentos odontológicos e de saúde.

---

## 🚀 1. Funcionalidades Principais

- **Esteira de Follow-up com Gatilho de Inatividade**:
  - Modo **Texto Fixo** (conteúdo idêntico) ou **Com IA** (reformulação inédita e humanizada preservando condições e benefícios).
  - Prazos com cálculo de dias, horas e minutos com modal interativo de relógio.
  - Suporte a anexo de mídias (imagens e documentos PDF) com limite de até 10MB.
- **Classificação e Gatilhos de Saída**:
  - Palavra-chave **JÁ COMPREI** (conversão imediata e encerramento de follow-up).
  - Palavra-chave **SAIR** (opt-out imediato com rodapé determinístico anti-bloqueio).
  - Tratamento estrito de negações (*"não comprei"* não converte).
  - Em conflito entre saída e conversão, a saída sempre prevalece.
- **Funil de Clientes & Indicadores (KPIs)**:
  - Total no Funil, Convertidos, Opt-out e Finalizados sem ação com percentuais calculados sobre o total real de inscrições.
  - Filtro por data e busca por nome ou número.
  - **Exportação real em planilha Excel `.xlsx`** com sanitização anti-formula injection.
- **Atendimento Automatizado com IA**:
  - Integração com `@google/genai` (modelo `gemini-3.8-flash` ou configurável).
  - Agrupamento de mensagens consecutivas do cliente em janela configurável (padrão 4s).
  - Pausa humana automática de 24h quando o atendente responde no WhatsApp.
- **Módulo de Agendamentos Próprio**:
  - Cadastro de serviços, duração e profissionais.
  - Prevenção transacional contra sobreposição de horários.
  - Disparo opcional de mensagem de confirmação formatada para o WhatsApp do paciente.
- **Simulador WhatsApp Web Integrado**:
  - Teste na tela sem necessidade imediata de chip físico.

---

## 🛠️ 2. Instalação e Execução Local

### Pré-requisitos
- Node.js 20+ ou 22+
- npm ou yarn

### Passos de Instalação
```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Iniciar o servidor full-stack em desenvolvimento (porta 3000)
npm run dev
```

Abra seu navegador em: `http://localhost:3000`

---

## 🔐 3. Credenciais Padrão do Administrador

- **E-mail:** `admin@delivale.com`
- **Senha Inicial:** `Admin@Delivale2026!`

A senha é armazenada com hash seguro Scrypt + salt aleatório e pode ser alterada.

---

## 🐳 4. Produção com Docker Compose & PostgreSQL

Para rodar em VPS com banco de dados PostgreSQL persistente:

```bash
docker-compose up -d --build
```

O compose inicializa automaticamente:
- Banco de dados PostgreSQL 16 com volume persistente `postgres_data` e migrations automáticas (`server/db/migrations/001_initial_schema.sql`).
- Aplicação full-stack e worker de segundo plano na porta 3000.
- Volume persistente para uploads de mídias (`app_uploads`) e dados locais (`app_data`).

---

## 📱 5. Configuração da Evolution API

1. No menu superior, selecione a tela **Conexão WhatsApp**.
2. Preencha os campos:
   - **Nome da Instância:** ex: `delivale_bot`
   - **URL do Servidor Evolution API:** ex: `https://evolution.seuservidor.com`
   - **API Key:** chave global ou da instância
3. Clique em **Conectar Agora**.
4. Escaneie o QR Code que surgirá na tela pelo seu aplicativo do WhatsApp.
5. No painel da sua Evolution API, configure o Webhook para apontar para:
   ```
   https://seu-dominio.com/api/webhooks/evolution
   ```
   Com os eventos: `MESSAGES_UPSERT` e `CONNECTION_UPDATE`.

---

## 🧪 6. Execução da Suíte de Testes Automatizados

O projeto possui suíte de testes unitários e de integração de regras de negócio:

```bash
npx tsx test/runTests.ts
```

Testes cobertos:
- Normalização de "JÁ COMPREI" e "SAIR".
- Bloqueio de falso positivo para "não comprei".
- Normalização de números de telefone com DDI 55.
- Geração e integridade do arquivo binário `.xlsx`.
- Fórmula da primeira etapa (`dueAt = lastInteraction + inatividade + duração da etapa 1`).
- Cancelamento de inscrição em caso de conversão ou opt-out.
- Prevenção de conflito de agenda no mesmo horário.
