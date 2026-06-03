import * as XLSX from "xlsx";
import type { MonthlyTaxSummary } from "@/lib/tax";

export function exportTaxReport(months: MonthlyTaxSummary[], year: number): void {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Resumo mensal ──────────────────────────────────────────────────
  const summary = months.map((m) => ({
    "Mês": m.label,
    "Total Vendas (R$)": m.totalSalesBRL.toFixed(2),
    "Lucro Swing (R$)": m.swingProfit.toFixed(2),
    "Prejuízo Swing (R$)": m.swingLossThisMonth.toFixed(2),
    "Compensação CF (R$)": m.swingCarryForwardUsed.toFixed(2),
    "Base Tributável Swing (R$)": m.taxableSwing.toFixed(2),
    "Isento (< R$20k)": m.isExemptSwing ? "SIM" : "NÃO",
    "IR Swing 15% (R$)": m.swingTaxDue.toFixed(2),
    "Lucro Day Trade (R$)": m.dayTradeProfit.toFixed(2),
    "IR Day Trade 20% (R$)": m.dayTradeTaxDue.toFixed(2),
    "Lucro FIIs (R$)": m.fiiProfit.toFixed(2),
    "IR FIIs 20% (R$)": m.fiiTaxDue.toFixed(2),
    "Total IR a Pagar (R$)": m.totalTaxDue.toFixed(2),
    "Código DARF": m.totalTaxDue > 0 ? "6015" : "—",
    "Vencimento DARF": m.totalTaxDue > 0 ? m.darfDueDate : "—",
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // ── Aba 2: Operações detalhadas ───────────────────────────────────────────
  const trades = months.flatMap((m) =>
    m.trades.map((t) => ({
      "Mês": m.label,
      "Data": t.date,
      "Ticker": t.ticker,
      "Tipo": t.isDayTrade ? "Day Trade" : t.isFII ? "FII" : "Swing Trade",
      "Cotas": t.shares,
      "Preço Venda (R$)": t.sellPrice.toFixed(2),
      "Custo Médio (R$)": t.avgCost.toFixed(2),
      "Valor Total Venda (R$)": t.saleValue.toFixed(2),
      "Lucro/Prejuízo (R$)": t.profit.toFixed(2),
      "Isento": !t.isDayTrade && !t.isFII && t.saleValue < 20_000 ? "SIM" : "NÃO",
    }))
  );

  if (trades.length > 0) {
    const wsDetail = XLSX.utils.json_to_sheet(trades);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Operações");
  }

  // ── Aba 3: Orientações ────────────────────────────────────────────────────
  const notes = [
    ["AVISO IMPORTANTE"],
    ["Este relatório é gerado com base em operações de paper-trading simuladas no Praxia."],
    ["Não constitui assessoria fiscal ou financeira. Consulte um contador ou a Receita Federal."],
    [""],
    ["Regras aplicadas neste relatório:"],
    [`  - Swing trade: isenção para vendas mensais < R$${(20000).toLocaleString("pt-BR")}; alíquota 15% sobre o lucro quando ≥ R$20.000.`],
    ["  - Day trade: alíquota 20%, sem isenção. Detectado automaticamente (compra e venda no mesmo dia)."],
    ["  - FIIs: alíquota 20% sobre ganho de capital. Rendimentos distribuídos são isentos (não rastreados aqui)."],
    ["  - Prejuízo de swing trade compensa lucros futuros de swing trade (carryforward)."],
    ["  - DARF mínimo: R$10 (abaixo disso, o valor não é exibido e deve ser acumulado)."],
    [""],
    ["Fontes: legislação brasileira (Lei 11.033/2004, IN RFB 1.585/2015), código DARF 6015."],
    [`Exportado em: ${new Date().toLocaleDateString("pt-BR")} — Praxia app (paper-trading, ano ${year})`],
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet(notes);
  XLSX.utils.book_append_sheet(wb, wsNotes, "Orientações");

  XLSX.writeFile(wb, `praxia-ir-${year}.xlsx`);
}
