import { useMemo } from "react";
import { PraxiaTokens, fmt, genSeries } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { PraxiaLogo } from "../PraxiaLogo";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import { AreaChart } from "../Charts";
import { SectionHeader } from "../SectionHeader";
import { HoldingRow } from "../HoldingRow";
import { DeltaPill } from "../Tag";
import { MacroQuotesStrip } from "../MacroQuotesStrip";
import { DisclaimerBar } from "../DisclaimerBar";
import { WeeklyPerformanceCard } from "../WeeklyPerformanceCard";
import type { Stock, InvestorProfile } from "@/types/stock";
import {
  sectorAllocation,
  todayChangeValue,
  totalCostBasis,
  totalPortfolioValue,
  dominantSector,
} from "@/lib/portfolio";
import { riskLabel } from "@/hooks/useInvestorProfile";

interface ScreenHomeProps {
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
  onOpenStock: (s: Stock) => void;
  onSeeAllHoldings: () => void;
  onAddStock: () => void;
  onOpenInsights?: () => void;
  onOpenProfile?: () => void;
  onOpenChat?: () => void;
  onOpenAlerts?: () => void;
  onOpenNews?: () => void;
  activeAlertCount?: number;
}

export function ScreenHome({
  stocks,
  profile,
  accent = PraxiaTokens.accent,
  onOpenStock,
  onSeeAllHoldings,
  onAddStock,
  onOpenInsights,
  onOpenProfile,
  onOpenChat,
  onOpenAlerts,
  onOpenNews,
  activeAlertCount = 0,
}: ScreenHomeProps) {
  const T = PraxiaTokens;

  const totalValue = useMemo(() => totalPortfolioValue(stocks), [stocks]);
  const totalCost = useMemo(() => totalCostBasis(stocks), [stocks]);
  const dailyChange = useMemo(() => todayChangeValue(stocks), [stocks]);
  const ytdPct = useMemo(() => {
    if (totalCost <= 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  }, [totalValue, totalCost]);
  const todayPct = useMemo(() => {
    const prev = totalValue - dailyChange;
    return prev > 0 ? (dailyChange / prev) * 100 : 0;
  }, [totalValue, dailyChange]);

  const series = useMemo(() => {
    // Synthetic series anchored at current value if no history available
    return genSeries(7, 60, Math.max(1000, totalValue || 1000), 0.012, ytdPct >= 0 ? 0.0008 : -0.0006);
  }, [totalValue, ytdPct]);

  // Last 7 entries of the synthetic series → bar chart values, with the
  // current weekday labels rotated so "today" lands on the last bar.
  const weekValues = useMemo(() => series.slice(-7), [series]);
  const weekLabels = useMemo<[string, string, string, string, string, string, string]>(() => {
    const dow = ["D", "S", "T", "Q", "Q", "S", "S"];
    const today = new Date().getDay();
    const rotated: string[] = [];
    for (let i = 0; i < 7; i++) {
      rotated.push(dow[(today - 6 + i + 7) % 7]);
    }
    return rotated as [string, string, string, string, string, string, string];
  }, []);

  const allocation = useMemo(() => sectorAllocation(stocks), [stocks]);
  const overweight = useMemo(() => dominantSector(stocks), [stocks]);
  const holdings = stocks.slice(0, 4);

  return (
    <div
      className="praxia-scroll pra-screen"
      key="home"
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
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px",
            marginBottom: 4,
          }}
        >
          <GlassButton onClick={onOpenProfile} ariaLabel="Abrir perfil">
            <Icon.menu size={18} color={T.ink70} />
          </GlassButton>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PraxiaLogo size={18} accent={accent} />
            <span
              style={{
                fontFamily: T.display,
                fontSize: 13.5,
                fontWeight: 600,
                color: T.ink70,
                letterSpacing: 0.2,
              }}
            >
              Praxia
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {onOpenNews && (
              <GlassButton onClick={onOpenNews} ariaLabel="Notícias">
                <Icon.feed size={18} color={T.ink70} />
              </GlassButton>
            )}
            {onOpenAlerts && (
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
                <Icon.bell size={18} color={T.ink70} />
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
                      boxShadow: `0 4px 10px ${accent}aa`,
                    }}
                  >
                    {activeAlertCount > 99 ? "99+" : activeAlertCount}
                  </span>
                )}
              </button>
            )}
            <GlassButton onClick={onOpenChat} ariaLabel="Falar com a Pra">
              <Icon.chat size={18} color={T.ink70} />
            </GlassButton>
          </div>
        </div>

        {/* macro quotes strip */}
        <MacroQuotesStrip />

        {/* portfolio hero */}
        <PraxiaCard
          raised
          padding={22}
          style={{
            background: `
              radial-gradient(120% 90% at 80% -10%, ${accent}33 0%, transparent 60%),
              linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)
            `,
            paddingBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12,
              color: T.ink50,
              fontWeight: 500,
              letterSpacing: 0.2,
            }}
          >
            Patrimônio investido
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: T.display,
              fontSize: 40,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -1.4,
              lineHeight: 1.05,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt.brl(totalValue)}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: T.body,
              fontSize: 13,
              flexWrap: "wrap",
            }}
          >
            <DeltaPill value={ytdPct} />
            <span style={{ color: T.ink50 }}>
              {dailyChange >= 0 ? "+" : ""}
              {fmt.brl(Math.abs(dailyChange))} hoje ({fmt.pct(todayPct)})
            </span>
          </div>

          <div style={{ marginTop: 14, marginLeft: -8, marginRight: -8 }}>
            <AreaChart
              values={series}
              w={356}
              h={70}
              color={accent}
              fillId="hero-fill"
              strokeWidth={2}
            />
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <HeroAction
              icon={<Icon.invest size={18} color={accent} />}
              label="Investir"
              onClick={onAddStock}
            />
            <HeroAction
              icon={<Icon.shield size={18} color={accent} />}
              label="Análise"
              onClick={onOpenInsights}
              disabled={stocks.length === 0}
            />
            <HeroAction
              icon={<Icon.chat size={18} color={accent} />}
              label="Pra"
              onClick={onOpenChat}
            />
          </div>
        </PraxiaCard>

        {/* Global disclaimer */}
        <DisclaimerBar accent={accent} />

        {/* AI insight */}
        <AIInsightCard
          accent={accent}
          profile={profile}
          stocks={stocks}
          overweightSector={overweight?.label}
          overweightPct={overweight?.pct ?? 0}
          onOpenInsights={onOpenInsights}
        />

        {/* Weekly performance — bar chart with active day tooltip */}
        {stocks.length > 0 && (
          <WeeklyPerformanceCard
            accent={accent}
            values={weekValues}
            labels={weekLabels}
          />
        )}

        {/* Holdings */}
        <div>
          <SectionHeader label="Minhas posições" trailing="Ver todas" onTrailingClick={onSeeAllHoldings} />
          {holdings.length === 0 ? (
            <PraxiaCard padding={20}>
              <div
                style={{
                  fontFamily: T.body,
                  fontSize: 13,
                  color: T.ink70,
                  textAlign: "center",
                }}
              >
                Você ainda não tem ativos.{" "}
                <button
                  onClick={onAddStock}
                  style={{
                    background: "none",
                    border: "none",
                    color: accent,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: T.body,
                    fontSize: 13,
                  }}
                >
                  Adicionar a primeira
                </button>
                .
              </div>
            </PraxiaCard>
          ) : (
            <PraxiaCard padding={4}>
              {holdings.map((s, i) => (
                <HoldingRow
                  key={s.ticker}
                  stock={s}
                  onClick={() => onOpenStock(s)}
                  isLast={i === holdings.length - 1}
                />
              ))}
            </PraxiaCard>
          )}
        </div>

        {/* Allocation */}
        {allocation.length > 0 && (
          <div>
            <SectionHeader label="Alocação por setor" />
            <PraxiaCard padding={18}>
              <AllocationBars data={allocation} />
            </PraxiaCard>
          </div>
        )}

        {profile && (
          <div
            style={{
              fontFamily: T.body,
              fontSize: 11,
              color: T.ink30,
              textAlign: "center",
              paddingTop: 4,
            }}
          >
            Perfil: {riskLabel(profile.risk)} · curadoria da Pra ativada
          </div>
        )}
      </div>
    </div>
  );
}

function HeroAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const T = PraxiaTokens;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 64,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        border: `0.5px solid ${T.hairline}`,
        color: T.ink,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        fontFamily: T.body,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <div>{icon}</div>
      <div style={{ color: T.ink70, fontSize: 11.5 }}>{label}</div>
    </button>
  );
}

function AllocationBars({
  data,
}: {
  data: { label: string; pct: number; value: number; color: string }[];
}) {
  const T = PraxiaTokens;
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {data.map((d) => (
          <div key={d.label} style={{ width: `${d.pct}%`, background: d.color }} />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 16px",
        }}
      >
        {data.map((d) => (
          <div
            key={d.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: T.body,
              fontSize: 12.5,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: d.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, color: T.ink70 }}>{d.label}</div>
            <div
              style={{
                color: T.ink,
                fontWeight: 600,
                fontFamily: T.mono,
                fontSize: 12,
              }}
            >
              {d.pct.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIInsightCard({
  accent,
  profile,
  stocks,
  overweightSector,
  overweightPct,
  onOpenInsights,
}: {
  accent: string;
  profile: InvestorProfile | null;
  stocks: Stock[];
  overweightSector?: string;
  overweightPct: number;
  onOpenInsights?: () => void;
}) {
  const T = PraxiaTokens;
  const empty = stocks.length === 0;
  const risk = profile ? riskLabel(profile.risk).toLowerCase() : "moderado";

  let message: React.ReactNode;
  if (empty) {
    message = (
      <>
        Vamos começar montando sua carteira? Adicione algumas ações e eu monto uma análise
        personalizada pro seu perfil <b style={{ color: accent }}>{risk}</b>.
      </>
    );
  } else if (overweightSector) {
    message = (
      <>
        Sua carteira está <b style={{ color: accent }}>{overweightPct.toFixed(0)}% em {overweightSector}</b>.
        Pelo seu perfil {risk}, talvez valha diversificar em setores menos correlacionados.
      </>
    );
  } else {
    message = (
      <>
        Carteira diversificada por enquanto. Quer que eu sugira posições alinhadas ao seu
        perfil <b style={{ color: accent }}>{risk}</b> com interesse em{" "}
        {(profile?.interests ?? []).slice(0, 2).join(", ") || "dividendos"}?
      </>
    );
  }

  return (
    <PraxiaCard
      padding={16}
      style={{
        background: `linear-gradient(160deg, ${accent}1f 0%, ${accent}08 60%, rgba(255,255,255,0.01) 100%)`,
        border: `0.5px solid ${accent}44`,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0 }}>
          <PraMark size={38} accent={accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 13.5,
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
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                border: `0.5px solid ${T.hairline}`,
                letterSpacing: 0.6,
              }}
              title="Heurística do app — sem IA. A IA fica no chat (botão azul) e na análise completa."
            >
              NÃO É IA
            </div>
            <div style={{ fontSize: 11, color: T.ink30, fontFamily: T.body }}>
              · agora
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: T.body,
              fontSize: 13.5,
              color: T.ink,
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink50,
              letterSpacing: 0.4,
            }}
          >
            fonte: cálculo do app (alocação setorial) + perfil do usuário
          </div>
          {onOpenInsights && stocks.length > 0 && (
            <button
              onClick={onOpenInsights}
              style={{
                marginTop: 12,
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "white",
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
                boxShadow: `0 6px 18px ${accent}55`,
              }}
            >
              Gerar análise IA completa (com fontes)
            </button>
          )}
        </div>
      </div>
    </PraxiaCard>
  );
}
