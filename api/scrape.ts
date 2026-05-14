import type { VercelRequest, VercelResponse } from '@vercel/node';

const FONTES = {
  investidor10: (ticker: string) =>
    `https://investidor10.com.br/acoes/${ticker.toLowerCase()}/`,
  statusinvest: (ticker: string) =>
    `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`,
  fundamentus: (ticker: string) =>
    `https://www.fundamentus.com.br/detalhes.php?papel=${ticker.toUpperCase()}`,
};

function headersFor(target: string): Record<string, string> {
  // Sites brasileiros frequentemente cancelam requisições sem Referer ou com
  // UA bot-like. Esse perfil reduz drasticamente o número de 403/CF challenges.
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Referer: target.includes("investidor10")
      ? "https://investidor10.com.br/"
      : target.includes("statusinvest")
      ? "https://statusinvest.com.br/"
      : target.includes("fundamentus")
      ? "https://www.fundamentus.com.br/"
      : "https://www.google.com.br/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
}

function extrairTextoHTML(html: string): string {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 4000)
  );
}

async function scrapar(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { headers: headersFor(url), signal: controller.signal });
    if (!res.ok) return "";
    const html = await res.text();
    return extrairTextoHTML(html);
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  try {
    if (request.method === 'OPTIONS') {
      return response.status(200).end();
    }

    const ticker = (Array.isArray(request.query.ticker) ? request.query.ticker[0] : request.query.ticker as string)?.toUpperCase();

    if (!ticker || !/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
      return response.status(400).json({ error: "Ticker inválido. Use formato XXXX0 (ex: PETR4)" });
    }

    let conteudo = "";
    let fonte = "";

    // Tenta três fontes em ordem de qualidade decrescente. Cada falha é
    // silenciosa — a IA continua com os dados quantitativos do app.
    const fontes: Array<{ url: string; nome: string }> = [
      { url: FONTES.investidor10(ticker), nome: "Investidor10" },
      { url: FONTES.statusinvest(ticker), nome: "StatusInvest" },
      { url: FONTES.fundamentus(ticker), nome: "Fundamentus" },
    ];

    for (const f of fontes) {
      const texto = await scrapar(f.url);
      if (texto && texto.length >= 200) {
        conteudo = texto;
        fonte = f.url;
        break;
      }
    }

    if (!conteudo || conteudo.length < 50) {
      return response.status(200).json({
        ticker,
        conteudo: "",
        fonte: "",
        aviso:
          "Dados de RI não disponíveis (sites podem estar bloqueando o scraping). A análise seguirá apenas com fundamentos do Yahoo Finance.",
      });
    }

    return response.status(200).json({ ticker, conteudo, fonte });
  } catch (error) {
    console.error("Erro fatal no proxy Scrape:", error);
    return response.status(200).json({ 
      ticker: request.query.ticker,
      conteudo: "",
      error: "Serviço de análise de dados indisponível no momento."
    });
  }
}

