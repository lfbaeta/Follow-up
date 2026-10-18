# Delivale Follow-up — Migração multiempresa segura

Status: especificação para implementação. **Não executar migração nem habilitar produção sem testes.**

## Objetivo
Várias empresas independentes, cada qual com suas instâncias Evolution API, clientes, campanhas, configurações, agendas, logs e arquivos. Administrador geral Delivale pode alternar entre empresas pelo rodapé; usuários comuns somente sua empresa.

## Achados confirmados no código (main em 2026-10-18)
- `src/components/Footer.tsx`: "Conta Selecionada: Padrão (Delivale Admin)" é texto fixo; não há seletor.
- `src/App.tsx`: não acompanha organização ativa nem recupera sessão de verdade.
- `server/routes/auth.ts`: `requireAuth` usa o primeiro usuário como fallback para token inexistente/inválido; risco crítico de acesso indevido.
- `server/routes/settings.ts`: GET busca registros da organização OU índice [0] de outra, causando vazamento entre empresas.
- `server/routes/whatsapp.ts`: GET status também faz fallback para conexão [0]; formato permite só primeira conexão.
- `server/db/database.ts`: seed odontológico, usuário admin e senha previsíveis no código; `DATABASE_URL` não significa que os dados do aplicativo estejam persistidos no PostgreSQL (o código ainda utiliza arquivo JSON).
- `server/db/migrations/001_initial_schema.sql`: possui organizations/users e organization_id, mas `whatsapp_connections` precisa suportar várias instâncias por organização.

## Regras obrigatórias
1. Bloquear requisições com sessão ausente, inválida ou expirada (401). Não utilizar usuário padrão/fallback. Nunca escolher organização pelo ID fornecido por cliente sem validação de permissão.
2. Criar função de contexto de organização autenticada: usuário comum só sua organização; superadmin pode selecionar organização pela rota autenticada, com verificação e auditoria. Papéis claros: superadmin/admin/membro.
3. CRUD de empresas restrito a superadmin, com nome, slug, ativo e limites de instâncias configuráveis; IDs únicos robustos e exclusão segura.
4. Rodapé: botão "Selecionar empresa", modal com pesquisa e empresas autorizadas, identificação da empresa ativa. Ao trocar, invalidar caches, cancelar requisições antigas ou descartar suas respostas e recarregar todas as telas no novo contexto.
5. CRUD de conexões: listar/adicionar/configurar/conectar/desconectar/excluir instância por empresa; instância com ID e nome próprios, verificar propriedade em toda operação; impedir colisão de `instance_name` no servidor Evolution; limitar por empresa.
6. Todas as rotas devem filtrar pelo contexto autorizado e conferir vínculo de cada ID antes de ler/mutar. **Proibido** `|| data.array[0]` como fallback de empresa.
7. Serviço Evolution, worker, mensagens e webhooks devem identificar `organizationId` **e** `connectionId`, inclusive ao receber webhook; validar autenticação de webhook, deduplicação e impedir disparos cruzados.
8. Criar configurações padrão neutras por empresa sem odontologia, sem copiar chaves ou dados de outras empresas.
9. Segredos: remover credenciais hardcoded do seed e chave fixa de criptografia; variáveis obrigatórias com falha segura e processo de rotação.
10. Revisar persistência real PostgreSQL/JSON, cópia de segurança, migração idempotente e retorno; uploads segregados e protegidos por organização.
11. Nunca permitir que empresas vejam logs, contatos, campanhas, prompts, agendas, QR codes, credenciais ou mídias alheias.
12. Testar lógica das múltiplas instâncias com isolamento da campanha e status para cada uma, e concorrência do worker.

## Critérios de aceite
- Superadmin troca A/B no rodapé e vê somente dados daquela empresa; troca refletida em todas as telas, sem flashes de dados antigos.
- Usuário A recebe 403 ao tentar ler/alterar dados da empresa B por ID, URL ou header.
- Sem token ou com token expirado/inválido => 401; não há fallback.
- Empresa A tem instâncias A1/A2; B tem B1/B2. Qualquer ação sobre A1/A2 não altera B1/B2.
- Webhook de A1 registra conversa em A, nunca em B, mesmo se telefone coincidir.
- Worker nunca envia mensagem de A usando instância B. Testes cobrem reinício, simultaneidade, idempotência e logs.
- Uma empresa nova começa com dados vazios e configurações genéricas próprias; nenhuma semente odontológica.
- Testes automatizados passam, backup e rollback demonstrados em ambiente de homologação.

## Ordem de implementação
**Fase 1:** fechar bypass da autenticação e eliminar todos os fallbacks de organização, testes de segregação, e tornar credenciais seguras.

**Fase 2:** organização autenticada e papel superadmin, endpoints de empresas, contexto de seleção, botão no rodapé e atualização integral das telas.

**Fase 3:** coleção de instâncias por empresa (backend, frontend, Evolution API e callbacks/webhooks/worker).

**Fase 4:** migração de dados e banco, testes E2E e implantação gradativa com backup.

Não publicar o seletor isoladamente: aparência multiempresa sem isolamento real aumenta risco de exposição de dados.
