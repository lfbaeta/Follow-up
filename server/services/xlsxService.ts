import * as XLSX from 'xlsx';

export interface FunnelExportRow {
  nome: string;
  numero: string;
  inscricaoId: string;
  dataEntrada: string;
  etapaAtual: string;
  proximoEnvio: string;
  status: string;
  motivoEncerramento: string;
  dataConclusao: string;
}

/**
 * Previne formula injection em planilhas para dados vindos de usuários
 */
function sanitizeFormulaInjection(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Gera um buffer binário XLSX real a partir das linhas fornecidas
 */
export function generateFunnelXlsx(rows: FunnelExportRow[]): Buffer {
  const sanitizedData = rows.map((r) => ({
    'Nome do Cliente': sanitizeFormulaInjection(r.nome),
    'Número WhatsApp': sanitizeFormulaInjection(r.numero),
    'ID Inscrição': sanitizeFormulaInjection(r.inscricaoId),
    'Data de Entrada': sanitizeFormulaInjection(r.dataEntrada),
    'Etapa no Funil': sanitizeFormulaInjection(r.etapaAtual),
    'Próximo Disparo': sanitizeFormulaInjection(r.proximoEnvio),
    'Status Comercial': sanitizeFormulaInjection(r.status),
    'Motivo Encerramento': sanitizeFormulaInjection(r.motivoEncerramento),
    'Data de Conclusão': sanitizeFormulaInjection(r.dataConclusao),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sanitizedData);

  // Formatação de largura de colunas para leitura confortável
  worksheet['!cols'] = [
    { wch: 24 }, // Nome
    { wch: 18 }, // Telefone
    { wch: 16 }, // ID
    { wch: 20 }, // Data Entrada
    { wch: 14 }, // Etapa
    { wch: 20 }, // Próximo Envio
    { wch: 16 }, // Status
    { wch: 28 }, // Motivo
    { wch: 20 }, // Data Conclusão
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Funil de Contatos');

  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return xlsxBuffer;
}

/**
 * Valida se um buffer binário é um arquivo XLSX íntegro e legível
 */
export function validateXlsxBuffer(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    return wb.SheetNames && wb.SheetNames.length > 0;
  } catch {
    return false;
  }
}
