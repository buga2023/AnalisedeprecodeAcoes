import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import { StockAvatar } from "../StockAvatar";
import type { OrderType, Stock, TransactionType } from "@/types/stock";

interface OrderDraft {
  shares: number;
  total: number;
  fee: number;
  orderType: OrderType;
  type: TransactionType;
}

interface ScreenOrderReviewProps {
  stock: Stock;
  draft: OrderDraft;
  totalPortfolio: number;
  accent?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ScreenOrderReview({
  stock,
  draft,
  totalPortfolio,
  accent = PraxiaTokens.accent,
  onClose,
  onConfirm,
}: ScreenOrderReviewProps) {
  const T = PraxiaTokens;
  const sharePct =
    totalPortfolio > 0
      ? ((draft.total / totalPortfolio) * 100).toFixed(1)
      : (100).toFixed(1);

  return (
    <div
      className="praxia-scroll pra-screen"
      key={`review-${stock.ticker}-${draft.type}`}
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
          position: "absolute",
          top: -80,
          right: -80,
          width: 320,
          height: 320,
          background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
          filter: "blur(20px)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
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
          <GlassButton onClick={onClose} ariaLabel="Fechar">
            <Icon.close size={16} color={T.ink70} />
          </GlassButton>
          <div style={{ display: "flex", gap: 8 }}>
            <GlassButton ariaLabel="Compartilhar">
              <Icon.share size={14} color={T.ink70} />
            </GlassButton>
            <GlassButton ariaLabel="Mais">
              <Icon.dots size={14} color={T.ink70} />
            </GlassButton>
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 32,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.8,
              lineHeight: 1.05,
            }}
          >
            Revisar {draft.type === "buy" ? "compra" : "venda"}
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: T.body,
              fontSize: 13.5,
              color: T.ink70,
            }}
          >
            Confirme os detalhes antes de registrar a ordem.
          </div>
        </div>

        <PraxiaCard padding={18}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StockAvatar ticker={stock.ticker} color={stock.brandColor} size={42} />
            <div>
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: 16,
                  color: T.ink,
                }}
              >
                {stock.ticker}
              </div>
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>
                {stock.name ?? stock.ticker}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: T.display,
              fontSize: 38,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -1.2,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt.brl(draft.total)}
          </div>
          <div style={{ marginTop: 6, fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>
            {draft.shares} ações × {fmt.brl(stock.price)} ·{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </div>
        </PraxiaCard>

        <PraxiaCard padding={16}>
          <ReviewRow lbl="Tipo de ordem" val={draft.orderType} />
          <ReviewRow lbl="Ações" val={String(draft.shares)} />
          <ReviewRow lbl="Preço por ação" val={fmt.brl(stock.price)} />
          <ReviewRow lbl="Taxa de transação" val={fmt.brl(draft.fee)} />
          <div style={{ height: 0.5, background: T.hairline, margin: "12px 0" }} />
          <ReviewRow lbl="Total estimado" val={fmt.brl(draft.total)} accent />
        </PraxiaCard>

        <PraxiaCard
          padding={14}
          style={{
            background: `linear-gradient(160deg, ${accent}10 0%, ${accent}03 100%)`,
            border: `0.5px solid ${accent}33`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <PraMark size={22} accent={accent} />
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 12.5,
                color: T.ink,
              }}
            >
              Verificação do app
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 9,
                color: T.ink50,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                border: `0.5px solid ${T.hairline}`,
                letterSpacing: 0.6,
              }}
              title="Cálculo determinístico — sem IA."
            >
              NÃO É IA
            </div>
          </div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12.5,
              color: T.ink,
              lineHeight: 1.5,
            }}
          >
            {draft.type === "buy"
              ? `Essa compra deixa ${stock.ticker} em ${sharePct}% da carteira pós-ordem. Simulação local (paper trading).`
              : `Você está reduzindo posição em ${stock.ticker}. A simulação atualiza sua carteira local.`}
          </div>
          <div
            style={{
              marginTop: 8,
              paddingTop: 6,
              borderTop: `0.5px dashed ${T.hairline}`,
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink50,
              letterSpacing: 0.4,
            }}
          >
            fonte: cálculo do app (preço atual via BrAPI × quantidade)
          </div>
        </PraxiaCard>

        <button
          onClick={onConfirm}
          style={{
            marginTop: "auto",
            height: 56,
            borderRadius: 999,
            background: accent,
            color: "white",
            border: "none",
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: `0 16px 36px ${accent}55`,
            letterSpacing: -0.1,
          }}
        >
          Confirmar {draft.type === "buy" ? "compra" : "venda"}
        </button>
      </div>
    </div>
  );
}

function ReviewRow({
  lbl,
  val,
  accent: hl,
}: {
  lbl: string;
  val: string;
  accent?: boolean;
}) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        fontFamily: T.body,
      }}
    >
      <span style={{ color: T.ink70, fontSize: 13.5 }}>{lbl}</span>
      <span
        style={{
          color: T.ink,
          fontWeight: hl ? 700 : 600,
          fontFamily: T.mono,
          fontSize: hl ? 15 : 13.5,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {val}
      </span>
    </div>
  );
}
