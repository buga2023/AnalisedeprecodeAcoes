import { PraxiaTokens } from "./tokens";

interface PraxiaLogoProps {
  /** Tamanho aproximado da altura visual (px). O wordmark se calibra pra encaixar. */
  size?: number;
  /** Cor do texto. Default: ink (parchment). Em fundo claro, passe `paperInk`. */
  color?: string;
  /** Cor do filete dourado. */
  gold?: string;
  /** Esconde a régua dourada (útil em escalas muito pequenas, < 12px). */
  hideRule?: boolean;
  /** Quando true, mostra só o ícone "P" serifado (sem o restante do wordmark). */
  iconOnly?: boolean;
  /** Mantido para compatibilidade — qualquer accent vira gold no v0. */
  accent?: string;
}

/**
 * Praxia · Wordmark "Engraved"
 *
 * Cormorant SC, tracked como inscrição em pedra, com um pequeno filete
 * dourado (line + diamante + line) embaixo. Direção 01 da brand exploration.
 *
 * Em modo `iconOnly`, vira um "P" serifado com um ponto dourado sobre o eixo
 * — utilizável como favicon/avatar/PraMark compacto.
 */
export function PraxiaLogo({
  size = 22,
  color = PraxiaTokens.ink,
  gold = PraxiaTokens.gold,
  hideRule = false,
  iconOnly = false,
  accent: _accent,
}: PraxiaLogoProps) {
  void _accent; // kept for legacy callers; v0 sempre usa champagne gold

  if (iconOnly) {
    return (
      <span
        aria-label="Praxia"
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          position: "relative",
          fontFamily: PraxiaTokens.display,
          fontSize: size * 1.05,
          fontWeight: 500,
          lineHeight: 1,
          color,
          letterSpacing: 0,
        }}
      >
        P
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -size * 0.06,
            top: size * 0.18,
            width: size * 0.10,
            height: size * 0.10,
            borderRadius: "50%",
            background: gold,
          }}
        />
      </span>
    );
  }

  // Wordmark tamanhos calibrados para o `size` representar a altura tipográfica.
  const trackPx = size * 0.18; // letter-spacing
  const ruleW = size * 0.5;
  const dot = Math.max(2, Math.round(size * 0.075));
  const ruleGap = Math.max(4, size * 0.22);

  return (
    <span
      aria-label="Praxia"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: ruleGap,
      }}
    >
      <span
        style={{
          fontFamily: PraxiaTokens.displaySC,
          fontSize: size,
          fontWeight: 500,
          color,
          letterSpacing: trackPx,
          lineHeight: 1,
          // padding-left compensa o letter-spacing para visual centering
          paddingLeft: trackPx,
        }}
      >
        PRAXIA
      </span>
      {!hideRule && size >= 12 && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: size * 0.2,
            opacity: 0.95,
          }}
        >
          <span style={{ width: ruleW, height: 1, background: gold }} />
          <span
            style={{
              width: dot,
              height: dot,
              background: gold,
              transform: "rotate(45deg)",
            }}
          />
          <span style={{ width: ruleW, height: 1, background: gold }} />
        </span>
      )}
    </span>
  );
}
