import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Mobile-first shell. On desktop we constrain the app to a ~430px column
 * so the iOS-style screens stay readable; on phones it fills the viewport.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        background: "#020314",
        color: "white",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          minHeight: "100dvh",
          overflow: "hidden",
          background: "#02030f",
          boxShadow: "0 0 60px rgba(0,0,0,0.7)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
