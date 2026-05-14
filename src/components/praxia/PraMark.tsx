import { PraxiaTokens } from "./tokens";

interface PraMarkProps {
  /** Diâmetro do selo em px. */
  size?: number;
  /** Cor do "P" central — default: parchment (ink). */
  color?: string;
  /** Cor do filete circular dourado — default: gold do token. */
  gold?: string;
  /** Mantido para compatibilidade com chamadas legacy (sempre usa gold). */
  accent?: string;
}

/**
 * Pra · Companion Seal Mark
 *
 * Selo circular tipo wax-seal — fino círculo dourado externo + sutil filete
 * interno + "P" em Cormorant ao centro. Reuso da direção SealMark da brand
 * exploration. Substitui o antigo monograma com gradient indigo.
 */
export function PraMark({
  size = 22,
  color = PraxiaTokens.ink,
  gold = PraxiaTokens.gold,
  accent: _accent,
}: PraMarkProps) {
  void _accent;
  const innerInset = Math.max(2, Math.round(size * 0.06));
  return (
    <span
      role="img"
      aria-label="Pra"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: PraxiaTokens.bgDeep,
        border: `1px solid ${gold}`,
        boxShadow: `0 0 0 0.5px ${PraxiaTokens.bgDeep}, 0 6px 14px rgba(0,0,0,0.45)`,
      }}
    >
      {/* filete interno — concêntrico, dourado fraco */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: innerInset,
          borderRadius: "50%",
          border: `0.5px solid ${gold}`,
          opacity: 0.5,
        }}
      />
      <span
        style={{
          fontFamily: PraxiaTokens.display,
          fontSize: size * 0.55,
          fontWeight: 500,
          color,
          lineHeight: 1,
          // ajuste óptico do P em Cormorant
          transform: "translateY(-3%)",
          letterSpacing: 0,
        }}
      >
        P
      </span>
    </span>
  );
}
