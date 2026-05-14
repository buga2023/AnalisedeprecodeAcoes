import type { CSSProperties, ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface PraxiaCardProps {
  children?: ReactNode;
  style?: CSSProperties;
  raised?: boolean;
  padding?: number | string;
  onClick?: () => void;
  as?: "div" | "button";
}

export function PraxiaCard({
  children,
  style,
  raised = false,
  padding = 16,
  onClick,
  as,
}: PraxiaCardProps) {
  const Tag: "div" | "button" = as ?? (onClick ? "button" : "div");
  return (
    <Tag
      onClick={onClick}
      className={onClick ? "pra-row" : undefined}
      style={{
        position: "relative",
        borderRadius: 22,
        padding,
        background: raised
          ? "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)"
          : "linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",
        border: `0.5px solid ${PraxiaTokens.hairline}`,
        boxShadow: raised
          ? "0 24px 50px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        textAlign: "left",
        color: "inherit",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
