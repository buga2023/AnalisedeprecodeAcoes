import type { MarketType } from '@/types/stock';

const SECTOR_HINTS: Record<string, string> = {
  PETR: 'Energia',
  VALE: 'Mineração',
  ITUB: 'Bancos',
  BBDC: 'Bancos',
  BBAS: 'Bancos',
  SANB: 'Bancos',
  WEGE: 'Industrial',
  MGLU: 'Varejo',
  BBSE: 'Seguros',
  TAEE: 'Energia',
  ELET: 'Energia',
  CSAN: 'Energia',
  SUZB: 'Papel & Celulose',
  KLBN: 'Papel & Celulose',
  RENT: 'Locação',
  RDOR: 'Saúde',
  HAPV: 'Saúde',
  EQTL: 'Energia',
  PRIO: 'Energia',
  RAIZ: 'Energia',
  RADL: 'Varejo',
  LREN: 'Varejo',
  AAPL: 'Tech',
  MSFT: 'Tech',
  GOOGL: 'Tech',
  AMZN: 'Tech',
  META: 'Tech',
  NVDA: 'Semicondutores',
  TSLA: 'Auto',
  NFLX: 'Streaming',
};

const BRAND_COLORS: Record<string, string> = {
  PETR: '#1a8754',
  VALE: '#c89e5d',
  ITUB: '#ff7a00',
  BBDC: '#cc0000',
  BBAS: '#fff200',
  WEGE: '#0a4d8c',
  MGLU: '#0050a0',
  AAPL: '#444444',
  MSFT: '#0078d4',
  GOOGL: '#4285f4',
  AMZN: '#ff9900',
  META: '#1877f2',
  NVDA: '#76b900',
  TSLA: '#cc0000',
  NFLX: '#e50914',
};

/**
 * Detect the listing market from the ticker suffix.
 * B3 tickers end with a digit (3, 4, 5, 6, 11, …). US tickers are letter-only.
 */
export function detectMarket(ticker: string): MarketType {
  const t = ticker.toUpperCase();
  if (/\d$/.test(t)) return 'B3';
  if (/^[A-Z]{1,5}$/.test(t)) return 'NASDAQ';
  return 'OTHER';
}

/** Best-effort sector inference (heuristic; can be replaced by an API later). */
export function detectSector(ticker: string): string {
  const t = ticker.toUpperCase();
  const stem = t.replace(/\d+$/, '').slice(0, 4);
  return SECTOR_HINTS[stem] ?? SECTOR_HINTS[t] ?? '—';
}

/** Branded avatar color, with a deterministic fallback. */
export function brandColor(ticker: string): string {
  const t = ticker.toUpperCase();
  const stem = t.replace(/\d+$/, '').slice(0, 4);
  if (BRAND_COLORS[stem]) return BRAND_COLORS[stem];
  if (BRAND_COLORS[t]) return BRAND_COLORS[t];
  // hash → hue
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  return `hsl(${h}, 56%, 42%)`;
}
