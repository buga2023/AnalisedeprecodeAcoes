import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { SectionHeader } from "../SectionHeader";
import { alertTypeLabel, formatAlertTrigger } from "@/hooks/useAlerts";
import type { PriceAlert } from "@/types/stock";

interface ScreenAlertsProps {
  accent?: string;
  alerts: PriceAlert[];
  permission: NotificationPermission | "unavailable";
  onBack: () => void;
  onRequestPermission: () => void;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
}

export function ScreenAlerts({
  accent = PraxiaTokens.accent,
  alerts,
  permission,
  onBack,
  onRequestPermission,
  onRemove,
  onReset,
}: ScreenAlertsProps) {
  const T = PraxiaTokens;
  const active = alerts.filter((a) => !a.triggeredAt);
  const triggered = alerts.filter((a) => !!a.triggeredAt);

  return (
    <div
      className="praxia-scroll"
      style={{
        position: "relative",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 16px 120px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 22,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.4,
            }}
          >
            Alertas
          </div>
        </div>

        {permission !== "granted" && permission !== "unavailable" && (
          <PraxiaCard
            padding={14}
            style={{
              background: `${accent}10`,
              border: `0.5px solid ${accent}55`,
            }}
          >
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink,
                lineHeight: 1.5,
              }}
            >
              Para receber alertas no navegador, autorize as notificações.
            </div>
            <button
              onClick={onRequestPermission}
              style={{
                marginTop: 10,
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                background: accent,
                color: "white",
                border: "none",
                fontFamily: T.body,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: `0 6px 18px ${accent}55`,
              }}
            >
              Ativar notificações
            </button>
          </PraxiaCard>
        )}

        {alerts.length === 0 && (
          <PraxiaCard padding={20}>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink70,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Nenhum alerta ainda. Abra uma ação e toque em <b style={{ color: T.ink }}>Criar alerta</b>{" "}
              para ser avisado quando o preço, a margem Graham ou a queda do dia bater seu gatilho.
            </div>
          </PraxiaCard>
        )}

        {active.length > 0 && (
          <>
            <SectionHeader label={`Ativos (${active.length})`} />
            <PraxiaCard padding={4}>
              {active.map((a, i) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  isLast={i === active.length - 1}
                  onRemove={() => onRemove(a.id)}
                />
              ))}
            </PraxiaCard>
          </>
        )}

        {triggered.length > 0 && (
          <>
            <SectionHeader label={`Disparados (${triggered.length})`} />
            <PraxiaCard padding={4}>
              {triggered.map((a, i) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  isLast={i === triggered.length - 1}
                  onRemove={() => onRemove(a.id)}
                  onReset={() => onReset(a.id)}
                />
              ))}
            </PraxiaCard>
          </>
        )}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  isLast,
  onRemove,
  onReset,
}: {
  alert: PriceAlert;
  isLast: boolean;
  onRemove: () => void;
  onReset?: () => void;
}) {
  const T = PraxiaTokens;
  const triggered = !!alert.triggeredAt;
  const accentColor = triggered ? T.warn : T.ink70;

  return (
    <div
      style={{
        padding: "12px 12px",
        borderBottom: isLast ? "none" : `0.5px solid ${T.hairline}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: triggered ? "rgba(255,200,87,0.16)" : "rgba(255,255,255,0.06)",
          border: `0.5px solid ${triggered ? "rgba(255,200,87,0.4)" : T.hairline}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon.bell size={14} color={accentColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 13.5,
            color: T.ink,
          }}
        >
          {alert.ticker} · {alertTypeLabel(alert.type)} {formatAlertTrigger(alert)}
        </div>
        <div
          style={{
            fontFamily: T.body,
            fontSize: 11.5,
            color: T.ink50,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {triggered
            ? `Disparado em ${new Date(alert.triggeredAt!).toLocaleString("pt-BR")}${alert.triggerPrice ? ` a ${fmt.brl(alert.triggerPrice)}` : ""}`
            : alert.note || `Criado em ${new Date(alert.createdAt).toLocaleDateString("pt-BR")}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {onReset && (
          <button
            onClick={onReset}
            aria-label="Reativar"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: `0.5px solid ${T.hairline}`,
              color: T.ink70,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            title="Reativar"
          >
            <Icon.refresh size={14} color={T.ink70} />
          </button>
        )}
        <button
          onClick={onRemove}
          aria-label="Remover"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(255,107,129,0.08)",
            border: "0.5px solid rgba(255,107,129,0.3)",
            color: T.down,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon.trash size={13} color={T.down} />
        </button>
      </div>
    </div>
  );
}
