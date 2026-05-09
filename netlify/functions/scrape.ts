/**
 * Netlify Function — Proxy de Scraping para dados de RI
 *
 * Faz scraping server-side do Investidor10 e StatusInvest
 * para evitar bloqueio de CORS no browser.
 *
 * Uso: GET /api/scrape?ticker=PETR4
 *
 * NOTA: Em desenvolvimento local, usar `netlify dev` (porta 8888)
 * ou o proxy do Vite que redireciona /api/scrape para a function.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";

// URLs das fontes de dados
const FONTES = {
  investidor10: (ticker: string) =>
    `https://investidor10.com.br/acoes/${ticker.toLowerCase()}/`,
  statusinvest: (ticker: string) =>
    `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`,
};

// Headers para simular browser e evitar bloqueio
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

/**
 * Extrai texto relevante do HTML usando regex simples.
 * Node.js nao tem DOMParser, entao usamos limpeza via regex.
 */
function extrairTextoHTML(html: string): string {
  return (
    html
      // Remover scripts e styles completos
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Remover todas as tags HTML
      .replace(/<[^>]+>/g, " ")
      // Decodificar entidades HTML comuns
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Limpar espacos excessivos
      .replace(/\s{2,}/g, " ")
      .trim()
      // Limitar tamanho para nao estourar contexto do Llama
      .slice(0, 4000)
  );
}

/**
 * Faz fetch de uma URL e extrai o texto limpo do HTML
 */
async function scrapar(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const html = await res.text();
  return extrairTextoHTML(html);
}

export const handler: Handler = async (event: HandlerEvent) => {
  // Apenas GET
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  const ticker = event.queryStringParameters?.ticker?.toUpperCase();

  // Validar formato do ticker (ex: PETR4, VALE3, BBAS3, VIVT3)
  if (!ticker || !/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: "Ticker invalido. Use formato XXXX0 (ex: PETR4)" }),
    };
  }



  // Tentar Investidor10 primeiro, StatusInvest como fallback
  let conteudo = "";
  let fonte = "";

  try {
    fonte = FONTES.investidor10(ticker);
    conteudo = await scrapar(fonte);
  } catch (err) {
    console.warn(`[scrape] Investidor10 falhou para ${ticker}:`, err);
  }

  // Se conteudo muito curto, tentar StatusInvest
  if (!conteudo || conteudo.length < 100) {
    try {
      fonte = FONTES.statusinvest(ticker);
      conteudo = await scrapar(fonte);
    } catch (err) {
      console.warn(`[scrape] StatusInvest falhou para ${ticker}:`, err);
    }
  }

  // Se ambos falharam, retornar aviso (nao erro — nao travar a feature)
  if (!conteudo || conteudo.length < 50) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ticker,
        conteudo: "",
        fonte: "",
        aviso: "Dados nao disponiveis nos sites consultados",
      }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ ticker, conteudo, fonte }),
  };
};
