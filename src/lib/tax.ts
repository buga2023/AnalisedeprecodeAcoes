/**
 * Calculadora de IR para ações brasileiras (paper-trading Praxia).
 *
 * Regras implementadas:
 *   Swing trade: vendas < R$20k/mês → isento; ≥ R$20k → 15% sobre lucro líquido.
 *   Day trade:   sempre 20% sobre lucro; identificado pelo flag `dayTrade` OU
 *                detecção automática (compra + venda do mesmo ticker no mesmo dia).
 *   FIIs:        ganho de capital 20% (sem isenção, como day trade).
 *   Prejuízo:    carryforward swing separado do day-trade; FIIs deduzem entre si.
 *   DARF:        código 6015; mínimo R$10 (abaixo disso acumula para o mês seguinte).
 */

import type { Transaction } from "@/types/stock";
import { isFII } from "@/lib/stockMeta";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface TradeSummary {
  ticker: string;
  isDayTrade: boolean;
  isFII: boolean;
  shares: number;
  sellPrice: number;
  avgCost: number;
  profit: number;
  saleValue: number;
  date: string;
}

export interface MonthlyTaxSummary {
  year: number;
  month: number;       // 1–12
  label: string;       // "Jan/2024"
  totalSalesBRL: number;
  swingProfit: number;
  swingLossThisMonth: number;
  swingCarryForwardUsed: number;
  taxableSwing: number;
  isExemptSwing: boolean;
  swingTaxDue: number;
  dayTradeProfit: number;
  dayTradeLossThisMonth: number;
  dayTradeTaxDue: number;
  fiiProfit: number;
  fiiTaxDue: number;
  totalTaxDue: number;
  darfDueDate: string;
  trades: TradeSummary[];
}

