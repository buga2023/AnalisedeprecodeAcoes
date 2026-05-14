import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";

interface DisclaimerBarProps {
  accent?: string;
  variant?: "compact" | "inline";
}

/**
 * Disclaimer reaproveitado em superfícies onde aparecem dados de mercado ou
 * análises — deixa explícito que TUDO aqui é sugestão com fonte, nunca
 * recomendação personalizada de investimento.
 */
export function DisclaimerBar({
  accent = PraxiaTokens.accent,
  variant = "compact",
}: DisclaimerBarProps) {
  const T = PraxiaTokens;

  if (variant === "inline") {
    return (
      <div
        style={{
          marginTop: 8,
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: `0.5px dashed ${T.hairline}`,
          color: T.ink50,
          fontFamily: T.body,
          fontSize: 11,
          lineHeight: 1.45,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <Icon.shield size={12} color={T.ink50} />
        <span>
          <b style={{ color: T.ink70 }}>Sugestão com fonte, não recomendação.</b>{" "}
          Praxia mostra dados do Yahoo Finance, cálculos do app e citações — a decisão é sua.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 14,
        background: `linear-gradient(160deg, ${accent}10 0%, ${accent}03 100%)`,
        border: `0.5px solid ${accent}33`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          background: "rgba(255,255,255,0.06)",
          display: "grid",
          placeItems: "center",
          border: `0.5px solid ${T.hairline}`,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon.shield size={12} color={accent} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: T.display,
            fontSize: 12,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: -0.1,
          }}
        >
          Sugestões com fonte — não é recomendação.
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: T.body,
            fontSize: 11,
            color: T.ink50,
            lineHeight: 1.45,
          }}
        >
          Todos os dados vêm com origem (Yahoo Finance, cálculo do app, perfil seu, ou link de RI). A decisão final é sempre sua. Praxia é simulação local de paper trading.
        </div>
      </div>
    </div>
  );
}
