import { useMemo, useState } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { SectionHeader } from "../SectionHeader";
import type { Transaction } from "@/types/stock";
import { computeMonthlyTax, availableYears, type MonthlyTaxSummary } from "@/lib/tax";

// Importação dinâmica do exportador (depende de xlsx — chunk separado)
async function lazyExport(months: MonthlyTaxSummary[], year: number) {
  const { exportTaxReport } = await import("@/lib/exportTaxReport");
  exportTaxReport(months, year);
}

interface ScreenTaxReportProps {
  transactions: Transaction[];
  accent?: string;
  onBack: () => void;
}

export function ScreenTaxReport({ transactions, accent = PraxiaTokens.accent, onBack }: ScreenTaxReportProps) {
  const T = PraxiaTokens;

  const years = useMemo(() => availableYears(transactions), [transactions]);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(() => years[0] ?? currentYear);
  const [exporting, setExporting] = useState(false);

  const result = useMemo(
    () => computeMonthlyTax(transactions, selectedYear),
    [transactions, selectedYear]
  );

  const handleExport = async () => {
    if (exporting || result.months.length === 0) return;
    setExporting(true);
    try {
      await lazyExport(result.months, selectedYear);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="praxia-scroll pra-screen" style={{ position: "relative", height: "100dvh", overflowY: "auto", overflowX: "hidden" }}>
      <PraxiaBackground accent={accent} />
      <div style={{ position: "relative", zIndex: 2, padding: "54px 16px 120px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <GlassButton onClick={onBack} ariaLabel="Voltar"><Icon.arrowLeft size={16} color={T.ink70} /></GlassButton>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: -0.5 }}>
              Calculadora de IR
            </div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, marginTop: 1 }}>
              Imposto de Renda — ações B3 (paper trading)
            </div>
          </div>
        </div>

        {/* Aviso disclaimer */}
        <PraxiaCard
          padding={12}
          style={{
            background: "rgba(200,162,92,0.08)",
            border: `0.5px solid rgba(200,162,92,0.3)`,
            marginBottom: 16,
          }}
        >
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.gold, lineHeight: 1.4 }}>
            ⚑ Simulação de paper trading. Não constitui assessoria fiscal. Consulte um contador antes de emitir DARFs reais.
          </div>
        </PraxiaCard>

        {transactions.filter((t) => t.type === "sell").length === 0 ? (
          <PraxiaCard padding={28}>
            <div style={{ textAlign: "center", fontFamily: T.body, fontSize: 13, color: T.ink50, lineHeight: 1.5 }}>
              Nenhuma venda registrada ainda.
              <br />
              <span style={{ fontSize: 11.5 }}>O IR é calculado sobre operações de venda.</span>
            </div>
          </PraxiaCard>
        ) : (
          <>
            {/* Year picker + Export */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    style={{
                      height: 32,
                      padding: "0 14px",
                      borderRadius: 999,
                      background: selectedYear === y ? T.ink : "rgba(255,255,255,0.05)",
                      color: selectedYear === y ? T.bg : T.ink70,
                      border: selectedYear === y ? "none" : `0.5px solid ${T.hairline}`,
                      fontFamily: T.mono,
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void handleExport()}
                disabled={exporting || result.months.length === 0}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 10,
                  background: exporting ? "rgba(255,255,255,0.06)" : `${accent}1a`,
                  border: `0.5px solid ${accent}44`,
                  color: exporting ? T.ink50 : accent,
                  fontFamily: T.body,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: exporting ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <Icon.upload size={13} color={accent} />
                {exporting ? "…" : "Exportar"}
              </button>
            </div>

            {/* Resumo anual */}
            <SectionHeader label={`Resumo ${selectedYear}`} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              <SummaryCard label="IR Total do Ano" value={fmt.brl(result.totalTaxDue)} color={result.totalTaxDue > 0 ? T.down : T.up} />
              <SummaryCard label="Lucro Total" value={fmt.brl(result.totalProfit)} color={T.up} />
              <SummaryCard label="Prejuízo Total" value={fmt.brl(result.totalLoss)} color={T.ink50} />
              <SummaryCard
                label="Prejuízo a compensar"
                value={fmt.brl(result.swingCarryForward + result.dayTradeCarryForward + result.fiiCarryForward)}
                color={T.gold}
                sub="carryforward"
              />
            </div>

            {/* Regras */}
            <PraxiaCard padding={14} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>
                Regras aplicadas
              </div>
              <RuleRow icon="✓" label="Swing trade < R$20k/mês" desc="Isento (Lei 11.033/2004)" color={T.up} />
              <RuleRow icon="%" label="Swing trade ≥ R$20k" desc="15% sobre o lucro líquido" color={T.ink70} />
              <RuleRow icon="%" label="Day trade" desc="20% sobre o lucro (sem isenção)" color={T.ink70} />
              <RuleRow icon="%" label="FIIs — ganho de capital" desc="20% (rendimentos são isentos)" color={T.ink70} />
              <RuleRow icon="↩" label="Prejuízo" desc="Compensável em meses futuros (separado por categoria)" color={T.gold} />
            </PraxiaCard>

            {/* Meses */}
            {result.months.length === 0 ? (
              <PraxiaCard padding={20}>
                <div style={{ textAlign: "center", fontFamily: T.body, fontSize: 13, color: T.ink50 }}>
                  Nenhuma venda em {selectedYear}.
                </div>
              </PraxiaCard>
            ) : (
              <>
                <SectionHeader label="Por mês" />
                {result.months.map((m) => (
                  <MonthCard key={`${m.year}-${m.month}`} month={m} accent={accent} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const T = PraxiaTokens;
  return (
    <PraxiaCard padding={12}>
      <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink30, marginTop: 2 }}>{sub}</div>}
    </PraxiaCard>
  );
}

function RuleRow({ icon, label, desc, color }: { icon: string; label: string; desc: string; color: string }) {
  const T = PraxiaTokens;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
      <span style={{ fontFamily: T.mono, fontSize: 11, color, flexShrink: 0, width: 14, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50 }}>{desc}</div>
      </div>
    </div>
  );
}

function MonthCard({ month: m }: { month: MonthlyTaxSummary; accent: string }) {
  const T = PraxiaTokens;
  const [open, setOpen] = useState(false);
  const hasTax = m.totalTaxDue > 0;
  const hasActivity = m.trades.length > 0;

  return (
    <PraxiaCard padding={0} style={{ marginBottom: 8, overflow: "hidden" }}>
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "14px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          textAlign: "left",
        }}
      >
        {/* Status badge */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: hasTax ? `${T.down}18` : m.isExemptSwing && !hasActivity ? "rgba(255,255,255,0.05)" : `${T.up}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: hasTax ? T.down : T.up }}>
            {hasTax ? "R$" : "✓"}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, color: T.ink }}>
            {m.label}
          </div>
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, marginTop: 1 }}>
            {m.trades.length} operaç{m.trades.length === 1 ? "ão" : "ões"} · vendas {fmt.brl(m.totalSalesBRL)}
            {m.isExemptSwing && m.dayTradeProfit === 0 && m.fiiProfit === 0 && " · Isento"}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {hasTax ? (
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.down }}>
                {fmt.brl(m.totalTaxDue)}
              </div>
              <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>
                DARF {m.darfDueDate}
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.up }}>Isento</div>
          )}
        </div>

        <span style={{ color: T.ink30, fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: `0.5px solid ${T.hairline}`, padding: "12px 14px" }}>
          {/* Breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {m.swingProfit > 0 || m.swingLossThisMonth > 0 ? (
              <DetailRow
                label={`Swing trade${m.isExemptSwing ? " (isento)" : ""}`}
                profit={m.swingProfit}
                loss={m.swingLossThisMonth}
                tax={m.swingTaxDue}
                isExempt={m.isExemptSwing}
                carryUsed={m.swingCarryForwardUsed}
                T={T}
              />
            ) : null}
            {m.dayTradeProfit > 0 || m.dayTradeLossThisMonth > 0 ? (
              <DetailRow label="Day trade" profit={m.dayTradeProfit} loss={m.dayTradeLossThisMonth} tax={m.dayTradeTaxDue} T={T} />
            ) : null}
            {m.fiiProfit > 0 ? (
              <DetailRow label="FIIs" profit={m.fiiProfit} loss={0} tax={m.fiiTaxDue} T={T} />
            ) : null}
          </div>

          {/* Trades list */}
          {m.trades.length > 0 && (
            <>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                Operações
              </div>
              {m.trades.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 6,
                    marginBottom: 6,
                    borderBottom: i < m.trades.length - 1 ? `0.5px solid ${T.hairline}` : "none",
                  }}
                >
                  <div>
                    <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>{t.ticker}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink50, marginLeft: 6 }}>
                      {t.isDayTrade ? "DT" : t.isFII ? "FII" : "Swing"} · {t.date}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: t.profit >= 0 ? T.up : T.down }}>
                      {t.profit >= 0 ? "+" : ""}{fmt.brl(t.profit)}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink50 }}>
                      {t.shares}x @ {fmt.brl(t.sellPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* DARF info */}
          {hasTax && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                borderRadius: 10,
                background: `${T.down}10`,
                border: `0.5px solid ${T.down}33`,
              }}
            >
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink, fontWeight: 600, marginBottom: 2 }}>
                DARF a recolher: {fmt.brl(m.totalTaxDue)}
              </div>
              <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50 }}>
                Código 6015 · Vencimento {m.darfDueDate}
              </div>
            </div>
          )}
        </div>
      )}
    </PraxiaCard>
  );
}

function DetailRow({
  label, profit, loss, tax, isExempt, carryUsed, T,
}: {
  label: string;
  profit: number;
  loss: number;
  tax: number;
  isExempt?: boolean;
  carryUsed?: number;
  T: typeof PraxiaTokens;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink }}>{label}</div>
        {(carryUsed ?? 0) > 0 && (
          <div style={{ fontFamily: T.body, fontSize: 11, color: T.gold }}>
            Compensação: -{fmt.brl(carryUsed!)}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        {profit > 0 && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.up }}>+{fmt.brl(profit)}</div>}
        {loss > 0 && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink50 }}>-{fmt.brl(loss)}</div>}
        <div style={{ fontFamily: T.mono, fontSize: 12, color: isExempt ? T.up : tax > 0 ? T.down : T.ink50 }}>
          IR: {isExempt ? "Isento" : fmt.brl(tax)}
        </div>
      </div>
    </div>
  );
}
