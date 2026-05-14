import { useState } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { StockAvatar } from "../StockAvatar";
import type { Stock, OrderType, TransactionType } from "@/types/stock";

interface OrderDraft {
  shares: number;
  total: number;
  fee: number;
  orderType: OrderType;
  type: TransactionType;
}

interface ScreenOrderProps {
  stock: Stock;
  type: TransactionType;
  accent?: string;
  maxShares?: number;
  onBack: () => void;
  onConfirm: (draft: OrderDraft) => void;
}

export function ScreenOrder({
  stock,
  type,
  accent = PraxiaTokens.accent,
  maxShares,
  onBack,
  onConfirm,
}: ScreenOrderProps) {
  const T = PraxiaTokens;
  const [shares, setShares] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>("Mercado");
  const total = shares * stock.price;
  const fee = 0;

  const sellMax = type === "sell" ? Math.max(0, maxShares ?? stock.quantity ?? 0) : undefined;
  const overSellLimit = sellMax !== undefined && shares > sellMax;
  const canConfirm = shares > 0 && !overSellLimit;

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
          padding: "54px 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <GlassButton onClick={onBack} ariaLabel="Fechar">
            <Icon.close size={16} color={T.ink70} />
          </GlassButton>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 14,
              fontWeight: 600,
              color: T.ink70,
            }}
          >
            {type === "buy" ? "Nova compra" : "Nova venda"}
          </div>
          <div style={{ width: 38 }} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <StockAvatar ticker={stock.ticker} color={stock.brandColor} size={42} />
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 17,
                color: T.ink,
              }}
            >
              {stock.ticker}
            </div>
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>
              {stock.name ?? stock.ticker} · {fmt.brl(stock.price)}
            </div>
          </div>
        </div>

        <PraxiaCard padding={20}>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12,
              color: T.ink50,
              fontWeight: 500,
              letterSpacing: 0.2,
            }}
          >
            Quantidade {sellMax !== undefined ? `(máx. ${sellMax})` : ""}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <StepperButton onClick={() => setShares((s) => Math.max(1, s - 1))}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.ink}
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M5 12h14" />
              </svg>
            </StepperButton>
            <input
              type="number"
              min={1}
              value={shares}
              onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                flex: 1,
                textAlign: "center",
                background: "transparent",
                border: "none",
                fontFamily: T.display,
                fontSize: 44,
                fontWeight: 600,
                color: overSellLimit ? T.down : T.ink,
                outline: "none",
                letterSpacing: -1.5,
                fontVariantNumeric: "tabular-nums",
                width: "100%",
              }}
            />
            <StepperButton onClick={() => setShares((s) => s + 1)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.ink}
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M5 12h14M12 5v14" />
              </svg>
            </StepperButton>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            {[1, 5, 10, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setShares(n)}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 8,
                  background: shares === n ? `${accent}25` : "rgba(255,255,255,0.04)",
                  color: shares === n ? accent : T.ink50,
                  border:
                    shares === n
                      ? `0.5px solid ${accent}55`
                      : `0.5px solid ${T.hairline}`,
                  fontFamily: T.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          {overSellLimit && (
            <div
              style={{
                marginTop: 8,
                fontFamily: T.body,
                fontSize: 11.5,
                color: T.down,
              }}
            >
              Você não possui essa quantidade ({sellMax} disponíveis).
            </div>
          )}
        </PraxiaCard>

        <div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12,
              color: T.ink50,
              fontWeight: 500,
              letterSpacing: 0.2,
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            Tipo de ordem
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Mercado", "Limite", "Stop"] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  background: orderType === t ? `${accent}25` : "rgba(255,255,255,0.04)",
                  color: orderType === t ? T.ink : T.ink70,
                  border:
                    orderType === t
                      ? `1px solid ${accent}`
                      : `0.5px solid ${T.hairline}`,
                  fontFamily: T.body,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <PraxiaCard padding={16}>
          <SummaryRow lbl="Preço estimado" val={fmt.brl(stock.price)} />
          <SummaryRow lbl="Quantidade" val={`${shares} ações`} />
          <SummaryRow lbl="Taxa" val={fmt.brl(fee)} />
          <div style={{ height: 0.5, background: T.hairline, margin: "10px 0" }} />
          <SummaryRow lbl="Total estimado" val={fmt.brl(total)} bold />
        </PraxiaCard>

        <button
          disabled={!canConfirm}
          onClick={() => onConfirm({ shares, total, fee, orderType, type })}
          style={{
            marginTop: "auto",
            height: 56,
            borderRadius: 999,
            background: canConfirm ? accent : "rgba(255,255,255,0.1)",
            color: canConfirm ? "white" : "rgba(255,255,255,0.4)",
            border: "none",
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 16,
            cursor: canConfirm ? "pointer" : "not-allowed",
            boxShadow: canConfirm ? `0 16px 36px ${accent}55` : "none",
            letterSpacing: -0.1,
          }}
        >
          Revisar {type === "buy" ? "compra" : "venda"} · {fmt.brl(total)}
        </button>
      </div>
    </div>
  );
}

function StepperButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  const T = PraxiaTokens;
  return (
    <button
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        background: "rgba(255,255,255,0.06)",
        border: `0.5px solid ${T.hairline}`,
        color: T.ink,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function SummaryRow({
  lbl,
  val,
  bold,
}: {
  lbl: string;
  val: string;
  bold?: boolean;
}) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 0",
        fontFamily: T.body,
        fontSize: bold ? 15 : 13.5,
      }}
    >
      <span style={{ color: bold ? T.ink : T.ink70, fontWeight: bold ? 600 : 500 }}>
        {lbl}
      </span>
      <span
        style={{
          color: T.ink,
          fontWeight: bold ? 700 : 600,
          fontFamily: T.mono,
          fontVariantNumeric: "tabular-nums",
          fontSize: bold ? 16 : 13.5,
        }}
      >
        {val}
      </span>
    </div>
  );
}
