import { useState } from "react";
import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";
import { LGPD_COOKIE_NOTICE } from "@/lib/legal";

/**
 * Aviso de privacidade LGPD — primeira visita.
 *
 * O Praxia não usa cookies de rastreamento, só localStorage para portfólio e
 * preferências. Como o armazenamento é ESSENCIAL para o app funcionar, a base
 * legal é execução de contrato (LGPD Art. 7, V) — por isso este é um aviso de
 * transparência, não um pedido de consentimento, e não há opção de "recusar"
 * (recusar equivaleria a não usar o app). "Entendi" grava `praxia-lgpd-consent`
 * em localStorage (versão do texto + timestamp) só para não reexibir o aviso a
 * cada visita; bump de `CONSENT_VERSION` reexibe quando o texto mudar.
 *
 * O usuário pode clicar em "Saiba mais" para abrir a Política de Privacidade.
 */

interface CookieConsentBannerProps {
  accent?: string;
  /** Acionado quando o usuário clica em "Saiba mais" — abre `/privacidade`. */
  onOpenPrivacy?: () => void;
}

const CONSENT_KEY = "praxia-lgpd-consent";
/** Versão do texto/política — bump aqui reexibe o aviso (texto mudou). */
const CONSENT_VERSION = "2026-05-30";

interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    return parsed?.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsent(): void {
  const rec: ConsentRecord = {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(rec));
  } catch {
    // Falha silenciosa (modo privado, quota cheia). UI continua, banner reaparece
    // na próxima visita — perda menor que crashar a primeira sessão.
  }
}

export function CookieConsentBanner({ accent, onOpenPrivacy }: CookieConsentBannerProps) {
  const T = PraxiaTokens;
  const accentColor = accent || T.accent;
  // Lazy initializer: roda uma vez na montagem, sem cascade de setState dentro
  // de useEffect (mais simples e mais rápido — sem flash de banner em re-mount).
  const [needsConsent, setNeedsConsent] = useState(() => readConsent() === null);

  if (!needsConsent) return null;

  function handleAccept() {
    writeConsent();
    setNeedsConsent(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de privacidade"
      style={{
        position: "absolute",
        bottom: 16,
        left: 12,
        right: 12,
        zIndex: 1000,
        padding: "14px 16px",
        borderRadius: 16,
        background: "rgba(10,10,16,0.94)",
        backdropFilter: "blur(12px)",
        border: `0.5px solid ${T.hairlineStrong}`,
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        animation: "praSlideUp 0.3s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: `${accentColor}22`,
            display: "grid",
            placeItems: "center",
            border: `0.5px solid ${accentColor}55`,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Icon.shield size={12} color={accentColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 13,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.1,
            }}
          >
            Sua privacidade
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: T.body,
              fontSize: 11.5,
              color: T.ink70,
              lineHeight: 1.45,
            }}
          >
            {LGPD_COOKIE_NOTICE}
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={handleAccept}
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: 999,
                background: accentColor,
                color: "white",
                border: "none",
                fontFamily: T.display,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: -0.1,
              }}
            >
              Entendi
            </button>
            {onOpenPrivacy && (
              <button
                onClick={onOpenPrivacy}
                style={{
                  padding: "9px 14px",
                  borderRadius: 999,
                  background: "transparent",
                  color: T.ink70,
                  border: `0.5px solid ${T.hairlineStrong}`,
                  fontFamily: T.body,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Saiba mais
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
