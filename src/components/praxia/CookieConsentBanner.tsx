import { useState } from "react";
import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";
import { LGPD_COOKIE_NOTICE } from "@/lib/legal";
import { readConsent, writeConsent, type ConsentDecision } from "@/lib/consent";

/**
 * Banner de consentimento LGPD — primeira visita.
 *
 * O Praxia não usa cookies de rastreamento, só localStorage para portfólio e
 * preferências. Mesmo assim a LGPD (Art. 8) exige consentimento explícito
 * antes do tratamento. Aceitar grava `praxia-lgpd-consent` em localStorage
 * com a versão do texto + timestamp, para podermos exigir reconsent quando
 * o texto mudar.
 *
 * O usuário pode clicar em "Saiba mais" para abrir a tela de privacidade.
 */

interface CookieConsentBannerProps {
  accent?: string;
  /** Acionado quando o usuário clica em "Saiba mais" — abre `/privacidade`. */
  onOpenPrivacy?: () => void;
}

export function CookieConsentBanner({ accent, onOpenPrivacy }: CookieConsentBannerProps) {
  const T = PraxiaTokens;
  const accentColor = accent || T.accent;
  // Lazy initializer: roda uma vez na montagem, sem cascade de setState dentro
  // de useEffect (mais simples e mais rápido — sem flash de banner em re-mount).
  const [needsConsent, setNeedsConsent] = useState(() => readConsent() === null);

  if (!needsConsent) return null;

  function decide(decision: ConsentDecision) {
    writeConsent(decision);
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
              onClick={() => decide("refused")}
              style={{
                padding: "9px 14px",
                borderRadius: 999,
                background: "transparent",
                color: T.ink70,
                border: `0.5px solid ${T.hairlineStrong}`,
                fontFamily: T.body,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Recusar
            </button>
            <button
              onClick={() => decide("accepted")}
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
          </div>
          {onOpenPrivacy && (
            <button
              onClick={onOpenPrivacy}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "6px 0",
                background: "transparent",
                color: T.ink50,
                border: "none",
                fontFamily: T.body,
                fontSize: 11.5,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Saiba mais
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
