import type { CSSProperties, ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface PraxiaBackgroundProps {
  children?: ReactNode;
  /**
   * Mantido para compatibilidade — v0 sempre usa champagne gold no halo.
   * Se passado, modula a intensidade do gold-glow superior.
   */
  accent?: string;
  style?: CSSProperties;
  /** Quando true, NÃO desenha as marcas dos cantos (úteis em sheets/modais). */
  hideCornerMarks?: boolean;
}

/**
 * Praxia background v0 — Engraved direction.
 *
 * Fundo onyx near-black com leve calor (#0a0a10 → #06060a), halo dourado
 * sutil no topo, textura de pergaminho discreta. Sem gradientes coloridos
 * fortes — a estética agora é "papel + dourado em pedra escura".
 *
 * As marcas nos cantos (corner-marks) são uma referência editorial — folha
 * de catálogo. Podem ser desligadas via `hideCornerMarks` quando o conteúdo
 * já tem moldura própria.
 */
export function PraxiaBackground({
  children,
  accent,
  style,
  hideCornerMarks = false,
}: PraxiaBackgroundProps) {
  const goldGlow = accent ?? PraxiaTokens.gold;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(120% 80% at 50% -10%, ${goldGlow}1f 0%, transparent 55%),
          radial-gradient(90% 60% at 100% 110%, rgba(200,162,92,0.06) 0%, transparent 60%),
          radial-gradient(70% 50% at -10% 50%, rgba(120,90,40,0.10) 0%, transparent 65%),
          linear-gradient(180deg, ${PraxiaTokens.bg} 0%, #08080d 50%, ${PraxiaTokens.bgDeep} 100%)
        `,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Grade tipográfica muito sutil — referência editorial */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.022,
          backgroundImage: `linear-gradient(rgba(244,236,223,0.6) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(244,236,223,0.6) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />
      {/* Textura papel-pergaminho — turbulência mais suave que a antiga film-grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          mixBlendMode: "overlay",
          background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.78  0 0 0 0 0.62  0 0 0 0 0.35  0 0 0 0.05 0'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>")`,
          pointerEvents: "none",
        }}
      />
      {/* Corner-marks dourados discretos — referência catálogo editorial */}
      {!hideCornerMarks && <CornerMarks color={PraxiaTokens.goldFaint} inset={14} len={10} />}
      {children}
    </div>
  );
}

interface CornerMarksProps {
  color: string;
  inset?: number;
  len?: number;
}

/** Marca de canto editorial — 4 cantos com cruz fina (1px). */
export function CornerMarks({ color, inset = 14, len = 10 }: CornerMarksProps) {
  const h: CSSProperties = { position: "absolute", height: 1, width: len, background: color };
  const v: CSSProperties = { position: "absolute", width: 1, height: len, background: color };
  return (
    <>
      <span style={{ ...h, top: inset, left: inset }} />
      <span style={{ ...v, top: inset, left: inset }} />
      <span style={{ ...h, top: inset, right: inset }} />
      <span style={{ ...v, top: inset, right: inset }} />
      <span style={{ ...h, bottom: inset, left: inset }} />
      <span style={{ ...v, bottom: inset, left: inset }} />
      <span style={{ ...h, bottom: inset, right: inset }} />
      <span style={{ ...v, bottom: inset, right: inset }} />
    </>
  );
}
