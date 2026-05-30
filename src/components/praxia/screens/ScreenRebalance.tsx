import { useMemo, useState } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { FeatureHintBanner } from "@/components/praxia/FeatureHintBanner";
import type { Stock, InvestorProfile } from "@/types/stock";
import {
  generateRebalancePlan,
  suggestBalancedTargets,
  portfolioSectors,
  type RebalanceOrder,
  type RebalancePlan,
} from "@/lib/rebalance";
import {
  explicarRebalanceamento,
  type RebalanceExplicacaoIA,
} from "@/lib/ai";

interface ScreenRebalanceProps {
  accent?: string;
  stocks: Stock[];
  profile: InvestorProfile | null;
  onBack: () => void;
  /** Executa uma ordem (compra/venda) no paper-trading. Resolve true em sucesso. */
  onExecuteOrder: (order: RebalanceOrder) => Promise<boolean>;
  onAddStock?: () => void;
}

/** Alvos iniciais = alocação atual arredondada (ponto de partida neutro). */
function initialTargets(stocks: Stock[]): Record<string, number> {
  const sectors = portfolioSectors(stocks);
  if (sectors.length === 0) return {};
  // Usa a sugestão sem teto (perfil null) só pra arredondar a 100 a partir do atual.
  const plan = generateRebalancePlan(
    stocks,
    sectors.map((s) => ({ sector: s, pct: 0 }))
  );
  const total = plan.totalValue || 1;
  const raw = plan.sectors
    .filter((s) => s.currentValue > 0)
    .map((s) => ({ sector: s.sector, pct: (s.currentValue / total) * 100 }));
  // Arredonda mantendo soma 100.
  const floored = raw.map((r) => ({ ...r, p: Math.floor(r.pct), frac: r.pct - Math.floor(r.pct) }));
  let rem = 100 - floored.reduce((a, b) => a + b.p, 0);
  floored.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floored.length && rem > 0; i++, rem--) floored[i].p += 1;
  const out: Record<string, number> = {};
  for (const f of floored) out[f.sector] = f.p;
  return out;
}

