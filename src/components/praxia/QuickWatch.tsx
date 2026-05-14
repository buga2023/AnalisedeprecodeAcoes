import { PraxiaTokens, fmt, genSeries } from "./tokens";
import { StockAvatar } from "./StockAvatar";
import { Sparkline } from "./Charts";
import { DeltaPill } from "./Tag";
import { GlassButton } from "./GlassButton";
import { Icon } from "./Icon";
import type { Stock } from "@/types/stock";

interface QuickWatchProps {
  stock: Stock;
  open: boolean;
  accent?: string;
  onClose: () => void;
  onBuy: () => void;
  onSell: () => void;
  onSeeDetail: () => void;
}

export function QuickWatch({
  stock,
  open,
  accent = PraxiaTokens.accent,
  onClose,
  onBuy,
  onSell,
  onSeeDetail,
}: QuickWatchProps) {
  const T = PraxiaTokens;
  if (!open) return null;
  const positive = stock.changePercent >= 0;
  const owned = (stock.quantity || 0) > 0;
  const positionValue = stock.quantity * stock.price;
  const todayPnL = stock.quantity * stock.change;
  const series = genSeries(
    stock.ticker.charCodeAt(0) + (stock.ticker.charCodeAt(1) || 0),
    40,
    100,
    0.02,
    positive ? 0.002 : -0.0015
  );

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          background: "rgba(2, 3, 20, 0.55)",
          backdropFilter: "blur(5px)",
          animation: "praFadeIn 0.18s ease-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          padding: "16px 16px 24px",
          background: `
            radial-gradient(120% 80% at 80% 0%, ${accent}22 0%, transparent 60%),
            linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 80%)
          `,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          border: `0.5px solid ${T.hairlineStrong}`,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "praSlideUp 0.28s cubic-bezier(.2,.7,.3,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StockAvatar ticker={stock.ticker} color={stock.brandColor} size={42} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 17,
                fontWeight: 600,
                color: T.ink,
              }}
            >
              {stock.ticker}
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12.5,
                color: T.ink50,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 200,
              }}
            >
              {stock.name ?? stock.ticker} · {stock.market ?? "—"}
            </div>
          </div>
          <GlassButton onClick={onClose} ariaLabel="Fechar">
            <Icon.close size={14} color={T.ink70} />
          </GlassButton>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 36,
                fontWeight: 600,
                color: T.ink,
                letterSpacing: -1.2,
                lineHeight: 1.05,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt.brl(stock.price)}
            </div>
            <div style={{ marginTop: 6 }}>
              <DeltaPill value={stock.changePercent} />
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
            <Sparkline
              values={series}
              w={120}
              h={48}
              color={positive ? T.up : T.down}
              strokeWidth={2}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <MiniStat label="Posição" value={owned ? `${stock.quantity}` : "—"} />
          <MiniStat
            label="Valor mercado"
            value={owned ? fmt.brl(positionValue) : "—"}
          />
          <MiniStat
            label="P/L hoje"
            value={owned ? fmt.brl(todayPnL) : "—"}
            color={owned ? (todayPnL >= 0 ? T.up : T.down) : T.ink50}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={!owned}
            onClick={onSell}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 999,
              background: owned ? "rgba(255,107,129,0.12)" : "rgba(255,255,255,0.04)",
              color: owned ? T.down : T.ink30,
              border: owned
                ? "0.5px solid rgba(255,107,129,0.3)"
                : `0.5px solid ${T.hairline}`,
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 14,
              cursor: owned ? "pointer" : "not-allowed",
            }}
          >
            Vender
          </button>
          <button
            onClick={onBuy}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 999,
              background: accent,
              color: "white",
              border: "none",
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: `0 12px 30px ${accent}55`,
            }}
          >
            Comprar
          </button>
        </div>

        <button
          onClick={onSeeDetail}
          style={{
            background: "none",
            border: "none",
            color: accent,
            fontFamily: T.body,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            paddingTop: 4,
          }}
        >
          Ver análise completa →
        </button>
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.04)",
        border: `0.5px solid ${T.hairline}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontFamily: T.body,
          fontSize: 10.5,
          color: T.ink50,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontFamily: T.mono,
          fontSize: 13.5,
          color: color ?? T.ink,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
