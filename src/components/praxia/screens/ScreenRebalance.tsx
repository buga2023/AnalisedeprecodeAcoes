import { useCallback, useMemo, useState } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { StockAvatar } from "../StockAvatar";
import { SectionHeader } from "../SectionHeader";
import type { InvestorProfile, Stock, Transaction } from "@/types/stock";
import { sectorAllocation, totalPortfolioValue } from "@/lib/portfolio";
import { generateRebalanceOrders, normalizePcts, type RebalanceOrder } from "@/lib/rebalance";
import { explicarRebalanceamento, type RebalanceExplicacao } from "@/lib/ai";

interface ScreenRebalanceProps {
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
  onBack: () => void;
  onApplyTransaction: (ticker: string, type: "buy" | "sell", shares: number, price: number) => Promise<boolean>;
  onRecord: (tx: Omit<Transaction, "id" | "timestamp">) => void;
}

export function ScreenRebalance({
  stocks,
  profile,
  accent = PraxiaTokens.accent,
  onBack,
  onApplyTransaction,
  onRecord,
}: ScreenRebalanceProps) {
  const T = PraxiaTokens;

  const owned = useMemo(() => stocks.filter((s) => (s.quantity ?? 0) > 0), [stocks]);
  const totalValue = useMemo(() => totalPortfolioValue(owned), [owned]);
  const slices = useMemo(() => sectorAllocation(owned), [owned]);

  // Inicializa targetPcts com a alocação atual (arredondada)
  const [targetPcts, setTargetPcts] = useState<Record<string, number>>(() =>
    Object.fromEntries(slices.map((s) => [s.label, Math.round(s.pct)]))
  );

  const [plan, setPlan] = useState<ReturnType<typeof generateRebalanceOrders> | null>(null);
  const [aiExpl, setAiExpl] = useState<RebalanceExplicacao | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [executed, setExecuted] = useState<Record<string, boolean>>({});

  const targetSum = useMemo(
    () => Object.values(targetPcts).reduce((s, v) => s + v, 0),
    [targetPcts]
  );

  const setTarget = useCallback((sector: string, val: number) => {
    setTargetPcts((prev) => ({ ...prev, [sector]: Math.max(0, Math.min(100, val)) }));
  }, []);

  const handleGenerate = useCallback(() => {
    const normalized = normalizePcts(targetPcts);
    const result = generateRebalanceOrders(owned, normalized);
    setPlan(result);
    setAiExpl(null);
    setExecuted({});
  }, [owned, targetPcts]);

  const handleAIComment = useCallback(async () => {
    if (!plan || loadingAI) return;
    setLoadingAI(true);
    try {
      const expl = await explicarRebalanceamento(plan.orders, profile);
      setAiExpl(expl);
    } catch {
      setAiExpl({
        comentario: "Não foi possível gerar comentário IA agora.",
        alertas: [],
        fontes: [],
      });
    } finally {
      setLoadingAI(false);
    }
  }, [plan, profile, loadingAI]);

  const executeOrder = useCallback(
    async (order: RebalanceOrder) => {
      const key = `${order.ticker}-${order.type}`;
      if (executing[key] || executed[key]) return;
      setExecuting((p) => ({ ...p, [key]: true }));
      try {
        const ok = await onApplyTransaction(order.ticker, order.type, order.shares, order.price);
        if (ok) {
          onRecord({
            ticker: order.ticker,
            type: order.type,
            orderType: "Mercado",
            shares: order.shares,
            price: order.price,
            total: order.estimatedValue,
            fee: 0,
          });
          setExecuted((p) => ({ ...p, [key]: true }));
        }
      } finally {
        setExecuting((p) => ({ ...p, [key]: false }));
      }
    },
    [executing, executed, onApplyTransaction, onRecord]
  );

  if (owned.length === 0) {
    return (
      <div className="praxia-scroll pra-screen" style={{ position: "relative", height: "100dvh", overflowY: "auto" }}>
        <PraxiaBackground accent={accent} />
        <div style={{ position: "relative", zIndex: 2, padding: "54px 16px 120px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <GlassButton onClick={onBack} ariaLabel="Voltar"><Icon.arrowLeft size={16} color={T.ink70} /></GlassButton>
            <span style={{ fontFamily: T.display, fontSize: 22, fontWeight: 600, color: T.ink }}>Rebalancear</span>
          </div>
          <PraxiaCard padding={24}>
            <div style={{ textAlign: "center", fontFamily: T.body, fontSize: 13, color: T.ink50 }}>
              Adicione ativos à carteira antes de rebalancear.
            </div>
          </PraxiaCard>
        </div>
      </div>
    );
  }

  return (
    <div className="praxia-scroll pra-screen" style={{ position: "relative", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <PraxiaBackground accent={accent} />
      <div style={{ position: "relative", zIndex: 2, padding: "54px 16px 120px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <GlassButton onClick={onBack} ariaLabel="Voltar"><Icon.arrowLeft size={16} color={T.ink70} /></GlassButton>
          <div>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: -0.5 }}>
              Rebalancear
            </div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, marginTop: 1 }}>
              {fmt.brl(totalValue)} · {owned.length} {owned.length === 1 ? "ativo" : "ativos"}
            </div>
          </div>
        </div>

        {/* Alocação atual */}
        <SectionHeader label="Alocação atual" />
        <PraxiaCard padding={14} style={{ marginBottom: 16 }}>
          {slices.map((s) => (
            <AllocationBar key={s.label} label={s.label} pct={s.pct} color={s.color} />
          ))}
        </PraxiaCard>

        {/* Sliders de alvo */}
        <SectionHeader label="Alocação alvo" />
        <PraxiaCard padding={14} style={{ marginBottom: 4 }}>
          {slices.map((s) => (
            <TargetRow
              key={s.label}
              label={s.label}
              currentPct={s.pct}
              targetPct={targetPcts[s.label] ?? 0}
              accent={s.color}
              onChange={(v) => setTarget(s.label, v)}
            />
          ))}
        </PraxiaCard>

        {/* Sum indicator */}
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11.5,
            color: Math.abs(targetSum - 100) > 1 ? T.down : T.ink50,
            textAlign: "right",
            marginBottom: 14,
            paddingRight: 4,
          }}
        >
          Total: {targetSum.toFixed(0)}% {Math.abs(targetSum - 100) > 1 ? "(será normalizado para 100%)" : "✓"}
        </div>

        {/* Gerar plano */}
        <button
          onClick={handleGenerate}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 14,
            background: accent,
            color: "#fff",
            border: "none",
            fontFamily: T.body,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          Gerar plano de rebalanceamento
        </button>

        {/* Results */}
        {plan && (
          <>
            {plan.orders.length === 0 ? (
              <PraxiaCard padding={20}>
                <div style={{ textAlign: "center", fontFamily: T.body, fontSize: 13, color: T.ink50 }}>
                  Carteira já está próxima do alvo. Nenhuma ordem necessária.
                </div>
              </PraxiaCard>
            ) : (
              <>
                <SectionHeader label={`${plan.orders.length} ordem${plan.orders.length > 1 ? "ns" : ""} sugerida${plan.orders.length > 1 ? "s" : ""}`} />
                {plan.orders.map((order) => {
                  const key = `${order.ticker}-${order.type}`;
                  return (
                    <OrderCard
                      key={key}
                      order={order}
                      executing={!!executing[key]}
                      executed={!!executed[key]}
                      onExecute={() => void executeOrder(order)}
                    />
                  );
                })}

                {/* IA Commentary */}
                {!aiExpl && !loadingAI && (
                  <button
                    onClick={() => void handleAIComment()}
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "12px 16px",
                      borderRadius: 12,
                      background: `${accent}12`,
                      border: `0.5px solid ${accent}44`,
                      color: accent,
                      fontFamily: T.body,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Icon.invest size={15} color={accent} />
                    Pedir análise da Pra sobre o plano
                  </button>
                )}

                {loadingAI && (
                  <div style={{ padding: "16px 0", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accent, display: "inline-block", animation: `praDot 1s ${i * 0.2}s infinite ease-in-out` }} />
                      ))}
                    </div>
                  </div>
                )}

                {aiExpl && (
                  <PraxiaCard
                    padding={14}
                    style={{
                      marginTop: 12,
                      background: `${accent}0d`,
                      border: `0.5px solid ${accent}33`,
                    }}
                  >
                    <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.5, marginBottom: aiExpl.alertas.length > 0 ? 12 : 0 }}>
                      {aiExpl.comentario}
                    </div>
                    {aiExpl.alertas.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {aiExpl.alertas.map((a, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ color: T.gold, fontFamily: T.mono, fontSize: 11, flexShrink: 0, marginTop: 2 }}>⚑</span>
                            <span style={{ fontFamily: T.body, fontSize: 12, color: T.ink70, lineHeight: 1.4 }}>{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiExpl.fontes.length > 0 && (
                      <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 10, color: T.ink30 }}>
                        Fontes: {aiExpl.fontes.join(" · ")}
                      </div>
                    )}
                  </PraxiaCard>
                )}
              </>
            )}

            {plan.ungrouped.length > 0 && (
              <div style={{ marginTop: 12, fontFamily: T.body, fontSize: 11.5, color: T.ink50 }}>
                Setores sem ativo elegível para negociar: {plan.ungrouped.join(", ")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AllocationBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const T = PraxiaTokens;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: T.body, fontSize: 12, color: T.ink70 }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function TargetRow({
  label,
  currentPct,
  targetPct,
  accent,
  onChange,
}: {
  label: string;
  currentPct: number;
  targetPct: number;
  accent: string;
  onChange: (v: number) => void;
}) {
  const T = PraxiaTokens;
  const delta = targetPct - currentPct;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, fontFamily: T.body, fontSize: 13, color: T.ink }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink50 }}>
          atual {currentPct.toFixed(1)}%
        </span>
        {Math.abs(delta) > 0.5 && (
          <span style={{ fontFamily: T.mono, fontSize: 11, color: delta > 0 ? T.up : T.down }}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
          </span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "2px 8px",
          }}
        >
          <button
            onClick={() => onChange(targetPct - 5)}
            style={{ background: "none", border: "none", color: T.ink50, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
          >−</button>
          <span style={{ fontFamily: T.mono, fontSize: 13, color: T.ink, minWidth: 36, textAlign: "center" }}>
            {targetPct.toFixed(0)}%
          </span>
          <button
            onClick={() => onChange(targetPct + 5)}
            style={{ background: "none", border: "none", color: T.ink50, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
          >+</button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={targetPct}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: accent,
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function OrderCard({
  order,
  executing,
  executed,
  onExecute,
}: {
  order: RebalanceOrder;
  executing: boolean;
  executed: boolean;
  onExecute: () => void;
}) {
  const T = PraxiaTokens;
  const isBuy = order.type === "buy";
  const color = isBuy ? T.up : T.down;

  return (
    <PraxiaCard padding={14} style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StockAvatar ticker={order.ticker} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, color: T.ink }}>{order.ticker}</span>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: 999,
                background: `${color}1a`,
                border: `0.5px solid ${color}55`,
                fontFamily: T.mono,
                fontSize: 10,
                fontWeight: 700,
                color,
              }}
            >
              {isBuy ? "COMPRAR" : "VENDER"}
            </span>
          </div>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, lineHeight: 1.35 }}>
            {order.shares} cota{order.shares > 1 ? "s" : ""} · {fmt.brl(order.price)}/un · {fmt.brl(order.estimatedValue)}
          </div>
          <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink30, marginTop: 2 }}>
            {order.reason}
          </div>
        </div>
        <button
          onClick={onExecute}
          disabled={executing || executed}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 999,
            background: executed ? "rgba(127,183,150,0.15)" : executing ? "rgba(255,255,255,0.06)" : isBuy ? `${T.up}22` : `${T.down}22`,
            border: `0.5px solid ${executed ? T.up : executing ? T.hairline : color}55`,
            color: executed ? T.up : color,
            fontFamily: T.body,
            fontWeight: 700,
            fontSize: 12,
            cursor: executed || executing ? "default" : "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {executed ? "✓ Ok" : executing ? "..." : "Executar"}
        </button>
      </div>
    </PraxiaCard>
  );
}
