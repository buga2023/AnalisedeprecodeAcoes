/**
 * Registro de consentimento LGPD (Art. 8) — persistido no localStorage.
 *
 * Mantido fora do componente do banner para satisfazer o react-refresh
 * (arquivo de componente só exporta componentes) e para ficar testável.
 * Grava a decisão (aceito/recusado) + versão do texto + timestamp, o que dá
 * uma escolha livre e demonstrável enquanto o registro existir no dispositivo.
 */

export const CONSENT_KEY = "praxia-lgpd-consent";
/** Versão do texto/política — bump aqui força reaceite. */
export const CONSENT_VERSION = "2026-05-30";

export type ConsentDecision = "accepted" | "refused";

export interface ConsentRecord {
  version: string;
  decision: ConsentDecision;
  decidedAt: string;
}

/** Lê o registro da versão atual; null se ausente, de versão antiga ou corrompido. */
export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    return parsed?.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

/** Grava a decisão (aceito/recusado) com timestamp. */
export function writeConsent(decision: ConsentDecision): void {
  const rec: ConsentRecord = {
    version: CONSENT_VERSION,
    decision,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(rec));
  } catch {
    // Falha silenciosa (modo privado, quota cheia). UI continua, banner reaparece
    // na próxima visita — perda menor que crashar a primeira sessão.
  }
}