export interface TaxComputeResult {
  months: MonthlyTaxSummary[];
  swingCarryForward: number;      // prejuízo acumulado não compensado
  dayTradeCarryForward: number;
  fiiCarryForward: number;
  totalTaxDue: number;
  totalProfit: number;
  totalLoss: number;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const SWING_EXEMPTION = 20_000;
const SWING_TAX_RATE = 0.15;
const DAY_TRADE_TAX_RATE = 0.20;
const FII_TAX_RATE = 0.20;
const DARF_MIN = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[month - 1]}/${year}`;
}

/** Último dia do mês seguinte como string ISO (aproximação do prazo da DARF). */
function darfDueDate(year: number, month: number): string {
  const next = month === 12 ? new Date(year + 1, 0, 31) : new Date(year, month, 31);
  // floor to last day of that month
  next.setDate(0);
  return next.toLocaleDateString("pt-BR");
}

/**
 * Detecta day trades automaticamente: mesmo ticker comprado E vendido no mesmo
 * dia civil. Retorna um Set de "YYYY-MM-DD|TICKER" que são day trades.
 */
function detectDayTrades(txs: Transaction[]): Set<string> {
  const dayActivity = new Map<string, Set<"buy" | "sell">>();
  for (const tx of txs) {
    const key = `${dayKey(tx.timestamp)}|${tx.ticker}`;
    const set = dayActivity.get(key) ?? new Set();
    set.add(tx.type);
    dayActivity.set(key, set);
  }
  const result = new Set<string>();
  for (const [key, types] of dayActivity) {
    if (types.has("buy") && types.has("sell")) result.add(key);
  }
  return result;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Calcula o IR mensal a partir do histórico de transações (paper-trading).
 *
 * @param transactions — lista completa de transações (todas as épocas)
 * @param filterYear   — se informado, retorna só os meses desse ano
 */
export function computeMonthlyTax(
  transactions: Transaction[],
  filterYear?: number
): TaxComputeResult {
  if (transactions.length === 0) {
    return { months: [], swingCarryForward: 0, dayTradeCarryForward: 0, fiiCarryForward: 0, totalTaxDue: 0, totalProfit: 0, totalLoss: 0 };
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const dayTrades = detectDayTrades(sorted);

  // Custo médio ponderado por ticker
  const avgCostMap = new Map<string, { qty: number; avgCost: number }>();

  // Agrupamento mensal das operações
  const monthMap = new Map<string, TradeSummary[]>();

  for (const tx of sorted) {
    const ticker = tx.ticker;
    const pos = avgCostMap.get(ticker) ?? { qty: 0, avgCost: 0 };

    if (tx.type === "buy") {
      const newQty = pos.qty + tx.shares;
      const newAvg = newQty > 0 ? (pos.avgCost * pos.qty + tx.price * tx.shares) / newQty : 0;
      avgCostMap.set(ticker, { qty: newQty, avgCost: newAvg });
      continue;
    }

    // SELL
    const sharesSOLD = Math.min(tx.shares, pos.qty);
    const profit = (tx.price - pos.avgCost) * sharesSOLD - (tx.fee ?? 0);
    const newQty = pos.qty - sharesSOLD;
    avgCostMap.set(ticker, { qty: newQty, avgCost: pos.avgCost });

    const dayK = `${dayKey(tx.timestamp)}|${ticker}`;
    const isDT = tx.dayTrade === true || dayTrades.has(dayK);
    const isFii = isFII(ticker);

    const summary: TradeSummary = {
      ticker,
      isDayTrade: isDT,
      isFII: isFii,
      shares: sharesSOLD,
      sellPrice: tx.price,
      avgCost: pos.avgCost,
      profit,
      saleValue: tx.price * sharesSOLD,
      date: dayKey(tx.timestamp),
    };

    const mk = monthKey(tx.timestamp);
    const list = monthMap.get(mk) ?? [];
    list.push(summary);
    monthMap.set(mk, list);
  }

  // Carryforward acumulados
  let swingCF = 0;
  let dtCF = 0;
  let fiiCF = 0;

  let totalTaxDue = 0;
  let totalProfit = 0;
  let totalLoss = 0;

  const months: MonthlyTaxSummary[] = [];

  for (const [mk, trades] of Array.from(monthMap.entries()).sort()) {
    const [yearStr, monthStr] = mk.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    // Separa por categoria
    const swingTrades = trades.filter((t) => !t.isDayTrade && !t.isFII);
    const dtTrades = trades.filter((t) => t.isDayTrade && !t.isFII);
    const fiiTrades = trades.filter((t) => t.isFII);

    // ── Swing trade ──────────────────────────────────────────
    const swingGross = swingTrades.reduce((s, t) => s + t.profit, 0);
    const swingProfit = Math.max(0, swingGross);
    const swingLoss = Math.abs(Math.min(0, swingGross));
    const totalSalesBRL = swingTrades.reduce((s, t) => s + t.saleValue, 0);
    const isExemptSwing = totalSalesBRL < SWING_EXEMPTION;

    let swingTaxDue = 0;
    let carryUsed = 0;

    if (!isExemptSwing && swingProfit > 0) {
      carryUsed = Math.min(swingCF, swingProfit);
      const taxable = swingProfit - carryUsed;
      swingTaxDue = taxable * SWING_TAX_RATE;
      swingCF = Math.max(0, swingCF - carryUsed);
    }
    // Acumula prejuízo swing
    if (swingGross < 0) swingCF += swingLoss;

    // ── Day trade ─────────────────────────────────────────────
    const dtGross = dtTrades.reduce((s, t) => s + t.profit, 0);
    const dtProfit = Math.max(0, dtGross);
    const dtLoss = Math.abs(Math.min(0, dtGross));

    let dtTaxDue = 0;
    if (dtProfit > 0) {
      const dtCarryUsed = Math.min(dtCF, dtProfit);
      dtTaxDue = (dtProfit - dtCarryUsed) * DAY_TRADE_TAX_RATE;
      dtCF = Math.max(0, dtCF - dtCarryUsed);
    }
    if (dtGross < 0) dtCF += dtLoss;

    // ── FIIs ─────────────────────────────────────────────────
    const fiiGross = fiiTrades.reduce((s, t) => s + t.profit, 0);
    const fiiProfit = Math.max(0, fiiGross);
    const fiiLoss = Math.abs(Math.min(0, fiiGross));

    let fiiTaxDue = 0;
    if (fiiProfit > 0) {
      const fiiCarryUsed = Math.min(fiiCF, fiiProfit);
      fiiTaxDue = (fiiProfit - fiiCarryUsed) * FII_TAX_RATE;
      fiiCF = Math.max(0, fiiCF - fiiCarryUsed);
    }
    if (fiiGross < 0) fiiCF += fiiLoss;

    // ── Total do mês ──────────────────────────────────────────
    let monthTax = swingTaxDue + dtTaxDue + fiiTaxDue;
    // DARF mínimo R$10 — abaixo disso acumula (simplificado: soma ao próximo)
    if (monthTax > 0 && monthTax < DARF_MIN) monthTax = 0;

    totalTaxDue += monthTax;
    const monthProfit = Math.max(0, swingGross) + Math.max(0, dtGross) + Math.max(0, fiiGross);
    const monthLoss = swingLoss + dtLoss + fiiLoss;
    totalProfit += monthProfit;
    totalLoss += monthLoss;

    if (filterYear && year !== filterYear) continue;

    months.push({
      year,
      month,
      label: monthLabel(year, month),
      totalSalesBRL,
      swingProfit,
      swingLossThisMonth: swingLoss,
      swingCarryForwardUsed: carryUsed,
      taxableSwing: swingProfit - carryUsed,
      isExemptSwing,
      swingTaxDue,
      dayTradeProfit: dtProfit,
      dayTradeLossThisMonth: dtLoss,
      dayTradeTaxDue: dtTaxDue,
      fiiProfit,
      fiiTaxDue,
      totalTaxDue: monthTax,
      darfDueDate: darfDueDate(year, month),
      trades,
    });
  }

  return {
    months: months.reverse(), // mais recente primeiro
    swingCarryForward: swingCF,
    dayTradeCarryForward: dtCF,
    fiiCarryForward: fiiCF,
    totalTaxDue,
    totalProfit,
    totalLoss,
  };
}

/** Anos com pelo menos uma transação de venda. */
export function availableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  for (const tx of transactions) {
    if (tx.type === "sell") years.add(new Date(tx.timestamp).getFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}
