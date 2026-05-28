import { useMemo } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { PraxiaCard } from "../PraxiaCard";
import { SectionHeader } from "../SectionHeader";
import { HoldingRow } from "../HoldingRow";
import { PortfolioScoreHero } from "../PortfolioScoreHero";
import { PortfolioInsightsContent } from "../PortfolioInsightsContent";
import { DeltaPill } from "../Tag";
import type { InvestorProfile, Stock } from "@/types/stock";
import {
  dominantSector,
  sectorAllocation,
  todayChangeValue,
  totalCostBasis,
  totalPortfolioValue,
} from "@/lib/portfolio";
import { portfolioScore } from "@/lib/portfolioScore";

interface ScreenAnalysisProps {
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
  activeAlertCount?: number;
  onBack: () => void;
  onAddStock: () => void;
  onOpenStock: (stock: Stock) => void;
  onOpenAlerts: () => void;
  onOpenCompare: (ticker: string) => void;
}

export function ScreenAnalysis({
  stocks,
  profile,
  accent = PraxiaTokens.accent,
  activeAlertCount = 0,
  onBack,
  onAddStock,
  onOpenStock,
  onOpenAlerts,
  onOpenCompare,
}: ScreenAnalysisProps) {
  const T = PraxiaTokens;
  const owned = useMemo(() => stocks.filter((s) => (s.quantity || 0) > 0), [stocks]);
  const totalValue = useMemo(() => totalPortfolioValue(stocks), [stocks]);
  const totalCost = useMemo(() => totalCostBasis(stocks), [stocks]);
  const dailyChange = useMemo(() => todayChangeValue(stocks), [stocks]);
  const todayPct = useMemo(() => {
    const prev = totalValue - dailyChange;
    return prev > 0 ? (dailyChange / prev) * 100 : 0;
  }, [dailyChange, totalValue]);
  const ytdPct = useMemo(() => {
    if (totalCost <= 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  }, [totalCost, totalValue]);
  const score = useMemo(() => portfolioScore(stocks), [stocks]);
  const allocation = useMemo(() => sectorAllocation(stocks), [stocks]);
  const overweight = useMemo(() => dominantSector(stocks, 40), [stocks]);
  const movers = useMemo(
    () =>
      stocks
        .filter((s) => (s.quantity || 0) > 0)
        .slice()
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 3),
    [stocks]
  );
  const bestScore = useMemo(
    () =>
      stocks
        .filter((s) => (s.quantity || 0) > 0)
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [stocks]
  );

  return (
    <div
      className="praxia-scroll pra-screen"
      key="analysis"
      style={{ position: "relative", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 16px 120px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 600, color: T.ink }}>
              Análise
            </div>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>
              visão central da carteira
            </div>
          </div>
          <button
            onClick={onOpenAlerts}
            aria-label="Alertas"
            style={{
              position: "relative",
              width: 38,
              height: 38,
              borderRadius: 19,
              background: "rgba(255,255,255,0.05)",
              border: `0.5px solid ${T.hairline}`,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon.bell size={17} color={T.ink70} />
            {activeAlertCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 8,
                  background: accent,
                  color: "white",
                  fontFamily: T.mono,
                  fontSize: 9,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {activeAlertCount > 99 ? "99+" : activeAlertCount}
              </span>
            )}
          </button>
        </div>

        {owned.length === 0 ? (
          <PraxiaCard raised padding={20}>
            <div style={{ fontFamily: T.display, fontSize: 22, color: T.ink, fontWeight: 600 }}>
              Adicione o primeiro ativo
            </div>
            <div style={{ marginTop: 8, fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.55 }}>
              A análise central precisa de posições com quantidade para calcular score, concentração e sugestões.
            </div>
            <button
              onClick={onAddStock}
              style={{
                marginTop: 14,
                width: "100%",
                height: 42,
                borderRadius: 12,
                border: "none",
                background: accent,
                color: "white",
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Adicionar ativo
            </button>
          </PraxiaCard>
        ) : (
          <>
            <PortfolioScoreHero
              score={score}
              totalValue={totalValue}
              todayChange={dailyChange}
              todayPct={todayPct}
              accent={accent}
            />

            <PraxiaCard padding={14}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <MiniMetric label="Retorno" value={fmt.pct(ytdPct)} color={ytdPct >= 0 ? T.up : T.down} />
                <MiniMetric label="Ativos" value={String(owned.length)} />
                <MiniMetric
                  label="Setor líder"
                  value={overweight ? `${overweight.pct.toFixed(0)}%` : "OK"}
                  sub={overweight?.label}
                  color={overweight ? T.warn : T.up}
                />
              </div>
            </PraxiaCard>

            <div>
              <SectionHeader label="Insights IA" />
              <PortfolioInsightsContent stocks={stocks} profile={profile} accent={accent} autoLoad />
            </div>

            <div>
              <SectionHeader label="Movimentos de hoje" />
              <PraxiaCard padding={4}>
                {movers.map((s, i) => (
                  <HoldingRow key={s.ticker} stock={s} onClick={() => onOpenStock(s)} isLast={i === movers.length - 1} />
                ))}
              </PraxiaCard>
            </div>

            <div>
              <SectionHeader label="Melhores scores" />
              <PraxiaCard padding={4}>
                {bestScore.map((s, i) => (
                  <ScoreRow
                    key={s.ticker}
                    stock={s}
                    isLast={i === bestScore.length - 1}
                    onOpen={() => onOpenStock(s)}
                    onCompare={() => onOpenCompare(s.ticker)}
                  />
                ))}
              </PraxiaCard>
            </div>

            {allocation.length > 0 && (
              <div>
                <SectionHeader label="Alocação setorial" />
                <PraxiaCard padding={16}>
                  <AllocationSummary data={allocation} />
                </PraxiaCard>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const T = PraxiaTokens;
  return (
    <div>
      <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>{label}</div>
      <div style={{ marginTop: 3, fontFamily: T.mono, fontSize: 14, color: color ?? T.ink, fontWeight: 700 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 2, fontFamily: T.body, fontSize: 9.5, color: T.ink30, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ScoreRow({
  stock,
  isLast,
  onOpen,
  onCompare,
}: {
  stock: Stock;
  isLast: boolean;
  onOpen: () => void;
  onCompare: () => void;
}) {
  const T = PraxiaTokens;
  const scoreColor = stock.score >= 70 ? T.up : stock.score >= 50 ? T.warn : T.down;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderBottom: isLast ? "none" : `0.5px solid ${T.hairline}`,
      }}
    >
      <button onClick={onOpen} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", color: T.ink, textAlign: "left", cursor: "pointer", padding: 0 }}>
        <div style={{ fontFamily: T.display, fontSize: 14.5, fontWeight: 600 }}>{stock.ticker}</div>
        <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {stock.name ?? stock.sector ?? stock.ticker}
        </div>
      </button>
      <DeltaPill value={stock.changePercent} />
      <div style={{ fontFamily: T.mono, fontSize: 13, color: scoreColor, fontWeight: 700, minWidth: 42, textAlign: "right" }}>
        {stock.score}
      </div>
      <button
        onClick={onCompare}
        aria-label={`Comparar ${stock.ticker}`}
        style={{ width: 30, height: 30, borderRadius: 15, border: `0.5px solid ${T.hairline}`, background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "grid", placeItems: "center" }}
      >
        <Icon.share size={13} color={T.ink50} />
      </button>
    </div>
  );
}

function AllocationSummary({ data }: { data: { label: string; pct: number; value: number; color: string }[] }) {
  const T = PraxiaTokens;
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
        {data.map((d) => (
          <div key={d.label} style={{ width: `${d.pct}%`, background: d.color }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.slice(0, 5).map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.body, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: T.ink70 }}>{d.label}</span>
            <span style={{ color: T.ink50, fontFamily: T.mono }}>{fmt.brl(d.value)}</span>
            <span style={{ color: T.ink, fontFamily: T.mono, fontWeight: 700, minWidth: 42, textAlign: "right" }}>
              {d.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
