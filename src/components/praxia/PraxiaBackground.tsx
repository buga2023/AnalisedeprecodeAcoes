import type { CSSProperties, ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface PraxiaBackgroundProps {
  children?: ReactNode;
  accent?: string;
  style?: CSSProperties;
}

export function PraxiaBackground({
  children,
  accent = PraxiaTokens.accent,
  style,
}: PraxiaBackgroundProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(120% 60% at 80% -10%, ${accent}38 0%, transparent 55%),
          radial-gradient(80% 50% at -10% 30%, rgba(80, 60, 200, 0.18) 0%, transparent 60%),
          radial-gradient(100% 70% at 50% 110%, rgba(20, 30, 80, 0.55) 0%, transparent 65%),
          linear-gradient(180deg, #05071a 0%, #03051a 50%, #020314 100%)
        `,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* faint grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.025,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />
      {/* film grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          mixBlendMode: "overlay",
          background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}
