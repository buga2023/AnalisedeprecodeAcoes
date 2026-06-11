import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  sheetName?: string;
  totalRows: number;
}

/**
 * Limite de tamanho de planilha (5 MB). O `xlsx` instalado é o 0.20.3
 * (vendorizado em `vendor/xlsx-0.20.3.tgz`, tarball oficial do SheetJS),
 * que já corrige os CVEs do 0.18.5 (Prototype Pollution GHSA-4r6h-8v6p-xvw6
 * + ReDoS GHSA-5pgg-2g8v-p4x9). O limite e as defesas abaixo permanecem como
 * defesa em profundidade — carteira real cabe folgado em 5 MB.
 */
const MAX_SHEET_BYTES = 5 * 1024 * 1024;

/**
 * Header keys que nunca podem ir pro objeto-resultado — atacante pode injetar
 * essas chaves via planilha maliciosa para poluir Object.prototype.
 */
const FORBIDDEN_HEADER_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isHeaderSafe(h: string): boolean {
  return h.length > 0 && !FORBIDDEN_HEADER_KEYS.has(h);
}

export async function parseSheet(file: File): Promise<ParsedSheet> {
  if (file.size > MAX_SHEET_BYTES) {
    throw new Error(`Planilha grande demais (limite ${MAX_SHEET_BYTES / (1024 * 1024)} MB).`);
  }
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  } else {
    throw new Error('Formato de arquivo nao suportado. Use .csv, .xlsx ou .xls');
  }
}

async function parseCSV(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = (results.meta.fields || []).filter(isHeaderSafe);
        const rowsAll = results.data as Record<string, string>[];

        // Limpeza básica + remove chaves bloqueadas (prototype pollution defense).
        const cleanRows = rowsAll
          .map(row => {
            const clean: Record<string, string> = Object.create(null);
            for (const h of headers) {
              if (h in row) clean[h] = row[h];
            }
            return clean;
          })
          .filter(row => {
            const values = Object.values(row).join('').trim();
            return values.length > 0 && !values.toLowerCase().includes('total');
          });

        resolve({
          headers,
          rows: cleanRows,
          totalRows: cleanRows.length
        });
      },
      error: (error) => reject(error)
    });
  });
}

async function parseExcel(file: File): Promise<ParsedSheet> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  
  // Detectar melhor aba
  let sheetName = workbook.SheetNames[0];
  const priorityNames = ['carteira', 'posicao', 'ativos', 'extrato', 'stocks', 'portfolio'];
  
  for (const name of workbook.SheetNames) {
    if (priorityNames.some(p => name.toLowerCase().includes(p))) {
      sheetName = name;
      break;
    }
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  if (jsonData.length === 0) {
    throw new Error('A planilha esta vazia.');
  }

  // Encontrar a linha do cabeçalho (pode haver lixo no topo)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i];
    if (row.length > 1 && row.some(cell => typeof cell === 'string' && cell.length > 2)) {
      headerIndex = i;
      break;
    }
  }

  const headers = jsonData[headerIndex].map(h => String(h || '').trim());
  const rowsRaw = jsonData.slice(headerIndex + 1);

  const rows: Record<string, string>[] = rowsRaw
    .filter(row => row.length > 0 && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
    .map(row => {
      // Object.create(null) impede prototype pollution caso `headers` ainda
      // escape a sanitização — chaves bizarras ficam isoladas do prototype.
      const obj: Record<string, string> = Object.create(null);
      headers.forEach((header, index) => {
        if (isHeaderSafe(header)) {
          obj[header] = String(row[index] ?? '').trim();
        }
      });
      return obj;
    })
    // Ignorar linhas de total
    .filter(row => {
      const allText = Object.values(row).join(' ').toLowerCase();
      return !allText.includes('total') && !allText.includes('subtotal') && !allText.startsWith('---');
    });

  return {
    headers,
    rows,
    sheetName,
    totalRows: rows.length
  };
}

export function normalizeTicker(ticker: string): string {
  if (!ticker) return '';
  let clean = ticker.toUpperCase().trim();
  // Remover espaços extras e sufixo F (fracionário)
  clean = clean.replace(/\s+/g, '');
  if (clean.endsWith('F') && clean.length > 4) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

export function parseBRNumber(value: string): number | null {
  if (!value) return null;
  // Limpar simbolos monetarios e espaços
  let clean = value.replace(/[R$\s]/g, '');
  
  // Se tiver ponto e virgula (1.234,56), remover ponto e trocar virgula por ponto
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    // Se so tiver virgula (38,50), trocar por ponto
    clean = clean.replace(',', '.');
  }
  
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}
