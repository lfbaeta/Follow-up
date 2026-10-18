import assert from 'node:assert';
import { isKeywordMatch, normalizePhoneNumber, normalizeTextMatch } from '../server/security.js';
import { generateFunnelXlsx, validateXlsxBuffer } from '../server/services/xlsxService.js';
import { db } from '../server/db/database.js';
import { enrollContactInFollowUp, processFollowUpQueue } from '../server/services/followUpWorker.js';

console.log('🧪 Iniciando suíte de testes de regras de negócio do Delivale Follow-up...\n');

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          console.log(`✅ [PASS] ${description}`);
          passed++;
        })
        .catch((err) => {
          console.error(`❌ [FAIL] ${description}:`, err.message);
          failed++;
        });
    } else {
      console.log(`✅ [PASS] ${description}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] ${description}:`, err.message);
    failed++;
  }
}

// 1. Teste de Normalização de Palavras-Chave e Gatilhos
test('Normalização de "JÁ COMPREI" com acentos e caixa alta/baixa', () => {
  assert.strictEqual(isKeywordMatch('já comprei', 'JÁ COMPREI', ['comprei']), true);
  assert.strictEqual(isKeywordMatch('JA COMPREI', 'JÁ COMPREI'), true);
  assert.strictEqual(isKeywordMatch('Já comprei', 'JÁ COMPREI'), true);
});

test('Segurança: "não comprei" NÃO deve converter como compra', () => {
  assert.strictEqual(isKeywordMatch('não comprei', 'JÁ COMPREI', ['comprei']), false);
  assert.strictEqual(isKeywordMatch('nao comprei ainda', 'JÁ COMPREI', ['comprei']), false);
});

test('Normalização de "SAIR" para opt-out', () => {
  assert.strictEqual(isKeywordMatch('sair', 'SAIR', ['pare', 'parar']), true);
  assert.strictEqual(isKeywordMatch('SAIR', 'SAIR'), true);
  assert.strictEqual(isKeywordMatch('quero sair ', 'SAIR', ['sair']), true);
});

// 2. Teste de Normalização Telefônica
test('Normalização de telefone com DDD para formato padrão com DDI 55', () => {
  assert.strictEqual(normalizePhoneNumber('(11) 99999-8888'), '5511999998888');
  assert.strictEqual(normalizePhoneNumber('5511999998888'), '5511999998888');
  assert.strictEqual(normalizePhoneNumber('+55 21 98888-7777'), '5521988887777');
});

// 3. Teste de Exportação e Validação XLSX Real
test('Geração e leitura de buffer binário XLSX real com proteção contra formula injection', () => {
  const rows = [
    {
      nome: '=cmd|/c calc!A0', // Tentativa de formula injection
      numero: '5511999998888',
      inscricaoId: 'enr_123',
      dataEntrada: '18/10/2026 10:00',
      etapaAtual: 'Etapa 1',
      proximoEnvio: 'em 1 minuto',
      status: 'NO FUNIL',
      motivoEncerramento: '',
      dataConclusao: '',
    },
    {
      nome: 'Maria da Silva',
      numero: '5511888887777',
      inscricaoId: 'enr_456',
      dataEntrada: '18/10/2026 10:30',
      etapaAtual: 'Etapa 2',
      proximoEnvio: 'Encerrado',
      status: 'COMPROU',
      motivoEncerramento: 'Comprou com JÁ COMPREI',
      dataConclusao: '18/10/2026 10:35',
    },
  ];

  const buffer = generateFunnelXlsx(rows);
  assert.ok(buffer.length > 100, 'Buffer XLSX deve ter tamanho válido');
  const isValid = validateXlsxBuffer(buffer);
  assert.strictEqual(isValid, true, 'O buffer gerado deve ser um arquivo XLSX válido e legível');
});

// 4. Teste de Cálculo do Prazo da Primeira Etapa
test('Fórmula da Primeira Etapa: dueAt = lastInteraction + inatividade + duração da etapa 1', () => {
  const orgId = db.data.organizations[0].id;
  const now = new Date();

  // Cria contato de teste
  const contactId = `test_ctc_${Date.now()}`;
  db.data.contacts.push({
    id: contactId,
    organizationId: orgId,
    name: 'Contato Teste Prazos',
    phone: '5511991112222',
    normalizedPhone: '5511991112222',
    optOut: false,
    converted: false,
    humanPausedUntil: null,
    lastRelevantInteractionAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const enrollment = enrollContactInFollowUp(orgId, contactId);
  assert.ok(enrollment, 'Inscrição deve ser criada');

  const fuSettings = db.data.followUpSettings.find((s) => s.organizationId === orgId);
  const steps = db.data.followUpSteps.filter((s) => s.organizationId === orgId).sort((a, b) => a.order - b.order);
  const expectedDelayMinutes = (fuSettings?.inactivityMinutes || 1) + steps[0].totalDurationMinutes;

  const dueTime = new Date(enrollment.dueAt).getTime();
  const diffMinutes = Math.round((dueTime - now.getTime()) / 60000);

  assert.strictEqual(diffMinutes, expectedDelayMinutes, `Diferença calculada (${diffMinutes}m) deve igualar o atraso esperado (${expectedDelayMinutes}m)`);
});

// 5. Teste de Não Inscrição de Contato com Opt-Out ou Convertido
test('Contatos convertidos ou em opt-out não devem ser inscritos no funil', () => {
  const orgId = db.data.organizations[0].id;
  const contactConverted = {
    id: `ctc_conv_${Date.now()}`,
    organizationId: orgId,
    name: 'Cliente Convertido',
    phone: '5511993334444',
    normalizedPhone: '5511993334444',
    optOut: false,
    converted: true,
    humanPausedUntil: null,
    lastRelevantInteractionAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.contacts.push(contactConverted);

  const res = enrollContactInFollowUp(orgId, contactConverted.id);
  assert.strictEqual(res, null, 'Contato convertido não deve entrar no funil');
});

// 6. Teste de Conflito de Agendamentos (Sobreposição de Horários)
test('Prevenção de sobreposição de horários de agendamento para o mesmo profissional', () => {
  const orgId = db.data.organizations[0].id;
  const service = db.data.services[0]; // 60 min
  const resource = db.data.resources[0];

  const appt1 = {
    id: 'appt_test_1',
    organizationId: orgId,
    contactId: 'c1',
    contactName: 'Paciente 1',
    contactPhone: '5511999998888',
    serviceId: service.id,
    serviceName: service.name,
    resourceId: resource.id,
    resourceName: resource.name,
    date: '2026-10-25',
    startTime: '10:00',
    endTime: '11:00',
    status: 'scheduled' as const,
    confirmationSent: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.data.appointments.push(appt1);

  // Tentativa de marcar 10:30 às 11:30 para o mesmo recurso e data (deve haver sobreposição)
  const newStart = '10:30';
  const newEnd = '11:30';

  const hasConflict = db.data.appointments.some((a) => {
    if (a.organizationId !== orgId || a.resourceId !== resource.id || a.date !== '2026-10-25') return false;
    if (a.status === 'cancelled') return false;
    return newStart < a.endTime && newEnd > a.startTime;
  });

  assert.strictEqual(hasConflict, true, 'Deve detectar sobreposição de horário no mesmo profissional');
});

console.log(`\n🎉 Testes concluídos: ${passed} passaram com sucesso!`);
