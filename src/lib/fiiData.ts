/**
 * Cliente do endpoint /api/fii-data — vacância e DY (%) de FIIs via scraping.
 * Cache localStorage 7d por ticker. Falha → objeto vazio (degradação graciosa).
 */
export interface FIIData {
  vacancyRate?: number;
  /** DY em % (ex.: 9.8) extraído por scraping. */
  dividendYield?: number;
  fonte?: string;
}

const CACHE_PREFIX = "praxia-fii-data:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry { data: FIIData; cachedAt: number }

function readCache(ticker: string): FIIData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + ticker.toUpperCase());
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt > TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, data: FIIData): void {
  try {
    localStorage.setItem(CACHE_PREFIX + ticker.toUpperCase(), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    /* quota cheia — ignorar */
  }
}

export async function fetchFIIData(ticker: string): Promise<FIIData> {
  const cached = readCache(ticker);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/fii-data?ticker=${encodeURIComponent(ticker.toUpperCase())}`);
    if (!res.ok) return {};
    const data = (await res.json()) as FIIData;
    const clean: FIIData = {
      vacancyRate: typeof data.vacancyRate === "number" ? data.vacancyRate : undefined,
      dividendYield: typeof data.dividendYield === "number" ? data.dividendYield : undefined,
      fonte: data.fonte,
    };
    writeCache(ticker, clean);
    return clean;
  } catch {
    return {};
  }
}
