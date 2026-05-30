import { useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { SectionHeader } from "../SectionHeader";
import { Icon } from "../Icon";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  collectLocalData,
  collectServerData,
  buildExportPayload,
  downloadJson,
} from "@/lib/dataExport";

/**
 * Tela "Exportar meus dados" — LGPD Art. 18 V (portabilidade).
 *
 * Gera um JSON com tudo que o Praxia tem do usuário: dados do dispositivo
 * (localStorage) e, se autenticado, os dados sincronizados no servidor (lidos
 * sob a RLS do próprio usuário). Download client-side, sem enviar nada a lugar nenhum.
 */

interface ScreenExportDataProps {
  accent?: string;
  onBack: () => void;
}

type Status = "idle" | "busy" | "done" | "error";

export function ScreenExportData({ accent, onBack }: ScreenExportDataProps) {
  const T = PraxiaTokens;
  const { user, isAuthenticated } = useAuth();
  const accentColor = accent || T.accent;
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const serverAvailable = isSupabaseConfigured && isAuthenticated;

  async function handleExport() {
    if (status === "busy") return;
    setStatus("busy");
    setErrorMsg(null);
    try {
      const userId = serverAvailable ? user?.id ?? null : null;
      const server = await collectServerData(userId);
      const device = collectLocalData();
      const payload = buildExportPayload({
        exportedAt: new Date().toISOString(),
        server,
        device,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `praxia-meus-dados-${stamp}.json`);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao gerar o arquivo.");
      setStatus("error");
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
          LGPD ART. 18 V
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
            Baixe um arquivo <b style={{ color: T.ink }}>JSON</b> com tudo que o Praxia
            guarda sobre você: portfólio, perfil de investidor, transações simuladas,
            preferências e caches deste dispositivo.
            {serverAvailable ? (
              <>
                {" "}Como você está logado, ele inclui também os{" "}
                <b style={{ color: T.ink }}>dados sincronizados no servidor</b>.
              </>
            ) : (
              <>
                {" "}Você não está logado, então ele traz apenas os dados{" "}
                <b style={{ color: T.ink }}>deste dispositivo</b>.
              </>
            )}
          </p>

          <p
            style={{
              marginTop: 12,
              fontFamily: T.body,
              fontSize: 12.5,
              color: T.ink50,
              lineHeight: 1.5,
            }}
          >
            O arquivo é gerado no seu navegador e não é enviado a lugar nenhum.
          </p>

          <button
            onClick={() => void handleExport()}
            disabled={status === "busy"}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "13px 16px",
              borderRadius: 999,
              background: status === "busy" ? `${accentColor}55` : accentColor,
              color: status === "busy" ? "rgba(255,255,255,0.6)" : "#0a0a10",
              border: "none",
              fontFamily: T.display,
              fontSize: 14,
              fontWeight: 600,
              cursor: status === "busy" ? "not-allowed" : "pointer",
              letterSpacing: -0.1,
              boxShadow: status === "busy" ? "none" : `0 10px 24px ${accentColor}33`,
            }}
          >
            {status === "busy" ? "Gerando…" : "Exportar meus dados (JSON)"}
          </button>

          {status === "done" && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: `${T.up}1a`,
                border: `0.5px solid ${T.up}55`,
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink70,
                lineHeight: 1.5,
              }}
            >
              Pronto — o download começou. Procure por <b>praxia-meus-dados-…json</b> na
              sua pasta de downloads.
            </div>
          )}

          {status === "error" && errorMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: `${T.down}1a`,
                border: `0.5px solid ${T.down}55`,
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink70,
                lineHeight: 1.5,
              }}
            >
              {errorMsg}
            </div>
          )}
        </PraxiaCard>
      </div>
    </div>
  );
}
