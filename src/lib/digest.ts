/**
 * Agregador puro do contexto semanal — entrada para `gerarDigestSemanal`.
 *
 * Combina dados REAIS dos hooks da app (sem fetch novo, sem mock): historico
 * de dividendos do Yahoo, transacoes registradas pelo usuario, alertas
 * disparados pelo engine de polling, e cache de noticias materiais.
 *
 * Quando um dado nao pode ser confirmado (ex.: nao temos preco do inicio da
 * semana), o campo retorna `null` ou `0` — NUNCA preenchemos com synthetic.
 */

import type { DividendEvent } from "./dividends";
import { getCachedStockNews } from "./stockNews";
import { getISOWeekString, isInWeek } from "./isoWeek";
import type {
  DigestContext,
  PriceAlert,
  Stock,
  Transaction,
} from "@/types/stock";

export interface AssembleDigestInput {
  stocks: Stock[];
  transactions: Transaction[];
  /** Histórico raw (eventos Yahoo) por ticker — vindo de `useDividendCalendar.rawHistoryByTicker`. */
  dividendHistoryByTicker: Record<string, DividendEvent[]>;
  triggeredAlerts: PriceAlert[];
  /**
   * Mapa OPCIONAL ticker → preço no início da semana (ex.: 7d atrás). Quando
   * fornecido, o digest pode calcular `variacaoSemanaPct` real. Sem esse dado,
   * o campo retorna `null` (nunca usa fake).
   */
  priceAtWeekStart?: Record<string, number>;
  /** Permite forçar a data de referencia (testes); default = agora. */
  now?: Date;
  /** Permite passar `weekStart`/`weekEnd` calculados; default = semana ANTERIOR a `now`. */
  weekStart?: Date;
  weekEnd?: Date;
}

/**
 * Calcula segunda → domingo da semana ANTERIOR a `ref` (o digest cobre o que
 * ja aconteceu, nao a semana em curso).
 */
function previousWeekRange(ref: Date): { start: Date; end: Date } {
  const oneWeekAgo = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);
  // segunda da semana anterior
  const d = new Date(Date.UTC(oneWeekAgo.getUTCFullYear(), oneWeekAgo.getUTCMonth(), oneWeekAgo.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start: d, end };
}

