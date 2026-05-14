import type { ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface TagProps {
  children: ReactNode;
  color?: string;
  text?: string;
  size?: "sm" | "md";
}

export function Tag({
  children,
  color = "rgba(255,255,255,0.08)",
  text = "rgba(255,255,255,0.78)",
  size = "sm",
}: TagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: size === "sm" ? 20 : 24,
        padding: size === "sm" ? "0 8px" : "0 10px",
        borderRadius: 999,
        background: color,
        color: text,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        fontFamily: PraxiaTokens.body,
        border: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </span>
  );
}

interface DeltaPillProps {
  value: number;
  size?: "sm" | "md";
}

/** Up/Down pill with arrow + percent. */
export function DeltaPill({ value, size = "sm" }: DeltaPillProps) {
  const T = PraxiaTokens;
  const positive = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: size === "sm" ? "3px 8px 3px 6px" : "4px 10px 4px 8px",
        borderRadius: 8,
        background: positive ? "rgba(66,232,163,0.16)" : "rgba(255,107,129,0.16)",
        color: positive ? T.up : T.down,
        fontWeight: 600,
        fontSize: size === "sm" ? 12.5 : 13.5,
        fontFamily: T.body,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path
          d={positive ? "m3 8 3-4 3 4" : "m3 4 3 4 3-4"}
          stroke={positive ? T.up : T.down}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {(positive ? "+" : "") + value.toFixed(2)}%
    </span>
  );
}
