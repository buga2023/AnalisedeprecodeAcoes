import type { VercelRequest, VercelResponse } from '@vercel/node';

const FONTES = {
  investidor10: (ticker: string) =>
    `https://investidor10.com.br/acoes/${ticker.toLowerCase()}/`,
  statusinvest: (ticker: string) =>
    `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`,
};

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

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
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    const html = await res.text();
    return extrairTextoHTML(html);
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

    try {
      fonte = FONTES.investidor10(ticker);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      try {
        const res = await fetch(fonte, { headers: BROWSER_HEADERS, signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const html = await res.text();
          conteudo = extrairTextoHTML(html);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.warn(`[scrape] Investidor10 falhou para ${ticker}:`, err);
    }

    if (!conteudo || conteudo.length < 100) {
      try {
        fonte = FONTES.statusinvest(ticker);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        try {
          const res = await fetch(fonte, { headers: BROWSER_HEADERS, signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const html = await res.text();
            conteudo = extrairTextoHTML(html);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        console.warn(`[scrape] StatusInvest falhou para ${ticker}:`, err);
      }
    }

    if (!conteudo || conteudo.length < 50) {
      return response.status(200).json({
        ticker,
        conteudo: "",
        fonte: "",
        aviso: "Dados não disponíveis nos sites consultados",
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

