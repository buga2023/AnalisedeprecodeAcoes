import { PraxiaTokens, fmt, genSeries } from "./tokens";
import { StockAvatar } from "./StockAvatar";
import { Sparkline } from "./Charts";
import type { Stock } from "@/types/stock";

interface HoldingRowProps {
  stock: Stock;
  onClick?: () => void;
  isLast?: boolean;
  showValue?: boolean;
}

export function HoldingRow({ stock, onClick, isLast = false, showValue = true }: HoldingRowProps) {
  const T = PraxiaTokens;
  const positive = stock.changePercent >= 0;
  const seed = stock.ticker.charCodeAt(0) + (stock.ticker.charCodeAt(1) || 0);
  const series = genSeries(seed, 30, 100, 0.02, positive ? 0.002 : -0.001);
  const positionValue = (stock.quantity || 0) * stock.price;

  return (
    <button
      onClick={onClick}
      className={onClick ? "pra-row" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px",
        width: "100%",
        background: "transparent",
        border: "none",
        cursor: onClick ? "pointer" : "default",
        borderBottom: isLast ? "none" : `0.5px solid ${T.hairline}`,
        color: T.ink,
        textAlign: "left",
        borderRadius: 12,
      }}
    >
      <StockAvatar ticker={stock.ticker} color={stock.brandColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 14.5,
            color: T.ink,
            letterSpacing: -0.1,
          }}
        >
          {stock.ticker}
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.ink50,
            fontFamily: T.body,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 160,
          }}
        >
          {stock.name ?? stock.ticker}
        </div>
      </div>
      <Sparkline values={series} w={48} h={22} color={positive ? T.up : T.down} />
      <div style={{ textAlign: "right", minWidth: 90 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 13.5,
            color: T.ink,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
          }}
        >
          {showValue && positionValue > 0 ? fmt.brl(positionValue) : fmt.brl(stock.price)}
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11.5,
            color: positive ? T.up : T.down,
            fontWeight: 600,
          }}
        >
          {fmt.pct(stock.changePercent)}
        </div>
      </div>
    </button>
  );
}