export function assembleDigestContext(input: AssembleDigestInput): DigestContext {
  const now = input.now ?? new Date();
  const { start: defaultStart, end: defaultEnd } = previousWeekRange(now);
  const weekStart = input.weekStart ?? defaultStart;
  const weekEnd = input.weekEnd ?? defaultEnd;

  const owned = input.stocks.filter((s) => s.quantity > 0);
  const totalValue = owned.reduce((acc, s) => acc + s.price * s.quantity, 0);
  const patrimonioFim = Math.round(totalValue * 100) / 100;

  // === variacaoSemanaPct (REAL ou null) ===================================
  let variacaoSemanaPct: number | null = null;
  if (input.priceAtWeekStart && Object.keys(input.priceAtWeekStart).length > 0) {
    let valorInicio = 0;
    let valido = true;
    for (const s of owned) {
      const p0 = input.priceAtWeekStart[s.ticker.toUpperCase()];
      if (typeof p0 !== "number" || !isFinite(p0) || p0 <= 0) {
        valido = false;
        break;
      }
      valorInicio += p0 * s.quantity;
    }
    if (valido && valorInicio > 0) {
      variacaoSemanaPct = Math.round(((totalValue - valorInicio) / valorInicio) * 10000) / 100;
    }
  }

  // === topMover ponderado por peso ========================================
  let topMover: DigestContext["topMover"] = null;
  if (owned.length > 0 && totalValue > 0) {
    let bestImpact = 0;
    let best: { ticker: string; variacaoPct: number; impactoR$: number } | null = null;
    for (const s of owned) {
      const impactoR$ = s.change * s.quantity; // change ja e absoluto (R$)
      if (Math.abs(impactoR$) > Math.abs(bestImpact)) {
        bestImpact = impactoR$;
        best = {
          ticker: s.ticker,
          variacaoPct: Math.round(s.changePercent * 100) / 100,
          impactoR$: Math.round(impactoR$ * 100) / 100,
        };
      }
    }
    topMover = best;
  }

  // === dividendos PAGOS na semana =========================================
  const dividendosRecebidos: DigestContext["dividendosRecebidos"] = [];
  let totalDividendosSemana = 0;
  for (const s of owned) {
    const history = input.dividendHistoryByTicker[s.ticker.toUpperCase()] ?? [];
    for (const event of history) {
      const eventDate = parseIsoDate(event.date);
      if (eventDate >= weekStart && eventDate <= weekEnd) {
        const recebido = Math.round(event.amount * s.quantity * 100) / 100;
        dividendosRecebidos.push({
          ticker: s.ticker,
          date: event.date,
          amount: recebido,
        });
        totalDividendosSemana += recebido;
      }
    }
  }
  totalDividendosSemana = Math.round(totalDividendosSemana * 100) / 100;

  // === transacoes da semana ===============================================
  const transacoesDaSemana: DigestContext["transacoesDaSemana"] = input.transactions
    .filter((t) => {
      const d = new Date(t.timestamp);
      return !isNaN(d.getTime()) && d >= weekStart && d <= weekEnd;
    })
    .map((t) => ({
      ticker: t.ticker,
      type: t.type,
      shares: t.shares,
      total: t.total,
      timestamp: t.timestamp,
    }));

  // === alertas disparados =================================================
  const alertasDisparados: DigestContext["alertasDisparados"] = input.triggeredAlerts
    .filter((a) => {
      if (!a.triggeredAt) return false;
      const d = new Date(a.triggeredAt);
      return !isNaN(d.getTime()) && isInWeek(d, weekStart);
    })
    .map((a) => ({
      ticker: a.ticker,
      type: a.type,
      value: a.value,
      triggerPrice: a.triggerPrice,
      triggeredAt: a.triggeredAt as string,
    }));

  // === noticias materiais (do cache existente) ============================
  const noticiasMateriais: DigestContext["noticiasMateriais"] = [];
  const seen = new Set<string>();
  for (const s of owned) {
    const cached = getCachedStockNews(s.ticker);
    if (!cached || !cached.hasMaterial) continue;
    // Só conta se a análise foi gerada DENTRO da semana (sinaliza eventos novos).
    if (cached.generatedAt < weekStart.getTime() || cached.generatedAt > weekEnd.getTime()) {
      continue;
    }
    for (const item of cached.itens) {
      if (!item.material) continue;
      const key = `${s.ticker}|${item.link}`;
      if (seen.has(key)) continue;
      seen.add(key);
      noticiasMateriais.push({
        ticker: s.ticker,
        titulo: item.titulo,
        link: item.link,
        impacto: item.impacto,
        generatedAt: cached.generatedAt,
      });
    }
  }

  // === snapshot leve do portfolio =========================================
  const portfolioSnapshot: DigestContext["portfolioSnapshot"] = owned.map((s) => ({
    ticker: s.ticker,
    quantity: s.quantity,
    price: Math.round(s.price * 100) / 100,
    score: s.score,
    weight:
      totalValue > 0 ? Math.round(((s.price * s.quantity) / totalValue) * 10000) / 100 : 0,
  }));

  return {
    isoWeek: getISOWeekString(weekStart),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    variacaoSemanaPct,
    patrimonioFim,
    topMover,
    dividendosRecebidos,
    totalDividendosSemana,
    transacoesDaSemana,
    alertasDisparados,
    noticiasMateriais,
    portfolioSnapshot,
  };
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map((p) => Number(p));
  return new Date(Date.UTC(y, m - 1, d));
}

/** Conveniencia: serializa o contexto como JSON compacto para o prompt. */
export function digestContextToPromptJson(ctx: DigestContext): string {
  // Limita arrays para economizar tokens — preserva o essencial.
  return JSON.stringify(
    {
      ...ctx,
      dividendosRecebidos: ctx.dividendosRecebidos.slice(0, 8),
      transacoesDaSemana: ctx.transacoesDaSemana.slice(0, 8),
      alertasDisparados: ctx.alertasDisparados.slice(0, 8),
      noticiasMateriais: ctx.noticiasMateriais.slice(0, 5),
      portfolioSnapshot: ctx.portfolioSnapshot.slice(0, 12),
    },
    null,
    2
  );
}
