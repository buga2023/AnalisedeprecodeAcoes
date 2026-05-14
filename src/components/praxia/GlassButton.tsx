import type { CSSProperties, ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface GlassButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: number;
  active?: boolean;
  style?: CSSProperties;
  title?: string;
  ariaLabel?: string;
}

export function GlassButton({
  children,
  onClick,
  size = 38,
  active = false,
  style,
  title,
  ariaLabel,
}: GlassButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: active ? PraxiaTokens.accentSoft : "rgba(255,255,255,0.06)",
        border: `0.5px solid ${PraxiaTokens.hairline}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: PraxiaTokens.ink,
        backdropFilter: "blur(12px)",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
