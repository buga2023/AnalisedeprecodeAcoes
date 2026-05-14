import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaLogo } from "../PraxiaLogo";

interface ScreenOnboardingProps {
  onStart: () => void;
  accent?: string;
}

export function ScreenOnboarding({ onStart, accent = PraxiaTokens.accent }: ScreenOnboardingProps) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "absolute",
          bottom: -120,
          left: -40,
          right: -40,
          height: 480,
          background: `
            radial-gradient(closest-side at 50% 50%, ${accent} 0%, ${accent}88 30%, transparent 70%),
            radial-gradient(closest-side at 30% 60%, #8b5cf6aa 0%, transparent 60%)
          `,
          filter: "blur(40px)",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: "50%",
          transform: "translateX(-50%)",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, white 0%, ${accent} 30%, ${accent}44 60%, transparent 80%)`,
          opacity: 0.35,
          filter: "blur(2px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "90px 28px 0",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.95 }}>
          <PraxiaLogo size={20} accent={accent} />
          <span
            style={{
              fontFamily: T.display,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 0.4,
              color: T.ink,
            }}
          >
            Praxia
          </span>
        </div>

        <div style={{ marginTop: "auto", paddingBottom: 56 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: T.display,
              fontSize: 46,
              fontWeight: 600,
              lineHeight: 1.0,
              color: T.ink,
              letterSpacing: -1.2,
            }}
          >
            Invista com
            <br />
            uma mente clara.
          </h1>
          <p
            style={{
              marginTop: 18,
              fontFamily: T.body,
              fontSize: 15,
              lineHeight: 1.5,
              color: T.ink70,
              maxWidth: 300,
            }}
          >
            Análise, precificação e uma IA que conversa com você para entender suas
            prioridades — não as do mercado.
          </p>

          <button
            onClick={onStart}
            style={{
              marginTop: 36,
              height: 56,
              padding: "0 26px",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: T.ink,
              color: "#05071a",
              border: "none",
              borderRadius: 999,
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              letterSpacing: -0.1,
              boxShadow: "0 12px 30px rgba(255,255,255,0.15)",
            }}
          >
            Começar
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </span>
          </button>

          <div
            style={{
              marginTop: 28,
              fontFamily: PraxiaTokens.mono,
              fontSize: 10.5,
              color: T.ink30,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Plataforma de elite · análise fundamentalista
          </div>
        </div>
      </div>
    </div>
  );
}