export function ScreenRebalance({
  accent = PraxiaTokens.accent,
  stocks,
  profile,
  onBack,
  onExecuteOrder,
  onAddStock,
}: ScreenRebalanceProps) {
  const T = PraxiaTokens;

  const sectors = useMemo(() => portfolioSectors(stocks), [stocks]);
  const [targets, setTargets] = useState<Record<string, number>>(() => initialTargets(stocks));

  // Plano vivo (preview de gaps + contagem) recalculado conforme sliders mudam.
  const livePlan = useMemo<RebalancePlan>(
    () =>
      generateRebalancePlan(
        stocks,
        sectors.map((s) => ({ sector: s, pct: targets[s] ?? 0 }))
      ),
    [stocks, sectors, targets]
  );

  // Snapshot congelado das ordens ao clicar "Gerar plano" — estável durante execução.
  const [committed, setCommitted] = useState<RebalancePlan | null>(null);
  const [executed, setExecuted] = useState<Set<number>>(new Set());
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  // IA
  const [aiData, setAiData] = useState<RebalanceExplicacaoIA | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const sumTargets = useMemo(
    () => sectors.reduce((acc, s) => acc + (targets[s] ?? 0), 0),
    [sectors, targets]
  );
  const targetsOk = Math.abs(sumTargets - 100) <= 1;

  const setSectorTarget = (sector: string, pct: number) => {
    setTargets((prev) => ({ ...prev, [sector]: Math.max(0, Math.min(100, Math.round(pct))) }));
    setCommitted(null);
    setExecuted(new Set());
    setAiData(null);
  };

  const applySuggestion = () => {
    const sug = suggestBalancedTargets(stocks, profile);
    if (sug.length === 0) return;
    const next: Record<string, number> = {};
    for (const t of sug) next[t.sector] = t.pct;
    // Garante que todo setor presente tenha um valor.
    for (const s of sectors) if (next[s] == null) next[s] = 0;
    setTargets(next);
    setCommitted(null);
    setExecuted(new Set());
    setAiData(null);
  };

  const generate = () => {
    setCommitted(livePlan);
    setExecuted(new Set());
  };

  const runAI = async () => {
    const plan = committed ?? livePlan;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await explicarRebalanceamento(
        {
          totalValue: plan.totalValue,
          sectors: plan.sectors.map((s) => ({
            sector: s.sector,
            currentPct: s.currentPct,
            targetPct: s.targetPct,
          })),
          orders: plan.orders.map((o) => ({
            ticker: o.ticker,
            action: o.action,
            shares: o.shares,
            estValue: o.estValue,
            sector: o.sector,
            score: o.score,
          })),
          unmetSectors: plan.unmetSectors,
        },
        profile
      );
      setAiData(result);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Falha ao gerar explicação.");
    } finally {
      setAiLoading(false);
    }
  };

  const executeOrder = async (order: RebalanceOrder, idx: number) => {
    setBusyIdx(idx);
    const ok = await onExecuteOrder(order);
    if (ok) setExecuted((prev) => new Set(prev).add(idx));
    setBusyIdx(null);
  };

  const hasPositions = sectors.length > 0;

  return (
    <div
      className="praxia-scroll"
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
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: -0.4 }}>
              Rebalanceador
            </div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, marginTop: 2, letterSpacing: 0.2 }}>
              Defina o alvo por setor · ordens calculadas pelo app
            </div>
          </div>
        </div>

        <FeatureHintBanner hintKey="rebalance" accent={accent} />

        {/* Empty state */}
        {!hasPositions && (
          <PraxiaCard padding={20}>
            <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.55 }}>
              Você ainda não tem posições na carteira. Adicione ativos em{" "}
              <strong style={{ color: T.ink }}>Mercado</strong> para definir uma alocação-alvo e
              gerar ordens de rebalanceamento.
            </div>
            {onAddStock && (
              <button type="button" onClick={onAddStock} style={ctaStyle(accent, T)}>
                <Icon.plus size={14} color={accent} />
                Adicionar ativos
              </button>
            )}
          </PraxiaCard>
        )}

        {hasPositions && (
          <>
            {/* Card de alvos com sliders */}
            <PraxiaCard padding={16} raised>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, letterSpacing: 0.6, textTransform: "uppercase" }}>
                  Alocação-alvo por setor
                </div>
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: targetsOk ? T.up : T.warn,
                  }}
                >
                  {sumTargets.toFixed(0)}%
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                {sectors.map((sector) => {
                  const st = livePlan.sectors.find((s) => s.sector === sector);
                  const current = st?.currentPct ?? 0;
                  const target = targets[sector] ?? 0;
                  return (
                    <div key={sector}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontFamily: T.body, fontSize: 13, color: T.ink, fontWeight: 600 }}>{sector}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink70 }}>
                          <span style={{ color: T.ink50 }}>{current.toFixed(0)}%</span>
                          {" → "}
                          <span style={{ color: accent, fontWeight: 600 }}>{target.toFixed(0)}%</span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={target}
                        onChange={(e) => setSectorTarget(sector, Number(e.target.value))}
                        aria-label={`Alvo ${sector}`}
                        style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
                      />
                    </div>
                  );
                })}
              </div>

              {!targetsOk && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: `${T.warn}14`,
                    border: `0.5px solid ${T.warn}44`,
                    fontFamily: T.body,
                    fontSize: 11.5,
                    color: T.ink70,
                    lineHeight: 1.5,
                  }}
                >
                  Os alvos somam {sumTargets.toFixed(0)}% — ajuste para ~100% antes de gerar o plano.
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <button type="button" onClick={applySuggestion} style={secondaryStyle(T)}>
                  Sugerir equilíbrio
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={!targetsOk}
                  style={{ ...ctaStyle(accent, T), marginTop: 0, flex: 1, opacity: targetsOk ? 1 : 0.5, cursor: targetsOk ? "pointer" : "not-allowed" }}
                >
                  <Icon.refresh size={14} color={accent} />
                  Gerar plano
                </button>
              </div>
            </PraxiaCard>

            {/* Ordens */}
            {committed && (
              <>
                {committed.orders.length === 0 && committed.unmetSectors.length === 0 && (
                  <PraxiaCard padding={16}>
                    <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.5 }}>
                      Carteira já está alinhada aos alvos — nenhuma ordem necessária.
                    </div>
                  </PraxiaCard>
                )}

                {committed.orders.map((order, idx) => {
                  const isBuy = order.action === "buy";
                  const done = executed.has(idx);
                  return (
                    <PraxiaCard key={`${order.ticker}-${order.action}-${idx}`} padding={14}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                fontFamily: T.body,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: 0.6,
                                color: isBuy ? T.up : T.down,
                                textTransform: "uppercase",
                              }}
                            >
                              {isBuy ? "Comprar" : "Vender"}
                            </span>
                            <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.ink, letterSpacing: 0.3 }}>
                              {order.shares}× {order.ticker}
                            </span>
                          </div>
                          <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, marginTop: 3 }}>
                            {order.sector} · score {order.score}/100 · ~{fmt.brl(order.estValue)}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={done || busyIdx === idx}
                          onClick={() => void executeOrder(order, idx)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: `0.5px solid ${done ? T.up + "55" : T.hairlineStrong}`,
                            background: done ? `${T.up}1a` : "rgba(255,255,255,0.06)",
                            color: done ? T.up : T.ink,
                            fontFamily: T.body,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: done || busyIdx === idx ? "default" : "pointer",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {done && <Icon.check size={12} color={T.up} />}
                          {done ? "Executado" : busyIdx === idx ? "…" : "Executar"}
                        </button>
                      </div>
                    </PraxiaCard>
                  );
                })}

                {committed.unmetSectors.map((u) => (
                  <PraxiaCard key={u.sector} padding={13} style={{ opacity: 0.85 }}>
                    <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink70, lineHeight: 1.5 }}>
                      <strong style={{ color: T.ink }}>{u.sector}</strong>: faltam ~{fmt.brl(u.neededBRL)} para o
                      alvo, mas você não tem ativo desse setor. Adicione um em Mercado.
                    </div>
                  </PraxiaCard>
                ))}

                {/* Explicação IA */}
                {(committed.orders.length > 0 || committed.unmetSectors.length > 0) && (
                  <PraxiaCard padding={16}>
                    {!aiData && (
                      <button type="button" onClick={() => void runAI()} disabled={aiLoading} style={{ ...ctaStyle(accent, T), marginTop: 0 }}>
                        <Icon.chat size={14} color={accent} />
                        {aiLoading ? "Pra está analisando…" : "Explicar plano com a Pra"}
                      </button>
                    )}
                    {aiError && (
                      <div style={{ fontFamily: T.body, fontSize: 12, color: T.down, marginTop: aiData ? 0 : 10 }}>{aiError}</div>
                    )}
                    {aiData && (
                      <div>
                        <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.6 }}>{aiData.resumo}</div>
                        {aiData.alertas.length > 0 && (
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            {aiData.alertas.map((a, i) => (
                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: accent, flexShrink: 0 }} />
                                <span style={{ fontFamily: T.body, fontSize: 12, color: T.ink70, lineHeight: 1.5 }}>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {aiData.fontes.length > 0 && (
                          <div style={{ marginTop: 12, fontFamily: T.body, fontSize: 10.5, color: T.ink30, letterSpacing: 0.3 }}>
                            Fontes: {aiData.fontes.join(" · ")}
                          </div>
                        )}
                      </div>
                    )}
                  </PraxiaCard>
                )}
              </>
            )}

            <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink30, textAlign: "center", paddingTop: 4, letterSpacing: 0.3 }}>
              Ordens calculadas pelo app · rebalanceia entre seus ativos · execução em paper-trading
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ctaStyle(accent: string, T: typeof PraxiaTokens) {
  return {
    marginTop: 14,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: `linear-gradient(135deg, ${accent}26, ${accent}10)`,
    border: `0.5px solid ${accent}55`,
    color: T.ink,
    fontFamily: T.body,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.2,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as const;
}

function secondaryStyle(T: typeof PraxiaTokens) {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    border: `0.5px solid ${T.hairlineStrong}`,
    color: T.ink70,
    fontFamily: T.body,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  } as const;
}
