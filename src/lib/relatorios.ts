import type { Relatorio } from "@/types/stock";
const BRAPI_PROXY_URL = "/api/brapi";

interface BrapiStatementItem {
  endDate?: string;
  netIncome?: number;
  totalRevenue?: number;
  grossProfit?: number;
}

interface BrapiReportResult {
  symbol: string;
  earningsPerShare?: number;
  financialData?: {
    netIncomeToCommon?: number;
    totalRevenue?: number;
    grossProfits?: number;
    profitMargins?: number;
  };
  incomeStatementHistoryQuarterly?: {
    incomeStatementHistory?: BrapiStatementItem[];
  };
}

interface BrapiReportsResponse {
  results?: BrapiReportResult[];
}

function formatarTrimestre(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "N/D";

  const trimestre = Math.ceil((date.getMonth() + 1) / 3);
  const ano = date.getFullYear().toString().slice(2);
  return `${trimestre}T${ano}`;
}

function readNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? 0;
}

function buildTtmRelatorio(result: BrapiReportResult, symbol: string): Relatorio[] {
  const receita = readNumber(
    result.financialData?.totalRevenue,
    result.financialData?.grossProfits
  );
  const lucroLiquido = readNumber(
    result.financialData?.netIncomeToCommon,
    receita > 0 && result.financialData?.profitMargins !== undefined
      ? receita * result.financialData.profitMargins
      : undefined,
    result.earningsPerShare
  );

  if (receita === 0 && lucroLiquido === 0) {
    return [];
  }

  return [{
    ticker: result.symbol ?? symbol,
    periodo: "Últimos 12 meses",
    dataFim: new Date().toISOString(),
    lucroLiquido,
    receita,
    resultado: lucroLiquido >= 0 ? "positivo" : "negativo",
  }];
}

export async function fetchRelatorios(
  ticker: string,
  signal?: AbortSignal
): Promise<Relatorio[]> {
  const symbol = ticker.trim().toUpperCase();
  const url = new URL(BRAPI_PROXY_URL, window.location.origin);
  
  url.searchParams.set("endpoint", `/quote/${encodeURIComponent(symbol)}`);
  url.searchParams.set("modules", "incomeStatementHistoryQuarterly,financialData");

  try {
    const response = await fetch(url.toString(), { signal });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[brapi] Erro ao buscar relatorios de ${symbol}`, {
        status: response.status,
        body,
      });

      const error = new Error(`Erro ao buscar dados de ${symbol}`) as Error & { status?: number };
      error.status = response.status;

      if (response.status === 401 || response.status === 403) {
        throw error;
      }
      if (response.status === 429) {
        throw error;
      }
      throw error;
    }

    const data = await response.json() as BrapiReportsResponse;

    const result = data.results?.[0];
    if (!result) {
      throw new Error(`API nao retornou dados de resultados para ${symbol}.`);
    }

    const statements = result.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];

    const relatorios = statements
      .filter((item) => item.endDate)
      .map((item) => {
        const lucroLiquido = item.netIncome ?? 0;
        const dataFim = new Date(item.endDate as string).toISOString();

        return {
          ticker: result.symbol ?? symbol,
          periodo: formatarTrimestre(dataFim),
          dataFim,
          lucroLiquido,
          receita: item.totalRevenue ?? 0,
          resultado: lucroLiquido >= 0 ? "positivo" as const : "negativo" as const,
        };
      })
      .sort((a, b) => new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime());

    return relatorios.length > 0 ? relatorios : buildTtmRelatorio(result, symbol);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }

    const status = (err as { status?: number })?.status ?? "desconhecido";
    console.error(`[relatorios] Erro ao buscar ${symbol}: HTTP ${status}`, err);
    throw new Error(`Erro ao buscar dados de ${symbol}`);
  }
}
