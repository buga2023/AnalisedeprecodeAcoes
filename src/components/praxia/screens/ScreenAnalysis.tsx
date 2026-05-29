import { useMemo, useState } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { PraxiaCard } from "../PraxiaCard";
import { SectionHeader } from "../SectionHeader";
import { HoldingRow } from "../HoldingRow";
import { PortfolioScoreHero } from "../PortfolioScoreHero";
import { PortfolioInsightsContent } from "../PortfolioInsightsContent";
import { FeatureHintBanner } from "@/components/praxia/FeatureHintBanner";
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
  const worstScore = useMemo(() => {
    const owned_ = stocks.filter((s) => (s.quantity || 0) > 0);
    if (owned_.length < 2) return null;
    return owned_.slice().sort((a, b) => a.score - b.score)[0];
  }, [stocks]);
  const overweightTopStock = useMemo(() => {
    if (!overweight) return null;
    const inSector = owned.filter((s) => (s.sector ?? "Outros") === overweight.label);
    if (inSector.length === 0) return null;
    return inSector.slice().sort((a, b) => b.quantity * b.price - a.quantity * a.price)[0];
  }, [overweight, owned]);

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
              score, sinais e próximos passos
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

        <FeatureHintBanner hintKey="analysis" accent={accent} />

        {owned.length === 0 ? (
          <PraxiaCard raised padding={20}>
            <div style={{ fontFamily: T.display, fontSize: 22, color: T.ink, fontWeight: 600 }}>
              Sem posições ainda
            </div>
            <div style={{ marginTop: 8, fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.55 }}>
              Adicione pelo menos um ativo com quantidade pra liberar score 0–100, concentração setorial e sugestões da IA.
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
              Buscar primeiro ativo
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
                <MiniMetric
                  label="Retorno"
                  value={fmt.pct(ytdPct)}
                  color={ytdPct >= 0 ? T.up : T.down}
                  tip="Variação do valor de mercado vs. o custo total das suas compras (paper trading)."
                />
                <MiniMetric
                  label="Ativos"
                  value={String(owned.length)}
                  tip="Quantidade de tickers únicos com posição > 0."
                />
                <MiniMetric
                  label="Setor líder"
                  value={overweight ? `${overweight.pct.toFixed(0)}%` : "Balanceada"}
                  sub={overweight?.label ?? "sem peso ≥ 40%"}
                  color={overweight ? T.warn : T.up}
                  tip={
                    overweight
                      ? `${overweight.label} pesa ${overweight.pct.toFixed(0)}% da carteira. Concentração ≥ 40% reduz o score.`
                      : "Nenhum setor passa de 40% — boa diversificação setorial."
                  }
                />
              </div>
            </PraxiaCard>

            <div>
              <SectionHeader label="Insights IA" />
              <PortfolioInsightsContent stocks={stocks} profile={profile} accent={accent} autoLoad />
            </div>

            <NextStepsCard
              accent={accent}
              scoreTotal={score.total}
              overweight={overweight}
              overweightTopStock={overweightTopStock}
              worstScore={worstScore}
              bestScore={bestScore[0] ?? null}
              onAddStock={onAddStock}
              onOpenStock={onOpenStock}
              onOpenAlerts={onOpenAlerts}
              onOpenCompare={onOpenCompare}
            />

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

function MiniMetric({
  label,
  value,
  sub,
  color,
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  tip?: string;
}) {
  const T = PraxiaTokens;
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>
        <span>{label}</span>
        {tip && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={`Sobre ${label}`}
            style={{
              width: 14,
              height: 14,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon.info size={11} color={open ? (color ?? T.ink70) : T.ink30} />
          </button>
        )}
      </div>
      <div style={{ marginTop: 3, fontFamily: T.mono, fontSize: 14, color: color ?? T.ink, fontWeight: 700 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 2, fontFamily: T.body, fontSize: 9.5, color: T.ink30, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sub}
        </div>
      )}
      {tip && open && (
        <div
          style={{
            marginTop: 6,
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: `0.5px solid ${T.hairline}`,
            fontFamily: T.body,
            fontSize: 10.5,
            color: T.ink70,
            lineHeight: 1.45,
          }}
        >
          {tip}
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

interface NextStep {
  key: string;
  label: string;
  sub: string;
  tone: "warn" | "down" | "neutral";
  onClick: () => void;
}

function NextStepsCard({
  accent,
  scoreTotal,
  overweight,
  overweightTopStock,
  worstScore,
  bestScore,
  onAddStock,
  onOpenStock,
  onOpenAlerts,
  onOpenCompare,
}: {
  accent: string;
  scoreTotal: number;
  overweight: { label: string; pct: number } | null;
  overweightTopStock: Stock | null;
  worstScore: Stock | null;
  bestScore: Stock | null;
  onAddStock: () => void;
  onOpenStock: (s: Stock) => void;
  onOpenAlerts: () => void;
  onOpenCompare: (ticker: string) => void;
}) {
  const T = PraxiaTokens;
  const steps: NextStep[] = [];

  if (overweight && overweightTopStock) {
    steps.push({
      key: "overweight",
      label: `Reduzir exposição em ${overweight.label}`,
      sub: `${overweightTopStock.ticker} é a maior posição do setor (${overweight.pct.toFixed(0)}% da carteira)`,
      tone: "warn",
      onClick: () => onOpenStock(overweightTopStock),
    });
  }

  if (worstScore && bestScore && worstScore.ticker !== bestScore.ticker) {
    steps.push({
      key: "compare",
      label: `Comparar ${worstScore.ticker} com ${bestScore.ticker}`,
      sub: `pior score (${worstScore.score}) vs. melhor (${bestScore.score}) na carteira`,
      tone: "neutral",
      onClick: () => onOpenCompare(worstScore.ticker),
    });
  }

  if (scoreTotal < 50) {
    steps.push({
      key: "alerts",
      label: "Criar alerta de proteção",
      sub: "carteira em zona de risco — defina disparo por preço ou margem Graham",
      tone: "down",
      onClick: onOpenAlerts,
    });
  }

  if (steps.length === 0) {
    steps.push({
      key: "add",
      label: "Diversificar com novo ativo",
      sub: "carteira sólida — buscar oportunidades complementares no mercado",
      tone: "neutral",
      onClick: onAddStock,
    });
  }

  const toneColor = (tone: NextStep["tone"]) => (tone === "warn" ? T.warn : tone === "down" ? T.down : accent);

  return (
    <div>
      <SectionHeader label="Próximos passos" />
      <PraxiaCard padding={4}>
        {steps.map((step, i) => (
          <button
            key={step.key}
            onClick={step.onClick}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 12px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              borderBottom: i === steps.length - 1 ? "none" : `0.5px solid ${T.hairline}`,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: `${toneColor(step.tone)}1f`,
                border: `0.5px solid ${toneColor(step.tone)}55`,
                color: toneColor(step.tone),
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon.arrowUp size={12} color={toneColor(step.tone)} style={{ transform: "rotate(90deg)" }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.display, fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                {step.label}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: T.body,
                  fontSize: 11,
                  color: T.ink50,
                  lineHeight: 1.4,
                }}
              >
                {step.sub}
              </div>
            </span>
          </button>
        ))}
      </PraxiaCard>
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
