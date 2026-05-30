import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Boundary global — captura crashes de render que escapariam pro usuário como
 * tela branca. Reporta via `captureError` (→ Sentry quando há DSN, senão
 * console) e mostra um fallback mínimo. Montado em `main.tsx` em volta do `App`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, {
      tag: "react-error-boundary",
      extra: { componentStack: info.componentStack ?? undefined },
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#0a0a10",
          color: "#f4ecdf",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          textAlign: "center",
          fontFamily: "Manrope, sans-serif",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Algo deu errado</div>
        <div style={{ fontSize: 14, opacity: 0.7, maxWidth: 320, lineHeight: 1.5 }}>
          Tivemos um problema inesperado. Seus dados estão salvos — tente recarregar.
        </div>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: 6,
            padding: "10px 22px",
            borderRadius: 10,
            border: "1px solid #c8a25c",
            background: "transparent",
            color: "#c8a25c",
            fontFamily: "Manrope, sans-serif",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}
