import type { Stock } from "@/types/stock";

export interface SectorSlice {
  label: string;
  pct: number;
  value: number;
  color: string;
}

const SECTOR_COLORS: Record<string, string> = {
  Tech: "#5b7cff",
  Semicondutores: "#a78bfa",
  Bancos: "#42e8a3",
  Energia: "#ffc857",
  Mineração: "#ff8a4d",
  Industrial: "#7dd3fc",
  Varejo: "#f472b6",
  Saúde: "#34d399",
  Seguros: "#fbbf24",
  Streaming: "#fb7185",
  Auto: "#f87171",
  "Papel & Celulose": "#a3a3a3",
  Locação: "#c084fc",
};

/** Total invested value at current prices. */
export function totalPortfolioValue(stocks: Stock[]): number {
  return stocks.reduce((acc, s) => acc + (s.quantity || 0) * s.price, 0);
}

/** Total cost basis. */
export function totalCostBasis(stocks: Stock[]): number {
  return stocks.reduce((acc, s) => acc + (s.cost || 0) * (s.quantity || 0), 0);
}

/** Today's variation in BRL (sum across positions). */
export function todayChangeValue(stocks: Stock[]): number {
  return stocks.reduce((acc, s) => acc + (s.quantity || 0) * s.change, 0);
}

/** Sector allocation as percentages of the total invested value. */
export function sectorAllocation(stocks: Stock[]): SectorSlice[] {
  const total = totalPortfolioValue(stocks);
  if (total === 0) return [];
  const byLabel = new Map<string, number>();
  for (const s of stocks) {
    const v = (s.quantity || 0) * s.price;
    if (v <= 0) continue;
    const label = s.sector && s.sector !== "—" ? s.sector : "Outros";
    byLabel.set(label, (byLabel.get(label) ?? 0) + v);
  }
  const entries = Array.from(byLabel.entries())
    .map(([label, value]) => ({
      label,
      value,
      pct: (value / total) * 100,
      color: SECTOR_COLORS[label] ?? "rgba(255,255,255,0.3)",
    }))
    .sort((a, b) => b.value - a.value);

  // Group small slices under "Outros"
  const big = entries.filter((e) => e.pct >= 4);
  const small = entries.filter((e) => e.pct < 4);
  if (small.length > 0) {
    const otherValue = small.reduce((acc, e) => acc + e.value, 0);
    big.push({
      label: "Outros",
      value: otherValue,
      pct: (otherValue / total) * 100,
      color: "rgba(255,255,255,0.3)",
    });
  }
  return big;
}

/** Sector currently overweight (>30% by default), if any. */
export function dominantSector(stocks: Stock[], thresholdPct = 30): SectorSlice | null {
  const slices = sectorAllocation(stocks);
  return slices.find((s) => s.pct >= thresholdPct) ?? null;
}
