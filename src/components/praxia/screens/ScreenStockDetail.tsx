import { useEffect, useMemo, useState } from "react";
import { PraxiaTokens, fmt, genSeries } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { AreaChart } from "../Charts";
import { StockAvatar } from "../StockAvatar";
import { Tag, DeltaPill } from "../Tag";
import type { Stock, InvestorProfile } from "@/types/stock";
import {
  fetchStockHistory,
  type HistoricalDataPoint,
  type HistoryRange,
} from "@/lib/api";
import { calculateGrahamValue, calculateMarginOfSafety } from "@/lib/calculators";
import { StockAIAnalysisSection } from "../StockAIAnalysisSection";
import { StockReportsSection } from "../StockReportsSection";

interface ScreenStockDetailProps {
  stock: Stock;
  profile: InvestorProfile | null;
  accent?: string;
  isFavorite: boolean;
  isOwned: boolean;
  onBack: () => void;
  onBuy: (s: Stock) => void;
  onSell: (s: Stock) => void;
  onToggleFavorite: () => void;
}

type RangeUI = "1D" | "5D" | "6M";

const RANGE_API: Record<RangeUI, HistoryRange> = {
  "1D": "1d",
  "5D": "5d",
  "6M": "6mo",
};

export function ScreenStockDetail({
  stock,
  profile,
  accent = PraxiaTokens.accent,
  isFavorite,
  isOwned,
  onBack,
  onBuy,
  onSell,
  onToggleFavorite,
}: ScreenStockDetailProps) {
  const T = PraxiaTokens;
  const [range, setRange] = useState<RangeUI>("6M");
  const [history, setHistory] = useState<HistoricalDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetchStockHistory(stock.ticker, RANGE_API[range])
      .then((points) => {
        if (cancelled) return;
        setHistory(points);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao buscar histórico");
        setHistory(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stock.ticker, range]);

  const series = useMemo(() => {
    if (history && history.length >= 2) return history.map((h) => h.close);
    // Fallback when API has no data
    const seed = stock.ticker.charCodeAt(0) + (stock.ticker.charCodeAt(1) || 0);
    return genSeries(
      seed,
      range === "1D" ? 24 : range === "5D" ? 30 : 60,
      stock.price,
      0.018,
      stock.changePercent >= 0 ? 0.0008 : -0.0006
    );
  }, [history, range, stock.ticker, stock.price, stock.changePercent]);

  const positive = stock.changePercent >= 0;
  const grahamValue = calculateGrahamValue(stock.lpa, stock.vpa);
  const margin = calculateMarginOfSafety(stock.price, grahamValue);
  const risk = profile?.risk ?? "mid";

  const praMessage = (() => {
    if (margin > 20) {
      return `Pelo seu perfil ${risk === "low" ? "conservador" : risk === "high" ? "arrojado" : "moderado"}, ${stock.ticker} está negociando ${margin.toFixed(1)}% abaixo do valor justo de Graham — boa janela de entrada.`;
    }
    if (margin < -10) {
      return `${stock.ticker} negocia ${Math.abs(margin).toFixed(1)}% acima do valor justo. Pode esperar correção ou olhar outras opções.`;
    }
    return `${stock.ticker} está próximo do valor justo (${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%). Avalie como combina com o restante da carteira.`;
  })();

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
          padding: "54px 16px 100px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div style={{ display: "flex", gap: 8 }}>
            <GlassButton onClick={onToggleFavorite} ariaLabel="Favoritar">
              <Icon.star size={16} color={isFavorite ? PraxiaTokens.warn : T.ink70} fill={isFavorite ? PraxiaTokens.warn : "none"} />
            </GlassButton>
            <GlassButton ariaLabel="Mais opções">
              <Icon.dots size={16} color={T.ink70} />
            </GlassButton>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StockAvatar ticker={stock.ticker} color={stock.brandColor} size={48} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: 20,
                  color: T.ink,
                  letterSpacing: -0.3,
                }}
              >
                {stock.ticker}
              </div>
              <Tag color="rgba(255,255,255,0.06)" text={T.ink50}>
                {stock.market ?? "—"}
              </Tag>
            </div>
            <div
              style={{
                fontSize: 13,
                color: T.ink50,
                fontFamily: T.body,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 260,
              }}
            >
              {stock.name ?? stock.ticker} · {stock.sector ?? "—"}
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: T.display,
            fontSize: 40,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: -1.2,
            lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt.brl(stock.price)}
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <DeltaPill value={stock.changePercent} />
          <span style={{ color: T.ink50, fontFamily: T.body, fontSize: 12.5 }}>
            hoje
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            marginLeft: -8,
            marginRight: -8,
            position: "relative",
            height: 150,
          }}
        >
          {loading ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink50,
              }}
            >
              Carregando histórico…
            </div>
          ) : (
            <AreaChart
              values={series}
              w={372}
              h={150}
              color={positive ? T.up : T.down}
              fillId={`sd-${stock.ticker}`}
              strokeWidth={2}
            />
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            padding: "0 4px",
          }}
        >
          {(["1D", "5D", "6M"] as RangeUI[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                flex: 1,
                margin: "0 2px",
                height: 30,
                fontFamily: T.mono,
                fontSize: 11,
                background: range === r ? accent : "transparent",
                color: range === r ? "white" : T.ink50,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              fontFamily: T.body,
              fontSize: 11,
              color: T.ink30,
              textAlign: "center",
            }}
          >
            {error} — exibindo aproximação.
          </div>
        )}

        {/* Heurística local — NÃO é IA. Cálculo determinístico do app. */}
        <PraxiaCard
          padding={14}
          style={{
            marginTop: 16,
            background: `linear-gradient(160deg, ${accent}10 0%, ${accent}03 100%)`,
            border: `0.5px solid ${accent}33`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                background: "rgba(255,255,255,0.06)",
                display: "grid",
                placeItems: "center",
                border: `0.5px solid ${T.hairline}`,
              }}
            >
              <Icon.shield size={14} color={accent} />
            </div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 13,
                color: T.ink,
              }}
            >
              Análise calculada
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 9,
                color: T.ink50,
                letterSpacing: 0.6,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                border: `0.5px solid ${T.hairline}`,
              }}
              title="Esse texto é gerado por regras determinísticas do app, sem IA."
            >
              NÃO É IA
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontFamily: T.mono,
                fontSize: 10,
                color: T.ink50,
                letterSpacing: 0.6,
              }}
            >
              SCORE{" "}
              <span
                style={{
                  color: stock.score >= 70 ? T.up : stock.score >= 40 ? PraxiaTokens.warn : T.down,
                  fontWeight: 700,
                }}
              >
                {stock.score}/100
              </span>
            </div>
          </div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 13,
              color: T.ink,
              lineHeight: 1.5,
            }}
          >
            {praMessage}
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: `0.5px dashed ${T.hairline}`,
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink50,
              letterSpacing: 0.4,
            }}
          >
            fonte: cálculo do app (Graham {grahamValue > 0 ? `R$ ${grahamValue.toFixed(2)}` : "indisponível"}, margem {grahamValue > 0 ? `${margin.toFixed(1)}%` : "—"}) + perfil do usuário
          </div>
        </PraxiaCard>

        {/* stats */}
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <Stat label="P/L" value={stock.pl > 0 ? `${stock.pl.toFixed(1)}x` : "N/D"} />
          <Stat label="P/VP" value={stock.pvp > 0 ? stock.pvp.toFixed(2) : "N/D"} />
          <Stat
            label="Div. Yield"
            value={stock.dividendYield > 0 ? `${(stock.dividendYield * 100).toFixed(2)}%` : "—"}
          />
          <Stat label="ROE" value={`${(stock.roe * 100).toFixed(1)}%`} />
          <Stat
            label="Preço-teto (Graham)"
            value={grahamValue > 0 ? fmt.brl(grahamValue) : "—"}
          />
          <Stat
            label="Margem de seg."
            value={grahamValue > 0 ? `${margin.toFixed(1)}%` : "—"}
          />
        </div>

        <StockAIAnalysisSection stock={stock} profile={profile} accent={accent} />

        <StockReportsSection ticker={stock.ticker} />

        {isOwned && (
          <div
            style={{
              marginTop: 16,
              fontFamily: T.body,
              fontSize: 12,
              color: T.ink50,
              textAlign: "center",
            }}
          >
            Posição atual: {stock.quantity} ações · valor {fmt.brl(stock.quantity * stock.price)}
          </div>
        )}
      </div>

      {/* sticky CTAs */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 16px 24px",
          background: "linear-gradient(180deg, transparent, rgba(2,3,20,0.95) 40%)",
          display: "flex",
          gap: 8,
          zIndex: 5,
        }}
      >
        <button
          disabled={!isOwned}
          onClick={() => onSell(stock)}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            background: isOwned ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            color: isOwned ? T.ink : T.ink30,
            border: "0.5px solid rgba(255,255,255,0.12)",
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 15,
            cursor: isOwned ? "pointer" : "not-allowed",
          }}
        >
          Vender
        </button>
        <button
          onClick={() => onBuy(stock)}
          style={{
            flex: 1.4,
            height: 52,
            borderRadius: 16,
            background: accent,
            color: "white",
            border: "none",
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: `0 12px 30px ${accent}55`,
          }}
        >
          Comprar
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const T = PraxiaTokens;
  return (
    <PraxiaCard padding={12}>
      <div
        style={{
          fontFamily: T.body,
          fontSize: 11,
          color: T.ink50,
          fontWeight: 500,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 16,
          color: T.ink,
          fontWeight: 500,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </PraxiaCard>
  );
}
