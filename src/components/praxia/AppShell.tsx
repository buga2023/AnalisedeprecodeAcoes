import type { ReactNode } from "react";
import { PraxiaTokens } from "./tokens";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Mobile-first shell. On desktop we constrain the app to a ~430px column
 * so the iOS-style screens stay readable; on phones it fills the viewport.
 *
 * v0 Engraved: shell vira onyx warm com leve filete dourado entre a coluna
 * e o canvas externo (visible no desktop como uma "moldura editorial").
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        background: PraxiaTokens.bgDeep,
        color: PraxiaTokens.ink,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          minHeight: "100dvh",
          overflow: "hidden",
          background: PraxiaTokens.bg,
          // Sombra mais profunda + filete dourado externo discreto
          boxShadow:
            "0 0 0 0.5px rgba(200,162,92,0.18), 0 0 80px rgba(0,0,0,0.75)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
