import { useEffect, useMemo, useState } from "react";
import { PraxiaTokens, fmt, genSeries } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import { Sparkline } from "../Charts";
import { StockAvatar } from "../StockAvatar";
import { SectionHeader } from "../SectionHeader";
import { HoldingRow } from "../HoldingRow";
import type { Stock, InvestorProfile, MarketType } from "@/types/stock";
import { fetchStockQuote } from "@/lib/api";
import { detectMarket } from "@/lib/stockMeta";
import { riskLabel } from "@/hooks/useInvestorProfile";

type Tab = "trending" | "para-voce" | "watchlist" | "B3" | "NASDAQ";

const TAB_LABELS: Record<Tab, string> = {
  trending: "Em alta",
  "para-voce": "Para você",
  watchlist: "Watchlist",
  B3: "B3",
  NASDAQ: "NASDAQ",
};

const TABS: Tab[] = ["trending", "para-voce", "watchlist", "B3", "NASDAQ"];

interface ScreenMarketProps {
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
  onOpenStock: (s: Stock) => void;
  onAddTicker: (ticker: string) => Promise<boolean>;
}

export function ScreenMarket({
  stocks,
  profile,
  accent = PraxiaTokens.accent,
  onOpenStock,
  onAddTicker,
}: ScreenMarketProps) {
  const T = PraxiaTokens;
  const [tab, setTab] = useState<Tab>("trending");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Stock | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    setSearchResult(null);
    setSearchError(null);
  }, [search]);

  const list = useMemo(() => {
    if (tab === "B3") return stocks.filter((s) => s.market === "B3");
    if (tab === "NASDAQ") return stocks.filter((s) => s.market === "NASDAQ");
    if (tab === "watchlist") return stocks.filter((s) => s.isFavorite);
    if (tab === "para-voce") {
      // ranking pelo score fundamentalista
      return [...stocks].sort((a, b) => b.score - a.score);
    }
    // trending: maiores |changePercent|
    return [...stocks].sort(
      (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)
    );
  }, [stocks, tab]);

  const movers = useMemo(
    () => [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5),
    [stocks]
  );

  const tryFetch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const q = await fetchStockQuote(search.trim().toUpperCase());
      const mockStock: Stock = {
        ticker: q.symbol,
        price: q.regularMarketPrice ?? 0,
        cost: 0,
        quantity: 0,
        lpa: q.earningsPerShare ?? 0,
        vpa: q.bookValue ?? 0,
        roe: q.financialData?.returnOnEquity ?? 0,
        debtToEbitda: 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        lastUpdated: q.regularMarketTime ?? new Date().toISOString(),
        score: 0,
        scoreBreakdown: {
          priceScore: 0,
          profitabilityScore: 0,
          healthScore: 0,
          dividendScore: 0,
          valuationScore: 0,
        },
        isFavorite: false,
        pl: q.priceEarnings ?? 0,
        pvp: 0,
        dividendYield: q.dividendYield ?? 0,
        evEbitda: 0,
        netMargin: 0,
        ebitdaMargin: 0,
        name: q.shortName ?? q.symbol,
        market: detectMarket(q.symbol) as MarketType,
        sector: "—",
      };
      setSearchResult(mockStock);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Erro na busca");
    } finally {
      setSearching(false);
    }
  };

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
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontFamily: T.display,
              fontSize: 24,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.6,
            }}
          >
            Mercado
          </div>
          <GlassButton ariaLabel="Filtros">
            <Icon.filter size={16} color={T.ink70} />
          </GlassButton>
        </div>

        {/* search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryFetch();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 44,
            padding: "0 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            border: `0.5px solid ${T.hairline}`,
            color: T.ink,
            marginBottom: 14,
          }}
        >
          <Icon.search size={16} color={T.ink50} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="Buscar ticker (ex: PETR4, AAPL)…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: T.ink,
              fontFamily: T.body,
              fontSize: 14,
            }}
          />
          {search && (
            <button
              type="submit"
              disabled={searching}
              style={{
                background: accent,
                color: "white",
                border: "none",
                borderRadius: 8,
                height: 28,
                padding: "0 10px",
                fontSize: 11.5,
                fontWeight: 700,
                fontFamily: T.body,
                cursor: searching ? "not-allowed" : "pointer",
              }}
            >
              {searching ? "..." : "Buscar"}
            </button>
          )}
        </form>

        {searchError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(255,107,129,0.08)",
              border: "0.5px solid rgba(255,107,129,0.3)",
              color: T.down,
              fontFamily: T.body,
              fontSize: 12.5,
              marginBottom: 14,
            }}
          >
            {searchError}
          </div>
        )}

        {searchResult && (
          <PraxiaCard padding={14} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <StockAvatar ticker={searchResult.ticker} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: 15,
                    color: T.ink,
                  }}
                >
                  {searchResult.ticker}
                </div>
                <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50 }}>
                  {searchResult.name} · {fmt.brl(searchResult.price)}
                </div>
              </div>
              <button
                onClick={async () => {
                  const ok = await onAddTicker(searchResult.ticker);
                  if (ok) {
                    setSearchResult(null);
                    setSearch("");
                  }
                }}
                style={{
                  height: 36,
                  padding: "0 14px",
                  background: accent,
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  fontFamily: T.body,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Adicionar
              </button>
            </div>
          </PraxiaCard>
        )}

        {/* tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            marginBottom: 14,
            paddingBottom: 4,
            paddingLeft: 4,
            paddingRight: 4,
            marginLeft: -4,
            marginRight: -4,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 999,
                whiteSpace: "nowrap",
                background: tab === t ? T.ink : "rgba(255,255,255,0.05)",
                color: tab === t ? "#05071a" : T.ink70,
                border: tab === t ? "none" : `0.5px solid ${T.hairline}`,
                fontFamily: T.body,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Pra curadoria strip */}
        {tab === "para-voce" && profile && (
          <PraxiaCard
            padding={14}
            style={{
              background: `linear-gradient(160deg, ${accent}1a 0%, ${accent}05 100%)`,
              border: `0.5px solid ${accent}44`,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <PraMark size={22} accent={accent} />
              <div
                style={{
                  fontFamily: T.display,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.ink,
                }}
              >
                Pra · curadoria do dia
              </div>
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12.5,
                color: T.ink70,
                lineHeight: 1.45,
              }}
            >
              Ranking ordenado pelo score fundamentalista para seu perfil{" "}
              <b style={{ color: T.ink }}>{riskLabel(profile.risk).toLowerCase()}</b>.
            </div>
          </PraxiaCard>
        )}

        {/* movers strip */}
        {movers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionHeader label="Em destaque hoje" />
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                marginLeft: -4,
                marginRight: -4,
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              {movers.map((s) => (
                <MoverCard
                  key={s.ticker}
                  stock={s}
                  onClick={() => onOpenStock(s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* main list */}
        {list.length === 0 ? (
          <PraxiaCard padding={24}>
            <div
              style={{
                textAlign: "center",
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink50,
              }}
            >
              {tab === "watchlist"
                ? "Sua watchlist está vazia. Toque na estrela em uma ação."
                : "Nenhum ativo aqui ainda."}
            </div>
          </PraxiaCard>
        ) : (
          <PraxiaCard padding={4}>
            {list.map((s, i) => (
              <HoldingRow
                key={s.ticker}
                stock={s}
                onClick={() => onOpenStock(s)}
                isLast={i === list.length - 1}
              />
            ))}
          </PraxiaCard>
        )}
      </div>
    </div>
  );
}

function MoverCard({ stock, onClick }: { stock: Stock; onClick: () => void }) {
  const T = PraxiaTokens;
  const positive = stock.changePercent >= 0;
  const seed = stock.ticker.charCodeAt(0) + (stock.ticker.charCodeAt(1) || 0);
  const series = genSeries(seed, 30, 100, 0.02, positive ? 0.002 : -0.001);
  return (
    <button
      onClick={onClick}
      style={{
        width: 130,
        flexShrink: 0,
        padding: 12,
        borderRadius: 18,
        background: "rgba(255,255,255,0.04)",
        border: `0.5px solid ${T.hairline}`,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        textAlign: "left",
        color: T.ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StockAvatar ticker={stock.ticker} color={stock.brandColor} size={26} />
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 13,
            color: T.ink,
          }}
        >
          {stock.ticker}
        </div>
      </div>
      <Sparkline values={series} w={106} h={26} color={positive ? T.up : T.down} />
      <div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 13,
            color: T.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt.brl(stock.price)}
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11,
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
