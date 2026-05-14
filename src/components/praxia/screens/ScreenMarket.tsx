import { useEffect, useMemo, useState } from "react";
import { PraxiaTokens, fmt, genSeries } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import { Sparkline } from "../Charts";
import { StockAvatar } from "../StockAvatar";
import { SectionHeader } from "../SectionHeader";
import { HoldingRow } from "../HoldingRow";
import type { Stock, InvestorProfile, MarketType } from "@/types/stock";
import { fetchStockQuote, TickerLookupError } from "@/lib/api";
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

/** Tickers we always surface as discovery suggestions in each tab. */
const DISCOVERY_B3 = [
  "PETR4",
  "VALE3",
  "ITUB4",
  "BBDC4",
  "BBAS3",
  "WEGE3",
  "RENT3",
  "PRIO3",
  "TAEE11",
  "RADL3",
  "ABEV3",
  "ELET3",
];

const DISCOVERY_NASDAQ = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX"];

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
  const [searchSuggestions, setSearchSuggestions] = useState<{ stock: string; name?: string }[]>([]);

  useEffect(() => {
    setSearchResult(null);
    setSearchError(null);
    setSearchSuggestions([]);
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

  /** Tickers we suggest in this tab that the user does NOT already hold. */
  const discoveryTickers = useMemo(() => {
    const owned = new Set(stocks.map((s) => s.ticker.toUpperCase()));
    const base =
      tab === "NASDAQ"
        ? DISCOVERY_NASDAQ
        : tab === "B3" || tab === "trending" || tab === "para-voce"
        ? DISCOVERY_B3
        : [];
    return base.filter((t) => !owned.has(t)).slice(0, 8);
  }, [stocks, tab]);

  const movers = useMemo(
    () => [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5),
    [stocks]
  );

  const tryFetch = async (overrideTicker?: string) => {
    const term = (overrideTicker ?? search).trim().toUpperCase();
    if (!term) return;
    if (overrideTicker) setSearch(overrideTicker);
    setSearching(true);
    setSearchError(null);
    setSearchSuggestions([]);
    try {
      const q = await fetchStockQuote(term);
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
      if (err instanceof TickerLookupError) {
        setSearchError(err.message);
        setSearchSuggestions(err.suggestions);
      } else {
        setSearchError(err instanceof Error ? err.message : "Erro na busca");
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div
      className="praxia-scroll pra-screen"
      key="market"
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
          <div>
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
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11.5,
                color: T.ink50,
                marginTop: 2,
              }}
            >
              {stocks.length === 0
                ? "Comece adicionando uma ação"
                : `${stocks.length} ${stocks.length === 1 ? "ativo" : "ativos"} na carteira`}
            </div>
          </div>
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
            id="market-search"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ticker (ex: PETR4, AAPL)…"
            autoCapitalize="characters"
            spellCheck={false}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: T.ink,
              fontFamily: T.body,
              fontSize: 14,
              textTransform: "uppercase",
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
              marginBottom: searchSuggestions.length > 0 ? 8 : 14,
              lineHeight: 1.4,
            }}
          >
            {searchError}
          </div>
        )}

        {searchSuggestions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                color: T.ink50,
                letterSpacing: 0.8,
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              Você quis dizer?
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {searchSuggestions.slice(0, 6).map((s) => (
                <button
                  key={s.stock}
                  onClick={() => tryFetch(s.stock)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: `${accent}1f`,
                    border: `0.5px solid ${accent}55`,
                    color: accent,
                    fontFamily: T.mono,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title={s.name}
                >
                  {s.stock}
                </button>
              ))}
            </div>
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
                color: tab === t ? T.bg : T.ink70,
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
        {list.length === 0 && discoveryTickers.length === 0 ? (
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
          <>
            {list.length > 0 && (
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

            {discoveryTickers.length > 0 && (
              <div style={{ marginTop: list.length > 0 ? 18 : 0 }}>
                <SectionHeader
                  label={
                    tab === "NASDAQ"
                      ? "Descobrir na NASDAQ"
                      : tab === "B3"
                      ? "Descobrir na B3"
                      : "Sugestões pra estudar"
                  }
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {discoveryTickers.map((tk) => (
                    <DiscoveryChip
                      key={tk}
                      ticker={tk}
                      accent={accent}
                      onPick={async () => {
                        const ok = await onAddTicker(tk);
                        if (!ok) {
                          // already surfaced via error state above
                        }
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: T.body,
                    fontSize: 11,
                    color: T.ink30,
                    textAlign: "center",
                  }}
                >
                  Toque pra adicionar à sua carteira de paper trading.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DiscoveryChip({
  ticker,
  accent,
  onPick,
}: {
  ticker: string;
  accent: string;
  onPick: () => Promise<void> | void;
}) {
  const T = PraxiaTokens;
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        if (loading) return;
        setLoading(true);
        try {
          await onPick();
        } finally {
          setLoading(false);
        }
      }}
      className="pra-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 52,
        padding: "0 12px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: `0.5px solid ${T.hairline}`,
        color: T.ink,
        cursor: loading ? "wait" : "pointer",
        textAlign: "left",
      }}
    >
      <StockAvatar ticker={ticker} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 13.5,
            color: T.ink,
          }}
        >
          {ticker}
        </div>
        <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>
          {detectMarket(ticker)} · adicionar
        </div>
      </div>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          background: `${accent}1f`,
          color: accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: PraxiaTokens.mono,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {loading ? "…" : "+"}
      </span>
    </button>
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
