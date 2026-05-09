/**
 * Cliente de scraping — chama a Netlify Function /api/scrape
 *
 * Em desenvolvimento: o proxy do Vite redireciona /api/scrape
 * para http://localhost:8888/.netlify/functions/scrape
 *
 * Em producao: o netlify.toml redireciona /api/* automaticamente
 * para /.netlify/functions/*
 *
 * NOTA: Para produção, é necessário deploy no Netlify com Functions.
 * O proxy do Vite so funciona em `npm run dev`.
 */

/** Dados retornados pelo proxy de scraping */
export interface DadosRI {
  ticker: string;
  conteudo: string;
  fonte: string;
  aviso?: string;
}

/**
 * Coleta dados de RI (Relacoes com Investidores) via proxy server-side
 * para evitar bloqueio de CORS nos sites Investidor10 e StatusInvest.
 */
export async function coletarDadosRI(ticker: string): Promise<DadosRI> {
  try {
    const res = await fetch(`/api/scrape?ticker=${encodeURIComponent(ticker)}`);

    if (!res.ok) {
      console.warn(`[scraping] Proxy retornou status ${res.status} para ${ticker}`);
      return {
        ticker,
        conteudo: "",
        fonte: "",
        aviso: `Erro no proxy de scraping: HTTP ${res.status}`,
      };
    }

    return (await res.json()) as DadosRI;
  } catch (err) {
    // Se o proxy nao estiver disponivel (ex: dev sem netlify dev),
    // retornar vazio — a IA analisa so com dados quantitativos
    console.warn(`[scraping] Falha ao conectar ao proxy para ${ticker}:`, err);
    return {
      ticker,
      conteudo: "",
      fonte: "",
      aviso: "Proxy de scraping indisponivel. A IA analisara apenas com dados quantitativos.",
    };
  }
}
