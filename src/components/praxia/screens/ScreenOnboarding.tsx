import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaLogo } from "../PraxiaLogo";

interface ScreenOnboardingProps {
  onStart: () => void;
  onLogin: () => void;
  /** Mantido para compatibilidade; v0 sempre usa champagne gold. */
  accent?: string;
}

/**
 * Tela 1 do onboarding — Engraved direction.
 *
 * Composição editorial: wordmark grande no topo + headline em Cormorant
 * itálico/serif, copy em Manrope, CTA pílula creme. Halo dourado discreto
 * no fundo. Sem ícones genéricos.
 */
export function ScreenOnboarding({ onStart, onLogin }: ScreenOnboardingProps) {
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

      {/* Halo dourado discreto no quadrante inferior — substitui os glow azuis */}
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-20%",
          right: "-20%",
          height: "55%",
          background: `radial-gradient(closest-side at 50% 50%, ${T.gold}28 0%, ${T.gold}10 35%, transparent 70%)`,
          filter: "blur(48px)",
          opacity: 0.85,
          pointerEvents: "none",
        }}
      />

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
        {/* Wordmark + caption mono */}
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
            Research · Planning
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          {/* Cabeçalho serif — protagonista da composição */}
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
            Invista com{" "}
            <span style={{ fontStyle: "italic", color: T.gold }}>clareza</span>.
          </h1>

          {/* Filete dourado curto abaixo da headline — assinatura editorial */}
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
            Análise fundamentalista, precificação e uma assistente que conversa para
            entender suas prioridades — não as do mercado.
          </p>

          <button
            onClick={onStart}
            style={{
              marginTop: 36,
              height: 56,
              padding: "0 10px 0 26px",
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              background: T.paper,
              color: T.paperInk,
              border: "none",
              borderRadius: 999,
              fontFamily: T.display,
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: 0.2,
              cursor: "pointer",
              boxShadow: "0 12px 30px rgba(241,234,219,0.10)",
              transition: "transform 0.18s cubic-bezier(0.2,0,0,1)",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Começar
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: T.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.paperInk}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </button>

          <div
            style={{
              marginTop: 28,
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink30,
              letterSpacing: 1.4,
            }}
          >
            JÁ TEM CONTA?{" "}
            <button
              onClick={onLogin}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: T.gold,
                fontFamily: T.mono,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.4,
                cursor: "pointer",
              }}
            >
              ENTRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
