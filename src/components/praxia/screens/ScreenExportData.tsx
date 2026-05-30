import { useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { SectionHeader } from "../SectionHeader";
import { Icon } from "../Icon";
import { useAuth } from "@/hooks/useAuth";
import { exportUserDataAsJSON } from "@/lib/exportUserData";

/**
 * Tela "Exportar meus dados" — LGPD Art. 18, V (portabilidade).
 *
 * Gera um JSON baixável com os dados do servidor (carteira, perfil, transações,
 * preferências — lidos com RLS, só os do próprio usuário) + o snapshot do
 * localStorage do dispositivo. Client-side; não há endpoint dedicado.
 */

interface ScreenExportDataProps {
  accent?: string;
  onBack: () => void;
}

export function ScreenExportData({ accent, onBack }: ScreenExportDataProps) {
  const T = PraxiaTokens;
  const accentColor = accent || T.accent;
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await exportUserDataAsJSON(user?.id ?? "", user?.email ?? "");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative", paddingBottom: 40 }}>
      <PraxiaBackground accent={accentColor} />

      <div style={{ position: "relative", zIndex: 1, padding: "24px 20px 12px" }}>
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: T.ink70,
            fontFamily: T.body,
            fontSize: 12.5,
            cursor: "pointer",
            padding: 0,
            marginBottom: 18,
          }}
        >
          <Icon.arrowLeft size={14} color={T.ink70} />
          Voltar
        </button>

        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10.5,
            color: T.ink50,
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          LGPD ART. 18, V
        </div>
        <SectionHeader label="Exportar meus dados" />
      </div>

      <div style={{ padding: "0 20px 24px", position: "relative", zIndex: 1 }}>
        <PraxiaCard>
          <p
            style={{
              margin: 0,
              fontFamily: T.body,
              fontSize: 13.5,
              color: T.ink70,
              lineHeight: 1.55,
            }}
          >
            Baixe uma cópia de tudo que o Praxia guarda sobre você em um arquivo{" "}
            <b style={{ color: T.ink }}>JSON</b>: do servidor (carteira, perfil de
            investidor, transações simuladas, preferências) e do seu dispositivo (caches
            locais). Esse é o seu direito de <b style={{ color: T.ink }}>portabilidade</b>.
          </p>

          <button
            onClick={() => void handleExport()}
            disabled={busy}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "13px 16px",
              borderRadius: 999,
              background: busy ? `${accentColor}2e` : accentColor,
              color: busy ? "rgba(255,255,255,0.6)" : "white",
              border: "none",
              fontFamily: T.display,
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              letterSpacing: -0.1,
              boxShadow: busy ? "none" : `0 10px 24px ${accentColor}33`,
            }}
          >
            {busy ? "Gerando…" : "Baixar meus dados (.json)"}
          </button>

          {done && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: `${accentColor}1a`,
                border: `0.5px solid ${accentColor}55`,
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink70,
                lineHeight: 1.5,
              }}
            >
              Arquivo gerado. Verifique os downloads do seu navegador.
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: `${T.warn}1a`,
                border: `0.5px solid ${T.warn}55`,
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink70,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
        </PraxiaCard>
      </div>
    </div>
  );
}
