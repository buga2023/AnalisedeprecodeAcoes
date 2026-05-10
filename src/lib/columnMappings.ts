import type { CSVRow } from '@/types/stock';

const COLUMN_ALIASES: Record<keyof CSVRow, string[]> = {
  ticker: [
    'ticker', 'ativo', 'papel', 'codigo', 'código', 'ação', 'acao',
    'symbol', 'stock', 'sigla', 'cod', 'instrumento', 'produto',
    'ativo/produto', 'código do ativo'
  ],
  avgCost: [
    'preço médio', 'preco medio', 'pm', 'custo médio', 'custo medio',
    'preço de custo', 'preco de custo', 'custo', 'preço médio de compra',
    'preco medio de compra', 'valor médio', 'valor medio', 'preço unitário',
    'preco unitario', 'pu', 'preço de aquisição', 'preco de aquisicao',
    'avg cost', 'average cost', 'avg price'
  ],
  quantity: [
    'quantidade', 'qtd', 'qtde', 'quant', 'qty', 'cotas',
    'quantidade de cotas', 'quantidade de ações', 'quantidade de acoes',
    'posição', 'posicao', 'saldo', 'shares'
  ],
  dpa: [
    'dpa', 'dividendo por ação', 'dividendo por acao', 'dividendos',
    'div por ação', 'div/ação', 'dividendo anual', 'proventos por ação',
    'proventos por acao', 'rendimento por cota', 'dividends per share'
  ],
  eps: [
    'lpa', 'eps', 'lucro por ação', 'lucro por acao', 'lucro/ação',
    'earnings per share', 'resultado por ação', 'resultado por acao'
  ],
  bvps: [
    'vpa', 'bvps', 'valor patrimonial por ação', 'valor patrimonial por acao',
    'valor patrimonial', 'patrimônio por ação', 'patrimonio por acao',
    'book value per share', 'book value', 'vp por ação'
  ]
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function detectColumns(headers: string[]) {
  const mapping: Partial<Record<keyof CSVRow, number>> = {};
  const unmatched: string[] = [];
  const normalizedHeaders = headers.map(normalizeString);

  const internalFields = Object.keys(COLUMN_ALIASES) as (keyof CSVRow)[];

  normalizedHeaders.forEach((header, index) => {
    let matched = false;
    for (const field of internalFields) {
      const aliases = COLUMN_ALIASES[field].map(normalizeString);
      if (aliases.includes(header)) {
        // Se ja tiver um mapping, priorizamos o primeiro match exato
        if (mapping[field] === undefined) {
          mapping[field] = index;
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      unmatched.push(headers[index]);
    }
  });

  const missing: string[] = [];
  if (mapping.ticker === undefined) missing.push('Ticker');
  if (mapping.avgCost === undefined) missing.push('Preço Médio');

  return { mapping, unmatched, missing };
}
