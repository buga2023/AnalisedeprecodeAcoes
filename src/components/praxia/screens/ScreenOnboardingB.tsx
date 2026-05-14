import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaLogo } from "../PraxiaLogo";

interface ScreenOnboardingBProps {
  onCreateAccount: () => void;
  onLogin: () => void;
  /** Mantido para compatibilidade — v0 sempre usa champagne gold. */
  accent?: string;
}

/**
 * Tela 2 do onboarding — variação "Establishment".
 *
 * Layout editorial: número grande "II" em serif faded ao fundo, triplé verbal
 * em itálico/regular alternados ("Pense. Analise. Invista."), CTA primário
 * pílula dourada + secundário fantasma.
 */
export function ScreenOnboardingB({ onCreateAccount, onLogin }: ScreenOnboardingBProps) {
  const T = PraxiaTokens;
  return (
    <div
      className="pra-screen"
      style={{
        position: "relative",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PraxiaBackground />

      {/* Numeral romano gigante atrás — referência editorial */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "8%",
          right: "-4%",
          fontFamily: T.display,
          fontSize: 420,
          fontStyle: "italic",
          fontWeight: 400,
          color: T.ink,
          opacity: 0.045,
          lineHeight: 0.9,
          pointerEvents: "none",
          userSelect: "none",
          letterSpacing: -10,
        }}
      >
        II
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "72px 28px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PraxiaLogo size={20} hideRule />
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink30,
              letterSpacing: 1.6,
              textTransform: "uppercase",
            }}
          >
            Capítulo II · Boas-vindas
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: T.display,
              fontSize: 52,
              fontWeight: 500,
              lineHeight: 1.02,
              color: T.ink,
              letterSpacing: -1.2,
            }}
          >
            Pense.
            <br />
            <span style={{ fontStyle: "italic", color: T.gold }}>Analise.</span>
            <br />
            Invista.
          </h1>

          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 1, background: T.gold }} />
            <span
              style={{
                width: 4,
                height: 4,
                background: T.gold,
                transform: "rotate(45deg)",
              }}
            />
          </div>

          <p
            style={{
              marginTop: 22,
              fontFamily: T.body,
              fontSize: 14.5,
              lineHeight: 1.6,
              color: T.ink70,
              maxWidth: 340,
            }}
          >
            Uma assistente que conversa antes de sugerir. Praxia é a habilidade de
            planejar — agora aplicada ao seu portfólio.
          </p>

          <div
            style={{
              marginTop: 36,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <button
              onClick={onCreateAccount}
              style={{
                height: 54,
                background: T.gold,
                color: T.paperInk,
                border: "none",
                borderRadius: 999,
                fontFamily: T.display,
                fontWeight: 500,
                fontSize: 15,
                letterSpacing: 0.4,
                cursor: "pointer",
                boxShadow: `0 14px 30px ${T.gold}33`,
              }}
            >
              Criar conta
            </button>

            <button
              onClick={onLogin}
              style={{
                height: 54,
                background: "transparent",
                color: T.ink,
                border: `0.5px solid ${T.hairlineStrong}`,
                borderRadius: 999,
                fontFamily: T.display,
                fontWeight: 500,
                fontSize: 15,
                letterSpacing: 0.4,
                cursor: "pointer",
              }}
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
