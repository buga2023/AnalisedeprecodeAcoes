/**
 * Chaves do Praxia em localStorage — fonte única compartilhada por
 * `ScreenDeleteAccount` (exclusão LGPD Art. 18 VI) e `dataExport` (portabilidade
 * Art. 18 V), pra que apagar e exportar nunca divirjam.
 */

/** Chaves canônicas (lista enumerada). */
export const PRAXIA_LOCAL_KEYS = [
  "stocks-ai-portfolio",
  "stocks-ai-brapi-token",
  "praxia-investor-profile",
  "praxia-pra-chat",
  "praxia-ui-prefs",
  "praxia-transactions",
  "stocks-ai-relatorios",
  "stocks-ai-portfolio-insights",
  "stocks-ai-provider-config",
  "praxia-lgpd-consent",
];

/** True se a chave pertence ao Praxia (canônica ou cache dinâmico por prefixo). */
function isPraxiaKey(key: string): boolean {
  return key.startsWith("praxia-") || key.startsWith("stocks-ai");
}

/**
 * Todas as chaves do Praxia presentes no localStorage agora: canônicas ∪ caches
 * dinâmicos por prefixo (ex.: `stocks-ai-analysis:PETR4`), deduplicadas.
 */
export function listPraxiaLocalKeys(): string[] {
  const found = new Set<string>();
  for (const k of PRAXIA_LOCAL_KEYS) {
    if (localStorage.getItem(k) !== null) found.add(k);
  }
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isPraxiaKey(key)) found.add(key);
  }
  return [...found];
}

/** Remove do localStorage todas as chaves do Praxia. Retorna quantas saíram. */
export function erasePraxiaLocalKeys(): number {
  const keys = listPraxiaLocalKeys();
  for (const k of keys) localStorage.removeItem(k);
  return keys.length;
}
