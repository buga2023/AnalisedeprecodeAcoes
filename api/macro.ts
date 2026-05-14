import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Indicadores macroeconômicos do Brasil — SELIC, IPCA, CDI, IBC-Br, USD/BRL.
 * Tudo via APIs públicas oficiais (Banco Central + Yahoo Finance) sem chave.
 *
 * Banco Central SGS (Sistema Gerador de Series): /dados/serie/bcdata.sgs.<id>/dados/ultimos/N
 * Códigos usados:
 *  - 432   → SELIC meta (% a.a.)
 *  - 4189  → SELIC efetiva diária acumulada 12 meses
 *  - 433   → IPCA mensal (variação %)
 *  - 13522 → IPCA acumulado 12 meses (%)
 *  - 12    → CDI diário
 *  - 4391  → CDI acumulado 12 meses (%)
 *  - 24364 → IBC-Br (proxy mensal do PIB)
 *  - 11753 → IGP-M mensal
 */

interface SGSPoint {
  data: string; // "DD/MM/YYYY"
  valor: string;
}

const BCB_HEADERS: Record<string, string> = {
  "User-Agent": "Praxia/1.0",
  Accept: "application/json",
};

async function fetchSGS(serie: number, ultimos = 1): Promise<SGSPoint | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${ultimos}?formato=json`;
    const res = await fetch(url, { headers: BCB_HEADERS, signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as SGSPoint[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[data.length - 1];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchIbovespa(): Promise<{ price: number; changePct: number } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?range=1d&interval=1d";
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://finance.yahoo.com/",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = Number(meta.regularMarketPrice) || 0;
    const prev = Number(meta.previousClose) || price;
    return {
      price,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface MacroResponse {
  generatedAt: string;
  source: string;
  selicMeta: { valor: number | null; data: string | null; descricao: string };
  ipcaMensal: { valor: number | null; data: string | null; descricao: string };
  ipca12m: { valor: number | null; data: string | null; descricao: string };
  cdi12m: { valor: number | null; data: string | null; descricao: string };
  igpmMensal: { valor: number | null; data: string | null; descricao: string };
  ibcbr: { valor: number | null; data: string | null; descricao: string };
  ibovespa: { price: number | null; changePct: number | null; descricao: string };
  /** Texto curto que o servidor IA pode injetar diretamente no prompt. */
  resumoParaPrompt: string;
}

// Cache em memória — indicadores macro mudam devagar (mensais/diários).
let cache: { at: number; payload: MacroResponse } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function num(p: SGSPoint | null): number | null {
  if (!p) return null;
  const n = parseFloat(p.valor.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function buildResumo(r: Omit<MacroResponse, "resumoParaPrompt">): string {
  const parts: string[] = [];
  if (r.selicMeta.valor != null)
    parts.push(`SELIC meta ${r.selicMeta.valor.toFixed(2)}% a.a. (${r.selicMeta.data})`);
  if (r.ipca12m.valor != null)
    parts.push(`IPCA 12m ${r.ipca12m.valor.toFixed(2)}% (${r.ipca12m.data})`);
  else if (r.ipcaMensal.valor != null)
    parts.push(`IPCA mês ${r.ipcaMensal.valor.toFixed(2)}% (${r.ipcaMensal.data})`);
  if (r.cdi12m.valor != null)
    parts.push(`CDI 12m ${r.cdi12m.valor.toFixed(2)}%`);
  if (r.igpmMensal.valor != null)
    parts.push(`IGP-M mês ${r.igpmMensal.valor.toFixed(2)}% (${r.igpmMensal.data})`);
  if (r.ibcbr.valor != null)
    parts.push(`IBC-Br ${r.ibcbr.valor.toFixed(2)} (${r.ibcbr.data})`);
  if (r.ibovespa.price != null && r.ibovespa.changePct != null)
    parts.push(
      `Ibovespa ${r.ibovespa.price.toFixed(0)} pts (${r.ibovespa.changePct >= 0 ? "+" : ""}${r.ibovespa.changePct.toFixed(2)}% no dia)`
    );
  return parts.join(" · ");
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Content-Type", "application/json");

  if (request.method === "OPTIONS") return response.status(204).end();

  try {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      response.setHeader("X-Cache", "HIT");
      return response.status(200).json(cache.payload);
    }

    const [selicMeta, ipcaMensal, ipca12m, cdi12m, igpmMensal, ibcbr, ibov] = await Promise.all([
      fetchSGS(432),
      fetchSGS(433),
      fetchSGS(13522),
      fetchSGS(4391),
      fetchSGS(189),
      fetchSGS(24364),
      fetchIbovespa(),
    ]);

    const base: Omit<MacroResponse, "resumoParaPrompt"> = {
      generatedAt: new Date().toISOString(),
      source: "Banco Central do Brasil (SGS) + Yahoo Finance",
      selicMeta: {
        valor: num(selicMeta),
        data: selicMeta?.data ?? null,
        descricao: "Meta SELIC anual (Copom)",
      },
      ipcaMensal: {
        valor: num(ipcaMensal),
        data: ipcaMensal?.data ?? null,
        descricao: "IPCA variação mensal",
      },
      ipca12m: {
        valor: num(ipca12m),
        data: ipca12m?.data ?? null,
        descricao: "IPCA acumulado 12 meses",
      },
      cdi12m: {
        valor: num(cdi12m),
        data: cdi12m?.data ?? null,
        descricao: "CDI acumulado 12 meses",
      },
      igpmMensal: {
        valor: num(igpmMensal),
        data: igpmMensal?.data ?? null,
        descricao: "IGP-M variação mensal",
      },
      ibcbr: {
        valor: num(ibcbr),
        data: ibcbr?.data ?? null,
        descricao: "IBC-Br (proxy mensal de atividade)",
      },
      ibovespa: {
        price: ibov?.price ?? null,
        changePct: ibov?.changePct ?? null,
        descricao: "Ibovespa intraday (Yahoo)",
      },
    };
    const payload: MacroResponse = { ...base, resumoParaPrompt: buildResumo(base) };

    cache = { at: Date.now(), payload };
    return response.status(200).json(payload);
  } catch (error) {
    console.error("[api/macro] erro fatal:", error);
    if (cache) return response.status(200).json(cache.payload);
    return response.status(200).json({
      generatedAt: new Date().toISOString(),
      source: "indisponível",
      resumoParaPrompt: "",
      selicMeta: { valor: null, data: null, descricao: "SELIC" },
      ipcaMensal: { valor: null, data: null, descricao: "IPCA mês" },
      ipca12m: { valor: null, data: null, descricao: "IPCA 12m" },
      cdi12m: { valor: null, data: null, descricao: "CDI 12m" },
      igpmMensal: { valor: null, data: null, descricao: "IGP-M mês" },
      ibcbr: { valor: null, data: null, descricao: "IBC-Br" },
      ibovespa: { price: null, changePct: null, descricao: "Ibovespa" },
    });
  }
}
