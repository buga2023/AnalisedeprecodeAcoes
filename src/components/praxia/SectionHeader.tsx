import type { ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface SectionHeaderProps {
  label: string;
  trailing?: ReactNode;
  onTrailingClick?: () => void;
}

export function SectionHeader({ label, trailing, onTrailingClick }: SectionHeaderProps) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "0 4px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontFamily: T.display,
          fontSize: 16,
          fontWeight: 600,
          color: T.ink,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </div>
      {trailing && (
        <button
          onClick={onTrailingClick}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: T.body,
            fontSize: 12,
            color: T.ink50,
            fontWeight: 600,
            cursor: onTrailingClick ? "pointer" : "default",
          }}
        >
          {trailing}
        </button>
      )}
    </div>
  );
}
