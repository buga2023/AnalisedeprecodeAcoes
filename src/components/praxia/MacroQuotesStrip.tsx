import { PraxiaTokens, fmt } from "./tokens";
import { DeltaPill } from "./Tag";
import { useMarketQuotes, type MarketQuote } from "@/hooks/useMarketQuotes";

function formatPrice(q: MarketQuote): string {
  if (q.price <= 0) return "—";
  if (q.type === "currency-usd") return `US$ ${q.price.toFixed(4)}`;
  if (q.type === "commodity") return `US$ ${fmt.compact(q.price)}`;
  if (q.code === "BTC" || q.code === "ETH") return fmt.brl(q.price);
  return `R$ ${q.price.toFixed(4)}`;
}

/** Macro quotes strip. (No props — caller passes accent via context if needed.) */
export function MacroQuotesStrip() {
  const T = PraxiaTokens;
  const { quotes, isLoading, error } = useMarketQuotes();

  const visible = quotes.filter((q) => q.price > 0);

  if (isLoading && visible.length === 0) {
    return (
      <div
        style={{
          padding: "10px 4px",
          fontFamily: T.body,
          fontSize: 11,
          color: T.ink50,
          letterSpacing: 0.4,
        }}
      >
        Carregando cotações macro…
      </div>
    );
  }

  if (error && visible.length === 0) return null;

  return (
    <div
      className="praxia-scroll"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        overflowY: "hidden",
        margin: "0 -16px",
        padding: "2px 16px 8px",
        scrollSnapType: "x proximity",
      }}
    >
      {visible.map((q) => (
        <div
          key={q.code}
          style={{
            flex: "0 0 auto",
            minWidth: 124,
            scrollSnapAlign: "start",
            padding: "10px 12px",
            borderRadius: 14,
            background: "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 100%)",
            border: `0.5px solid ${T.hairline}`,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: T.display,
                fontSize: 11.5,
                fontWeight: 600,
                color: T.ink70,
                letterSpacing: 0.4,
              }}
            >
              {q.code}
            </span>
            <DeltaPill value={q.pctChange} size="sm" />
          </div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 13,
              color: T.ink,
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: -0.2,
            }}
            title={q.name}
          >
            {formatPrice(q)}
          </div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 10,
              color: T.ink30,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {q.name}
          </div>
        </div>
      ))}
    </div>
  );
}
